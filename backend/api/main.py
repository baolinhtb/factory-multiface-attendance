"""
Optimized FastAPI application with modular routes, rate limiting, and improved performance.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import asyncio
import base64
import cv2
import logging
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import route modules
from api.routes import auth, users, settings, cameras, employees, attendance, shifts, language, ollama, health
from db import database
from core.camera_manager import CameraManager
from core.camera_stream import CameraStream
from api import auth as auth_module
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends

# Rate limiting configuration
limiter = Limiter(key_func=get_remote_address)

# Initialize FastAPI app with rate limiting
app = FastAPI(
    title="Face Attendance API",
    description="Multi-camera face recognition attendance system with optimizations",
    version="2.1.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Mount static files
if not os.path.exists("images"):
    os.makedirs("images")
app.mount("/images", StaticFiles(directory="images"), name="images")

# Load allowed origins from environment variable
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

# CORS middleware - restricted to specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Global instances
database.init_db()
camera_manager = CameraManager()

# Include routers with rate limiting
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["User Management"])
app.include_router(settings.router, prefix="/settings", tags=["Settings"])
app.include_router(cameras.router, prefix="/cameras", tags=["Cameras"])
app.include_router(employees.router, prefix="/employees", tags=["Employees"])
app.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])
app.include_router(shifts.router, prefix="/shifts", tags=["Shifts"])
app.include_router(language.router, prefix="/languages", tags=["Languages"])
app.include_router(ollama.router, prefix="/api/ollama", tags=["Ollama Chat"])
app.include_router(health.router, prefix="/health", tags=["Health"])

@app.on_event("startup")
def startup_event():
    """Initialize on startup."""
    try:
        logger.info("Starting up Face Attendance API...")
        
        # Create or update default admin
        admin_user = database.get_system_user("admin")
        hashed_pass = auth_module.get_password_hash("admin123")
        if not admin_user:
            database.create_system_user("admin", hashed_pass, "admin")
            logger.info("Default admin created: admin / admin123")
        else:
            database.update_system_user_password(admin_user["id"], hashed_pass)
            logger.info("Default admin password synchronized.")
        
        # Start the camera manager
        camera_manager.load_cameras()
        logger.info(f"Loaded {len(camera_manager.get_all_streams())} cameras")
        
        logger.info("Startup complete")
    except Exception as e:
        logger.error(f"Startup error: {e}")

@app.on_event("shutdown")
def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down...")
    camera_manager.stop_all()
    logger.info("Shutdown complete")

# Legacy login endpoint with rate limiting
@app.post("/login")
# @limiter.limit("5/minute")
async def legacy_login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """Legacy login endpoint - redirects to auth router."""
    return await auth.login(form_data)

@app.get("/me")
async def get_me(current_user: dict = Depends(auth_module.get_current_user)):
    """Return info about the currently logged in user."""
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "role": current_user["role"]
    }

@app.get("/daily-stats")
async def get_daily_stats_root(
    date: Optional[str] = None,
    current_user: dict = Depends(auth_module.get_current_user)
):
    """Get daily statistics (Compatibility alias)."""
    return database.get_daily_stats(date)

# WebSocket video streaming endpoint with rate limiting
@app.websocket("/ws/video")
async def websocket_endpoint(websocket: WebSocket, camera_id: Optional[int] = None):
    """WebSocket endpoint for real-time video streaming."""
    await websocket.accept()
    
    # If no camera_id provided, pick the first active one
    cur_camera_id = camera_id
    if cur_camera_id is None:
        streams = camera_manager.get_all_streams()
        if streams:
            cur_camera_id = streams[0].camera_id
    
    connection_active = True
    frame_skip_counter = 0
    
    try:
        while connection_active:
            stream = camera_manager.get_stream(cur_camera_id) if cur_camera_id is not None else None
            if stream:
                result = stream.get_processed_frame()
                if result:
                    frame, has_unknown, has_phone, has_fire, has_unsafe_pose = result
                    if frame is not None:
                        # Optimization: Resize for streaming (reduce bandwidth/latency)
                        # Processing is high-res (1024), but preview can be 640
                        h, w = frame.shape[:2]
                        if w > 640:
                            s = 640 / w
                            view_frame = cv2.resize(frame, (640, int(h * s)))
                        else:
                            view_frame = frame
                            
                        # Encode with optimized quality
                        _, buffer = cv2.imencode('.jpg', view_frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
                        img_base64 = base64.b64encode(buffer).decode('utf-8')
                        
                        try:
                            await websocket.send_json({
                                "camera_id": cur_camera_id,
                                "camera_name": stream.camera_name,
                                "image": img_base64,
                                "has_unknown": has_unknown,
                                "has_phone": len(has_phone) > 0, # Keep boolean for compatibility
                                "phone_violators": has_phone,   # Send names list
                                "has_fire": has_fire,
                                "has_unsafe_pose": has_unsafe_pose,
                                "enable_alarm": stream.get_effective_setting('enable_alarm', True)
                            })
                        except Exception:
                            break
                        
                # Yield control to event loop to prevent blocking
                await asyncio.sleep(0.01)
            else:
                # If no stream found, wait a bit and check again
                await websocket.send_json({
                    "error": "Camera not found or inactive",
                    "camera_id": cur_camera_id
                })
                await asyncio.sleep(1.0)
                # Try to re-pick if it was None
                if cur_camera_id is None:
                    streams = camera_manager.get_all_streams()
                    if streams:
                        cur_camera_id = streams[0].camera_id
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for camera {cur_camera_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        connection_active = False

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
