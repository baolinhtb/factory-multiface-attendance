import cv2
import threading
import time
import os
import numpy as np
import math
import insightface
from scipy.optimize import linear_sum_assignment
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
    _shared_lock = threading.Lock()
    _face_lock = threading.Lock() # Lock for face analysis inference
    
    @classmethod
    def get_face_analysis(cls):
        with cls._shared_lock:
            if cls._face_analysis_app is None:
                print("Initializing Shared InsightFace analysis (Buffalo_L)...")
                # Use buffalo_l but with a smaller search size for Speed on CPU
                cls._face_analysis_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
                cls._face_analysis_app.prepare(ctx_id=0, det_size=(320, 320))
            return cls._face_analysis_app

    def load_yolo_model(self):
        """Load per-instance YOLO model for object detection."""
        print(f"[{self.camera_name}] Loading YOLO26 for object detection...")
        model_path = 'models/yolo26n.pt' if os.path.exists('models/yolo26n.pt') else 'yolo26n.pt'
        try:
            return YOLO(model_path)
        except Exception as e:
            print(f"[{self.camera_name}] Error loading YOLO26: {e}. Fallback to YOLOv8.")
            return YOLO('yolov8n.pt')

    def load_pose_model(self):
        """Load per-instance YOLO model for pose detection."""
        print(f"[{self.camera_name}] Loading YOLO11 Pose Detection...")
        pose_model_path = 'models/yolo11n-pose.pt'
        if not os.path.exists(pose_model_path):
            if os.path.exists('yolo11n-pose.pt'):
                pose_model_path = 'yolo11n-pose.pt'
            elif os.path.exists('models/yolo26n-pose.pt'):
                pose_model_path = 'models/yolo26n-pose.pt'
        
        try:
            return YOLO(pose_model_path)
        except Exception as e:
            print(f"[{self.camera_name}] Error loading pose model: {e}")
            return None

    def __init__(self, camera_config: dict = None):
        """
        Initialize CameraStream with a specific configuration.
        """
        self.global_settings = database.get_settings()
        
        if camera_config:
            self.camera_id = camera_config.get('id')
            self.camera_name = camera_config.get('name', 'Unnamed Camera')
            self.camera_type = camera_config.get('type', 'usb')
            self.camera_source_str = camera_config.get('source', '0')
            self.camera_settings = camera_config.get('settings', {}) or {}
        else:
            self.camera_id = 0
            self.camera_name = "Default Camera"
            self.camera_type = self.global_settings.get('camera_type', 'usb')
            self.camera_source_str = self.global_settings.get('rtsp_url', '') if self.camera_type == 'rtsp' else self.global_settings.get('camera_src', '0')
            self.camera_settings = {}

        if self.camera_type == 'rtsp' and self.camera_source_str:
            self.camera_source = self.camera_source_str
        else:
            try: self.camera_source = int(self.camera_source_str)
            except: self.camera_source = self.camera_source_str

        print(f"[{self.camera_name}] Initializing on {self.camera_source}")
        self.apply_settings()

        self.capture = cv2.VideoCapture(self.camera_source)
        if not self.capture.isOpened():
            print(f"[{self.camera_name}] ERROR: Could not open source {self.camera_source}")
        
        self.is_running = False
        self.frame = None
        self.thread = None
        self.lock = threading.Lock()
        
        # Get Shared Face Model
        self.app = self.get_face_analysis()
        
        # Per-instance YOLO Models to avoid tracking ID conflicts
        self.yolo = self.load_yolo_model()
        self.pose_yolo = self.load_pose_model()
        
        self.face_recognizer = FaceRecognizer()
        self.reload_faces()

        fire_model_path = 'models/fire_detection.pt' if os.path.exists('models/fire_detection.pt') else 'fire_detection.pt'
        self.fire_detector = FireDetector(
            model_path=fire_model_path, target_height=640, iou_threshold=0.2,
            min_confidence=self.fire_detection_confidence, smoke_confidence=0.75
        )
        
        self.fire_detected_time = None
        self.fire_alert_cooldown = 10
        self.last_frame_time = time.time()
        self.font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
        self.fall_detector = FallDetector()
        self.identity_cache = {}
        self.frame_idx = 0
        
    def get_effective_setting(self, key, default_val):
        """Get setting prioritizing Camera -> Global -> Default."""
        # 1. Camera specific
        if self.camera_settings and key in self.camera_settings:
            val = self.camera_settings[key]
            if str(val).lower() == 'true': return True
            if str(val).lower() == 'false': return False
            return val
            
        # 2. Global settings (which are strings in DB)
        if key in self.global_settings:
            val = self.global_settings[key]
            if val.lower() == 'true': return True
            if val.lower() == 'false': return False
            return val
            
        # 3. Default
        return default_val

    def apply_settings(self):
        """Apply current settings to internal variables."""
        # Thresholds
        self.face_recognition_threshold = float(self.get_effective_setting('face_recognition_threshold', 0.45))
        self.phone_detection_confidence = float(self.get_effective_setting('phone_detection_confidence', 0.15))
        self.fire_detection_confidence = float(self.get_effective_setting('fire_detection_confidence', 0.30))
        self.pose_detection_confidence = float(self.get_effective_setting('pose_detection_confidence', 0.50))
        
        # Enablers
        self.enable_face_rec = self.get_effective_setting('enable_face_rec', True)
        self.enable_phone_det = self.get_effective_setting('enable_phone_det', True)
        self.enable_fire_det = self.get_effective_setting('enable_fire_det', True)
        self.enable_pose_det = self.get_effective_setting('enable_pose_det', True)
        self.show_pose_visualization = self.get_effective_setting('show_pose_visualization', True)
        self.enable_fall_det = self.get_effective_setting('enable_fall_det', False)
        
        # Pose Matching Configs
        self.pose_matching_frame_skip = int(self.get_effective_setting('POSE_MATCHING_FRAME_SKIP', 5))
        self.pose_matching_threshold = float(self.get_effective_setting('POSE_MATCHING_THRESHOLD', 100))
        self.pose_area_ratio_threshold = float(self.get_effective_setting('POSE_AREA_RATIO_THRESHOLD', 0.5))
        self.pose_reverify_interval = float(self.get_effective_setting('POSE_REVERIFY_INTERVAL', 2.0))
        self.pose_stale_timeout = float(self.get_effective_setting('POSE_STALE_TIMEOUT', 20.0))
        self.pose_cache_expiry = float(self.get_effective_setting('POSE_CACHE_EXPIRY', 30.0))
        self.pose_matching_algorithm = self.get_effective_setting('POSE_MATCHING_ALGORITHM', 'hybrid')
        self.pose_stale_display = self.get_effective_setting('POSE_STALE_DISPLAY', 'possible')
        
        # Other
        self.show_age_gender = self.get_effective_setting('show_age_gender', True)
        
        # Apply to sub-components
        if hasattr(self, 'fire_detector'):
            self.fire_detector.min_confidence = self.fire_detection_confidence

        print(f"[{self.camera_name}] Settings applied: Face={self.enable_face_rec}, PoseAlgo={self.pose_matching_algorithm}")

    def update_settings(self, new_config=None):
        """Fetch updated thresholds and fall det settings."""
        self.global_settings = database.get_settings()
        if new_config:
            self.camera_settings = new_config.get('settings', {}) or {}
        self.apply_settings()

    def reload_faces(self):
        """Reload employees from database."""
        employees = database.get_all_employees_with_embeddings()
        self.face_recognizer.load_faces(employees)
        self.known_employee_ids = [u['id'] for u in employees]
        self.known_names = [u['name'] for u in employees]
        self.last_attendance_log = {}
        self.employee_presence = {}
        self.employee_presence_state = {}
        print(f"[{self.camera_name}] Loaded {len(employees)} employees into FAISS.")

    def get_available_cameras(self):
        """Scan for available cameras (indices 0-4)."""
        available_cameras = []
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

    def _draw_batch_text(self, img, text_items):
        """
        Draw multiple text items on the image efficiently.
        text_items: list of (text, (x, y), color_rgb_tuple, size)
        """
        if not text_items: return img
        
        # Convert once
        img_pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(img_pil)
        
        try:
            fonts = {} # Cache fonts by size
            default_font = ImageFont.load_default()
            
            for text, pos, color, size in text_items:
                if size not in fonts:
                    try:
                        fonts[size] = ImageFont.truetype(self.font_path, size)
                    except:
                        fonts[size] = default_font
                
                font = fonts[size]
                draw.text(pos, text, font=font, fill=color)
        except Exception as e:
            print(f"Error drawing text: {e}")
            
        return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

    def get_processed_frame(self):
        t_start = time.time()
        prof = {}

        with self.lock:
            if self.frame is None: return None
            h, w = self.frame.shape[:2]
            if w > 1024:
                scale = 1024 / w
                frame_to_process = cv2.resize(self.frame, (1024, int(h * scale)))
            else:
                frame_to_process = self.frame.copy()

        processed_frame = frame_to_process 
        
        self.frame_idx += 1
        is_face_frame = (self.frame_idx % self.pose_matching_frame_skip == 0)
        is_object_frame = (self.frame_idx % 2 == 0)
        is_fire_frame = (self.frame_idx % 10 == 0)
        
        now_ts = time.time()
        elapsed = now_ts - self.last_frame_time
        if elapsed > 0.5: elapsed = 1.0 / 30.0
        self.last_frame_time = now_ts
        
        identified_ids_in_frame = []
        has_unknown = False
        has_unsafe_pose = False
        text_to_draw = [] # buffer for batch drawing
        
        # 1. Face
        current_faces_info = [] 
        if self.enable_face_rec and is_face_frame:
            t0 = time.time()
            try:
                with CameraStream._face_lock:
                    faces = self.app.get(frame_to_process)
                prof['face'] = (time.time() - t0) * 1000
                for face in faces:
                    b = face.bbox.astype(int)
                    eid, name, _ = self.face_recognizer.identify(face.embedding, threshold=self.face_recognition_threshold)
                    current_faces_info.append({
                        'center': ((b[0]+b[2])//2, (b[1]+b[3])//2), 'name': name, 'emp_id': eid,
                        'bbox': b, 'area': (b[2]-b[0])*(b[3]-b[1]), 'embedding': face.embedding
                    })
                    if not eid: has_unknown = True
            except Exception as e:
                print(f"[{self.camera_name}] Face Error: {e}")

        # 2. Objects (Phone)
        detected_phones = []
        if self.enable_phone_det and is_object_frame and self.yolo:
            t0 = time.time()
            try:
                res = self.yolo(frame_to_process, conf=self.phone_detection_confidence, verbose=False)
                prof['yolo'] = (time.time() - t0) * 1000
                for r in res:
                    for b in r.boxes:
                        if int(b.cls[0]) == 67: detected_phones.append({'box': b.xyxy[0].cpu().numpy().astype(int)})
            except: pass

        # 3. Fire
        has_fire = False
        if self.enable_fire_det and is_fire_frame:
            t0 = time.time()
            try:
                drawn, status, fires = self.fire_detector.process_frame(frame_to_process)
                processed_frame = drawn
                has_fire = len(fires) > 0
                prof['fire'] = (time.time() - t0) * 1000
            except: pass

        # 4. Pose
        pose_data = []
        if (self.enable_pose_det or self.enable_fall_det) and self.pose_yolo:
            t0 = time.time()
            try:
                # Optimized skipping using self.last_total_process_time
                skip_pose = (self.frame_idx % 3 == 0) and (getattr(self, 'last_total_process_time', 0) > 250)
                if not skip_pose:
                    p_res = self.pose_yolo.track(frame_to_process, conf=0.3, persist=True, verbose=False)
                    prof['pose'] = (time.time() - t0) * 1000
                    
                    track_ids_seen = set()
                    for r in p_res:
                        if hasattr(r, 'keypoints') and r.keypoints is not None:
                            bs = r.boxes
                            ids = bs.id.int().cpu().tolist() if bs.id is not None else [None] * len(bs)
                            for i, kpt_o in enumerate(r.keypoints):
                                tid, kpts, b = ids[i], kpt_o.xy[0].cpu().numpy(), bs.xyxy[i].cpu().numpy().astype(int)
                                vh = kpts[0:5][np.all(kpts[0:5] > 0, axis=1)]
                                hc = np.mean(vh, axis=0).astype(int) if len(vh) > 0 else np.array([(b[0]+b[2])//2, b[1]+20])
                                pose_data.append({'tid': tid, 'kpts': kpts, 'bbox': b, 'hc': hc, 'area': (b[2]-b[0])*(b[3]-b[1])*0.1})
                                if tid is not None: track_ids_seen.add(tid)

                    # Match
                    if is_face_frame and current_faces_info and pose_data:
                        nf, np_ = len(current_faces_info), len(pose_data)
                        dm = np.zeros((nf, np_))
                        for fi, f in enumerate(current_faces_info):
                            for pi, p in enumerate(pose_data):
                                dm[fi, pi] = math.sqrt((f['center'][0]-p['hc'][0])**2 + (f['center'][1]-p['hc'][1])**2)
                        try:
                            mf, mp = linear_sum_assignment(dm)
                            for fi, pi in zip(mf, mp):
                                if dm[fi, pi] < self.pose_matching_threshold:
                                    t_ = pose_data[pi]['tid']
                                    if t_ is not None: self.identity_cache[t_] = {'name': current_faces_info[fi]['name'], 'emp_id': current_faces_info[fi]['emp_id'], 'last_verified': now_ts, 'last_seen': now_ts}
                        except: pass

                    # Accumulate Draw Items
                    for p in pose_data:
                        tid, kpts, b = p['tid'], p['kpts'], p['bbox']
                        id_ = self.identity_cache.get(tid) if tid is not None else None
                        name, eid, stale = "Người lạ", None, False
                        if id_:
                            id_['last_seen'] = now_ts
                            dur = now_ts - id_['last_verified']
                            if dur < self.pose_stale_timeout:
                                stale = dur > self.pose_reverify_interval
                                name, eid = id_['name'], id_['emp_id']
                        
                        if eid:
                            identified_ids_in_frame.append(eid)
                            self.employee_presence[eid] = now_ts
                            if self.employee_presence_state.get(eid) != 'entered':
                                database.log_employee_presence(eid, 'enter'); self.employee_presence_state[eid] = 'entered'
                            if (now_ts - self.last_attendance_log.get(eid, 0)) > 10:
                                database.log_attendance(eid); self.last_attendance_log[eid] = now_ts

                        if self.show_pose_visualization:
                            color = (128, 128, 128) if stale else (0, 255, 0) if eid else (0, 0, 255)
                            
                            # Calculate Body Axis for Rotated Box
                            # Keypoints COCO format: 5=L_Shoulder, 6=R_Shoulder, 11=L_Hip, 12=R_Hip
                            # kpts is (17, 2), containing only x, y.
                            
                            # simple check: if x and y are not 0
                            shoulders_detected = (kpts[5][0] != 0 and kpts[6][0] != 0)
                            hips_detected = (kpts[11][0] != 0 and kpts[12][0] != 0)
                            
                            angle = 0
                            if shoulders_detected and hips_detected:
                                # Mid-shoulder
                                sx, sy = (kpts[5][0] + kpts[6][0]) / 2, (kpts[5][1] + kpts[6][1]) / 2
                                # Mid-hip
                                hx, hy = (kpts[11][0] + kpts[12][0]) / 2, (kpts[11][1] + kpts[12][1]) / 2
                                
                                # Standard vertical is (0, -1). Vector is (sx-hx, sy-hy).
                                dx = sx - hx
                                dy = sy - hy
                                
                                rad = math.atan2(dy, dx)
                                deg = math.degrees(rad)
                                
                                angle = deg + 90 
                                
                            # Create Rotated Rect
                            cx = float((b[0] + b[2]) / 2)
                            cy = float((b[1] + b[3]) / 2)
                            w = float(b[2] - b[0])
                            h = float(b[3] - b[1])
                            
                            if abs(angle) > 5 and abs(angle) < 80: # Filter extreme angles
                                rect = ((cx, cy), (w, h), angle)
                                try:
                                    box = cv2.boxPoints(rect)
                                    box = np.int32(box)
                                    cv2.drawContours(processed_frame, [box], 0, color, 2)
                                except Exception as e:
                                    print(f"Draw Box Error: {e}")
                                    cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), color, 2)
                            else:
                                cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), color, 2)
                            
                            # Draw Skeleton
                            if len(kpts) >= 17:
                                # Connections: index pairs (COCO)
                                # 5-7-9 (L Arm), 6-8-10 (R Arm)
                                # 11-13-15 (L Leg), 12-14-16 (R Leg)
                                # 5-6 (Shoulders), 11-12 (Hips)
                                # 5-11 (L Side), 6-12 (R Side)
                                connections = [
                                    (5,7), (7,9), (6,8), (8,10),
                                    (11,13), (13,15), (12,14), (14,16),
                                    (5,6), (11,12), (5,11), (6,12)
                                ]
                                for i, j in connections:
                                    if kpts[i][0] > 0 and kpts[i][1] > 0 and kpts[j][0] > 0 and kpts[j][1] > 0:
                                        pt1 = (int(kpts[i][0]), int(kpts[i][1]))
                                        pt2 = (int(kpts[j][0]), int(kpts[j][1]))
                                        cv2.line(processed_frame, pt1, pt2, color, 2)
                            
                            lbl = (f"Maybe {name}?" if stale else name)
                            text_to_draw.append((lbl, (b[0], b[1]-35), (0,255,0) if eid else (255,0,0), 22))
                        
                        if self.enable_fall_det and tid is not None:
                            status, _ = self.fall_detector.update(tid, kpts, now_ts)
                            if status >= FallDetector.STATUS_PRE_ALARM:
                                has_unsafe_pose = True
                                b_color = (0, 255, 255) if status == FallDetector.STATUS_PRE_ALARM else (0, 0, 255)
                                msg = "🆘 PHÁT HIỆN NGÃ" if status >= FallDetector.STATUS_ALARM else "⚠️ CẢNH BÁO NGÃ"
                                
                                # Draw rotated alert box too
                                if abs(angle) > 5 and abs(angle) < 80:
                                    rect = ((cx, cy), (w, h), angle)
                                    try:
                                        box = cv2.boxPoints(rect)
                                        box = np.int0(box)
                                        cv2.drawContours(processed_frame, [box], 0, b_color, 4)
                                    except Exception:
                                        cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), b_color, 4)
                                else:
                                    cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), b_color, 4)
                                    
                                text_to_draw.append((f"{msg}: {name}", (b[0], b[1]-65), b_color, 26))

                    # Cleanup
                    for t in list(self.identity_cache.keys()):
                        if t not in track_ids_seen and (now_ts - self.identity_cache[t]['last_seen'] > 30): del self.identity_cache[t]
            except Exception as e:
                print(f"[{self.camera_name}] Pose Error: {e}")

        # 5. Face Fallback (If no pose detected, or ensuring faces are handled)
        if not pose_data or not self.show_pose_visualization:
            for f in current_faces_info:
                b, c = f['bbox'], (0, 255, 0) if f['emp_id'] else (0, 0, 255)
                cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), c, 2)
                text_to_draw.append((f['name'], (b[0], b[1]-30), c[::-1], 20))
                
                # Logic for logging attendance from Face Only
                # Only log if pose detection didn't already handle it (i.e. pose_data is empty)
                if not pose_data:
                    eid = f['emp_id']
                    if eid:
                        identified_ids_in_frame.append(eid)
                        self.employee_presence[eid] = now_ts
                        
                        if self.employee_presence_state.get(eid) != 'entered':
                             database.log_employee_presence(eid, 'enter')
                             self.employee_presence_state[eid] = 'entered'
                             
                        if (now_ts - self.last_attendance_log.get(eid, 0)) > 10:
                            database.log_attendance(eid)
                            self.last_attendance_log[eid] = now_ts

        # 6. Phones
        for ph in detected_phones:
            b = ph['box']
            cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (255, 165, 0), 2)
            text_to_draw.append(("Điện thoại", (b[0], b[1]-25), (255, 165, 0), 18))
            
        # Perform Batch Drawing
        if text_to_draw:
            processed_frame = self._draw_batch_text(processed_frame, text_to_draw)

        # 7. Phone/Presence Logic
        if len(detected_phones) > 0 and identified_ids_in_frame:
            for eid in identified_ids_in_frame: database.update_phone_usage(eid, elapsed)
        for eid, last in list(self.employee_presence.items()):
            if eid not in identified_ids_in_frame and (now_ts - last > 10.0):
                if self.employee_presence_state.get(eid) == 'entered':
                    database.log_employee_presence(eid, 'leave'); self.employee_presence_state[eid] = 'left'

        # Profiling
        tt = (time.time() - t_start) * 1000
        self.last_total_process_time = tt # Store for skipping logic
        prof['total'] = tt
        if tt > 100:
            ps = ", ".join([f"{k}:{v:.0f}" for k,v in prof.items()])
            print(f"[{self.camera_name}] Slow frame: {ps}")

        return processed_frame, has_unknown, len(detected_phones)>0, has_fire, has_unsafe_pose

    def stop(self):
        self.is_running = False
        if self.capture.isOpened():
            self.capture.release()
