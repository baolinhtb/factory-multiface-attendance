from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import cv2
import asyncio
import numpy as np
from camera_stream import CameraStream
import database

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

camera = CameraStream()

@app.on_event("startup")
def startup_event():
    try:
        database.init_db()
        camera.start()
    except Exception as e:
        print(f"Startup error: {e}")

@app.on_event("shutdown")
def shutdown_event():
    camera.stop()

@app.get("/")
async def root():
    return {"message": "Factory Multiface Attendance App Backend is running"}

@app.post("/register")
async def register_user(name: str = Form(...), file: UploadFile = File(...)):
    # Read image file
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Detect face to get embedding
    # We use the camera.app (InsightFace model) assuming it's thread safe or just for POC
    faces = camera.app.get(img)
    
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected in image")
    
    # Take the largest face
    # Sort by area (bbox width * height)
    face = max(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]))
    embedding = face.embedding
    
    # Save to DB
    try:
        database.add_user(name, embedding)
        # Reload faces in memory
        camera.reload_faces()
        return {"status": "success", "message": f"User {name} registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats():
    try:
        stats = database.get_phone_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import base64

@app.websocket("/ws/video")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            result = camera.get_processed_frame()
            if result:
                frame, has_unknown, has_phone = result
                if frame is not None:
                    _, buffer = cv2.imencode('.jpg', frame)
                    # Use base64 to send both image and metadata in one JSON
                    img_base64 = base64.b64encode(buffer).decode('utf-8')
                    await websocket.send_json({
                        "image": img_base64,
                        "has_unknown": has_unknown,
                        "has_phone": has_phone
                    })
            
            # Control frame rate
            await asyncio.sleep(0.033) # ~30 fps
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        try:
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
