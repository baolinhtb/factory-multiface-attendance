import cv2
import sys
import time

def test_camera(source):
    print(f"Testing connection to: {source}")
    
    # Try converting to int if it's a number (USB)
    try:
        source_val = int(source)
        print("Detected USB Camera Index")
    except ValueError:
        source_val = source
        print("Detected Network Stream / File")

    # Force FFMPEG for RTSP if available
    if isinstance(source_val, str) and source_val.startswith('rtsp'):
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
        print("Enforcing RTSP via TCP...")

    cap = cv2.VideoCapture(source_val)
    
    if not cap.isOpened():
        print(f"❌ ERROR: Could not open video source.")
        print("Suggestions:")
        print("1. Check if the IP address is reachable (ping <ip>)")
        print("2. Check username/password in RTSP URL")
        print("3. Ensure 'ffmpeg' is installed: sudo apt install ffmpeg")
        return

    print("✓ Successfully opened video source!")
    print("Reading frames (Press Ctrl+C to stop)...")
    
    start = time.time()
    frames = 0
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("❌ Failed to read frame")
                break
            
            frames += 1
            if frames % 30 == 0:
                print(f"✓ Read {frames} frames...")
                
            # Stop after 5 seconds of successful reading
            if time.time() - start > 5:
                print("✓ Test completed successfully (5 seconds stable).")
                break
                
    except KeyboardInterrupt:
        print("Stopped by user.")
    
    cap.release()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_camera.py <rtsp_url_or_index>")
        print("Example: python test_camera.py rtsp://admin:pass@192.168.1.10:554/...")
        sys.exit(1)
        
    import os
    test_camera(sys.argv[1])
