import cv2
import threading
import time
import os
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
        
        # Determine camera source: check camera_type setting
        camera_type = self.settings.get('camera_type', 'usb')
        rtsp_url = self.settings.get('rtsp_url', '').strip()
        src = self.settings.get('camera_src', '0')
        
        if camera_type == 'rtsp' and rtsp_url:
            # Use RTSP URL
            camera_source = rtsp_url
            print(f"Using RTSP camera: {rtsp_url}")
        else:
            # Use camera_src (USB camera ID or other source)
            try:
                camera_source = int(src)
            except:
                camera_source = src
            print(f"Using USB camera source: {camera_source}")
            
        # Initialize Camera
        self.capture = cv2.VideoCapture(camera_source)
        self.current_src = camera_source
        
        if not self.capture.isOpened():
            print(f"ERROR: Could not open video source {camera_source}")
        else:
            print(f"SUCCESS: Video source {camera_source} opened")

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



        # Initialize YOLO26 for object detection (phone, etc.)
        print("Initializing YOLO26 for object detection...")
        model_path = 'models/yolo26n.pt' if os.path.exists('models/yolo26n.pt') else 'yolo26n.pt'
        try:
            self.yolo = YOLO(model_path)
            print(f"YOLO26 object detection model loaded: {model_path}")
        except Exception as e:
            print(f"Error loading YOLO26 model: {e}. Fallback to YOLOv8/11 if available.")
            self.yolo = YOLO('yolov8n.pt') # Fallback

        # Initialize YOLO26 for pose detection
        print("Initializing YOLO26 Pose Detection...")
        pose_model_path = 'models/yolo26n-pose.pt' if os.path.exists('models/yolo26n-pose.pt') else 'yolo26n-pose.pt'
        try:
            self.pose_yolo = YOLO(pose_model_path)
            print(f"YOLO26 Pose model loaded: {pose_model_path}")
        except Exception as e:
            print(f"Error loading pose model: {e}")
            self.pose_yolo = None
            print("Pose detection disabled")
        
        # Initialize YOLO for fire detection (using custom or pretrained model)
        print("Initializing Fire Detection model...")
        fire_model_path = 'models/fire_detection.pt'
        try:
            if os.path.exists(fire_model_path):
                self.fire_yolo = YOLO(fire_model_path)
                print(f"Custom fire detection model loaded from {fire_model_path}")
            else:
                # Fallback to standard YOLO (won't detect fire specifically)
                self.fire_yolo = self.yolo
                print("Using standard YOLO26 for fire detection (limited capability)")
        except Exception as e:
            print(f"Error loading fire model: {e}")
            self.fire_yolo = self.yolo
            print("Fallback to standard YOLO26 for fire detection")
        
        # AI Detection thresholds from settings
        self.face_recognition_threshold = float(self.settings.get('face_recognition_threshold', '0.45'))
        self.phone_detection_confidence = float(self.settings.get('phone_detection_confidence', '0.15'))
        self.fire_detection_confidence = float(self.settings.get('fire_detection_confidence', '0.30'))
        self.pose_detection_confidence = float(self.settings.get('pose_detection_confidence', '0.50'))
        
        # Fire detection state
        self.fire_detected_time = None
        self.fire_alert_cooldown = 10  # seconds between alerts
        
        # Pose detection state
        self.unsafe_pose_detected_time = None
        self.unsafe_pose_cooldown = 5  # seconds between alerts
        
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
        self.employee_presence = {} # employee_id -> last_seen_time
        self.employee_presence_state = {} # employee_id -> 'entered' or 'left'
        print(f"Loaded {len(self.known_embeddings)} employees from database.")

    def update_settings(self):
        """Fetch updated settings from DB."""
        new_settings = database.get_settings()
        
        # Determine new camera source: check camera_type setting
        new_camera_type = new_settings.get('camera_type', 'usb')
        new_rtsp_url = new_settings.get('rtsp_url', '').strip()
        new_src = new_settings.get('camera_src', '0')
        
        if new_camera_type == 'rtsp' and new_rtsp_url:
            # Use RTSP URL
            new_camera_source = new_rtsp_url
        else:
            # Use camera_src (USB camera ID or other source)
            try:
                new_camera_source = int(new_src)
            except:
                new_camera_source = new_src
            
        if new_camera_source != self.current_src:
            print(f"Changing camera source to {new_camera_source}...")
            with self.lock:
                self.capture.release()
                self.capture = cv2.VideoCapture(new_camera_source)
                self.current_src = new_camera_source
                if not self.capture.isOpened():
                    print(f"ERROR: Could not open new video source {new_camera_source}")
                else:
                    print(f"SUCCESS: New video source {new_camera_source} opened")
        
        # Update AI thresholds
        self.face_recognition_threshold = float(new_settings.get('face_recognition_threshold', '0.45'))
        self.phone_detection_confidence = float(new_settings.get('phone_detection_confidence', '0.15'))
        self.fire_detection_confidence = float(new_settings.get('fire_detection_confidence', '0.30'))
        self.pose_detection_confidence = float(new_settings.get('pose_detection_confidence', '0.50'))
        print(f"AI Thresholds updated: Face={self.face_recognition_threshold}, Phone={self.phone_detection_confidence}, Fire={self.fire_detection_confidence}, Pose={self.pose_detection_confidence}")
        
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
                        if score > self.face_recognition_threshold:
                            name = self.known_names[idx]
                            emp_id = self.known_employee_ids[idx]
            
            if name == "Chưa nhận diện":
                has_unknown = True
            else:
                identified_ids_in_frame.append(emp_id)
                
                # Presence tracking - log enter/leave events
                now_ts = time.time()
                self.employee_presence[emp_id] = now_ts
                
                # Check if this is a new entry (not seen before or previously left)
                if emp_id not in self.employee_presence_state or self.employee_presence_state[emp_id] == 'left':
                    database.log_employee_presence(emp_id, 'enter')
                    self.employee_presence_state[emp_id] = 'entered'
                    print(f"[PRESENCE] {name} ({emp_id}) entered camera view")
                
                # Log attendance periodically (e.g., every 10 seconds)
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

        # 1. Collect all detections from BOTH models
        detected_phones = []
        detected_fires = []
        
        # Phone Detection (from primary YOLO)
        enable_phone_det = self.settings.get('enable_phone_det', 'true') == 'true'
        if enable_phone_det:
            yolo_results = self.yolo(frame_to_process, conf=self.phone_detection_confidence, verbose=False)
            for result in yolo_results:
                for box in result.boxes:
                    if int(box.cls[0]) == 67: # cell phone
                        detected_phones.append({
                            'box': box.xyxy[0].cpu().numpy().astype(int),
                            'conf': box.conf[0].item()
                        })

        # Fire Detection (from custom Fire YOLO)
        enable_fire_det = self.settings.get('enable_fire_det', 'true') == 'true'
        if enable_fire_det:
            fire_results = self.fire_yolo(frame_to_process, conf=self.fire_detection_confidence, verbose=False)
            for result in fire_results:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    class_name = result.names[class_id].lower() if hasattr(result, 'names') else ''
                    
                    # Fire model: check class_name OR class_id 0 (common for custom single-class models)
                    if 'fire' in class_name or 'flame' in class_name or 'smoke' in class_name or class_id == 0:
                        detected_fires.append({
                            'box': box.xyxy[0].cpu().numpy().astype(int),
                            'conf': box.conf[0].item()
                        })

        # 2. Resolve Overlaps and Draw
        has_phone = False
        has_fire = False
        
        # We need to decide for each area if it's fire or phone
        # Strategy: If both detect something in the same spot, trust the one with higher confidence
        # BUT: Since fire is more critical, we give it a 20% "danger boost" or prioritize it if it's over 0.6
        
        final_fires = []
        final_phones = []
        
        for fire in detected_fires:
            fb = fire['box']
            is_valid_fire = True
            
            for phone in detected_phones:
                pb = phone['box']
                # Check overlap (IoU)
                ix1, iy1 = max(fb[0], pb[0]), max(fb[1], pb[1])
                ix2, iy2 = min(fb[2], pb[2]), min(fb[3], pb[3])
                
                if ix2 > ix1 and iy2 > iy1:
                    intersection = (ix2 - ix1) * (iy2 - iy1)
                    area_fire = (fb[2] - fb[0]) * (fb[3] - fb[1])
                    if intersection / area_fire > 0.4: # Significant overlap
                        # Compare confidence. Phone model often misidentifies fire as phone.
                        # If Fire model says it's fire and YOLO says it's phone, 
                        # we trust the specialized Fire model unless it's very low confidence.
                        if fire['conf'] < 0.35 and phone['conf'] > 0.7:
                            is_valid_fire = False
                            break
            
            if is_valid_fire:
                final_fires.append(fire)
                has_fire = True

        for phone in detected_phones:
            pb = phone['box']
            is_valid_phone = True
            
            for fire in final_fires:
                fb = fire['box']
                ix1, iy1 = max(pb[0], fb[0]), max(pb[1], fb[1])
                ix2, iy2 = min(pb[2], fb[2]), min(pb[3], fb[3])
                
                if ix2 > ix1 and iy2 > iy1:
                    intersection = (ix2 - ix1) * (iy2 - iy1)
                    area_phone = (pb[2] - pb[0]) * (pb[3] - pb[1])
                    if intersection / area_phone > 0.4:
                        # If fire model is confident, it's NOT a phone
                        is_valid_phone = False
                        break
            
            if is_valid_phone:
                final_phones.append(phone)
                has_phone = True

        # 3. Draw final detections
        for phone in final_phones:
            b = phone['box']
            cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (255, 165, 0), 2)
            label = f"Điện thoại ({phone['conf']:.2f})"
            processed_frame = self.draw_unicode_text(processed_frame, label, (b[0], b[1] - 25), (255, 165, 0), 18)

        for fire in final_fires:
            b = fire['box']
            cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (0, 0, 255), 3)
            label = f"🔥 LỬA PHÁT HIỆN ({fire['conf']:.2f})"
            processed_frame = self.draw_unicode_text(processed_frame, label, (b[0], b[1] - 30), (0, 0, 255), 22)
            
            # Log fire alert with cooldown
            current_time = time.time()
            if self.fire_detected_time is None or (current_time - self.fire_detected_time) > self.fire_alert_cooldown:
                print(f"[FIRE ALERT] Fire detected with confidence {fire['conf']:.2f}")
                self.fire_detected_time = current_time

        # Update phone usage stats if confirmed phone
        if has_phone:
            if identified_ids_in_frame:
                for emp_id in identified_ids_in_frame:
                    database.update_phone_usage(emp_id, elapsed)
        
        # Pose Detection (detect unsafe postures)
        has_unsafe_pose = False
        enable_pose_det = self.settings.get('enable_pose_det', 'true') == 'true'
        
        if enable_pose_det and self.pose_yolo is not None:
            try:
                pose_results = self.pose_yolo(frame_to_process, conf=self.pose_detection_confidence, verbose=False)
                for result in pose_results:
                    if hasattr(result, 'keypoints') and result.keypoints is not None:
                        for person_idx, keypoints in enumerate(result.keypoints):
                            # Draw skeleton
                            if hasattr(keypoints, 'xy'):
                                kpts = keypoints.xy[0].cpu().numpy()  # Shape: (17, 2) for COCO format
                                
                                # YOLO11 Pose keypoints (COCO format):
                                # 0: nose, 1-2: eyes, 3-4: ears, 5-6: shoulders, 
                                # 7-8: elbows, 9-10: wrists, 11-12: hips, 
                                # 13-14: knees, 15-16: ankles
                                
                                # Draw keypoints
                                for i, (x, y) in enumerate(kpts):
                                    if x > 0 and y > 0:  # Valid keypoint
                                        cv2.circle(processed_frame, (int(x), int(y)), 3, (0, 255, 0), -1)
                                
                                # Draw skeleton connections
                                skeleton = [
                                    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),  # Arms
                                    (5, 11), (6, 12), (11, 12),  # Torso
                                    (11, 13), (13, 15), (12, 14), (14, 16)  # Legs
                                ]
                                
                                for start_idx, end_idx in skeleton:
                                    if start_idx < len(kpts) and end_idx < len(kpts):
                                        x1, y1 = kpts[start_idx]
                                        x2, y2 = kpts[end_idx]
                                        if x1 > 0 and y1 > 0 and x2 > 0 and y2 > 0:
                                            cv2.line(processed_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                                
                                # Detect unsafe postures (example: bending over - head lower than hips)
                                nose = kpts[0]
                                left_hip = kpts[11]
                                right_hip = kpts[12]
                                
                                if nose[1] > 0 and left_hip[1] > 0 and right_hip[1] > 0:
                                    avg_hip_y = (left_hip[1] + right_hip[1]) / 2
                                    # If nose is significantly lower than hips, person is bending
                                    if nose[1] > avg_hip_y + 50:  # 50 pixels threshold
                                        has_unsafe_pose = True
                                        # Draw warning
                                        if result.boxes is not None and len(result.boxes) > person_idx:
                                            box = result.boxes[person_idx]
                                            b = box.xyxy[0].cpu().numpy().astype(int)
                                            cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (0, 165, 255), 2)
                                            label = "⚠️ TƯ THẾ KHÔNG AN TOÀN"
                                            processed_frame = self.draw_unicode_text(processed_frame, label, (b[0], b[1] - 30), (0, 165, 255), 18)
                                        
                                        # Log unsafe pose with cooldown
                                        current_time = time.time()
                                        if self.unsafe_pose_detected_time is None or (current_time - self.unsafe_pose_detected_time) > self.unsafe_pose_cooldown:
                                            print(f"[POSE ALERT] Unsafe posture detected at {time.strftime('%Y-%m-%d %H:%M:%S')}")
                                            self.unsafe_pose_detected_time = current_time
            except Exception as e:
                print(f"[POSE] Error during pose detection: {e}")
        
        # Check for employees who have left (not seen for 5 seconds)
        current_time = time.time()
        for emp_id, last_seen in list(self.employee_presence.items()):
            if emp_id not in identified_ids_in_frame:
                if current_time - last_seen > 5.0:  # Not seen for 5 seconds
                    if emp_id in self.employee_presence_state and self.employee_presence_state[emp_id] == 'entered':
                        # Find employee name for logging
                        emp_name = "Unknown"
                        try:
                            idx = self.known_employee_ids.index(emp_id)
                            emp_name = self.known_names[idx]
                        except:
                            pass
                        database.log_employee_presence(emp_id, 'leave')
                        self.employee_presence_state[emp_id] = 'left'
                        print(f"[PRESENCE] {emp_name} ({emp_id}) left camera view")

        return processed_frame, has_unknown, has_phone, has_fire, has_unsafe_pose

    def stop(self):
        self.is_running = False
        if self.capture.isOpened():
            self.capture.release()
