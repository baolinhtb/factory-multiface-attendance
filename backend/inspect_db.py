import database
import json
from datetime import datetime

# Initialize to ensure connection
database.init_db()

# Query logs for NV001 for today
logs = database.get_employee_attendance_logs("NV001", "2026-01-29", "2026-01-30")

print(json.dumps(logs, indent=2, default=str))
