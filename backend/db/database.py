import sqlite3
import os
import numpy as np

# Database config - Simple SQLite file
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "attendance.db")

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        print(f"✓ Database connection successful: {DB_PATH}")
        return conn
    except Exception as e:
        print(f"✗ Database connection FAILED: {e}")
        raise

def init_db():
    """Initialize the database tables."""
    print(f"[DB] Initializing database at: {DB_PATH}")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        print("[DB] Creating 'employees' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                position TEXT,
                department TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                embedding BLOB,
                assigned_config_id INTEGER,
                FOREIGN KEY(assigned_config_id) REFERENCES shift_configs(id)
            );
        """)
        
        # Migration for existing employees table
        try:
            cur.execute("ALTER TABLE employees ADD COLUMN assigned_config_id INTEGER")
        except:
            pass
        
        print("[DB] Creating 'shift_configs' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS shift_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                work_days TEXT DEFAULT '1,1,1,1,1,1,0', -- "Mon,Tue,Wed,Thu,Fri,Sat,Sun" (1=work, 0=off)
                is_default INTEGER DEFAULT 0
            );
        """)

        print("[DB] Creating 'shifts' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_id INTEGER,
                name TEXT NOT NULL,
                start_time TEXT NOT NULL,       -- "HH:MM"
                end_time TEXT NOT NULL,         -- "HH:MM"
                late_grace_period INTEGER DEFAULT 0,  -- minutes
                early_grace_period INTEGER DEFAULT 0, -- minutes
                checkin_start TEXT DEFAULT "00:00",   -- "HH:MM" window start
                checkout_end TEXT DEFAULT "23:59",    -- "HH:MM" window end
                FOREIGN KEY(config_id) REFERENCES shift_configs(id)
            );
        """)
        
        # Helper to add missing columns if they don't exist
        try:
            cur.execute("ALTER TABLE shifts ADD COLUMN late_grace_period INTEGER DEFAULT 0")
            cur.execute("ALTER TABLE shifts ADD COLUMN early_grace_period INTEGER DEFAULT 0")
            cur.execute("ALTER TABLE shifts ADD COLUMN checkin_start TEXT DEFAULT '00:00'")
            cur.execute("ALTER TABLE shifts ADD COLUMN checkout_end TEXT DEFAULT '23:59'")
        except:
            pass # Columns already exist
        
        print("[DB] Creating 'attendance_logs' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS attendance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                date TEXT NOT NULL, -- "YYYY-MM-DD"
                check_in TIMESTAMP,
                check_out TIMESTAMP,
                shift_id INTEGER,
                status TEXT, -- "late", "early", "on_time"
                overtime_minutes INTEGER DEFAULT 0,
                FOREIGN KEY(employee_id) REFERENCES employees(employee_id),
                FOREIGN KEY(shift_id) REFERENCES shifts(id)
            );
        """)        
        
        print("[DB] Creating 'employee_presence_logs' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS employee_presence_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                event_type TEXT NOT NULL,  -- 'enter' or 'leave'
                FOREIGN KEY(employee_id) REFERENCES employees(employee_id)
            );
        """)
        
        print("[DB] Creating 'chat_sessions' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        print("[DB] Creating 'chat_messages' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                images TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            );
        """)
        
        # Add updated_at trigger for chat_sessions
        cur.execute("""
            CREATE TRIGGER IF NOT EXISTS update_chat_session_timestamp 
            AFTER INSERT ON chat_messages
            BEGIN
                UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.session_id;
            END;
        """)

        print("[DB] Creating 'daily_phone_usage' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS daily_phone_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                date TEXT NOT NULL, -- "YYYY-MM-DD"
                total_seconds REAL DEFAULT 0,
                FOREIGN KEY(employee_id) REFERENCES employees(employee_id)
            );
        """)
        
        print("[DB] Creating 'system_users' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        print("[DB] Creating 'settings' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """)
        
        print("[DB] Creating 'date_filter_presets' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS date_filter_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                days_offset INTEGER NOT NULL,
                is_range INTEGER DEFAULT 0,
                is_custom INTEGER DEFAULT 0,
                display_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1
            );
        """)

        print("[DB] Creating 'cameras_config' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cameras_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL, -- 'usb' or 'rtsp'
                source TEXT NOT NULL, -- index or URL
                is_active INTEGER DEFAULT 1,
                description TEXT
            );
        """)
        
        # Default settings
        print("[DB] Inserting default settings...")
        default_settings = [
            ('camera_type', 'usb'),
            ('camera_src', '0'),
            ('rtsp_url', ''),
            ('show_age_gender', 'true'),
            ('enable_alarm', 'true'),
            ('enable_phone_det', 'true'),
            ('enable_fire_det', 'true'),
            ('enable_pose_det', 'true'),
            ('overtime_enabled', 'true'),
            # AI Detection Thresholds
            ('face_recognition_threshold', '0.45'),
            ('phone_detection_confidence', '0.15'),
            ('fire_detection_confidence', '0.30'),
            ('pose_detection_confidence', '0.50'),
            # Ollama Configuration
            ('ollama_base_url', 'http://localhost:11434'),
            ('ollama_model_name', 'qwen2.5-vl:7b-instruct-q4_K_M'),
            ('ollama_timeout', '120'),
            ('ollama_enabled', 'true')
        ]
        cur.executemany("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", default_settings)
        
        # Default date filter presets
        print("[DB] Initializing default date filter presets...")
        default_filters = [
            ('today', 'Hôm nay', 0, 0, 0, 1, 1),
            ('yesterday', 'Hôm qua', -1, 0, 0, 2, 1),
            ('week', 'Tuần này', -7, 1, 0, 3, 1),
            ('month', 'Tháng này', -30, 1, 0, 4, 1),
            ('custom', 'Tùy chọn', 0, 0, 1, 5, 1)
        ]
        cur.executemany("""
            INSERT OR IGNORE INTO date_filter_presets 
            (value, label, days_offset, is_range, is_custom, display_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, default_filters)

        # Migration and Defaults
        try:
            cur.execute("ALTER TABLE employees ADD COLUMN assigned_config_id INTEGER")
        except: pass
        try:
            cur.execute("ALTER TABLE shifts ADD COLUMN config_id INTEGER")
        except: pass
        try:
            cur.execute("ALTER TABLE employees ADD COLUMN image_path TEXT")
        except: pass
        
        # Ensure at least one default config exists
        cur.execute("SELECT COUNT(*) FROM shift_configs WHERE is_default = 1")
        if cur.fetchone()[0] == 0:
            cur.execute("INSERT INTO shift_configs (name, is_default, work_days) VALUES (?, ?, ?)", ("Chế độ mặc định của công ty", 1, "1,1,1,1,1,1,0"))
            default_config_id = cur.lastrowid
            
            # Link existing shifts to this default config if they are not linked
            cur.execute("UPDATE shifts SET config_id = ? WHERE config_id IS NULL", (default_config_id,))
            
            # Also insert default shifts if table empty
            cur.execute("SELECT COUNT(*) FROM shifts")
            if cur.fetchone()[0] == 0:
                cur.executemany("INSERT INTO shifts (config_id, name, start_time, end_time, late_grace_period, early_grace_period, checkin_start, checkout_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", default_shifts_data)

        # Migration: Check if we need to migrate old single camera settings to cameras_config
        cur.execute("SELECT COUNT(*) FROM cameras_config")
        if cur.fetchone()[0] == 0:
            print("[DB] Migrating single camera settings to 'cameras_config'...")
            cur.execute("SELECT value FROM settings WHERE key = 'camera_type'")
            cam_type = cur.fetchone()
            cur.execute("SELECT value FROM settings WHERE key = 'camera_src'")
            cam_src = cur.fetchone()
            cur.execute("SELECT value FROM settings WHERE key = 'rtsp_url'")
            rtsp_url = cur.fetchone()
            
            # Default values if not found or empty
            final_type = cam_type[0] if cam_type else 'usb'
            final_src = cam_src[0] if cam_src else '0'
            if final_type == 'rtsp' and rtsp_url and rtsp_url[0]:
                final_src = rtsp_url[0]
            
            cur.execute("INSERT INTO cameras_config (name, type, source, is_active) VALUES (?, ?, ?, ?)", 
                        ("Camera Mặc Định", final_type, final_src, 1))

        conn.commit()
        conn.close()
        print(f"✓ Database initialized successfully at {DB_PATH}")
    except Exception as e:
        print(f"✗ Database initialization FAILED: {e}")
        raise

def add_employee(employee_id: str, full_name: str, embedding: np.ndarray, position: str = None, department: str = None, assigned_config_id: int = None, image_path: str = None):
    """Save employee details and embedding to database."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Convert numpy array to bytes for storage
    embedding_bytes = embedding.tobytes()
    
    cur.execute(
        "INSERT INTO employees (employee_id, full_name, embedding, position, department, assigned_config_id, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (employee_id, full_name, embedding_bytes, position, department, assigned_config_id, image_path)
    )
    conn.commit()
    conn.close()

def update_employee(employee_id: str, full_name: str, position: str = None, department: str = None, assigned_config_id: int = None):
    """Update employee details."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE employees 
        SET full_name = ?, position = ?, department = ?, assigned_config_id = ? 
        WHERE employee_id = ?
    """, (full_name, position, department, assigned_config_id, employee_id))
    conn.commit()
    conn.close()

def update_employee_image(employee_id: str, image_path: str, embedding: np.ndarray):
    """Update employee image and embedding."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Convert numpy array to bytes
    embedding_bytes = embedding.tobytes()
    
    cur.execute("""
        UPDATE employees 
        SET image_path = ?, embedding = ?
        WHERE employee_id = ?
    """, (image_path, embedding_bytes, employee_id))
    conn.commit()
    conn.close()

def get_all_employees_with_embeddings():
    """Retrieve all employees and their embeddings for recognition."""
    if not os.path.exists(DB_PATH):
        return []
        
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT employee_id, full_name, embedding FROM employees")
    rows = cur.fetchall()
    
    employees = []
    for row in rows:
        employee_id = row[0]
        full_name = row[1]
        embedding_bytes = row[2]
        # Convert bytes back to numpy array (InsightFace standard is float32)
        embedding = np.frombuffer(embedding_bytes, dtype=np.float32)
        employees.append({"id": employee_id, "name": full_name, "embedding": embedding})
        
    conn.close()
    return employees

def get_all_employees():
    """Retrieve basic list of all employees."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Include image_path in selection
    # Need to check if column exists first? 
    # Since we added migration, it should exist. But select * or explicit fields is better.
    # To avoid errors if running on old code structure without restart, let's just stick to explicit.
    # We need to update this query to fetch image_path if we want it in list view too.
    # But user asked for "Employees Detail".
    try:
        cur.execute("SELECT id, employee_id, full_name, position, department, created_at, assigned_config_id, image_path FROM employees")
        rows = cur.fetchall()
        conn.close()
        return [{
            "id": r[0],
            "employee_id": r[1],
            "full_name": r[2],
            "position": r[3],
            "department": r[4],
            "created_at": r[5],
            "assigned_config_id": r[6],
            "image_path": r[7]
        } for r in rows]
    except Exception as e:
        # Fallback for old schema if migration didn't run properly yet (rare)
        conn.close()
        return []

def get_employee_detail(employee_id: str):
    """Retrieve full details of a specific employee including assigned shift config and its shifts."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, employee_id, full_name, position, department, created_at, assigned_config_id, image_path FROM employees WHERE employee_id = ?", (employee_id,))
        row = cur.fetchone()
        
        if not row:
            conn.close()
            return None
        
        employee = {
            "id": row[0],
            "employee_id": row[1],
            "full_name": row[2],
            "position": row[3],
            "department": row[4],
            "created_at": row[5],
            "assigned_config_id": row[6],
            "image_path": row[7]
        }
    except:
        # Fallback
        conn.close()
        return None
    
    if not row:
        conn.close()
        return None
        
    emp_data = {
        "id": row[0],
        "employee_id": row[1],
        "full_name": row[2],
        "position": row[3],
        "department": row[4],
        "created_at": row[5],
        "assigned_config_id": row[6],
        "image_path": row[7]
    }
    
    # Get config details
    config_id = emp_data["assigned_config_id"]
    if not config_id:
        cur.execute("SELECT id FROM shift_configs WHERE is_default = 1")
        res = cur.fetchone()
        if res: config_id = res[0]
        
    if config_id:
        cur.execute("SELECT id, name, work_days, is_default FROM shift_configs WHERE id = ?", (config_id,))
        c_row = cur.fetchone()
        if c_row:
            emp_data["config"] = {
                "id": c_row[0],
                "name": c_row[1],
                "work_days": c_row[2],
                "is_default": c_row[3],
                "shifts": []
            }
            cur.execute("SELECT id, name, start_time, end_time FROM shifts WHERE config_id = ?", (config_id,))
            s_rows = cur.fetchall()
            emp_data["config"]["shifts"] = [{"id": r[0], "name": r[1], "start": r[2], "end": r[3]} for r in s_rows]
            
    conn.close()
    return emp_data

def log_attendance(employee_id: str):
    """Log or update daily attendance based on employee's assigned shift configuration."""
    from datetime import datetime
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    now_time = now.strftime("%H:%M")
    day_of_week = now.weekday() # 0 = Monday, 6 = Sunday
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 1. Determine which configuration to use
    cur.execute("SELECT assigned_config_id FROM employees WHERE employee_id = ?", (employee_id,))
    emp_row = cur.fetchone()
    config_id = emp_row[0] if emp_row else None
    
    if config_id is None:
        cur.execute("SELECT id FROM shift_configs WHERE is_default = 1")
        def_row = cur.fetchone()
        config_id = def_row[0] if def_row else None
    
    if config_id is None:
        print(f"[ATTENDANCE] FATAL: No shift configuration found for {employee_id}")
        conn.close()
        return

    # 2. Check if today is a work day in this config
    cur.execute("SELECT work_days, name FROM shift_configs WHERE id = ?", (config_id,))
    config_row = cur.fetchone()
    if not config_row:
        conn.close()
        return
    
    work_days_str = config_row[0]
    work_days = [d == '1' for d in work_days_str.split(',')]
    
    if not work_days[day_of_week]:
        print(f"[ATTENDANCE] {employee_id}: Today is NOT a work day in config '{config_row[1]}'")
        conn.close()
        return

    # 3. Find relevant shift in this config based on window
    cur.execute("SELECT id, name, start_time, end_time, late_grace_period, early_grace_period, checkin_start, checkout_end FROM shifts WHERE config_id = ?", (config_id,))
    config_shifts = cur.fetchall()
    
    target_shift = None
    for s in config_shifts:
        s_id, s_name, s_start, s_end, s_late, s_early, c_start, c_end = s
        if c_start <= c_end:
            in_window = (c_start <= now_time <= c_end)
        else: # Overnight
            in_window = (now_time >= c_start or now_time <= c_end)
        if in_window:
            target_shift = s
            break
            
    if not target_shift:
        print(f"[ATTENDANCE] {employee_id}: No active shift window in config '{config_row[1]}' at {now_time}")
        conn.close()
        return

    s_id, s_name, s_start, s_end, s_late, s_early, c_start, c_end = target_shift
    
    # 4. Check if log for this specific shift session already exists
    cur.execute("SELECT id, check_in, shift_id, status FROM attendance_logs WHERE employee_id = ? AND date = ? AND shift_id = ?", (employee_id, today, s_id))
    row = cur.fetchone()
    
    if not row:
        # Check In - Determine status
        status = "on_time"
        s_dt = datetime.strptime(s_start, "%H:%M")
        n_dt = datetime.strptime(now_time, "%H:%M")
        
        # Calculate diff in minutes
        diff = (n_dt - s_dt).total_seconds() / 60
        if diff > s_late:
            status = "late"
            
        cur.execute("""
            INSERT INTO attendance_logs (employee_id, date, check_in, shift_id, status)
            VALUES (?, ?, ?, ?, ?)
        """, (employee_id, today, now.isoformat(), s_id, status))
        print(f"[ATTENDANCE] Checked In: {employee_id} at {now.isoformat()} (Shift: {s_name}, Status: {status})")
    else:
        # Check Out - Update status if early leaver
        log_id, check_in_raw, log_shift_id, current_status = row
        
        status = current_status
        e_dt = datetime.strptime(s_end, "%H:%M")
        n_dt = datetime.strptime(now_time, "%H:%M")
        
        # Calculate diff end
        # Handle overnight by checking if n_dt is early morning and e_dt is late night or vice versa
        # For simplicity, we compare as same-day times for now, but a robust system would use full datetimes
        diff_end = (e_dt - n_dt).total_seconds() / 60
        
        new_status = status
        if diff_end > s_early:
            if status == "on_time":
                new_status = "early_leave"
            elif status == "late":
                new_status = "late_and_early"
        
        # Calculate overtime
        overtime = 0
        if n_dt > e_dt:
            overtime = int((n_dt - e_dt).total_seconds() / 60)
            
        cur.execute("""
            UPDATE attendance_logs 
            SET check_out = ?, status = ?, overtime_minutes = ? 
            WHERE id = ?
        """, (now.isoformat(), new_status, overtime, log_id))
    
    conn.commit()
    conn.close()

def update_phone_usage(employee_id: str, seconds: float):
    """Increment daily phone usage seconds for an employee."""
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM daily_phone_usage WHERE employee_id = ? AND date = ?", (employee_id, today))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE daily_phone_usage SET total_seconds = total_seconds + ? WHERE id = ?", (seconds, row[0]))
    else:
        cur.execute("INSERT INTO daily_phone_usage (employee_id, date, total_seconds) VALUES (?, ?, ?)", (employee_id, today, seconds))
        
    conn.commit()
    conn.close()

def get_daily_stats(date: str = None):
    """Get all employee stats for a specific day."""
    from datetime import datetime
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
        
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Combined query for attendance and phone usage
    cur.execute("""
        SELECT e.employee_id, e.full_name, a.check_in, a.check_out, a.status, p.total_seconds
        FROM employees e
        LEFT JOIN attendance_logs a ON e.employee_id = a.employee_id AND a.date = ?
        LEFT JOIN daily_phone_usage p ON e.employee_id = p.employee_id AND p.date = ?
        ORDER BY a.check_in DESC
    """, (date, date))
    
    rows = cur.fetchall()
    conn.close()
    return [{
        "employee_id": r[0],
        "name": r[1],
        "check_in": r[2],
        "check_out": r[3],
        "status": r[4],
        "phone_seconds": r[5] or 0
    } for r in rows]

def get_shift_configs():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, work_days, is_default FROM shift_configs")
    rows = cur.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "work_days": r[2], "is_default": r[3]} for r in rows]

def add_shift_config(name: str, is_default: int = 0):
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get settings from default config to clone
    cur.execute("SELECT id, work_days FROM shift_configs WHERE is_default = 1")
    def_row = cur.fetchone()
    
    work_days = def_row[1] if def_row else '1,1,1,1,1,1,0'
    def_config_id = def_row[0] if def_row else None

    if is_default:
        cur.execute("UPDATE shift_configs SET is_default = 0")
    
    cur.execute("INSERT INTO shift_configs (name, work_days, is_default) VALUES (?, ?, ?)", (name, work_days, is_default))
    new_config_id = cur.lastrowid
    
    # Clone shifts from default config if exists
    if def_config_id:
        cur.execute("""
            INSERT INTO shifts (config_id, name, start_time, end_time, late_grace_period, early_grace_period, checkin_start, checkout_end)
            SELECT ?, name, start_time, end_time, late_grace_period, early_grace_period, checkin_start, checkout_end
            FROM shifts WHERE config_id = ?
        """, (new_config_id, def_config_id))
    
    conn.commit()
    conn.close()
    return new_config_id

def update_shift_config(id: int, name: str, work_days: str, is_default: int):
    conn = get_db_connection()
    cur = conn.cursor()
    if is_default:
        cur.execute("UPDATE shift_configs SET is_default = 0 WHERE id != ?", (id,))
    cur.execute("UPDATE shift_configs SET name = ?, work_days = ?, is_default = ? WHERE id = ?", (name, work_days, is_default, id))
    conn.commit()
    conn.close()

def delete_shift_config(id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    # Check if it's default
    cur.execute("SELECT is_default FROM shift_configs WHERE id = ?", (id,))
    if cur.fetchone()[0]:
        conn.close()
        return False # Cannot delete default
    cur.execute("DELETE FROM shifts WHERE config_id = ?", (id,))
    cur.execute("DELETE FROM shift_configs WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return True

def get_shifts(config_id: int = None):
    conn = get_db_connection()
    cur = conn.cursor()
    if config_id:
        cur.execute("SELECT id, name, start_time, end_time, late_grace_period, early_grace_period, checkin_start, checkout_end, config_id FROM shifts WHERE config_id = ?", (config_id,))
    else:
        cur.execute("SELECT id, name, start_time, end_time, late_grace_period, early_grace_period, checkin_start, checkout_end, config_id FROM shifts")
    rows = cur.fetchall()
    conn.close()
    return [{
        "id": r[0],
        "name": r[1],
        "start_time": r[2],
        "end_time": r[3],
        "late_grace_period": r[4],
        "early_grace_period": r[5],
        "checkin_start": r[6],
        "checkout_end": r[7],
        "config_id": r[8]
    } for r in rows]

def add_shift(name: str, start_time: str, end_time: str, late_grace: int = 0, early_grace: int = 0, checkin_start: str = "00:00", checkout_end: str = "23:59", config_id: int = None):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO shifts (name, start_time, end_time, late_grace_period, early_grace_period, checkin_start, checkout_end, config_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (name, start_time, end_time, late_grace, early_grace, checkin_start, checkout_end, config_id))
    conn.commit()
    conn.close()

def update_shift(shift_id: int, name: str, start_time: str, end_time: str, late_grace: int = 0, early_grace: int = 0, checkin_start: str = "00:00", checkout_end: str = "23:59"):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE shifts 
        SET name = ?, start_time = ?, end_time = ?, late_grace_period = ?, early_grace_period = ?, checkin_start = ?, checkout_end = ? 
        WHERE id = ?
    """, (name, start_time, end_time, late_grace, early_grace, checkin_start, checkout_end, shift_id))
    conn.commit()
    conn.close()

def delete_shift(shift_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM shifts WHERE id = ?", (shift_id,))
    conn.commit()
    conn.close()

def get_employee_attendance_logs(employee_id: str, start_date: str = None, end_date: str = None):
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT a.date, a.check_in, a.check_out, a.status, a.overtime_minutes, s.name as shift_name, s.start_time
        FROM attendance_logs a
        LEFT JOIN shifts s ON a.shift_id = s.id
        WHERE a.employee_id = ?
    """
    params = [employee_id]
    
    if start_date and end_date:
        query += " AND a.date BETWEEN ? AND ?"
        params.extend([start_date, end_date])
        
    query += " ORDER BY a.date DESC, s.start_time ASC"
    
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return [{
        "date": r[0],
        "check_in": r[1],
        "check_out": r[2],
        "status": r[3],
        "overtime": r[4],
        "shift_name": r[5],
        "shift_start_time": r[6]
    } for r in rows]

def get_employee_phone_logs(employee_id: str, start_date: str = None, end_date: str = None):
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT date, total_seconds 
        FROM daily_phone_usage 
        WHERE employee_id = ?
    """
    params = [employee_id]
    
    if start_date and end_date:
        query += " AND date BETWEEN ? AND ?"
        params.extend([start_date, end_date])
        
    query += " ORDER BY date DESC"
    
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return [{"date": r[0], "phone_seconds": r[1]} for r in rows]

def get_system_user(username: str):
    print(f"[DB] Looking up system user: '{username}'")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, username, hashed_password, role FROM system_users WHERE username = ?", (username,))
        row = cur.fetchone()
        conn.close()
        
        if row:
            user_data = {"id": row[0], "username": row[1], "hashed_password": row[2], "role": row[3]}
            print(f"✓ User found: {username} (role: {user_data['role']})")
            return user_data
        else:
            print(f"✗ User NOT found: {username}")
            return None
    except Exception as e:
        print(f"✗ Error retrieving user '{username}': {e}")
        raise

def create_system_user(username: str, hashed_pass: str, role: str = 'user'):
    print(f"[DB] Creating system user: '{username}' with role '{role}'")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO system_users (username, hashed_password, role) VALUES (?, ?, ?)", (username, hashed_pass, role))
        conn.commit()
        conn.close()
        print(f"✓ User created successfully: {username}")
    except Exception as e:
        print(f"✗ Error creating user '{username}': {e}")
        raise

def get_all_system_users():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, role FROM system_users")
    rows = cur.fetchall()
    conn.close()
    return [{"id": r[0], "username": r[1], "role": r[2]} for r in rows]

def delete_system_user(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM system_users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

def update_system_user_password(user_id: int, hashed_pass: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE system_users SET hashed_password = ? WHERE id = ?", (hashed_pass, user_id))
    conn.commit()
    conn.close()

def get_all_cameras():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, type, source, is_active, description FROM cameras_config")
    rows = cur.fetchall()
    conn.close()
    return [{
        "id": r[0],
        "name": r[1],
        "type": r[2],
        "source": r[3],
        "is_active": r[4],
        "description": r[5]
    } for r in rows]

def get_camera_by_id(camera_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, type, source, is_active, description FROM cameras_config WHERE id = ?", (camera_id,))
    r = cur.fetchone()
    conn.close()
    if r:
        return {
            "id": r[0],
            "name": r[1],
            "type": r[2],
            "source": r[3],
            "is_active": r[4],
            "description": r[5]
        }
    return None

def add_camera(name: str, cam_type: str, source: str, is_active: int = 1, description: str = None):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO cameras_config (name, type, source, is_active, description) VALUES (?, ?, ?, ?, ?)",
        (name, cam_type, source, is_active, description)
    )
    new_id = cur.lastrowid
    conn.commit()
    conn.close()
    return new_id

def update_camera(camera_id: int, name: str, cam_type: str, source: str, is_active: int, description: str = None):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE cameras_config 
        SET name = ?, type = ?, source = ?, is_active = ?, description = ? 
        WHERE id = ?
    """, (name, cam_type, source, is_active, description, camera_id))
    conn.commit()
    conn.close()

def delete_camera(camera_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM cameras_config WHERE id = ?", (camera_id,))
    conn.commit()
    conn.close()

def get_settings():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM settings")
    rows = cur.fetchall()
    conn.close()
    return {r[0]: r[1] for r in rows}

def update_setting(key: str, value: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE settings SET value = ? WHERE key = ?", (value, key))
    conn.commit()
    conn.close()

# Employee Presence Logs Functions
def log_employee_presence(employee_id: str, event_type: str):
    """Log when employee enters or leaves camera view"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO employee_presence_logs (employee_id, timestamp, event_type)
        VALUES (?, datetime('now', 'localtime'), ?)
    """, (employee_id, event_type))
    conn.commit()
    conn.close()

def get_employee_presence_logs(employee_id: str = None, start_date: str = None, end_date: str = None):
    """Get presence logs with optional filters"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT pl.id, pl.employee_id, e.full_name, pl.timestamp, pl.event_type
        FROM employee_presence_logs pl
        LEFT JOIN employees e ON pl.employee_id = e.employee_id
        WHERE 1=1
    """
    params = []
    
    if employee_id:
        query += " AND pl.employee_id = ?"
        params.append(employee_id)
    
    if start_date:
        query += " AND DATE(pl.timestamp) >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(pl.timestamp) <= ?"
        params.append(end_date)
    
    query += " ORDER BY pl.timestamp DESC"
    
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    
    return [{
        "id": r[0],
        "employee_id": r[1],
        "full_name": r[2],
        "timestamp": r[3],
        "event_type": r[4]
    } for r in rows]

# Date Filter Presets Functions
def get_active_date_filter_presets():
    """Get all active date filter presets ordered by display_order"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, value, label, days_offset, is_range, is_custom, display_order, is_active
        FROM date_filter_presets
        WHERE is_active = 1
        ORDER BY display_order ASC
    """)
    rows = cur.fetchall()
    conn.close()
    return [{
        "id": r[0],
        "value": r[1],
        "label": r[2],
        "days_offset": r[3],
        "is_range": r[4],
        "is_custom": r[5],
        "display_order": r[6],
        "is_active": r[7]
    } for r in rows]

def get_all_date_filter_presets():
    """Get ALL date filter presets (for settings management)"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, value, label, days_offset, is_range, is_custom, display_order, is_active
        FROM date_filter_presets
        ORDER BY display_order ASC
    """)
    rows = cur.fetchall()
    conn.close()
    return [{
        "id": r[0],
        "value": r[1],
        "label": r[2],
        "days_offset": r[3],
        "is_range": r[4],
        "is_custom": r[5],
        "display_order": r[6],
        "is_active": r[7]
    } for r in rows]

def update_date_filter_preset(preset_id: int, label: str, is_active: int):
    """Update a date filter preset's label and/or active status"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE date_filter_presets
        SET label = ?, is_active = ?
        WHERE id = ?
    """, (label, is_active, preset_id))
    conn.commit()
    conn.close()
