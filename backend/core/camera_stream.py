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
        
        # 1. Try Loading RKNN (NPU) Model on Orange Pi 5
        if os.uname().machine == 'aarch64':
            rknn_path = 'models/yolo26n.rknn' if os.path.exists('models/yolo26n.rknn') else 'yolo26n.rknn'
            # Check default YOLOv8 name too
            if not os.path.exists(rknn_path):
                 if os.path.exists('models/yolov8n.rknn'): rknn_path = 'models/yolov8n.rknn'
                 elif os.path.exists('yolov8n.rknn'): rknn_path = 'yolov8n.rknn'

            if os.path.exists(rknn_path):
                print(f"[{self.camera_name}] Loading NPU Model: {rknn_path}")
                try:
                    from core.rknn_yolo import RKNNYolo
                    return RKNNYolo(rknn_path)
                except Exception as e:
                    print(f"[{self.camera_name}] RKNN Load Failed: {e}. Fallback to CPU.")

        # 2. Fallback to Standard PyTorch/ONNX (CPU)
        print(f"[{self.camera_name}] Loading YOLO26 (CPU) for object detection...")
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
        
        self.camera_config = camera_config or {}
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
            # Force TCP for RTSP stability (prevents corrupt frames/gray screen)
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            print(f"[{self.camera_name}] Enforcing RTSP Transport: TCP")
        else:
            try: self.camera_source = int(self.camera_source_str)
            except: self.camera_source = self.camera_source_str
        
        # Check for Rockchip NPU / ORANGE PI 5
        # Note: True NPU usage requires converting models to .rknn format.
        # This is a placeholder to allow future NPU integration.
        # For now, we optimize CPU threads for ARM.
        if os.uname().machine == 'aarch64':
             print(f"[{self.camera_name}] Detected ARM/NPU Environment (Orange Pi 5?)")
             # Set OpenCV to using slightly less threads to leave room for NPU/YOLO
             cv2.setNumThreads(2)
        
        # Restricted Zones State
        self.restricted_zones = [] 
        self.person_restricted_states = {}
        
        print(f"[{self.camera_name}] Initializing on {self.camera_source}")
        self.apply_settings()

        self.capture = cv2.VideoCapture(self.camera_source)
        
        # Optimize for Low Latency
        try:
            # Set buffer size to 1 to always get the latest frame
            self.capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except: pass
        
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
        self.last_pose_data = [] # Persistent pose across frames

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
        
        # Phone Tracking & State Machine
        self.phone_tracks = {} # {id: {'bbox': bbox, 'last_seen': ts, 'person_id': id, 'conf_count': count}}
        self.person_phone_states = {} # {emp_id: {'violation_start': ts, 'grace_frames': count}}
        self.next_phone_id = 1
        self.historical_face_width = 0 # For adaptive threshold fallback
        
        # Snapshot Cache (Optimized API performance)
        self.snapshot_cache = {'jpeg': None, 'ts': 0}
        
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
        
        # Restricted Zones
        self.restricted_zones = self.camera_config.get('restricted_zones', [])
        if self.restricted_zones is None: self.restricted_zones = []
        
        # Reset violation states on setting change to avoid "sticky" alarms
        self.person_restricted_states = {}
        
        print(f"[{self.camera_name}] Settings applied: Face={self.enable_face_rec}, Zones={len(self.restricted_zones) if isinstance(self.restricted_zones, list) else 0}")

    def update_settings(self, new_config=None):
        """Fetch updated thresholds and fall det settings."""
        self.global_settings = database.get_settings()
        if new_config:
            self.camera_config = new_config
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
            # Read freely to drain buffer
            ret, frame = self.capture.read()
            if ret:
                with self.lock:
                    self.frame = frame
            else:
                # If reading fails, small sleep to prevent CPU spike
                time.sleep(0.01)
                
    def get_frame(self):
        with self.lock:
            if self.frame is None:
                return None
            return self.frame.copy()
    def get_snapshot_jpeg(self):
        """Get JPEG-encoded snapshot with caching to prevent AI thread slowdown."""
        now = time.time()
        # Return cache if less than 1.5 seconds old
        if self.snapshot_cache['jpeg'] and (now - self.snapshot_cache['ts'] < 1.5):
            return self.snapshot_cache['jpeg']
            
        frame = self.get_frame()
        if frame is None: return None
        
        # Encode with slightly lower quality to be faster
        success, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not success: return None
        jpeg_bytes = buffer.tobytes()
        
        self.snapshot_cache = {'jpeg': jpeg_bytes, 'ts': now}
        return jpeg_bytes

    def _calculate_iou(self, boxA, boxB):
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])
        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
        iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
        return iou

    def _update_phone_tracks(self, current_detections, now_ts):
        """Simple IOU-based tracking for phone boxes."""
        matched_indices = set()
        new_tracks = {}
        
        # 1. Try to match current detections with existing tracks
        for track_id, track in self.phone_tracks.items():
            best_iou = 0.3 # Minimum IOU threshold for match
            best_idx = -1
            
            for i, det in enumerate(current_detections):
                if i in matched_indices: continue
                iou = self._calculate_iou(track['bbox'], det['box'])
                if iou > best_iou:
                    best_iou = iou
                    best_idx = i
            
            if best_idx != -1:
                matched_indices.add(best_idx)
                track['bbox'] = current_detections[best_idx]['box']
                track['last_seen'] = now_ts
                new_tracks[track_id] = track
            elif now_ts - track['last_seen'] < 1.0: # Grace period for track (1s)
                new_tracks[track_id] = track
        
        # 2. Create new tracks for unmatched detections
        for i, det in enumerate(current_detections):
            if i not in matched_indices:
                new_tracks[self.next_phone_id] = {
                    'bbox': det['box'],
                    'last_seen': now_ts,
                    'person_id': None,
                    'conf_count': 0
                }
                self.next_phone_id += 1
        
        self.phone_tracks = new_tracks
        return self.phone_tracks

    def _assign_phones_to_employees(self, phone_tracks, faces_info, pose_data, now_ts):
        """Attribution using Keypoint-Aware scoring & Temporal Logic."""
        assignments = {} # {phone_track_id: emp_id}
        
        # 1. Determine Scale Factor for Adaptive Threshold
        scale_factor = 100 # default proxy
        if pose_data:
            # use avg shoulder width if possible
            sws = []
            for p in pose_data:
                k = p['kpts']
                if k[5][0]>0 and k[6][0]>0:
                    sws.append(math.sqrt((k[5][0]-k[6][0])**2 + (k[5][1]-k[6][1])**2))
            if sws: scale_factor = np.mean(sws)
        elif faces_info:
            fws = [f['bbox'][2]-f['bbox'][0] for f in faces_info]
            if fws: 
                scale_factor = np.mean(fws)
                self.historical_face_width = scale_factor # save as proxy
        elif self.historical_face_width > 0:
            scale_factor = self.historical_face_width
            
        threshold = 3.0 * scale_factor # Adaptive Threshold k=3.0
        
        # 2. Score Candidates
        for tid, track in phone_tracks.items():
            best_score = 0
            best_emp_id = None
            
            p_box = track['bbox']
            p_center = ((p_box[0]+p_box[2])//2, (p_box[1]+p_box[3])//2)
            
            # Combine face and pose into cohesive 'person' candidates
            for p in (pose_data or []):
                # Try to find corresponding face/identity from identity_cache
                id_info = self.identity_cache.get(p['tid'])
                if not id_info or not id_info.get('emp_id'): continue
                
                emp_id = id_info['emp_id']
                kpts = p['kpts']
                
                # Formula components
                # Use max of IoU or containment to handle small phone vs large body
                iou = self._calculate_iou(p_box, p['bbox'])
                
                # Normalized distance to Wrist
                wrists = []
                if kpts[9][0]>0: wrists.append(kpts[9])
                if kpts[10][0]>0: wrists.append(kpts[10])
                
                d_norm = 1.0
                if wrists:
                    dists = [math.sqrt((p_center[0]-w[0])**2 + (p_center[1]-w[1])**2) for w in wrists]
                    d_norm = min(dists) / threshold
                
                # Pose Bonus (Ear/Head area)
                pose_bonus = 0
                ears = []
                if kpts[3][0]>0: ears.append(kpts[3])
                if kpts[4][0]>0: ears.append(kpts[4])
                for ear in ears:
                    if math.sqrt((p_center[0]-ear[0])**2 + (p_center[1]-ear[1])**2) < (scale_factor * 0.7):
                        pose_bonus = 0.6 # High bonus for ear proximity (calling behavior)
                        break
                
                # Weights: Prioritize distance to keypoints (80%) + IoU (20%) + Bonus
                score = (0.2 * iou) + (0.8 * (1 - min(1.0, d_norm))) + pose_bonus
                
                if score > best_score:
                    best_score = score
                    best_emp_id = emp_id

            # Fallback to Face Only if no pose match or low score
            if best_score < 0.4:
                for f in faces_info:
                    if not f['emp_id']: continue
                    iou = self._calculate_iou(p_box, f['bbox'])
                    d = math.sqrt((p_center[0]-f['center'][0])**2 + (p_center[1]-f['center'][1])**2)
                    d_norm = d / threshold
                    score = (0.4 * iou) + (0.6 * (1 - min(1.0, d_norm)))
                    if score > best_score:
                        best_score = score
                        best_emp_id = f['emp_id']

            # 3. Final Assignment & Logging
            if best_score > 0.6:
                assignments[tid] = best_emp_id
                track['person_id'] = best_emp_id # Update track persistent identity
                # Structured JSON Log
                import json
                log_data = {"frame": self.frame_idx, "phone_id": tid, "emp_id": best_emp_id, "score": round(best_score, 2), "method": "keypoint" if pose_data else "bbox"}
                # print(f"[Phone Attribution] {json.dumps(log_data)}")
            elif track['person_id'] and best_score > 0.3:
                # Temporal Override: Keep previous ID if score is still decent
                assignments[tid] = track['person_id']
                
        return assignments

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
        has_restricted = False
        restricted_violators = set()
        text_to_draw = [] # buffer for batch drawing
        
        ph, pw = processed_frame.shape[:2]
        
        # 0. Draw Restricted Zones
        scaled_zones = []
        if self.restricted_zones:
            for zone in self.restricted_zones:
                if not zone: continue
                scaled_zones.append(np.array([[int(p[0] * pw), int(p[1] * ph)] for p in zone], np.int32))
            
            overlay = processed_frame.copy()
            for pts in scaled_zones:
                cv2.fillPoly(overlay, [pts], (0, 0, 255))
            cv2.addWeighted(overlay, 0.25, processed_frame, 0.75, 0, processed_frame)
            for pts in scaled_zones:
                cv2.polylines(processed_frame, [pts], True, (0, 0, 255), 1)
                # Draw small label
                cv2.putText(processed_frame, "RESTRICTED", (pts[0][0], pts[0][1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
            
            text_to_draw.append(("🛡️ GIÁM SÁT VÙNG CẤM: ĐANG BẬT", (pw - 250, 30), (0, 0, 255), 18))
        
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
                track_ids_seen = set()
                # Optimized skipping using self.last_total_process_time
                skip_pose = (self.frame_idx % 3 == 0) and (getattr(self, 'last_total_process_time', 0) > 250)
                
                if not skip_pose:
                    # Lower threshold for tracking to be more permissive
                    p_res = self.pose_yolo.track(frame_to_process, conf=self.pose_detection_confidence * 0.5, persist=True, verbose=False)
                    prof['pose'] = (time.time() - t_start) * 1000
                    
                    pose_data = []
                    for r in p_res:
                        if hasattr(r, 'keypoints') and r.keypoints is not None:
                            bs = r.boxes
                            ids = bs.id.int().cpu().tolist() if bs.id is not None else [None] * len(bs)
                            pxy = r.keypoints.xy.cpu().numpy()
                            pconf = r.keypoints.conf.cpu().numpy() if r.keypoints.conf is not None else None
                            for i in range(len(pxy)):
                                tid, kpts, b = ids[i], pxy[i], bs.xyxy[i].cpu().numpy().astype(int)
                                # Filter only truly detected points
                                vh = kpts[0:5][np.all(kpts[0:5] > 0, axis=1)]
                                hc = np.mean(vh, axis=0).astype(int) if len(vh) > 0 else np.array([(b[0]+b[2])//2, b[1]+20])
                                pose_data.append({'tid': tid, 'kpts': kpts, 'kconf': pconf[i] if pconf is not None else None, 'bbox': b, 'hc': hc, 'area': (b[2]-b[0])*(b[3]-b[1])*0.1})
                    self.last_pose_data = pose_data
                else:
                    pose_data = self.last_pose_data
                
                for p in pose_data:
                    if p['tid'] is not None: track_ids_seen.add(p['tid'])

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
                    kconf = p.get('kconf')
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

                        # --- Restricted Zone Detection Logic (Always Run) ---
                        in_restricted = False
                        detect_point = None
                        if scaled_zones:
                            # Use Feet (Ankles) or BBox Bottom-Center
                            check_pts = []
                            if kpts[15][0] > 0: check_pts.append(kpts[15]) # L Ankle
                            if kpts[16][0] > 0: check_pts.append(kpts[16]) # R Ankle
                            if not check_pts: check_pts.append([(b[0]+b[2])/2, b[3]]) # BBox Bottom
                            
                            for cp in check_pts:
                                for szone in scaled_zones:
                                    # Convert to float for opencv
                                    if cv2.pointPolygonTest(szone, (float(cp[0]), float(cp[1])), False) >= 0:
                                        in_restricted = True
                                        detect_point = cp
                                        break
                                if in_restricted: break

                            # DEBUG: Draw detect points in view to verify logic
                            if self.show_pose_visualization:
                                for cp in check_pts:
                                    color = (0, 0, 255) if in_restricted else (0, 255, 255)
                                    cv2.circle(processed_frame, (int(cp[0]), int(cp[1])), 5, color, -1)
                                    cv2.circle(processed_frame, (int(cp[0]), int(cp[1])), 8, (255, 255, 255), 1)

                            # Track violation state using tid (or fall back to a session-based ID if needed)
                            # If no tid, we treat as a single anonymous person for that frame
                            state_id = tid if tid is not None else f"anon_{id(p)}"
                            
                            rst = self.person_restricted_states.get(state_id, {'count': 0})
                            if in_restricted:
                                rst['count'] = min(8, rst['count'] + 1) # Cap at 8
                            else:
                                rst['count'] = max(0, rst['count'] - 2) # Drop twice as fast
                            rst['last_seen'] = now_ts
                            self.person_restricted_states[state_id] = rst
                            
                            # Trigger alarm if count is high enough
                            if rst['count'] >= 4:
                                has_restricted = True
                                v_name = name if name != "Người lạ" else (f"Khách #{tid}" if tid is not None else "Người lạ")
                                # Only add to active violators if CURRENTLY/RECENTLY in the zone
                                restricted_violators.add(v_name)
                                
                                # Visual Alert on Frame
                                cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), (0, 0, 255), 3)
                                # Glow effect for text - Show specific name warning
                                warning_text = f"{v_name}: đã đi vào khu vực cấm"
                                text_to_draw.append((warning_text, (b[0], b[1]-65), (0, 0, 255), 24))
                                if eid:
                                    # Mark as high priority for attendance log
                                    self.last_attendance_log[eid] = now_ts - 5 # Force some priority?

                        if self.show_pose_visualization:
                            color = (128, 128, 128) if stale else (0, 255, 0) if eid else (0, 0, 255)
                            cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), color, 1)
                            
                            # Connections
                            cc = [(0,1), (0,2), (1,3), (2,4), (5,6), (5,7), (7,9), (6,8), (8,10), (11,12), (5,11), (6,12), (11,13), (12,14), (13,15), (14,16)]
                            for i, j in cc:
                                if i < len(kpts) and j < len(kpts) and kpts[i][0] > 0 and kpts[j][0] > 0:
                                    cv2.line(processed_frame, (int(kpts[i][0]), int(kpts[i][1])), (int(kpts[j][0]), int(kpts[j][1])), color, 2)
                            
                            # Keypoints with GLOW
                            for idx, kp in enumerate(kpts):
                                if kp[0] > 0:
                                    if idx < 5: # Face
                                        cv2.circle(processed_frame, (int(kp[0]), int(kp[1])), 6, (255, 255, 255), -1)
                                        cv2.circle(processed_frame, (int(kp[0]), int(kp[1])), 9, (0, 255, 255), 2)
                                    else:
                                        cv2.circle(processed_frame, (int(kp[0]), int(kp[1])), 3, color, -1)

                            lbl = (f"Maybe {name}?" if stale else name)
                            text_to_draw.append((lbl, (b[0], b[1]-35), color, 22))
                    
                    if self.enable_fall_det and tid is not None:
                        status, _ = self.fall_detector.update(tid, kpts, now_ts)
                        if status >= FallDetector.STATUS_PRE_ALARM:
                            has_unsafe_pose = True
                            b_color = (0, 255, 255) if status == FallDetector.STATUS_PRE_ALARM else (0, 0, 255)
                            msg = "🆘 PHÁT HIỆN NGÃ" if status >= FallDetector.STATUS_ALARM else "⚠️ CẢNH BÁO NGÃ"
                            cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), b_color, 4)
                            text_to_draw.append((f"{msg}: {name}", (b[0], b[1]-65), b_color, 26))

                # Status Info (Always show if anything found)
                text_to_draw.append((f"POSE STATUS: {len(pose_data)} IDs", (10, 30), (0, 255, 255), 20))
                text_to_draw.append(("POSE ENGINE v2.0", (10, 60), (0, 255, 0), 18))
                
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

        # 6. Phone Tracking & Assignment
        current_assignments = {}
        if self.enable_phone_det:
             tracked_phones = self._update_phone_tracks(detected_phones, now_ts)
             current_assignments = self._assign_phones_to_employees(tracked_phones, current_faces_info, pose_data, now_ts)
             
             # Draw Assigned Phones
             for tid, track in tracked_phones.items():
                 b = track['bbox']
                 eid = current_assignments.get(tid)
                 color = (0, 165, 255) if eid else (255, 165, 0) # Blue-ish if assigned, Orange if not
                 cv2.rectangle(processed_frame, (b[0], b[1]), (b[2], b[3]), color, 2)
                 lbl = f"Phone {tid}"
                 if eid:
                     # Find name for eid
                     name = "Unknown"
                     for f in current_faces_info:
                         if f['emp_id'] == eid: name = f['name']; break
                     if name == "Unknown":
                         # check identity cache
                         for id_ in self.identity_cache.values():
                             if id_['emp_id'] == eid: name = id_['name']; break
                     lbl += f" ({name})"
                     # Draw line to person
                     # (Future improvement: find person bbox center and draw line)
                 text_to_draw.append((lbl, (b[0], b[1]-25), color, 18))
            
        # 7. Phone/Presence Logic (State Machine Implementation)
        active_ids_with_phone = set(current_assignments.values())
        
        # State Machine Update: Handle active detections first
        for eid in identified_ids_in_frame:
            if eid in active_ids_with_phone:
                if eid not in self.person_phone_states:
                    self.person_phone_states[eid] = {'count': 0, 'grace': 0}
                self.person_phone_states[eid]['count'] += 1
                self.person_phone_states[eid]['grace'] = 60 # Extended Grace Period (2s @ 30fps)
                if self.person_phone_states[eid]['count'] >= 5: # Back to 5 for faster response
                    database.update_phone_usage(eid, elapsed)
        
        # Draw Warnings based on State Machine (persists even if face is lost)
        alert_y_offset = 40
        for eid, state in list(self.person_phone_states.items()):
            # Update grace for lost persons
            if eid not in active_ids_with_phone:
                if state['grace'] > 0:
                    state['grace'] -= 1
                    database.update_phone_usage(eid, elapsed)
                else:
                    state['count'] = 0
            
            # Draw if count threshold met
            if state['count'] >= 5 and state['grace'] > 0:
                # Resolve Name
                emp_name = "Unknown"
                # Search in all known places
                for f in current_faces_info:
                    if f['emp_id'] == eid: emp_name = f['name']; break
                if emp_name == "Unknown":
                    # Check list of known employees if possible or identity cache
                    for id_info in self.identity_cache.values():
                        if id_info.get('emp_id') == eid: emp_name = id_info['name']; break
                if emp_name == "Unknown":
                    # Fallback to names list from reload_faces
                    if hasattr(self, 'known_employee_ids') and eid in self.known_employee_ids:
                        idx = self.known_employee_ids.index(eid)
                        emp_name = self.known_names[idx]

                color = (0, 0, 255) if eid in active_ids_with_phone else (0, 165, 255)
                text_to_draw.append((f"⚠️ VI PHẠM: {emp_name} ĐANG DÙNG ĐIỆN THOẠI", (20, alert_y_offset), color, 28))
                alert_y_offset += 35
        
        # Perform Batch Drawing at the end of logic
        if text_to_draw:
            processed_frame = self._draw_batch_text(processed_frame, text_to_draw)
        
        # Presence Logic
        for eid, last in list(self.employee_presence.items()):
            if eid not in identified_ids_in_frame and (now_ts - last > 10.0):
                if self.employee_presence_state.get(eid) == 'entered':
                    database.log_employee_presence(eid, 'leave'); self.employee_presence_state[eid] = 'left'
                    # Clear phone state on leave
                    if eid in self.person_phone_states: del self.person_phone_states[eid]

        # 8. Final Return with Active Violator Names
        phone_violators = []
        for eid, state in self.person_phone_states.items():
            if state['count'] >= 5 and state['grace'] > 0:
                emp_name = "Unknown"
                for f in current_faces_info:
                    if f['emp_id'] == eid: emp_name = f['name']; break
                if emp_name == "Unknown":
                    for id_info in self.identity_cache.values():
                        if id_info.get('emp_id') == eid: emp_name = id_info['name']; break
                if emp_name == "Unknown" and hasattr(self, 'known_employee_ids') and eid in self.known_employee_ids:
                    emp_name = self.known_names[self.known_employee_ids.index(eid)]
                
                if emp_name not in phone_violators:
                    phone_violators.append(emp_name)
                    
        # List of Restricted Zone Violators
        r_violators = list(restricted_violators)

        # Cleanup Restricted States
        for t in list(self.person_restricted_states.keys()):
            if now_ts - self.person_restricted_states[t].get('last_seen', 0) > 30:
                del self.person_restricted_states[t]

        return processed_frame, has_unknown, phone_violators, has_fire, has_unsafe_pose, r_violators, has_restricted

    def stop(self):
        self.is_running = False
        if self.capture.isOpened():
            self.capture.release()
