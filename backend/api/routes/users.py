"""
User management routes (admin only).
"""
from fastapi import APIRouter, Depends, HTTPException, Form
from api import auth
from api.models import ChangePasswordRequest
from db import database

router = APIRouter()


@router.get("/")
async def list_users(admin: dict = Depends(auth.get_admin_user)):
    """Get all system users."""
    return database.get_all_system_users()


@router.post("/")
async def add_system_user(
    username: str = Form(...),
    password: str = Form(...),
    role: str = Form("user"),
    admin: dict = Depends(auth.get_admin_user)
):
    """Create a new system user."""
    if database.get_system_user(username):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_pass = auth.get_password_hash(password)
    database.create_system_user(username, hashed_pass, role)
    return {"message": "User created successfully"}


@router.delete("/{user_id}")
async def remove_user(user_id: int, admin: dict = Depends(auth.get_admin_user)):
    """Delete a system user."""
    database.delete_system_user(user_id)
    return {"message": "User deleted"}


@router.put("/{user_id}/password")
async def change_user_password(
    user_id: int,
    request: ChangePasswordRequest,
    current_user: dict = Depends(auth.get_current_user)
):
    """Change user password."""
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
