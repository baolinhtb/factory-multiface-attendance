"""
Pydantic models for API requests and responses.
"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


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


class CameraSettings(BaseModel):
    face_recognition_threshold: float = Field(0.45, ge=0.0, le=1.0)
    phone_detection_confidence: float = Field(0.15, ge=0.0, le=1.0)
    fire_detection_confidence: float = Field(0.30, ge=0.0, le=1.0)
    pose_detection_confidence: float = Field(0.50, ge=0.0, le=1.0)
    enable_face_rec: bool = True
    enable_phone_det: bool = True
    enable_fire_det: bool = True
    enable_pose_det: bool = True
    show_pose_visualization: bool = True
    model_config = ConfigDict(extra='allow')


class CameraCreate(BaseModel):
    name: str
    type: str = "usb"
    source: str
    is_active: int = 1
    description: Optional[str] = None
    settings: Optional[CameraSettings] = None


class CameraUpdate(BaseModel):
    name: str
    type: str
    source: str
    is_active: int = 1
    description: Optional[str] = None
    settings: Optional[CameraSettings] = None


class CameraStatusUpdate(BaseModel):
    is_active: int = Field(..., description="1 for active, 0 for inactive")


class BulkCameraSettingsUpdate(BaseModel):
    camera_ids: List[int]
    settings: CameraSettings


class DateFilterPresetUpdate(BaseModel):
    label: str
    is_active: int


class OllamaChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = None
