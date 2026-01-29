from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
import uvicorn
import cv2
import asyncio
import numpy as np
import base64
from typing import List

from camera_stream import CameraStream
import database
import auth

app = FastAPI()

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

# --- Face Attendance Endpoints ---

@app.post("/register")
async def register_face(name: str = Form(...), file: UploadFile = File(...), current_user: dict = Depends(auth.get_current_user)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    faces = camera.app.get(img)
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected in image")
    
    face = max(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]))
    embedding = face.embedding
    
    try:
        database.add_user(name, embedding)
        camera.reload_faces()
        return {"status": "success", "message": f"User {name} registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats(current_user: dict = Depends(auth.get_current_user)):
    return database.get_phone_stats()

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
