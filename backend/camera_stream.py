import cv2
import threading
import time
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from ultralytics import YOLO
import database
from PIL import Image, ImageDraw, ImageFont

class CameraStream:
    def __init__(self):
        # Load settings from DB
        self.settings = database.get_settings()
        src = self.settings.get('camera_src', '0')
        try:
            src = int(src)
        except:
            pass
            
        # Initialize Camera
        self.capture = cv2.VideoCapture(src)
        self.current_src = src
        
        if not self.capture.isOpened():
            print(f"ERROR: Could not open video source {src}")
        else:
            print(f"SUCCESS: Video source {src} opened")

        self.is_running = False
        self.frame = None
        self.thread = None
        self.lock = threading.Lock()
        
        # Initialize InsightFace
        print("Initializing InsightFace analysis...")
        self.app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        
        # Load known faces from DB
        self.known_embeddings = []
        self.known_names = []
        self.reload_faces()

        # Initialize YOLO for phone detection
        print("Initializing YOLOv8 for object detection...")
        self.yolo = YOLO('yolov8n.pt')
        
        # Font for Vietnamese labels
        self.font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
        
        # Time tracking for phone usage
        self.last_frame_time = time.time()

    def reload_faces(self):
        """Reload employees from database."""
        employees = database.get_all_employees_with_embeddings()
        self.known_embeddings = [u['embedding'] for u in employees]
        self.known_employee_ids = [u['id'] for u in employees]
        self.known_names = [u['name'] for u in employees]
        self.last_attendance_log = {} # employee_id -> last_log_time
        print(f"Loaded {len(self.known_embeddings)} employees from database.")

    def update_settings(self):
        """Fetch updated settings from DB."""
        new_settings = database.get_settings()
        
        # Check if camera source changed
        new_src = new_settings.get('camera_src', '0')
        try:
            new_src = int(new_src)
        except:
            pass
            
        if new_src != self.current_src:
            print(f"Changing camera source to {new_src}...")
            with self.lock:
                self.capture.release()
                self.capture = cv2.VideoCapture(new_src)
                self.current_src = new_src
                if not self.capture.isOpened():
                    print(f"ERROR: Could not open new video source {new_src}")
                else:
                    print(f"SUCCESS: New video source {new_src} opened")
        
        self.settings = new_settings

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self.update, args=())
        self.thread.daemon = True
        self.thread.start()

    def update(self):
        while self.is_running:
            ret, frame = self.capture.read()
            if ret:
                with self.lock:
                    self.frame = frame
            time.sleep(0.01)

    def get_frame(self):
        with self.lock:
            if self.frame is None:
                return None
            return self.frame.copy()
            
    def compute_sim(self, feat1, feat2):
        return np.dot(feat1, feat2) / (np.linalg.norm(feat1) * np.linalg.norm(feat2))

    def draw_unicode_text(self, img, text, pos, color, size=20):
        """Helper to draw Unicode (Vietnamese) text on frame using Pillow."""
        img_pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(img_pil)
        try:
            font = ImageFont.truetype(self.font_path, size)
        except:
            font = ImageFont.load_default()
        draw.text(pos, text, font=font, fill=color)
        return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

    def get_processed_frame(self):
        with self.lock:
            if self.frame is None:
                return None
            frame_to_process = self.frame.copy()

        processed_frame = frame_to_process
        faces = self.app.get(frame_to_process)
        has_unknown = False
        identified_ids_in_frame = []
        
        show_age_gender = self.settings.get('show_age_gender', 'true') == 'true'

        for face in faces:
            bbox = face.bbox.astype(int)
            name = "Chưa nhận diện"
            emp_id = None
            max_score = 0.0
            
            # Compare with known faces
            if self.known_embeddings:
                for idx, known_emb in enumerate(self.known_embeddings):
                    score = self.compute_sim(face.embedding, known_emb)
                    if score > max_score:
                        max_score = score
                        if score > 0.45: # Increased Threshold for better accuracy
                            name = self.known_names[idx]
                            emp_id = self.known_employee_ids[idx]
            
            if name == "Chưa nhận diện":
                has_unknown = True
            else:
                identified_ids_in_frame.append(emp_id)
                # Log attendance periodically (e.g., every 10 seconds)
                now_ts = time.time()
                if emp_id not in self.last_attendance_log or (now_ts - self.last_attendance_log[emp_id]) > 10:
                    database.log_attendance(emp_id)
                    self.last_attendance_log[emp_id] = now_ts

            # Get age and gender
            age = getattr(face, 'age', 0)
            gender_val = getattr(face, 'gender', -1)
            gender_str = "Nam" if gender_val == 1 else ("Nữ" if gender_val == 0 else "N/A")

            color_bgr = (0, 255, 0) if name != "Chưa nhận diện" else (0, 0, 255)
            color_rgb = (0, 255, 0) if name != "Chưa nhận diện" else (255, 0, 0)

            # Draw bounding box
            cv2.rectangle(processed_frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color_bgr, 2)
            
            # Draw label with Age, Gender and Unicode support
            display_name = f"{name}" if name != "Chưa nhận diện" else "Không rõ"
            
            if show_age_gender:
                label = f"{display_name} | {gender_str}, {age}t"
            else:
                label = display_name
                
            processed_frame = self.draw_unicode_text(processed_frame, label, (bbox[0], bbox[1] - 30), color_rgb, 20)
            
            # Sub-label for confidence score
            score_label = f"Match: {max_score:.2f}" if name != "Chưa nhận diện" else f"Det: {face.det_score:.2f}"
            processed_frame = self.draw_unicode_text(processed_frame, score_label, (bbox[0], bbox[1] - 12), color_rgb, 12)

        # Phone Detection Time Tracking
        now = time.time()
        elapsed = now - self.last_frame_time
        if elapsed > 0.5: elapsed = 0.033 
        self.last_frame_time = now

        # Phone Detection
        has_phone = False
        enable_phone_det = self.settings.get('enable_phone_det', 'true') == 'true'
        
        if enable_phone_det:
            yolo_results = self.yolo(frame_to_process, conf=0.15, verbose=False)
            for result in yolo_results:
                for box in result.boxes:
                    if int(box.cls[0]) == 67: # cell phone
                        has_phone = True
                        b = box.xyxy[0].cpu().numpy().astype(int)
                        conf = box.conf[0].item()
                        cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (255, 165, 0), 2)
                        label = f"Điện thoại ({conf:.2f})"
                        processed_frame = self.draw_unicode_text(processed_frame, label, (b[0], b[1] - 25), (255, 165, 0), 18)

            # Update stats if phone detected
            if has_phone:
                if identified_ids_in_frame:
                    for emp_id in identified_ids_in_frame:
                        database.update_phone_usage(emp_id, elapsed)
                # If no one identified but phone detected, we don't log to specific employee
                # Optional: log to "Unknown" or just ignore

        return processed_frame, has_unknown, has_phone

    def stop(self):
        self.is_running = False
        if self.capture.isOpened():
            self.capture.release()
