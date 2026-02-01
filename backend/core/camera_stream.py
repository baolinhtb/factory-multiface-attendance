import cv2
import threading
import time
import os
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from ultralytics import YOLO
from db import database
from PIL import Image, ImageDraw, ImageFont
from core.fall_detector import FallDetector
from core.fire_detector import FireDetector
from core.face_recognizer import FaceRecognizer

class CameraStream:
    # Shared AI Models to save memory
    _face_analysis_app = None
    _yolo_model = None
    _pose_model = None
    _shared_lock = threading.Lock()

    @classmethod
    def get_face_analysis(cls):
        with cls._shared_lock:
            if cls._face_analysis_app is None:
                print("Initializing Shared InsightFace analysis...")
                cls._face_analysis_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
                cls._face_analysis_app.prepare(ctx_id=0, det_size=(640, 640))
            return cls._face_analysis_app

    @classmethod
    def get_yolo(cls):
        with cls._shared_lock:
            if cls._yolo_model is None:
                print("Initializing Shared YOLO26 for object detection...")
                model_path = 'models/yolo26n.pt' if os.path.exists('models/yolo26n.pt') else 'yolo26n.pt'
                try:
                    cls._yolo_model = YOLO(model_path)
                    print(f"YOLO26 object detection model loaded: {model_path}")
                except Exception as e:
                    print(f"Error loading YOLO26 model: {e}. Fallback to YOLOv8.")
                    cls._yolo_model = YOLO('yolov8n.pt')
            return cls._yolo_model

    @classmethod
    def get_pose_yolo(cls):
        with cls._shared_lock:
            if cls._pose_model is None:
                print("Initializing Shared YOLO26 Pose Detection...")
                pose_model_path = 'models/yolo26n-pose.pt' if os.path.exists('models/yolo26n-pose.pt') else 'yolo26n-pose.pt'
                try:
                    cls._pose_model = YOLO(pose_model_path)
                    print(f"YOLO26 Pose model loaded: {pose_model_path}")
                except Exception as e:
                    print(f"Error loading pose model: {e}")
                    cls._pose_model = None
            return cls._pose_model

    def __init__(self, camera_config: dict = None):
        """
        Initialize CameraStream with a specific configuration.
        camera_config: {id, name, type, source, is_active, description}
        """
        # Load global settings for thresholds
        self.settings = database.get_settings()
        
        # Camera Config
        if camera_config:
            self.camera_id = camera_config.get('id')
            self.camera_name = camera_config.get('name', 'Unnamed Camera')
            self.camera_type = camera_config.get('type', 'usb')
            self.camera_source_str = camera_config.get('source', '0')
        else:
            # Fallback to default single camera settings
            self.camera_id = 0
            self.camera_name = "Default Camera"
            self.camera_type = self.settings.get('camera_type', 'usb')
            self.camera_source_str = self.settings.get('rtsp_url', '') if self.camera_type == 'rtsp' else self.settings.get('camera_src', '0')

        # Determine actual OpenCV source
        if self.camera_type == 'rtsp' and self.camera_source_str:
            self.camera_source = self.camera_source_str
        else:
            try:
                self.camera_source = int(self.camera_source_str)
            except:
                self.camera_source = self.camera_source_str

        print(f"Initializing {self.camera_name} ({self.camera_type}) at {self.camera_source}")
            
        # AI Detection thresholds from settings
        self.face_recognition_threshold = float(self.settings.get('face_recognition_threshold', '0.45'))
        self.phone_detection_confidence = float(self.settings.get('phone_detection_confidence', '0.15'))
        self.fire_detection_confidence = float(self.settings.get('fire_detection_confidence', '0.30'))
        self.pose_detection_confidence = float(self.settings.get('pose_detection_confidence', '0.50'))

        # Initialize Camera
        self.capture = cv2.VideoCapture(self.camera_source)
        self.current_src = self.camera_source
        
        if not self.capture.isOpened():
            print(f"ERROR: Could not open video source {self.camera_source} for {self.camera_name}")
        else:
            print(f"SUCCESS: Video source {self.camera_source} opened for {self.camera_name}")

        self.is_running = False
        self.frame = None
        self.thread = None
        self.lock = threading.Lock()
        
        # Get Shared AI Models
        self.app = self.get_face_analysis()
        self.yolo = self.get_yolo()
        self.pose_yolo = self.get_pose_yolo()
        
        # Initialize Face Recognizer (FAISS)
        self.face_recognizer = FaceRecognizer()
        self.reload_faces()

        # Initialize FireDetector
        fire_model_path = 'models/fire_detection.pt'
        if not os.path.exists(fire_model_path):
             fire_model_path = 'fire_detection.pt'
        
        self.fire_detector = FireDetector(
            model_path=fire_model_path,
            target_height=640,
            iou_threshold=0.2,
            min_confidence=self.fire_detection_confidence,
            smoke_confidence=0.75
        )
        
        # Detection states
        self.fire_detected_time = None
        self.fire_alert_cooldown = 10
        self.unsafe_pose_detected_time = None
        self.unsafe_pose_cooldown = 5
        self.last_frame_time = time.time()
        
        # Font for Vietnamese labels
        self.font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
        
        # Fall Detector
        self.fall_detector = FallDetector()
        self.enable_fall_det = self.settings.get('enable_fall_det', 'false') == 'true'

    def reload_faces(self):
        """Reload employees from database."""
        employees = database.get_all_employees_with_embeddings()
        self.face_recognizer.load_faces(employees)
        
        self.known_employee_ids = [u['id'] for u in employees]
        self.known_names = [u['name'] for u in employees]
        
        self.last_attendance_log = {} # employee_id -> last_log_time
        self.employee_presence = {} # employee_id -> last_seen_time
        self.employee_presence_state = {} # employee_id -> 'entered' or 'left'
        print(f"[{self.camera_name}] Loaded {len(employees)} employees into FAISS.")

    def update_settings(self):
        """Fetch updated thresholds and fall det settings."""
        self.settings = database.get_settings()
        
        self.face_recognition_threshold = float(self.settings.get('face_recognition_threshold', '0.45'))
        self.phone_detection_confidence = float(self.settings.get('phone_detection_confidence', '0.15'))
        self.fire_detection_confidence = float(self.settings.get('fire_detection_confidence', '0.30'))
        self.pose_detection_confidence = float(self.settings.get('pose_detection_confidence', '0.50'))
        self.enable_fall_det = self.settings.get('enable_fall_det', 'false') == 'true'
        
        self.fire_detector.min_confidence = self.fire_detection_confidence
        print(f"[{self.camera_name}] AI Thresholds updated.")

    def get_available_cameras(self):
        """Scan for available cameras (indices 0-4)."""
        available_cameras = []
        # Checks the first 5 indexes.
        for index in range(5):
            try:
                cap = cv2.VideoCapture(index)
                if cap.isOpened():
                    ret, _ = cap.read()
                    if ret:
                        available_cameras.append({"id": str(index), "name": f"Camera {index}"})
                    cap.release()
            except:
                pass
        return available_cameras

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
            # Compare with known faces using FAISS
            emp_id, name, max_score = self.face_recognizer.identify(
                face.embedding, 
                threshold=self.face_recognition_threshold
            )
            
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
            # Fire Detection (from custom Fire Detector)
        enable_fire_det = self.settings.get('enable_fire_det', 'true') == 'true'
        if enable_fire_det:
            # Override confidence from settings if needed, or update detector property
            self.fire_detector.min_confidence = self.fire_detection_confidence
            
            # Process frame using custom detector (handling drawing internally)
            # Use frame_to_process directly (it will be drawn upon by the detector)
            # Note: The detector returns (processed_frame, detection_str, detected_objects_list)
            # We want to use the drawn frame? Yes.
            
            # Create a localized copy for fire detection to avoid affecting other detections?
            # Actually, we want the drawings.
            # But the existing code pipeline draws things sequentially on `processed_frame`.
            # If `process_frame` modifies the frame heavily (like adding overlays), it might cover other things?
            # The user code adds an overlay at the bottom.
            
            # Important: FireDetector.process_frame returns a NEW frame if it copies, or modifies in place depending on impl.
            # My impl copies: `draw_frame = frame.copy()`. So we need to assign it back or just extract boxes.
            
            # User request: "Use this code" -> The code does drawing.
            # So let's capture the drawn frame result.
            
            fire_drawn_frame, fire_status, fire_objects = self.fire_detector.process_frame(frame_to_process)
            
            # Update frame_to_process with the visually enhanced frame from fire detector
            # This will contain the bounding boxes and the bottom overlay.
            frame_to_process = fire_drawn_frame
            
            for obj in fire_objects:
                detected_fires.append({
                    'box': obj['box'],
                    'conf': obj['conf']
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
             # Fire is now drawn by FireDetector with enhanced effects (corners, transparency).
             # We just need to log alerts.
             
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
        
        # Pose Detection & Fall Detection
        has_unsafe_pose = False
        enable_pose_det = self.settings.get('enable_pose_det', 'true') == 'true'
        self.enable_fall_det = self.settings.get('enable_fall_det', 'false') == 'true' # Refresh setting
        
        if (enable_pose_det or self.enable_fall_det) and self.pose_yolo is not None:
            try:
                # Use Tracking for Fall Detection
                if self.enable_fall_det:
                    pose_results = self.pose_yolo.track(frame_to_process, conf=self.pose_detection_confidence, persist=True, verbose=False)
                else:
                    pose_results = self.pose_yolo(frame_to_process, conf=self.pose_detection_confidence, verbose=False)
                
                for result in pose_results:
                    if hasattr(result, 'keypoints') and result.keypoints is not None:
                        # Map track IDs to keypoints
                        
                        # Get boxes and IDs if available
                        boxes = result.boxes
                        track_ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
                        
                        for person_idx, keypoints in enumerate(result.keypoints):
                            track_id = track_ids[person_idx]
                            
                            # Draw skeleton
                            if hasattr(keypoints, 'xy'):
                                kpts = keypoints.xy[0].cpu().numpy()
                                
                                # Draw standard skeleton (Green)
                                for i, (x, y) in enumerate(kpts):
                                    if x > 0 and y > 0:
                                        cv2.circle(processed_frame, (int(x), int(y)), 3, (0, 255, 0), -1)
                                
                                skeleton = [
                                    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),
                                    (5, 11), (6, 12), (11, 12),
                                    (11, 13), (13, 15), (12, 14), (14, 16)
                                ]
                                for start_idx, end_idx in skeleton:
                                    if start_idx < len(kpts) and end_idx < len(kpts):
                                        x1, y1 = kpts[start_idx]
                                        x2, y2 = kpts[end_idx]
                                        if x1 > 0 and y1 > 0 and x2 > 0 and y2 > 0:
                                            cv2.line(processed_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                                
                                # --- FALL DETECTION LOGIC ---
                                if self.enable_fall_det and track_id is not None:
                                    fall_status, _ = self.fall_detector.update(track_id, kpts, time.time())
                                    
                                    box = result.boxes[person_idx]
                                    b = box.xyxy[0].cpu().numpy().astype(int)
                                    
                                    if fall_status == FallDetector.STATUS_PRE_ALARM:
                                        # Yellow Warning
                                        cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (0, 255, 255), 3)
                                        processed_frame = self.draw_unicode_text(processed_frame, "⚠️ CẢNH BÁO NGÃ...", (b[0], b[1] - 30), (0, 255, 255), 18)
                                        
                                    elif fall_status == FallDetector.STATUS_ALARM:
                                        # Red Alarm
                                        cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (0, 0, 255), 4)
                                        processed_frame = self.draw_unicode_text(processed_frame, "🆘 NGƯỜI BỊ NGÃ!", (b[0], b[1] - 50), (0, 0, 255), 24)
                                        print(f"[FALL ALERT] Fall Confirmed for ID {track_id}")

                                    elif fall_status == FallDetector.STATUS_RESTING:
                                        # Optional: Show resting status (Blue/Cyan)
                                        processed_frame = self.draw_unicode_text(processed_frame, "Đang nằm nghỉ", (b[0], b[1] - 20), (255, 255, 0), 16)

                                # --- UNSAFE POSTURE LOGIC (Legacy) ---
                                # Only run if Fall Detection didn't trigger an Alarm (to avoid clutter)
                                elif enable_pose_det: 
                                    nose = kpts[0]
                                    left_hip = kpts[11]
                                    right_hip = kpts[12]
                                    if nose[1] > 0 and left_hip[1] > 0 and right_hip[1] > 0:
                                        avg_hip_y = (left_hip[1] + right_hip[1]) / 2
                                        if nose[1] > avg_hip_y + 50:
                                            has_unsafe_pose = True
                                            if result.boxes is not None and len(result.boxes) > person_idx:
                                                box = result.boxes[person_idx]
                                                b = box.xyxy[0].cpu().numpy().astype(int)
                                                cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (0, 165, 255), 2)
                                                processed_frame = self.draw_unicode_text(processed_frame, "⚠️ TƯ THẾ KHÔNG AN TOÀN", (b[0], b[1] - 30), (0, 165, 255), 18)

            except Exception as e:
                print(f"[POSE] Error during pose/fall detection: {e}")
        
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
