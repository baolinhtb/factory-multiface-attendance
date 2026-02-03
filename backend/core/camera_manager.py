import threading
from typing import Dict, List
from core.camera_stream import CameraStream
from db import database

class CameraManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(CameraManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.streams: Dict[int, CameraStream] = {}
        self._initialized = True

    def load_cameras(self):
        """Load cameras from DB and start streams."""
        camera_configs = database.get_all_cameras()
        
        # Stop and remove streams that are no longer in DB or inactive
        active_ids = [c['id'] for c in camera_configs if c['is_active']]
        for cam_id in list(self.streams.keys()):
            if cam_id not in active_ids:
                print(f"[CameraManager] Stopping camera {cam_id}...")
                self.streams[cam_id].stop()
                del self.streams[cam_id]

        # Start or update streams
        for config in camera_configs:
            if not config['is_active']:
                continue
            
            cam_id = config['id']
            if cam_id not in self.streams:
                print(f"[CameraManager] Starting new camera: {config['name']} (ID: {cam_id})")
                stream = CameraStream(config)
                stream.start()
                self.streams[cam_id] = stream
            else:
                # Update settings for existing stream
                # For source change, we might need to recreate the stream or enhance CameraStream.update_settings
                # For now, let's just trigger update_settings for thresholds
                self.streams[cam_id].update_settings(config)

    def start_all(self):
        for stream in self.streams.values():
            stream.start()

    def stop_all(self):
        for stream in self.streams.values():
            stream.stop()
        self.streams.clear()

    def get_stream(self, camera_id: int) -> CameraStream:
        return self.streams.get(camera_id)

    def get_all_streams(self) -> List[CameraStream]:
        return list(self.streams.values())

    def reload_faces(self):
        """Reload faces for all active streams."""
        for stream in self.streams.values():
            stream.reload_faces()
