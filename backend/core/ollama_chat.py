import ollama
import base64
import cv2
import tempfile
import os
from typing import List, Dict, Optional, Tuple
import logging

class OllamaChat:
    def __init__(self, model_name: str = "qwen2.5-vl:7b-instruct-q4_K_M", base_url: str = "http://localhost:11434", timeout: float = 120.0):
        """
        Initialize Ollama chat interface.
        
        Args:
            model_name (str): Name of the Ollama model to use
            base_url (str): Ollama server URL
            timeout (float): Request timeout in seconds
        """
        self.model_name = model_name
        self.base_url = base_url
        self.timeout = timeout
        self.logger = logging.getLogger(__name__)
        
        # Create ollama client with custom base_url
        self.client = ollama.Client(host=base_url)
        
    def check_connection(self) -> Tuple[bool, str]:
        """
        Check if Ollama is running and the model is available.
        
        Returns:
            tuple: (is_available, message)
        """
        try:
            # List available models using the client
            models = self.client.list()
            
            # Debug log the response
            self.logger.info(f"Ollama models response: {models}")
            
            # Extract model names safely
            model_list = models.get('models', [])
            model_names = []
            
            for model in model_list:
                # Handle different response formats
                if isinstance(model, dict):
                    # Dictionary format
                    if 'name' in model:
                        model_names.append(model['name'])
                    elif 'model' in model:
                        model_names.append(model['model'])
                elif isinstance(model, str):
                    # String format
                    model_names.append(model)
                else:
                    # Object format (has attributes)
                    try:
                        if hasattr(model, 'model'):
                            model_names.append(model.model)
                        elif hasattr(model, 'name'):
                            model_names.append(model.name)
                    except:
                        pass
            
            if not model_names:
                return False, f"Ollama is running but no models found. Server response: {models}"
            
            # Check if our model is available
            if self.model_name in model_names or any(self.model_name in name for name in model_names):
                return True, f"Model {self.model_name} is available. Connected to {self.base_url}"
            else:
                return False, f"Model {self.model_name} not found. Available models: {', '.join(model_names)}"
                
        except Exception as e:
            self.logger.error(f"Ollama connection error: {e}", exc_info=True)
            return False, f"Ollama connection error: {str(e)}"
    
    def encode_image(self, image_path: str) -> str:
        """
        Encode image to base64 string.
        
        Args:
            image_path (str): Path to image file
            
        Returns:
            str: Base64 encoded image
        """
        with open(image_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    
    def get_system_context(self) -> str:
        """
        Retrieve system context from database to augment AI knowledge.
        Returns:
            str: System context prompt
        """
        try:
            from db import database
            conn = database.get_db_connection()
            cur = conn.cursor()
            
            # 1. Get Employee Stats
            cur.execute("SELECT COUNT(*) FROM employees")
            total_employees = cur.fetchone()[0]
            
            cur.execute("SELECT employee_id, full_name, position, department FROM employees LIMIT 10")
            employees = cur.fetchall()
            employee_list = "\n".join([f"- {e[1]} ({e[0]}), {e[2]} - {e[3]}" for e in employees])
            
            # 2. Get Today's Attendance Stats
            from datetime import datetime
            today = datetime.now().strftime('%Y-%m-%d')
            cur.execute("SELECT COUNT(*) FROM attendance_logs WHERE date = ?", (today,))
            present_today = cur.fetchone()[0]
            
            # 3. Get recent logs
            cur.execute("""
                SELECT employee_id, check_in, status 
                FROM attendance_logs 
                WHERE date = ? 
                ORDER BY check_in DESC LIMIT 5
            """, (today,))
            recent_logs = cur.fetchall()
            logs_text = "\n".join([f"- {l[0]} check-in lúc {l[1]} ({l[2]})" for l in recent_logs])
            
            conn.close()
            
            context = f"""
SYSTEM CONTEXT (Factory Attendance System):
- Date: {today}
- Total Employees: {total_employees}
- Present Today: {present_today}

Recent Employees:
{employee_list}

Latest Attendance Activity:
{logs_text}

INSTRUCTIONS: 
You are an AI Assistant for the Factory Attendance System. 
Use the above REAL-TIME DATA to answer user questions.
If asked about employees, attendance, or system status, refer to this data.
If the answer is not in the data, state that you don't have that specific information.
"""
            return context
            
        except Exception as e:
            self.logger.error(f"Failed to get system context: {e}")
            return "You are an AI Assistant for the Factory Attendance System."

    def chat(self, message: str, conversation_history: List[Dict] = None, image_paths: List[str] = None, use_system_context: bool = False) -> str:
        """
        Send a chat message with optional images.
        """
        try:
            # Build messages array
            messages = conversation_history or []
            
            # Inject system context if requested and not present
            if use_system_context:
                system_role_exists = any(m.get('role') == 'system' for m in messages)
                if not system_role_exists:
                    system_context = self.get_system_context()
                    messages.insert(0, {
                        'role': 'system',
                        'content': system_context
                    })
            
            # Add current message
            current_message = {
                'role': 'user',
                'content': message
            }
            
            # Add images if provided - convert to base64 for remote servers
            if image_paths:
                base64_images = []
                for img_path in image_paths:
                    try:
                        with open(img_path, 'rb') as f:
                            img_data = base64.b64encode(f.read()).decode('utf-8')
                            base64_images.append(img_data)
                    except Exception as e:
                        self.logger.error(f"Failed to encode image {img_path}: {e}")
                
                if base64_images:
                    current_message['images'] = base64_images
            
            messages.append(current_message)
            
            # Call Ollama chat using client instance with timeout
            response = self.client.chat(
                model=self.model_name,
                messages=messages,
                options={
                    'timeout': self.timeout
                }
            )
            
            return response['message']['content']
            
        except Exception as e:
            self.logger.error(f"Ollama chat error: {e}")
            raise Exception(f"Chat error: {str(e)}")
    
    def process_video(self, video_path: str, question: str, frame_interval: int = 30) -> str:
        """
        Process a video by extracting frames and analyzing them.
        
        Args:
            video_path (str): Path to video file
            question (str): Question about the video
            frame_interval (int): Extract one frame every N frames
            
        Returns:
            str: Analysis result
        """
        try:
            # Open video
            cap = cv2.VideoCapture(video_path)
            frame_count = 0
            extracted_frames = []
            temp_dir = tempfile.mkdtemp()
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                if frame_count % frame_interval == 0:
                    # Save frame
                    frame_path = os.path.join(temp_dir, f"frame_{frame_count}.jpg")
                    cv2.imwrite(frame_path, frame)
                    extracted_frames.append(frame_path)
                    
                    # Limit to 10 frames to avoid token limits
                    if len(extracted_frames) >= 10:
                        break
                
                frame_count += 1
            
            cap.release()
            
            if not extracted_frames:
                return "No frames could be extracted from the video."
            
            # Analyze frames with the question
            prompt = f"Analyze these video frames and answer: {question}"
            response = self.chat(prompt, image_paths=extracted_frames)
            
            # Cleanup temp files
            for frame_path in extracted_frames:
                try:
                    os.remove(frame_path)
                except:
                    pass
            try:
                os.rmdir(temp_dir)
            except:
                pass
            
            return response
            
        except Exception as e:
            self.logger.error(f"Video processing error: {e}")
            raise Exception(f"Video processing error: {str(e)}")
