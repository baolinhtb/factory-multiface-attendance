import time
import math
import numpy as np

class FallDetector:
    """
    Module for robust Fall Detection using Keypoint Analysis.
    Implements:
    1. Angle-based State Detection (Standing, Bending, Lying)
    2. Velocity Check (High Impact)
    3. Transition Speed Analysis (Fast vs Slow)
    4. Inactivity Monitoring (Pre-Alarm -> Confirmed Alarm)
    """

    # Constants
    STATE_STANDING = "STANDING"
    STATE_BENDING = "BENDING"
    STATE_LYING = "LYING"
    
    # Alert States
    STATUS_NORMAL = "NORMAL"
    STATUS_RESTING = "RESTING" # Lying but slow transition
    STATUS_PRE_ALARM = "PRE_ALARM" # Potential fall, waiting for inactivity check
    STATUS_ALARM = "ALARM" # Confirmed fall
    
    # Config
    ANGLE_STANDING_MAX = 30
    ANGLE_LYING_MIN = 60
    
    HISTORY_DURATION = 2.0 # Seconds to look back for transition
    FALL_TRANSITION_MAX_TIME = 1.5 # Seconds. Faster than this = Fall.
    
    HIGH_IMPACT_VELOCITY_THRESHOLD = 500 # pixels/sec (approx, depends on resolution)
    
    INACTIVITY_DURATION = 3.0 # Seconds to wait in PRE_ALARM
    INACTIVITY_DISTANCE_THRESHOLD = 50 # Pixels. Movement less than this = Inactive.

    MIN_CONFIDENCE = 0.6

    def __init__(self):
        # Dictionary to store state for each track_id
        # { track_id: { 
        #       'history': [(ts, hip_y, state), ...], 
        #       'current_status': STATUS_NORMAL,
        #       'pre_alarm_start_time': None,
        #       'pre_alarm_start_pos': (x,y),
        #       'last_seen': ts
        #   }
        # }
        self.tracks = {}

    def cleanup(self, max_age=10.0):
        """Remove old tracks to save memory"""
        now = time.time()
        to_remove = []
        for tid, data in self.tracks.items():
            if now - data['last_seen'] > max_age:
                to_remove.append(tid)
        for tid in to_remove:
            del self.tracks[tid]

    def get_angle(self, p1, p2):
        """Calculate angle with vertical axis (0 degrees = upright)"""
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]  # y increases downwards
        if dy == 0: return 90.0
        angle = math.degrees(math.atan2(abs(dx), abs(dy)))
        return angle

    def update(self, track_id, keypoints, timestamp):
        """
        Process new keypoints for a track_id.
        keypoints: numpy array shape (17, 2 or 3) or list of tuples. COCO format.
        """
        if track_id not in self.tracks:
            self.tracks[track_id] = {
                'history': [],
                'current_status': self.STATUS_NORMAL,
                'pre_alarm_start_time': None,
                'pre_alarm_start_center': None,
                'last_seen': timestamp
            }
        
        track = self.tracks[track_id]
        track['last_seen'] = timestamp
        
        # 1. Extract Critical Keypoints
        # 5: Left Shoulder, 6: Right Shoulder
        # 11: Left Hip, 12: Right Hip
        try:
            # Handle different YOLO output formats (sometimes (17,3) with conf, sometimes (17,2))
            kpts = np.array(keypoints)
            if kpts.shape[1] == 3:
                confs = kpts[:, 2]
                pts = kpts[:, :2]
            else:
                confs = np.ones(17) # Assume 1 if not provided? Or pass confs separately.
                pts = kpts

            l_sh = pts[5]
            r_sh = pts[6]
            l_hip = pts[11]
            r_hip = pts[12]
            
            l_sh_conf = confs[5]
            r_sh_conf = confs[6]
            l_hip_conf = confs[11]
            r_hip_conf = confs[12]
            
            # 2. Validity Check (Smoothing)
            # If any of the 4 key points has low confidence, rely on previous state (or skip)
            if min(l_sh_conf, r_sh_conf, l_hip_conf, r_hip_conf) < self.MIN_CONFIDENCE:
                # Keep previous state but update timestamp
                 if track['history']:
                     last_state = track['history'][-1][2]
                     # If we can't see them clearly, maybe we shouldn't update 'history' with bad data,
                     # but we need to keep time moving.
                     # Strategy: Don't add to history, just return current status.
                     return track['current_status'], 0.0
                 return self.STATUS_NORMAL, 0.0

            # Calculate Midpoints
            mid_shoulder = (l_sh + r_sh) / 2
            mid_hip = (l_hip + r_hip) / 2
            
            # 3. Determine Posture State
            angle = self.get_angle(mid_shoulder, mid_hip)
            
            if angle < self.ANGLE_STANDING_MAX:
                current_posture = self.STATE_STANDING
            elif angle > self.ANGLE_LYING_MIN:
                current_posture = self.STATE_LYING
            else:
                current_posture = self.STATE_BENDING
            
            # Add to history
            track['history'].append((timestamp, mid_hip[1], current_posture))
            # Prune history
            track['history'] = [h for h in track['history'] if timestamp - h[0] <= self.HISTORY_DURATION]
            
            # 4. Velocity Check (High Impact)
            # Calculate vertical velocity of hip in last ~0.5s or instantaneous
            velocity = 0.0
            is_high_impact = False
            if len(track['history']) > 2:
                # Compare current hip y with hip y from 0.2s ago
                prev_h = track['history'][0] # Oldest in buffer (max 2s) or scan for specific window
                # Let's verify specifically the last 200ms for impact
                for h in reversed(track['history']):
                    dt = timestamp - h[0]
                    if dt > 0.1 and dt < 0.3: # Good window for velocity
                        dy = mid_hip[1] - h[1] # Positive dy = moving down
                        velocity = dy / dt
                        if velocity > self.HIGH_IMPACT_VELOCITY_THRESHOLD:
                            is_high_impact = True
                        break

        except Exception as e:
            print(f"Error in FallDetector: {e}")
            return self.STATUS_NORMAL, 0.0

        # ==========================================
        # 5. Logic Decision Machine
        # ==========================================
        
        # IF ALREADY ALARMED
        if track['current_status'] == self.STATUS_ALARM:
            # Remain in ALARM until manual reset or they stand up clearly
            if current_posture == self.STATE_STANDING:
                 track['current_status'] = self.STATUS_NORMAL
            return self.STATUS_ALARM, 1.0

        # IF IN PRE_ALARM (Monitoring Inactivity)
        elif track['current_status'] == self.STATUS_PRE_ALARM:
            elapsed = timestamp - track['pre_alarm_start_time']
            
            # Check for recovery (Standing up)
            if current_posture == self.STATE_STANDING:
                track['current_status'] = self.STATUS_NORMAL
                return self.STATUS_NORMAL, 0.0
            
            # Check for Movement
            dist = np.linalg.norm(mid_hip - track['pre_alarm_start_center'])
            
            if dist > self.INACTIVITY_DISTANCE_THRESHOLD:
                # Moving too much -> Likely exercising or trying to get up -> Cancel Alarm
                track['current_status'] = self.STATUS_NORMAL # Or STATUS_RESTING?
                return self.STATUS_NORMAL, 0.0
            
            # Time's up?
            if elapsed >= self.INACTIVITY_DURATION:
                # Still lying, didn't move much -> CONFIRM ALARM
                track['current_status'] = self.STATUS_ALARM
                return self.STATUS_ALARM, 1.0
            
            # Still waiting
            return self.STATUS_PRE_ALARM, 0.0

        # IF NORMAL or RESTING -> CHECK FOR FALL
        else:
            if current_posture == self.STATE_LYING:
                # Check HOW they got here
                
                # Check 1: Fast Transition?
                # Find last time they were STANDING
                time_standing = None
                for h in reversed(track['history']):
                    if h[2] == self.STATE_STANDING:
                        time_standing = h[0]
                        break
                
                transition_fast = False
                if time_standing:
                    delta = timestamp - time_standing
                    if delta < self.FALL_TRANSITION_MAX_TIME:
                        transition_fast = True
                
                # Logic: If (Fast Transition OR High Impact) -> PRE_ALARM
                if transition_fast or is_high_impact:
                    track['current_status'] = self.STATUS_PRE_ALARM
                    track['pre_alarm_start_time'] = timestamp
                    track['pre_alarm_start_center'] = mid_hip
                    return self.STATUS_PRE_ALARM, 0.0
                
                # If Slow transition and No impact -> RESTING
                if not transition_fast and not is_high_impact:
                     track['current_status'] = self.STATUS_RESTING
                     return self.STATUS_RESTING, 0.0

            else:
                # Standing or Bending -> Reset to Normal
                track['current_status'] = self.STATUS_NORMAL
                return self.STATUS_NORMAL, 0.0

        return self.STATUS_NORMAL, 0.0
