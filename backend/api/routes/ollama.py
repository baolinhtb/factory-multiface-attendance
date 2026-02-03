"""
Ollama chat routes.
"""
import os
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from api import auth
from db import database
from core.ollama_chat import OllamaChat

router = APIRouter()


def get_ollama_client():
    """Get or create Ollama client using current settings."""
    settings = database.get_settings()
    base_url = settings.get('ollama_base_url', 'http://localhost:11434')
    model_name = settings.get('ollama_model_name', 'qwen2.5-vl:7b-instruct-q4_K_M')
    timeout = float(settings.get('ollama_timeout', '120'))
    return OllamaChat(model_name=model_name, base_url=base_url, timeout=timeout)


ollama_client = get_ollama_client()


@router.post("/reload")
async def ollama_reload(admin: dict = Depends(auth.get_admin_user)):
    """Reload config."""
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


@router.get("/status")
async def ollama_status(current_user: dict = Depends(auth.get_current_user)):
    """Check status."""
    is_available, message = ollama_client.check_connection()
    return {
        "available": is_available,
        "message": message,
        "model": ollama_client.model_name
    }


@router.post("/chat")
async def ollama_chat(
    message: str = Form(...),
    conversation_history: Optional[str] = Form(None),
    use_system_context: str = Form("false"),
    session_id: Optional[int] = Form(None),
    images: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(auth.get_current_user)
):
    """Chat endpoint."""
    try:
        # Parse conversation history
        history = json.loads(conversation_history) if conversation_history else []
        
        should_use_context = use_system_context.lower() == 'true'
        
        # Save uploaded images temporarily
        image_paths = []
        temp_dir = "temp_ollama_images"
        os.makedirs(temp_dir, exist_ok=True)
        
        for img in images:
            img_path = os.path.join(temp_dir, img.filename)
            with open(img_path, "wb") as f:
                f.write(await img.read())
            image_paths.append(img_path)
            
        # DB Handling for Session & User Message
        conn = database.get_db_connection()
        cur = conn.cursor()
        
        active_session_id = session_id
        
        if active_session_id is None:
            title = message[:50] + "..." if len(message) > 50 else message
            cur.execute("INSERT INTO chat_sessions (title) VALUES (?)", (title,))
            active_session_id = cur.lastrowid
            conn.commit()
            
        # Save User Message
        cur.execute("""
            INSERT INTO chat_messages (session_id, role, content, images) 
            VALUES (?, 'user', ?, ?)
        """, (active_session_id, message, json.dumps([])))
        
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


@router.post("/analyze-video")
async def ollama_analyze_video(
    video: UploadFile = File(...),
    question: str = Form(...),
    current_user: dict = Depends(auth.get_current_user)
):
    """Analyze video."""
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


@router.get("/sessions")
async def get_chat_sessions(current_user: dict = Depends(auth.get_current_user)):
    """List sessions."""
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


@router.post("/sessions")
async def create_chat_session(
    title: str = Form(None),
    current_user: dict = Depends(auth.get_current_user)
):
    """Create session."""
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


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: int,
    current_user: dict = Depends(auth.get_current_user)
):
    """Delete session."""
    try:
        conn = database.get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        conn.commit()
        conn.close()
        return {"message": "Session deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: int,
    current_user: dict = Depends(auth.get_current_user)
):
    """Get messages."""
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
