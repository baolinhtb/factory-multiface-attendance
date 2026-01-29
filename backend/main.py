from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
import uvicorn
import cv2
import asyncio
import numpy as np
import base64
import os
import shutil
from typing import List

from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from camera_stream import CameraStream
import database
import auth
import attendance_calculator

app = FastAPI()

# Mount static files
if not os.path.exists("images"):
    os.makedirs("images")
app.mount("/images", StaticFiles(directory="images"), name="images")

class EmployeeUpdate(BaseModel):
    full_name: str
    position: Optional[str] = None
    department: Optional[str] = None
    assigned_config_id: Optional[int] = None

class ShiftConfigUpdate(BaseModel):
    name: str
    work_days: str = '1,1,1,1,1,1,0'
    is_default: int = 0

class ShiftUpdate(BaseModel):
    config_id: int
    name: str
    start_time: str
    end_time: str
    late_grace_period: int = 0
    early_grace_period: int = 0
    checkin_start: str = "00:00"
    checkout_end: str = "23:59"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB before anything else
database.init_db()

# Global camera instance
camera = CameraStream()

@app.on_event("startup")
def startup_event():
    try:
        # Create or update default admin
        admin_user = database.get_system_user("admin")
        hashed_pass = auth.get_password_hash("admin123")
        if not admin_user:
            database.create_system_user("admin", hashed_pass, "admin")
            print("Default admin created: admin / admin123")
        else:
            # Re-hash to ensure consistency with current algorithm
            database.update_system_user_password(admin_user["id"], hashed_pass)
            print("Default admin password updated/synchronized.")
            
        camera.start()
    except Exception as e:
        print(f"Startup error: {e}")

@app.on_event("shutdown")
def shutdown_event():
    camera.stop()

# --- Auth Endpoints ---

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    print(f"Login attempt: {form_data.username}")
    user = database.get_system_user(form_data.username)
    if not user:
        print(f"User not found: {form_data.username}")
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if not auth.verify_password(form_data.password, user["hashed_password"]):
        print(f"Password mismatch for user: {form_data.username}")
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    print(f"Login successful: {form_data.username}")
    access_token = auth.create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}

@app.get("/me")
async def get_me(current_user: dict = Depends(auth.get_current_user)):
    return {"username": current_user["username"], "role": current_user["role"]}

# --- User Management (Admin Only) ---

@app.get("/users")
async def list_users(admin: dict = Depends(auth.get_admin_user)):
    return database.get_all_system_users()

@app.post("/users")
async def add_system_user(username: str = Form(...), password: str = Form(...), role: str = Form("user"), admin: dict = Depends(auth.get_admin_user)):
    if database.get_system_user(username):
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed_pass = auth.get_password_hash(password)
    database.create_system_user(username, hashed_pass, role)
    return {"message": "User created successfully"}

@app.delete("/users/{user_id}")
async def remove_user(user_id: int, admin: dict = Depends(auth.get_admin_user)):
    database.delete_system_user(user_id)
    return {"message": "User deleted"}

# --- Settings Endpoints (Admin Only) ---

@app.get("/settings")
async def get_app_settings(admin: dict = Depends(auth.get_admin_user)):
    return database.get_settings()

@app.put("/settings")
async def update_app_settings(settings: dict, admin: dict = Depends(auth.get_admin_user)):
    for key, value in settings.items():
        database.update_setting(key, str(value))
    camera.update_settings()
    return {"message": "Settings updated"}

# --- Employee & Attendance Endpoints ---

@app.get("/employees")
async def list_employees(current_user: dict = Depends(auth.get_current_user)):
    return database.get_all_employees()

@app.post("/employees")
async def add_employee(
    employee_id: str = Form(...),
    full_name: str = Form(...),
    position: str = Form(None),
    department: str = Form(None),
    assigned_config_id: str = Form(None),
    file: UploadFile = File(...),
    admin: dict = Depends(auth.get_admin_user)
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    selected_config = None
    if assigned_config_id and assigned_config_id != 'None':
        selected_config = int(assigned_config_id)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    faces = camera.app.get(img)
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
        camera.reload_faces()
        return {"status": "success", "message": f"Employee {full_name} registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/employees/{employee_id}")
async def employee_detail(employee_id: str, current_user: dict = Depends(auth.get_current_user)):
    detail = database.get_employee_detail(employee_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Employee not found")
    return detail

@app.put("/employees/{employee_id}")
async def update_employee(employee_id: str, data: EmployeeUpdate, admin: dict = Depends(auth.get_admin_user)):
    database.update_employee(employee_id, data.full_name, data.position, data.department, data.assigned_config_id)
    camera.reload_faces()
    return {"message": "Employee updated"}

@app.post("/employees/{employee_id}/upload-image")
async def upload_employee_image(
    employee_id: str,
    file: UploadFile = File(...),
    admin: dict = Depends(auth.get_admin_user)
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    faces = camera.app.get(img)
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
        
        # Reload faces in camera stream
        camera.reload_faces()
        
        return {"status": "success", "message": "Image updated and face re-indexed", "image_path": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/employees/{employee_id}/attendance")
async def employee_attendance(
    employee_id: str, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    if not start_date or not end_date:
        # Default to last 30 days
        end = datetime.now()
        start = end - timedelta(days=30)
        start_date = start.strftime("%Y-%m-%d")
        end_date = end.strftime("%Y-%m-%d")
        
    return attendance_calculator.calculate_attendance_dynamic(employee_id, start_date, end_date)

@app.get("/employees/{employee_id}/phone")
async def employee_phone_logs(
    employee_id: str, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    return database.get_employee_phone_logs(employee_id, start_date, end_date)

@app.get("/daily-stats")
async def daily_stats(date: str = None, current_user: dict = Depends(auth.get_current_user)):
    return database.get_daily_stats(date)

# --- Shift & Configuration Endpoints ---

@app.get("/shift-configs")
async def list_shift_configs(current_user: dict = Depends(auth.get_current_user)):
    return database.get_shift_configs()

@app.post("/shift-configs")
async def create_shift_config(data: ShiftConfigUpdate, admin: dict = Depends(auth.get_admin_user)):
    database.add_shift_config(data.name, data.is_default)
    return {"message": "Shift configuration created"}

@app.put("/shift-configs/{config_id}")
async def update_shift_config(config_id: int, data: ShiftConfigUpdate, admin: dict = Depends(auth.get_admin_user)):
    database.update_shift_config(config_id, data.name, data.work_days, data.is_default)
    return {"message": "Shift configuration updated"}

@app.delete("/shift-configs/{config_id}")
async def delete_shift_config(config_id: int, admin: dict = Depends(auth.get_admin_user)):
    success = database.delete_shift_config(config_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete default configuration")
    return {"message": "Shift configuration deleted"}

@app.get("/shifts")
async def list_shifts(config_id: int = None, current_user: dict = Depends(auth.get_current_user)):
    return database.get_shifts(config_id)

@app.post("/shifts")
async def create_shift(shift_data: ShiftUpdate, admin: dict = Depends(auth.get_admin_user)):
    database.add_shift(
        shift_data.name, shift_data.start_time, shift_data.end_time,
        shift_data.late_grace_period, shift_data.early_grace_period,
        shift_data.checkin_start, shift_data.checkout_end,
        shift_data.config_id
    )
    return {"message": "Shift created"}

@app.put("/shifts/{shift_id}")
async def update_shift(shift_id: int, shift_data: ShiftUpdate, admin: dict = Depends(auth.get_admin_user)):
    database.update_shift(
        shift_id, shift_data.name, shift_data.start_time, shift_data.end_time,
        shift_data.late_grace_period, shift_data.early_grace_period,
        shift_data.checkin_start, shift_data.checkout_end
    )
    return {"message": "Shift updated"}

@app.delete("/shifts/{shift_id}")
async def delete_shift(shift_id: int, admin: dict = Depends(auth.get_admin_user)):
    database.delete_shift(shift_id)
    return {"message": "Shift deleted"}

@app.get("/stats")
async def get_stats_deprecated(current_user: dict = Depends(auth.get_current_user)):
    # Redirecting to new daily-stats or keeping for compatibility
    return database.get_daily_stats()

# --- Video Stream ---

@app.websocket("/ws/video")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    # Note: WebSocket auth can be tricky, for now we keep it open or check token in query param
    try:
        while True:
            result = camera.get_processed_frame()
            if result:
                frame, has_unknown, has_phone = result
                if frame is not None:
                    _, buffer = cv2.imencode('.jpg', frame)
                    img_base64 = base64.b64encode(buffer).decode('utf-8')
                    await websocket.send_json({
                        "image": img_base64,
                        "has_unknown": has_unknown,
                        "has_phone": has_phone,
                        "enable_alarm": camera.settings.get('enable_alarm', 'true') == 'true'
                    })
            await asyncio.sleep(0.033)
    except WebSocketDisconnect:
        pass

# Employee Presence Logs Endpoints
@app.get("/presence-logs")
async def get_presence_logs(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Get employee presence logs with optional filters"""
    logs = database.get_employee_presence_logs(employee_id, start_date, end_date)
    return logs

# Attendance Calculation Endpoints
@app.post("/calculate-attendance")
async def calculate_attendance(
    employee_id: str,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Tính toán chấm công cho nhân viên trong khoảng thời gian (Dynamic - Không lưu DB)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can calculate attendance")
    
    if start_date and end_date:
        s_date, e_date = start_date, end_date
    elif date:
        s_date, e_date = date, date
    else:
        # Default today
        today = datetime.now().strftime("%Y-%m-%d")
        s_date, e_date = today, today
        
    result = attendance_calculator.calculate_attendance_dynamic(employee_id, s_date, e_date)
    return {
        "employee_id": employee_id,
        "date": f"{s_date} to {e_date}",
        "shifts": result
    }

@app.post("/calculate-attendance-all")
async def calculate_attendance_all(
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Tính toán chấm công cho TẤT CẢ nhân viên trong khoảng thời gian (Dynamic)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can calculate attendance")
    
    if start_date and end_date:
        s_date, e_date = start_date, end_date
    elif date:
        s_date, e_date = date, date
    else:
        today = datetime.now().strftime("%Y-%m-%d")
        s_date, e_date = today, today
        
    # Get all employees
    employees = database.get_all_employees()
    
    results = []
    for emp in employees:
        emp_id = emp['employee_id']
        shifts = attendance_calculator.calculate_attendance_dynamic(emp_id, s_date, e_date)
        results.append({
            "employee_id": emp_id,
            "name": emp['full_name'],
            "shifts": shifts
        })
    
    return {
        "date": f"{s_date} to {e_date}",
        "processed": len(employees),
        "results": results
    }

# Date Filter Presets Endpoints
@app.get("/date-filter-presets")
async def get_date_filters(current_user: dict = Depends(auth.get_current_user)):
    """Get all active date filter presets for dropdown"""
    return database.get_active_date_filter_presets()

@app.get("/date-filter-presets/all")
async def get_all_date_filters(admin: dict = Depends(auth.get_admin_user)):
    """Get ALL date filter presets for settings management (admin only)"""
    return database.get_all_date_filter_presets()

class DateFilterPresetUpdate(BaseModel):
    label: str
    is_active: int

@app.put("/date-filter-presets/{preset_id}")
async def update_filter_preset(
    preset_id: int,
    data: DateFilterPresetUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Update a date filter preset (admin only)"""
    database.update_date_filter_preset(preset_id, data.label, data.is_active)
    return {"message": "Filter preset updated successfully"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
