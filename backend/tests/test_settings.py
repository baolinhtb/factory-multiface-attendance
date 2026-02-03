
import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock dependencies before importing CameraStream
sys.modules['numpy'] = MagicMock()
sys.modules['cv2'] = MagicMock()
sys.modules['insightface'] = MagicMock()
sys.modules['insightface.app'] = MagicMock()
sys.modules['ultralytics'] = MagicMock()
sys.modules['PIL'] = MagicMock()
sys.modules['db'] = MagicMock()
sys.modules['core.fall_detector'] = MagicMock()
sys.modules['core.fire_detector'] = MagicMock()
sys.modules['core.face_recognizer'] = MagicMock()

# Now import
from core.camera_stream import CameraStream

class TestCameraSettings(unittest.TestCase):
    def setUp(self):
        # Patch __init__ to avoid initialization logic
        with patch.object(CameraStream, '__init__', return_value=None):
            self.stream = CameraStream()
            self.stream.camera_settings = {}
            self.stream.global_settings = {}
            self.stream.camera_name = "TestCam"

    def test_get_effective_setting_precedence(self):
        # 1. Default fallback
        self.assertEqual(self.stream.get_effective_setting('test_key', 'default'), 'default')

        # 2. Global setting
        self.stream.global_settings = {'test_key': 'global_val'}
        self.assertEqual(self.stream.get_effective_setting('test_key', 'default'), 'global_val')

        # 3. Camera override
        self.stream.camera_settings = {'test_key': 'camera_val'}
        self.assertEqual(self.stream.get_effective_setting('test_key', 'default'), 'camera_val')

    def test_boolean_conversions(self):
        # Test string 'true'/'false' from global settings (DB typically stores strings)
        self.stream.global_settings = {'bool_key': 'true'}
        self.assertTrue(self.stream.get_effective_setting('bool_key', False))
        
        self.stream.global_settings = {'bool_key': 'false'}
        self.assertFalse(self.stream.get_effective_setting('bool_key', True))

    def test_numeric_conversion_integration(self):
        # CameraStream code does float() conversion in apply_settings, 
        # but get_effective_setting just returns value.
        # Let's verify get_effective_setting returns the raw value correctly
        self.stream.camera_settings = {'thresh': 0.85}
        val = self.stream.get_effective_setting('thresh', 0.5)
        self.assertEqual(val, 0.85)

    def test_unset_revert_to_global(self):
        # Scenario: Camera setting removed -> Revert to global
        self.stream.global_settings = {'threshold': '0.5'}
        self.stream.camera_settings = {'threshold': 0.9}
        
        # Initial check
        self.assertEqual(self.stream.get_effective_setting('threshold', 0.1), 0.9)
        
        # Action: Unset (remove key from camera settings)
        del self.stream.camera_settings['threshold']
        
        # Verify revert
        self.assertEqual(self.stream.get_effective_setting('threshold', 0.1), '0.5')
        
    def test_apply_settings_logic(self):
        # Mock get_effective_setting to return controlled values
        self.stream.get_effective_setting = MagicMock(side_effect=[
            0.8, # face
            0.2, # phone
            0.4, # fire
            0.6, # pose
            False, # enable face
            True, # enable phone
            True, # enable fire
            True, # enable pose
            False, # enable fall
            False  # show age
        ])
        
        # Call apply_settings
        # We need to ensure attributes exist because we bypassed __init__
        self.stream.fire_detector = MagicMock()
        
        # We need to temporarily restore the original apply_settings if we mocked the class? 
        # No, we only mocked __init__. methods are intact.
        self.stream.apply_settings()
        
        self.assertEqual(self.stream.face_recognition_threshold, 0.8)
        self.assertFalse(self.stream.enable_face_rec)
        self.assertTrue(self.stream.enable_phone_det)
        self.assertEqual(self.stream.fire_detector.min_confidence, 0.4)

if __name__ == '__main__':
    unittest.main()
