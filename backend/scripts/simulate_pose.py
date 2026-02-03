import numpy as np
import time
import math
from scipy.optimize import linear_sum_assignment

def calculate_dist(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

class IdentityCache:
    def __init__(self):
        self.cache = {}
    def update(self, tid, name, now):
        self.cache[tid] = {'name': name, 'last_verified': now, 'last_seen': now}
    def get(self, tid):
        return self.cache.get(tid)

def simulate_scenario(name, num_frames, face_frequency, path_func_1, path_func_2):
    print(f"\n--- Scenario: {name} ---")
    cache = IdentityCache()
    
    # Matching params
    threshold = 50
    reverify_interval = 2.0
    timeout = 10.0
    
    stats = {'matches': 0, 'mismatches': 0, 'stale': 0, 'unknown': 0}

    for f in range(num_frames):
        now = f * 0.1 # 10 FPS
        is_face_frame = (f % face_frequency == 0)
        
        # Poses are always there
        p1_pos = path_func_1(now)
        p2_pos = path_func_2(now)
        poses = [{'tid': 1, 'pos': p1_pos}, {'tid': 2, 'pos': p2_pos}]
        
        # Faces might be missing
        faces = []
        if is_face_frame:
            # Person 1 face visible?
            if p1_pos[2]: # visible flag
                faces.append({'name': 'Alice', 'pos': p1_pos[:2], 'area': 100})
            if p2_pos[2]:
                faces.append({'name': 'Bob', 'pos': p2_pos[:2], 'area': 100})

        # Matching
        if is_face_frame and faces:
            dist_matrix = np.zeros((len(faces), len(poses)))
            for fi, face in enumerate(faces):
                for pi, pose in enumerate(poses):
                    dist_matrix[fi, pi] = calculate_dist(face['pos'], pose['pos'])
            
            mf, mp = linear_sum_assignment(dist_matrix)
            for fi, pi in zip(mf, mp):
                if dist_matrix[fi, pi] < threshold:
                    cache.update(poses[pi]['tid'], faces[fi]['name'], now)

        # Recognition Display
        for pose in poses:
            identity = cache.get(pose['tid'])
            if identity:
                identity['last_seen'] = now
                if (now - identity['last_verified']) > reverify_interval:
                    stats['stale'] += 1
                    status = f"Stale {identity['name']}"
                else:
                    stats['matches'] += 1
                    status = identity['name']
                
                if (now - identity['last_verified']) > timeout:
                    status = "Unknown"
                    stats['unknown'] += 1
            else:
                stats['unknown'] += 1
                status = "Unknown"
            
            # print(f"Frame {f}: Pose {pose['tid']} at {pose['pos'][:2]} -> {status}")

    print(f"Stats: {stats}")

# Scenarios
def scenario_crossing(t):
    # Person 1: left to right
    # Person 2: right to left
    # Cross at t=2.5
    p1 = (100 + 50*t, 200, True)
    p2 = (400 - 50*t, 200, True)
    return p1, p2

def scenario_occlusion(t):
    # Person 1 face disappears between t=1 and t=4
    p1 = (100, 200, (t < 1 or t > 4))
    p2 = (300, 200, True)
    return p1, p2

if __name__ == "__main__":
    # Crossing
    simulate_scenario("Crossing Paths", 50, 5, 
                     lambda t: scenario_crossing(t)[0], 
                     lambda t: scenario_crossing(t)[1])
    
    # Occlusion
    simulate_scenario("Occlusion", 50, 5, 
                     lambda t: scenario_occlusion(t)[0], 
                     lambda t: scenario_occlusion(t)[1])
