from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
import uvicorn
import cv2
import asyncio
import numpy as np
import base64
import os
import shutil
import io
import pandas as pd
import xml.etree.ElementTree as ET
import glob
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from core.camera_stream import CameraStream
from db import database
from api import auth
from core import attendance_calculator
from core.ollama_chat import OllamaChat

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

class ChangePasswordRequest(BaseModel):
    new_password: str
    current_password: Optional[str] = None

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
    return {"id": current_user["id"], "username": current_user["username"], "role": current_user["role"]}

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

@app.put("/users/{user_id}/password")
async def change_user_password(
    user_id: int,
    request: ChangePasswordRequest,
    current_user: dict = Depends(auth.get_current_user)
):
    # Authorization: Admin can change anyone, User can only change their own
    if current_user["role"] != "admin":
        if current_user["id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to change this user's password")
            
    # Verify current password if changing own password
    if current_user["id"] == user_id:
        if not request.current_password:
             raise HTTPException(status_code=400, detail="Current password is required")
        if not auth.verify_password(request.current_password, current_user["hashed_password"]):
             raise HTTPException(status_code=400, detail="Incorrect current password")
            
    hashed_pass = auth.get_password_hash(request.new_password)
    database.update_system_user_password(user_id, hashed_pass)
    return {"message": "Password updated successfully"}

# --- Settings Endpoints (Admin Only) ---

@app.get("/settings")
async def get_app_settings(admin: dict = Depends(auth.get_admin_user)):
    return database.get_settings()

@app.put("/settings")
async def update_app_settings(settings: dict, admin: dict = Depends(auth.get_admin_user)):
    for key, value in settings.items():
        database.update_setting(key, str(value))
    camera.update_settings()
    camera.update_settings()
    return {"message": "Settings updated"}

@app.get("/cameras")
async def get_cameras(admin: dict = Depends(auth.get_admin_user)):
    """Get list of available connected cameras"""
    return camera.get_available_cameras()

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
                frame, has_unknown, has_phone, has_fire, has_unsafe_pose = result
                if frame is not None:
                    _, buffer = cv2.imencode('.jpg', frame)
                    img_base64 = base64.b64encode(buffer).decode('utf-8')
                    await websocket.send_json({
                        "image": img_base64,
                        "has_unknown": has_unknown,
                        "has_phone": has_phone,
                        "has_fire": has_fire,
                        "has_unsafe_pose": has_unsafe_pose,
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

@app.get("/export-attendance")
async def export_attendance(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Xuất dữ liệu chấm công ra file Excel"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can export attendance")
        
    # Determine dates
    s_date = start_date if start_date else datetime.now().strftime("%Y-%m-%d")
    e_date = end_date if end_date else s_date
    
    data_for_export = []
    
    if employee_id and employee_id != 'null':
        # Export single employee
        results = attendance_calculator.calculate_attendance_dynamic(employee_id, s_date, e_date)
        for r in results:
            data_for_export.append({
                "Mã NV": employee_id,
                "Ngày": r['date'],
                "Ca làm việc": r['shift_name'],
                "Giờ vào": r['check_in'].replace('T', ' ') if r['check_in'] else '-',
                "Giờ ra": r['check_out'].replace('T', ' ') if r['check_out'] else '-',
                "Trạng thái": r['status'],
                "Tăng ca (phút)": r.get('overtime', 0)
            })
    else:
        # Export all employees
        all_employees = database.get_all_employees()
        for emp in all_employees:
            emp_id = emp['employee_id']
            results = attendance_calculator.calculate_attendance_dynamic(emp_id, s_date, e_date)
            for r in results:
                data_for_export.append({
                    "Mã NV": emp_id,
                    "Họ tên": emp['full_name'],
                    "Phòng ban": emp.get('department', '-'),
                    "Ngày": r['date'],
                    "Ca làm việc": r['shift_name'],
                    "Giờ vào": r['check_in'].replace('T', ' ') if r['check_in'] else '-',
                    "Giờ ra": r['check_out'].replace('T', ' ') if r['check_out'] else '-',
                    "Trạng thái": r['status'],
                    "Tăng ca (phút)": r.get('overtime', 0)
                })
    
    if not data_for_export:
        # Return an empty excel with headers or error
        df = pd.DataFrame(columns=["Mã NV", "Họ tên", "Phòng ban", "Ngày", "Ca làm việc", "Giờ vào", "Giờ ra", "Trạng thái", "Tăng ca (phút)"])
    else:
        df = pd.DataFrame(data_for_export)
    
    # Create Excel in memory
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Chấm công')
    
    output.seek(0)
    
    filename = f"cham_cong_{s_date}_den_{e_date}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# --- Language Management ---

@app.get("/languages")
async def get_languages():
    """List available languages"""
    lang_dir = "languages"
    if not os.path.exists(lang_dir):
        return []
    
    files = glob.glob(os.path.join(lang_dir, "*.xml"))
    languages = []
    for f in files:
        code = os.path.splitext(os.path.basename(f))[0]
        # Try to parse to get a name if possible, or just use code
        try:
            tree = ET.parse(f)
            root = tree.getroot()
            # Simple assumption: Maybe we add a specific tag for language name later?
            # For now just return the code.
            # actually we can look for 'language_vi' or 'language_en' inside the file itself if we wanted to be fancy
            # but for now, filename is the code.
            languages.append({"code": code, "name": code.upper()}) 
        except:
            pass
            
    return languages

@app.get("/languages/{code}")
async def get_language_content(code: str):
    """Get content of a language file as JSON key-value pairs"""
    file_path = os.path.join("languages", f"{code}.xml")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Language file not found")
        
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        resources = {}
        for child in root:
            if child.tag == 'string':
                name = child.attrib.get('name')
                if name:
                    resources[name] = child.text
        return resources
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing language file: {str(e)}")

@app.post("/languages/upload")
async def upload_language(
    file: UploadFile = File(...),
    current_user: dict = Depends(auth.get_admin_user)
):
    """Upload a new language XML file"""
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Only XML files are allowed")
        
    lang_dir = "languages"
    if not os.path.exists(lang_dir):
        os.makedirs(lang_dir)
        
    file_path = os.path.join(lang_dir, file.filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Verify it's valid XML
    try:
        ET.parse(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Invalid XML file: {str(e)}")
        
    return {"message": "Language uploaded successfully", "filename": file.filename}

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

# Ollama Chat Endpoints
def get_ollama_client():
    """Get or create Ollama client using current settings"""
    settings = database.get_settings()
    base_url = settings.get('ollama_base_url', 'http://localhost:11434')
    model_name = settings.get('ollama_model_name', 'qwen2.5-vl:7b-instruct-q4_K_M')
    timeout = float(settings.get('ollama_timeout', '120'))
    return OllamaChat(model_name=model_name, base_url=base_url, timeout=timeout)

ollama_client = get_ollama_client()

@app.post("/api/ollama/reload")
async def ollama_reload(admin: dict = Depends(auth.get_admin_user)):
    """Reload Ollama configuration from settings (admin only)"""
    global ollama_client
    try:
        ollama_client = get_ollama_client()
        is_available, message = ollama_client.check_connection()
        return {
            "message": "Ollama configuration reloaded",
            "available": is_available,
            "connection_status": message,
            "model": ollama_client.model_name,
            "base_url": ollama_client.base_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reload: {str(e)}")

class OllamaChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = None

@app.get("/api/ollama/status")
async def ollama_status(current_user: dict = Depends(auth.get_current_user)):
    """Check if Ollama service is available"""
    is_available, message = ollama_client.check_connection()
    return {
        "available": is_available,
        "message": message,
        "model": ollama_client.model_name
    }

@app.post("/api/ollama/chat")
async def ollama_chat(
    message: str = Form(...),
    conversation_history: Optional[str] = Form(None),
    use_system_context: str = Form("false"),
    session_id: Optional[int] = Form(None),
    images: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(auth.get_current_user)
):
    """
    Chat with Ollama with optional image attachments.
    conversation_history should be JSON string of message array.
    """
    try:
        # Parse conversation history
        import json
        history = json.loads(conversation_history) if conversation_history else []
        
        should_use_context = use_system_context.lower() == 'true'
        
        # Save uploaded images temporarily
        image_paths = []
        temp_dir = "temp_ollama_images"
        os.makedirs(temp_dir, exist_ok=True)
        
        for img in images:
            # Save image
            img_path = os.path.join(temp_dir, img.filename)
            with open(img_path, "wb") as f:
                f.write(await img.read())
            image_paths.append(img_path)
            
        # --- DB Handling for Session & User Message ---
        conn = database.get_db_connection()
        cur = conn.cursor()
        
        active_session_id = session_id
        
        if active_session_id is None:
            # Create new session if not provided
            title = message[:50] + "..." if len(message) > 50 else message
            cur.execute("INSERT INTO chat_sessions (title) VALUES (?)", (title,))
            active_session_id = cur.lastrowid
            conn.commit()
            
        # Save User Message
        # For images, we need to decide whether to store paths or base64. 
        # Since these are temp files that get deleted, we should probably read and store as base64 
        # OR just store that there were images. 
        # For history display, base64 is heavy for DB. 
        # Ideally we'd move them to a permanent storage. 
        # For simplicity now: store empty list or just filenames, 
        # but re-loading history won't show images unless we store them. 
        # Let's Skip saving image content to DB for now to avoid bloating, just note [Image] in content?
        # Or better: Store base64 thumb? 
        # The ollama_chat.py converts to base64 for sending. 
        # Let's try to read one of them to base64 for DB if small enough.
        # For safety/speed, let's just store JSON list of "image" markers or similar.
        # Actually, let's store NULL for images in DB for now to allow text history. 
        # Enhancing image storage is a separate task.
        
        cur.execute("""
            INSERT INTO chat_messages (session_id, role, content, images) 
            VALUES (?, 'user', ?, ?)
        """, (active_session_id, message, json.dumps([]) )) # Images not stored permanently yet
        
        conn.commit()
        
        # Get response from Ollama
        response_text = ollama_client.chat(
            message=message, 
            conversation_history=history, 
            image_paths=image_paths if image_paths else None,
            use_system_context=should_use_context
        )
        
        # Save Assistant Message
        cur.execute("""
            INSERT INTO chat_messages (session_id, role, content) 
            VALUES (?, 'assistant', ?)
        """, (active_session_id, response_text))
        
        conn.commit()
        conn.close()
        
        # Cleanup temp images
        for img_path in image_paths:
            try:
                os.remove(img_path)
            except:
                pass
        
        return {
            "response": response_text,
            "session_id": active_session_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ollama/analyze-video")
async def ollama_analyze_video(
    video: UploadFile = File(...),
    question: str = Form(...),
    current_user: dict = Depends(auth.get_current_user)
):
    """Analyze a video file and answer a question about it"""
    try:
        # Save video temporarily
        temp_dir = "temp_ollama_videos"
        os.makedirs(temp_dir, exist_ok=True)
        video_path = os.path.join(temp_dir, video.filename)
        
        with open(video_path, "wb") as f:
            f.write(await video.read())
        
        # Process video
        response = ollama_client.process_video(video_path, question)
        
        # Cleanup
        try:
            os.remove(video_path)
        except:
            pass
        
        return {"response": response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Chat History Endpoints

@app.get("/api/ollama/sessions")
async def get_chat_sessions(current_user: dict = Depends(auth.get_current_user)):
    """List all chat sessions."""
    try:
        conn = database.get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC")
        sessions = cur.fetchall()
        conn.close()
        
        return [
            {
                "id": s[0],
                "title": s[1] or "New Chat",
                "created_at": s[2],
                "updated_at": s[3]
            }
            for s in sessions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ollama/sessions")
async def create_chat_session(
    title: str = Form(None),
    current_user: dict = Depends(auth.get_current_user)
):
    """Create a new chat session."""
    try:
        conn = database.get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO chat_sessions (title) VALUES (?)", (title,))
        session_id = cur.lastrowid
        conn.commit()
        conn.close()
        return {"id": session_id, "title": title}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/ollama/sessions/{session_id}")
async def delete_chat_session(
    session_id: int,
    current_user: dict = Depends(auth.get_current_user)
):
    """Delete a chat session."""
    try:
        conn = database.get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        conn.commit()
        conn.close()
        return {"message": "Session deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ollama/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: int,
    current_user: dict = Depends(auth.get_current_user)
):
    """Get messages for a specific session."""
    try:
        conn = database.get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT role, content, images, created_at 
            FROM chat_messages 
            WHERE session_id = ? 
            ORDER BY id ASC
        """, (session_id,))
        rows = cur.fetchall()
        conn.close()
        
        # Parse messages
        import json
        messages = []
        for r in rows:
            images = json.loads(r[2]) if r[2] else []
            messages.append({
                "role": r[0],
                "content": r[1],
                "images": images,
                "timestamp": r[3]
            })
            
        return messages
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
