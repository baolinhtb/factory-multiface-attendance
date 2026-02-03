"""
Attendance and presence routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi.responses import StreamingResponse
import io
import pandas as pd
from api import auth
from api.models import DateFilterPresetUpdate
from db import database
from core import attendance_calculator
from core.camera_manager import CameraManager

camera_manager = CameraManager()

router = APIRouter()


@router.get("/presence-logs")
async def get_presence_logs(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Get presence logs."""
    logs = database.get_employee_presence_logs(employee_id, start_date, end_date)
    return logs


@router.post("/calculate")
async def calculate_attendance(
    employee_id: str,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Calculate attendance for an employee."""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can calculate attendance")
    
    if start_date and end_date:
        s_date, e_date = start_date, end_date
    elif date:
        s_date, e_date = date, date
    else:
        today = datetime.now().strftime("%Y-%m-%d")
        s_date, e_date = today, today
        
    result = attendance_calculator.calculate_attendance_dynamic(employee_id, s_date, e_date)
    return {
        "employee_id": employee_id,
        "date": f"{s_date} to {e_date}",
        "shifts": result
    }


@router.get("/export")
async def export_attendance(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Export attendance to Excel."""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can export attendance")
        
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


@router.post("/calculate-all")
async def calculate_attendance_all(
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Calculate attendance for all employees."""
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


@router.get("/daily-stats")
async def get_daily_stats(
    date: Optional[str] = None,
    current_user: dict = Depends(auth.get_current_user)
):
    """Get daily statistics."""
    return database.get_daily_stats(date)


@router.get("/date-filter-presets")
async def get_date_filter_presets(current_user: dict = Depends(auth.get_current_user)):
    """Get date filter presets."""
    return database.get_active_date_filter_presets()


@router.get("/date-filter-presets/all")
async def get_all_date_filter_presets(admin: dict = Depends(auth.get_admin_user)):
    """Get all presets (admin)."""
    return database.get_all_date_filter_presets()


@router.put("/date-filter-presets/{preset_id}")
async def update_date_filter_preset(
    preset_id: int,
    data: DateFilterPresetUpdate,
    admin: dict = Depends(auth.get_admin_user)
):
    """Update preset."""
    database.update_date_filter_preset(preset_id, data.label, data.is_active)
    return {"message": "Filter preset updated successfully"}
