import unittest
import numpy as np
import math
from scipy.optimize import linear_sum_assignment

def greedy_match(dist_matrix, threshold, area_ratio_threshold, faces_info, pose_data):
    num_f, num_p = len(faces_info), len(pose_data)
    pairs = sorted([(f, p, dist_matrix[f, p]) for f in range(num_f) for p in range(num_p)], key=lambda x: x[2])
    matched = []
    used_f, used_p = set(), set()
    for f, p, d in pairs:
        if f not in used_f and p not in used_p:
            face, pose = faces_info[f], pose_data[p]
            ratio = min(face['area'], pose['area']) / max(face['area'], pose['area']) if pose['area'] > 0 else 0
            if d < threshold and ratio > area_ratio_threshold:
                matched.append((f, p))
                used_f.add(f)
                used_p.add(p)
    return matched

def hungarian_match(dist_matrix, threshold, area_ratio_threshold, faces_info, pose_data):
    num_f, num_p = len(faces_info), len(pose_data)
    mf, mp = linear_sum_assignment(dist_matrix)
    matched = []
    for f, p in zip(mf, mp):
        d = dist_matrix[f, p]
        face, pose = faces_info[f], pose_data[p]
        ratio = min(face['area'], pose['area']) / max(face['area'], pose['area']) if pose['area'] > 0 else 0
        if d < threshold and ratio > area_ratio_threshold:
            matched.append((f, p))
    return matched

class TestPoseMatching(unittest.TestCase):
    def setUp(self):
        self.threshold = 100
        self.area_ratio = 0.5
        
    def test_greedy_simple(self):
        faces = [{'center': (10, 10), 'area': 100}]
        poses = [{'head_center': (12, 12), 'area': 90}]
        dist = np.array([[math.sqrt(2**2 + 2**2)]])
        res = greedy_match(dist, self.threshold, self.area_ratio, faces, poses)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0], (0, 0))

    def test_greedy_mismatch_area(self):
        faces = [{'center': (10, 10), 'area': 1000}]
        poses = [{'head_center': (12, 12), 'area': 100}] # Area ratio 0.1
        dist = np.array([[math.sqrt(2**2 + 2**2)]])
        res = greedy_match(dist, self.threshold, self.area_ratio, faces, poses)
        self.assertEqual(len(res), 0)

    def test_hungarian_assignment(self):
        # Case where greedy might pick a sub-optimal global match if not sorting globally correctly
        # But our greedy sorts globally, so it should be fine.
        # Let's test a case where Hungarian is better.
        # Face 0: (0,0), Face 1: (10,0)
        # Pose 0: (2,0), Pose 1: (8,0)
        # Dist Matrix:
        # F0-P0: 2, F0-P1: 8
        # F1-P0: 8, F1-P1: 2
        faces = [{'center': (0, 0), 'area': 100}, {'center': (10, 0), 'area': 100}]
        poses = [{'head_center': (2, 0), 'area': 100}, {'head_center': (8, 0), 'area': 100}]
        dist = np.array([[2, 8], [8, 2]])
        
        res_g = greedy_match(dist, self.threshold, self.area_ratio, faces, poses)
        res_h = hungarian_match(dist, self.threshold, self.area_ratio, faces, poses)
        
        self.assertEqual(set(res_g), {(0, 0), (1, 1)})
        self.assertEqual(set(res_h), {(0, 0), (1, 1)})

    def test_stale_logic_simulation(self):
        # Simulated logic check
        now = 1000
        verified = 999
        reverify_interval = 2.0
        timeout = 20.0
        
        is_stale = (now - verified) > reverify_interval
        is_gone = (now - verified) > timeout
        
        self.assertFalse(is_stale)
        self.assertFalse(is_gone)
        
        now = 1005
        is_stale = (now - verified) > reverify_interval
        self.assertTrue(is_stale)
        
        now = 1030
        is_gone = (now - verified) > timeout
        self.assertTrue(is_gone)

if __name__ == '__main__':
    unittest.main()
