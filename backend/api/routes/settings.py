"""
Settings routes.
"""
from fastapi import APIRouter, Depends
from api import auth
from db import database
from core.camera_manager import CameraManager

# Initialize camera manager
camera_manager = CameraManager()

router = APIRouter()


@router.get("/")
async def get_app_settings(admin: dict = Depends(auth.get_admin_user)):
    """Get all application settings."""
    return database.get_settings()


@router.put("/")
async def update_app_settings(settings: dict, admin: dict = Depends(auth.get_admin_user)):
    """Update application settings."""
    for key, value in settings.items():
        database.update_setting(key, str(value))
    # Update settings for all active camera streams
    camera_manager.load_cameras()
    return {"message": "Settings updated"}
