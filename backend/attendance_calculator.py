from datetime import datetime, timedelta
import database

def calculate_attendance_from_presence(employee_id: str, date: str):
    """
    Tính toán chấm công từ presence logs
    Logic đơn giản:
    - Check-in = lần ENTER đầu tiên trong khung checkin_start -> start_time + late_grace
    - Check-out = lần LEAVE cuối cùng trong khung end_time - early_grace -> checkout_end
    """
    conn = database.get_db_connection()
    cur = conn.cursor()
    
    # 1. Lấy config của nhân viên
    cur.execute("SELECT assigned_config_id FROM employees WHERE employee_id = ?", (employee_id,))
    emp_row = cur.fetchone()
    if not emp_row:
        conn.close()
        return {"error": "Employee not found"}
    
    config_id = emp_row[0]
    if not config_id:
        # Lấy default config
        cur.execute("SELECT id FROM shift_configs WHERE is_default = 1 LIMIT 1")
        def_row = cur.fetchone()
        config_id = def_row[0] if def_row else None
    
    if not config_id:
        conn.close()
        return {"error": "No config found"}
    
    # 2. Kiểm tra ngày làm việc
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    day_of_week = date_obj.weekday()  # 0=Monday, 6=Sunday
    
    cur.execute("SELECT work_days FROM shift_configs WHERE id = ?", (config_id,))
    config_row = cur.fetchone()
    if not config_row:
        conn.close()
        return {"error": "Config not found"}
    
    work_days_str = config_row[0]
    work_days = [d == '1' for d in work_days_str.split(',')]
    
    if not work_days[day_of_week]:
        conn.close()
        return {"message": "Not a work day", "shifts": []}
    
    # 3. Lấy tất cả ca của config
    cur.execute("""
        SELECT id, name, start_time, end_time, late_grace_period, early_grace_period, 
               checkin_start, checkout_end 
        FROM shifts 
        WHERE config_id = ?
        ORDER BY start_time
    """, (config_id,))
    shifts = cur.fetchall()
    
    # 4. Lấy presence logs của ngày (và ngày hôm sau cho overnight)
    next_day = (date_obj + timedelta(days=1)).strftime("%Y-%m-%d")
    cur.execute("""
        SELECT timestamp, event_type 
        FROM employee_presence_logs 
        WHERE employee_id = ? AND (DATE(timestamp) = ? OR DATE(timestamp) = ?)
        ORDER BY timestamp
    """, (employee_id, date, next_day))
    presence_logs = cur.fetchall()
    
    results = []
    
    # 5. Với mỗi ca, tìm check-in và check-out
    for shift in shifts:
        shift_id, shift_name, start_time, end_time, late_grace, early_grace, checkin_start, checkout_end = shift
        
        # Parse times
        start_dt = datetime.strptime(f"{date} {start_time}", "%Y-%m-%d %H:%M")
        end_dt = datetime.strptime(f"{date} {end_time}", "%Y-%m-%d %H:%M")
        checkin_start_dt = datetime.strptime(f"{date} {checkin_start}", "%Y-%m-%d %H:%M")
        checkout_end_dt = datetime.strptime(f"{date} {checkout_end}", "%Y-%m-%d %H:%M")
        
        # Handle overnight shifts
        if end_time < start_time:
            end_dt += timedelta(days=1)
            checkout_end_dt += timedelta(days=1)
        
        # Collect all valid logs for this shift window
        # Window: From Check-in Start to Checkout End
        shift_logs = []
        for log_time, event_type in presence_logs:
            log_dt = datetime.strptime(log_time, "%Y-%m-%d %H:%M:%S")
            if checkin_start_dt <= log_dt <= checkout_end_dt:
                shift_logs.append(log_dt)
        
        check_in = None
        check_out = None
        
        if len(shift_logs) == 1:
            # Single log rule: In = Out = Log Time
            check_in = shift_logs[0]
            check_out = shift_logs[0]
        elif len(shift_logs) > 1:
            # Standard rule: First = In, Last = Out
            check_in = shift_logs[0]
            check_out = shift_logs[-1]
            
        # Tìm check-in: lần ENTER đầu tiên trong window (OLD LOGIC - Commented out for reference)
        # Check-in = shift_logs[0] is effectively the same as "First see"
        pass 
        
        # Nếu có check-in hoặc check-out, tính status
        if check_in or check_out:
            status = "on_time"
            
            # Kiểm tra muộn
            if check_in:
                late_minutes = (check_in - start_dt).total_seconds() / 60
                if late_minutes > late_grace:
                    status = "late"
            
            # Kiểm tra về sớm
            if check_out:
                early_minutes = (end_dt - check_out).total_seconds() / 60
                if early_minutes > early_grace:
                    if status == "late":
                        status = "late_and_early"
                    else:
                        status = "early_leave"
                        
            # Special case: Single log often means late coming or early leaving or just checking in once.
            # Warning: Single log at 8:05 (Shift 8:00) -> Late & Early Leave (since Out=8:05 < End)
            
            results.append({
                "shift_name": shift_name,
                "shift_id": shift_id,
                "check_in": check_in.isoformat() if check_in else None,
                "check_out": check_out.isoformat() if check_out else None,
                "status": status,
                "start_dt": start_dt,
                "end_dt": end_dt
            })
    
    # 6. Tính OVERTIME V2 (Logic: Tổng hiện diện - Thời gian đã tính công)
    
    # B1: Xác định các khoảng thời gian ĐƯỢC TÍNH CÔNG (Credited Periods)
    credited_periods = []
    for r in results:
        if r.get('check_in') and r.get('check_out'):
            # Ca trọn vẹn
            c_in = datetime.fromisoformat(r['check_in'])
            c_out = datetime.fromisoformat(r['check_out'])
            credited_periods.append((c_in, c_out))
        elif r.get('check_in'):
            # Ca chỉ có vào (chưa ra -> tính đến hết ca hoặc hiện tại?)
            # Tạm thời nếu thiếu check-out, không tính credit phần sau (hoặc tính đến end_time?)
            # Theo logic an toàn: Chỉ trừ đi phần thực sự được ghi nhận là "Làm việc trong ca"
            # Nếu status là 'on_time' hoặc 'late', coi như đã tính công từ check_in -> end_time (nếu r['end_dt'] có)
            # Tuy nhiên, để chính xác với log, ta nên lấy check_in -> (log leave cuối cùng trong window)?
            # Nhưng ở bước 5 ta đã chốt check_out = None.
            # Để đơn giản và tránh OT ảo: Nếu không có check-out, ta coi như chưa hoàn thành ca -> Không trừ? 
            # Hoặc trừ đến End Time?
            # User case: Check-in 20:01, Check-out 20:35. Có check-out.
            pass

    # B2: Xác định Tổng thời gian hiện diện (Work Sessions) từ Log thô bằng Clustering
    # Logic: Gom nhóm các log gần nhau (khoảng cách < 60 phút).
    # Trong mỗi nhóm: Session = [First Enter] -> [Last Leave]
    
    work_sessions = []
    if presence_logs:
        # Pre-process logs: Convert to objects
        logs_dt = []
        for t, evt in presence_logs:
            logs_dt.append({
                'time': datetime.strptime(t, "%Y-%m-%d %H:%M:%S"),
                'type': evt
            })
        
        # Clustering
        clusters = []
        if logs_dt:
            current_cluster = [logs_dt[0]]
            for i in range(1, len(logs_dt)):
                prev_log = logs_dt[i-1]
                curr_log = logs_dt[i]
                
                # Gap threshold: 60 minutes
                gap_minutes = (curr_log['time'] - prev_log['time']).total_seconds() / 60
                
                if gap_minutes < 60:
                    current_cluster.append(curr_log)
                else:
                    clusters.append(current_cluster)
                    current_cluster = [curr_log]
            clusters.append(current_cluster)
        
        # Derive sessions from clusters
        for cluster in clusters:
            if not cluster:
                continue
                
            # First Log is Start, Last Log is End
            # cluster is already sorted by time (as presence_logs was sorted)
            first_log = cluster[0]['time']
            last_log = cluster[-1]['time']
            
            # Chỉ tạo session nếu first != last (hoặc nếu muốn tính 0 phút?)
            # Nếu first == last (chỉ 1 log), ta có thể coi là session 0 phút hoặc bỏ qua.
            # Để tính OT chính xác, nên giữ lại dù là 1 điểm, nhưng duration = 0.
            work_sessions.append((first_log, last_log))
            
    # B3: Trừ thời gian: OT = Work Sessions - Credited Periods
    total_overtime_minutes = 0
    overtime_sessions = []
    
    for sess_start, sess_end in work_sessions:
        # Bắt đầu với toàn bộ session là potential OT
        segments = [(sess_start, sess_end)]
        
        # Lần lượt trừ đi các credited periods
        for cred_start, cred_end in credited_periods:
            new_segments = []
            for seg_start, seg_end in segments:
                # Tìm phần giao (overlap)
                overlap_start = max(seg_start, cred_start)
                overlap_end = min(seg_end, cred_end)
                
                if overlap_start < overlap_end:
                    # Có overlap, cắt segment ra
                    # Phần trước overlap
                    if seg_start < overlap_start:
                        new_segments.append((seg_start, overlap_start))
                    # Phần sau overlap
                    if seg_end > overlap_end:
                        new_segments.append((overlap_end, seg_end))
                else:
                    # Không overlap, giữ nguyên
                    new_segments.append((seg_start, seg_end))
            segments = new_segments
        
        # Cộng dồn các segment còn lại vào OT
        for seg_start, seg_end in segments:
            minutes = (seg_end - seg_start).total_seconds() / 60
            if minutes > 1: # Chỉ tính nếu > 1 phút để lọc nhiễu
                total_overtime_minutes += minutes
                overtime_sessions.append({
                    'start': seg_start.isoformat(),
                    'end': seg_end.isoformat(),
                    'minutes': int(minutes)
                })

    total_overtime_minutes = int(total_overtime_minutes)
    
    # 7. Lưu vào database
    for r in results:
        shift_id = r['shift_id']
        check_in = r['check_in']
        check_out = r['check_out']
        status = r['status']
        
        # Xóa các field tạm
        r.pop('start_dt', None)
        r.pop('end_dt', None)
        
        cur.execute("""
            SELECT id FROM attendance_logs 
            WHERE employee_id = ? AND date = ? AND shift_id = ?
        """, (employee_id, date, shift_id))
        existing = cur.fetchone()
        
        if existing:
            # Update
            cur.execute("""
                UPDATE attendance_logs 
                SET check_in = ?, check_out = ?, status = ?, overtime_minutes = ?
                WHERE id = ?
            """, (
                check_in,
                check_out,
                status,
                total_overtime_minutes if r == results[-1] else 0,  # Chỉ ghi overtime vào ca cuối
                existing[0]
            ))
        else:
            # Insert
            cur.execute("""
                INSERT INTO attendance_logs 
                (employee_id, date, check_in, check_out, shift_id, status, overtime_minutes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                employee_id,
                date,
                check_in,
                check_out,
                shift_id,
                status,
                total_overtime_minutes if r == results[-1] else 0  # Chỉ ghi overtime vào ca cuối
            ))
        
        # Thêm overtime vào kết quả
        if r == results[-1]:
            r['overtime_minutes'] = total_overtime_minutes
            r['overtime_sessions'] = overtime_sessions
        else:
            r['overtime_minutes'] = 0
            r['overtime_sessions'] = []
    
    conn.commit()
    conn.close()
    
    return {
        "employee_id": employee_id,
        "date": date,
        "shifts": results,
        "total_overtime_minutes": total_overtime_minutes,
        "overtime_sessions": overtime_sessions
    }

def calculate_attendance_for_all_employees(date: str):
    """Tính toán chấm công cho tất cả nhân viên trong một ngày"""
    conn = database.get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT employee_id FROM employees")
    employees = cur.fetchall()
    conn.close()
    
    results = []
    for (emp_id,) in employees:
        result = calculate_attendance_from_presence(emp_id, date)
        results.append(result)
    
    return results


def calculate_attendance_dynamic(employee_id: str, start_date: str, end_date: str):
    """
    Real-time calculation of attendance for a date range.
    Does NOT save to database.
    """
    conn = database.get_db_connection()
    cur = conn.cursor()
    
    # 1. Fetch Config
    cur.execute("SELECT assigned_config_id FROM employees WHERE employee_id = ?", (employee_id,))
    emp_row = cur.fetchone()
    if not emp_row:
        conn.close()
        return []
    
    config_id = emp_row[0]
    if not config_id:
        cur.execute("SELECT id FROM shift_configs WHERE is_default = 1 LIMIT 1")
        def_row = cur.fetchone()
        config_id = def_row[0] if def_row else None
        
    if not config_id:
        conn.close()
        return []

    # Get work days
    cur.execute("SELECT work_days FROM shift_configs WHERE id = ?", (config_id,))
    config_row = cur.fetchone()
    if not config_row:
        conn.close()
        return []
    
    work_days_str = config_row[0]
    work_days = [d == '1' for d in work_days_str.split(',')]

    # Get Shifts
    cur.execute("""
        SELECT id, name, start_time, end_time, late_grace_period, early_grace_period, 
               checkin_start, checkout_end 
        FROM shifts 
        WHERE config_id = ?
        ORDER BY start_time
    """, (config_id,))
    shifts = cur.fetchall()

    # 2. Fetch Logs for Range (Extend +1 day for overnight)
    start_dt_obj = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt_obj = datetime.strptime(end_date, "%Y-%m-%d")
    next_day_obj = end_dt_obj + timedelta(days=1)
    
    cur.execute("""
        SELECT timestamp, event_type 
        FROM employee_presence_logs 
        WHERE employee_id = ? AND timestamp >= ? AND timestamp < ?
        ORDER BY timestamp
    """, (employee_id, start_date, (next_day_obj + timedelta(days=1)).strftime("%Y-%m-%d")))
    all_logs = cur.fetchall()
    conn.close()

    # Pre-process logs
    logs_by_date = []
    for t, evt in all_logs:
        logs_by_date.append((t, evt))
        
    final_results = []
    
    # Iterate dates
    current_date = start_dt_obj
    while current_date <= end_dt_obj:
        date_str = current_date.strftime("%Y-%m-%d")
        day_of_week = current_date.weekday()
        
        # Determine if work day
        is_work_day = work_days[day_of_week]
        
        # Even if not work day, we might want to show if they showed up? 
        # Requirement usually matches shifts. If not work day but has shifts configured?
        # Usually shifts table defines "what represents a work day". 
        # If work_days[x] is 0, arguably we shouldn't expect shifts.
        # But let's process shifts if they exist.
        
        if not is_work_day:
            # If not a work day, maybe we skip or check for overtime only?
            # For simplicity, if not work day, we skip standard shift processing.
            # But the user might want to see OT.
            pass

        # Calculate for each shift
        daily_shifts = []
        for shift in shifts:
            shift_id, shift_name, start_time, end_time, late_grace, early_grace, checkin_start, checkout_end = shift
            
            # Construct Datetimes
            shift_start_dt = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
            shift_end_dt = datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %H:%M")
            checkin_start_dt = datetime.strptime(f"{date_str} {checkin_start}", "%Y-%m-%d %H:%M")
            checkout_end_dt = datetime.strptime(f"{date_str} {checkout_end}", "%Y-%m-%d %H:%M")
            
            # Overflow handling
            if shift_end_dt < shift_start_dt:
                shift_end_dt += timedelta(days=1)
                checkout_end_dt += timedelta(days=1)

            # Filter Logs for this Shift Window
            shift_logs = []
            for log_time, event_type in logs_by_date:
                try:
                    log_dt = datetime.strptime(log_time, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    try:
                        log_dt = datetime.strptime(log_time, "%Y-%m-%d %H:%M:%S.%f")
                    except ValueError:
                        continue # Skip invalid formats
                        
                if checkin_start_dt <= log_dt <= checkout_end_dt:
                    shift_logs.append(log_dt)
            
            check_in = None
            check_out = None
            
            if len(shift_logs) == 1:
                check_in = shift_logs[0]
                check_out = shift_logs[0]
            elif len(shift_logs) > 1:
                check_in = shift_logs[0]
                check_out = shift_logs[-1]
            
            status = "absent" if is_work_day else "off"
            
            if check_in or check_out:
                status = "on_time"
                if check_in:
                    late_min = (check_in - shift_start_dt).total_seconds() / 60
                    if late_min > late_grace:
                        status = "late"
                if check_out:
                    early_min = (shift_end_dt - check_out).total_seconds() / 60
                    if early_min > early_grace:
                        status = "late_and_early" if status == "late" else "early_leave"
            
            # Logic "Absent"
            # If is_work_day and no logs -> Absent.
            if not (check_in or check_out) and not is_work_day:
                continue # Clean skip if not work day and no show
            
            # Add to results
            if is_work_day or (check_in or check_out):
                 final_results.append({
                    "date": date_str,
                    "check_in": check_in.isoformat() if check_in else None,
                    "check_out": check_out.isoformat() if check_out else None,
                    "status": status,
                    "overtime": 0, # Calculate OT separately or below
                    "shift_name": shift_name,
                    "shift_start_time": start_time
                })

        # Logic Overtime (Generic for the day) - Simplification:
        # If we need specific shift OT, we can calculate it here. 
        # Using simple duration logic for now as per previous complex OT function?
        # The previous OT logic was complex (clustering).
        # For now, let's stick to shift-based status.
        
        current_date += timedelta(days=1)

    return final_results
