import sys
import os

try:
    print("Attempting to import main...")
    import main
    print("Successfully imported main.")
    
    print("Attempting to import camera_stream...")
    import camera_stream
    print("Successfully imported camera_stream.")
    
    print("Attempting to import fire_detector...")
    import fire_detector
    print("Successfully imported fire_detector.")
    
    print("All imports successful.")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
