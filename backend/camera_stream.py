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
    def __init__(self, src=0):
        # Initialize Camera
        self.capture = cv2.VideoCapture(src)
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
        """Reload faces from database."""
        users = database.get_all_users()
        self.known_embeddings = [u['embedding'] for u in users]
        self.known_names = [u['name'] for u in users]
        print(f"Loaded {len(self.known_embeddings)} users from database.")

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
        identified_names_in_frame = []

        for face in faces:
            bbox = face.bbox.astype(int)
            name = "Chưa nhận diện" # Unknown
            max_score = 0.0
            
            # Compare with known faces
            if self.known_embeddings:
                for idx, known_emb in enumerate(self.known_embeddings):
                    score = self.compute_sim(face.embedding, known_emb)
                    if score > max_score:
                        max_score = score
                        if score > 0.4: # Threshold
                            name = self.known_names[idx]
            
            if name == "Chưa nhận diện":
                has_unknown = True
            else:
                identified_names_in_frame.append(name)

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
            label = f"{display_name} | {gender_str}, {age}t"
            processed_frame = self.draw_unicode_text(processed_frame, label, (bbox[0], bbox[1] - 30), color_rgb, 20)
            
            # Sub-label for confidence score
            score_label = f"Match: {max_score:.2f}" if name != "Chưa nhận diện" else f"Det: {face.det_score:.2f}"
            processed_frame = self.draw_unicode_text(processed_frame, score_label, (bbox[0], bbox[1] - 12), color_rgb, 12)

        # Phone Detection Time Tracking
        now = time.time()
        elapsed = now - self.last_frame_time
        # Cap elapsed to avoid jumps if the stream was paused
        if elapsed > 0.5: elapsed = 0.033 
        self.last_frame_time = now

        # Phone Detection with higher sensitivity (lower confidence threshold)
        has_phone = False
        yolo_results = self.yolo(frame_to_process, conf=0.15, verbose=False)
        for result in yolo_results:
            for box in result.boxes:
                # cls 67 is cell phone in COCO
                if int(box.cls[0]) == 67:
                    has_phone = True
                    b = box.xyxy[0].cpu().numpy().astype(int)
                    conf = box.conf[0].item()
                    cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (255, 165, 0), 2)
                    label = f"Điện thoại ({conf:.2f})"
                    processed_frame = self.draw_unicode_text(processed_frame, label, (b[0], b[1] - 25), (255, 165, 0), 18)

        # Update stats if phone detected
        if has_phone:
            # Attribute to the first identified person, or "Người lạ", or "Hệ thống"
            target_name = "Người lạ"
            if identified_names_in_frame:
                target_name = identified_names_in_frame[0]
            elif not faces:
                target_name = "Chưa rõ chủ thể"
            
            database.update_phone_usage(target_name, elapsed)

        return processed_frame, has_unknown, has_phone

    def stop(self):
        self.is_running = False
        if self.capture.isOpened():
            self.capture.release()
