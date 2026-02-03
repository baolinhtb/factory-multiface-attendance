"""
Camera management routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from api import auth
from api.models import CameraCreate, CameraUpdate, BulkCameraSettingsUpdate, CameraStatusUpdate
from db import database
from core.camera_stream import CameraStream
from core.camera_manager import CameraManager

# Initialize camera manager
camera_manager = CameraManager()

router = APIRouter()


@router.get("/available")
async def get_available_phys_cameras(admin: dict = Depends(auth.get_admin_user)):
    """Scan for physical cameras connected to the server."""
    streams = camera_manager.get_all_streams()
    if streams:
        return streams[0].get_available_cameras()
    else:
        # Create a temporary stream just for scanning
        temp_cam = CameraStream()
        return temp_cam.get_available_cameras()


@router.get("/")
async def list_cameras(current_user: dict = Depends(auth.get_current_user)):
    """Get all cameras."""
    return database.get_all_cameras()


@router.post("/")
async def add_camera(camera: CameraCreate, admin: dict = Depends(auth.get_admin_user)):
    """Add a new camera."""
    settings_dict = camera.settings.model_dump() if camera.settings else None
    cam_id = database.add_camera(
        camera.name, 
        camera.type, 
        camera.source, 
        camera.is_active, 
        camera.description, 
        settings_dict,
        camera.restricted_zones
    )
    camera_manager.load_cameras()
    return {"id": cam_id, "message": "Camera added"}


@router.put("/{camera_id}")
async def update_camera(
    camera_id: int,
    camera: CameraUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Update camera configuration."""
    settings_dict = camera.settings.model_dump() if camera.settings else None
    database.update_camera(
        camera_id, 
        camera.name, 
        camera.type, 
        camera.source, 
        camera.is_active, 
        camera.description, 
        settings_dict,
        camera.restricted_zones
    )
    camera_manager.load_cameras()
    return {"message": "Camera updated"}


@router.patch("/{camera_id}/status")
async def update_camera_status(
    camera_id: int,
    status_update: CameraStatusUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Enable or disable a camera."""
    database.update_camera_status(camera_id, status_update.is_active)
    
    # Reload cameras to start/stop streams
    camera_manager.load_cameras()
    
    status_str = "enabled" if status_update.is_active else "disabled"
    return {"message": f"Camera {status_str}"}


@router.post("/bulk-settings")
async def bulk_update_camera_settings(
    payload: BulkCameraSettingsUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Bulk update settings for multiple cameras."""
    settings_dict = payload.settings.model_dump()
    success = database.update_camera_settings_bulk(payload.camera_ids, settings_dict)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update settings for some cameras")
    
    camera_manager.load_cameras()
    return {"message": "Bulk settings updated"}


@router.delete("/{camera_id}")
async def delete_camera(camera_id: int, admin: dict = Depends(auth.get_admin_user)):
    """Delete a camera."""
    database.delete_camera(camera_id)
    camera_manager.load_cameras()
    return {"message": "Camera deleted"}

@router.get("/{camera_id}/snapshot")
async def get_camera_snapshot(camera_id: int, admin: dict = Depends(auth.get_admin_user)):
    """Capture a live frame from the camera for zone editing (Optimized)."""
    from fastapi.responses import Response
    
    stream = camera_manager.get_stream(camera_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Camera stream not found or inactive")
    
    jpeg_bytes = stream.get_snapshot_jpeg()
    if jpeg_bytes is None:
        raise HTTPException(status_code=503, detail="Failed to capture frame from camera")
    
    return Response(content=jpeg_bytes, media_type="image/jpeg")
