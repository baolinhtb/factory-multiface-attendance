"""
Employee management routes.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
import numpy as np
import cv2
from api import auth
from api.models import EmployeeUpdate
from db import database
from core.camera_stream import CameraStream
from core.camera_manager import CameraManager

camera_manager = CameraManager()

router = APIRouter()


@router.get("/")
async def list_employees(current_user: dict = Depends(auth.get_current_user)):
    """List all employees."""
    return database.get_all_employees()


@router.post("/")
async def add_employee(
    employee_id: str = Form(...),
    full_name: str = Form(...),
    position: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    assigned_config_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    admin: dict = Depends(auth.get_admin_user)
):
    """Add employee with image upload (uses face recognition)."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    selected_config = None
    if assigned_config_id and assigned_config_id != 'None':
        selected_config = int(assigned_config_id)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    faces = CameraStream.get_face_analysis().get(img)
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected in image")
    
    face = max(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]))
    embedding = face.embedding
    
    # Save image to disk
    image_filename = f"{employee_id}.jpg"
    image_path = f"images/{image_filename}"
    with open(image_path, "wb") as buffer:
        buffer.write(contents)
        
    # Web accessible URL
    image_url = f"/images/{image_filename}"
    
    try:
        database.add_employee(employee_id, full_name, embedding, position, department, selected_config, image_url)
        camera_manager.reload_faces()
        return {"status": "success", "message": f"Employee {full_name} registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{employee_id}")
async def get_employee_details(
    employee_id: str,
    current_user: dict = Depends(auth.get_current_user)
):
    """Get employee details."""
    detail = database.get_employee_detail(employee_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Employee not found")
    return detail


@router.put("/{employee_id}")
async def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Update employee."""
    database.update_employee(employee_id, data.full_name, data.position, data.department, data.assigned_config_id)
    camera_manager.reload_faces()
    return {"message": "Employee updated"}


@router.post("/{employee_id}/upload-image")
async def upload_employee_image(
    employee_id: str,
    file: UploadFile = File(...),
    admin: dict = Depends(auth.get_admin_user)
):
    """Upload/replace employee image."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    faces = CameraStream.get_face_analysis().get(img)
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected in image")
    
    # Get the largest face
    face = max(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]))
    embedding = face.embedding
    
    # Save image to disk (overwrite existing)
    image_filename = f"{employee_id}.jpg"
    image_path = f"images/{image_filename}"
    
    try:
        with open(image_path, "wb") as buffer:
            buffer.write(contents)
            
        # Web accessible URL
        image_url = f"/images/{image_filename}"
        
        # Update DB
        database.update_employee_image(employee_id, image_url, embedding)
        
        # Reload faces in camera manager
        camera_manager.reload_faces()
        
        return {"status": "success", "message": "Image updated and face re-indexed", "image_path": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{employee_id}/attendance")
async def get_employee_attendance(
    employee_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Get employee attendance."""
    from datetime import datetime, timedelta
    from core import attendance_calculator
    
    if not start_date or not end_date:
        # Default to last 30 days
        end = datetime.now()
        start = end - timedelta(days=30)
        start_date = start.strftime("%Y-%m-%d")
        end_date = end.strftime("%Y-%m-%d")
        
    return attendance_calculator.calculate_attendance_dynamic(employee_id, start_date, end_date)


@router.get("/{employee_id}/phone")
async def get_employee_phone_logs(
    employee_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Get phone usage logs."""
    return database.get_employee_phone_logs(employee_id, start_date, end_date)
