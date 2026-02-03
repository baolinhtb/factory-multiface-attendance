"""
Shift configuration routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from api import auth
from api.models import ShiftConfigUpdate, ShiftUpdate
from db import database
from core.camera_manager import CameraManager

camera_manager = CameraManager()

router = APIRouter()


@router.get("/configs")
async def list_shift_configs(current_user: dict = Depends(auth.get_current_user)):
    """List shift configs."""
    return database.get_shift_configs()


@router.post("/configs")
async def create_shift_config(
    data: ShiftConfigUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Create config."""
    database.add_shift_config(data.name, data.is_default)
    return {"message": "Shift configuration created"}


@router.put("/configs/{config_id}")
async def update_shift_config(
    config_id: int,
    data: ShiftConfigUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Update config."""
    database.update_shift_config(config_id, data.name, data.work_days, data.is_default)
    return {"message": "Shift configuration updated"}


@router.delete("/configs/{config_id}")
async def delete_shift_config(
    config_id: int,
    admin: dict = Depends(auth.get_admin_user)
):
    """Delete config."""
    success = database.delete_shift_config(config_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete default configuration")
    return {"message": "Shift configuration deleted"}


@router.get("/")
async def list_shifts(
    config_id: Optional[int] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """List shifts."""
    return database.get_shifts(config_id)


@router.post("/")
async def create_shift(
    shift_data: ShiftUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Create shift."""
    database.add_shift(
        shift_data.name, shift_data.start_time, shift_data.end_time,
        shift_data.late_grace_period, shift_data.early_grace_period,
        shift_data.checkin_start, shift_data.checkout_end,
        shift_data.config_id
    )
    return {"message": "Shift created"}


@router.put("/{shift_id}")
async def update_shift(
    shift_id: int,
    shift_data: ShiftUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Update shift."""
    database.update_shift(
        shift_id, shift_data.name, shift_data.start_time, shift_data.end_time,
        shift_data.late_grace_period, shift_data.early_grace_period,
        shift_data.checkin_start, shift_data.checkout_end
    )
    return {"message": "Shift updated"}


@router.delete("/{shift_id}")
async def delete_shift(
    shift_id: int,
    admin: dict = Depends(auth.get_admin_user)
):
    """Delete shift."""
    database.delete_shift(shift_id)
    return {"message": "Shift deleted"}
