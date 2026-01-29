import database
import json

database.init_db()
conn = database.get_db_connection()
cur = conn.cursor()

# Get logs with Shift ID
cur.execute("""
    SELECT a.id, a.date, a.shift_id, s.name, a.check_in, a.check_out, a.status 
    FROM attendance_logs a 
    LEFT JOIN shifts s ON a.shift_id = s.id 
    WHERE a.employee_id='NV001' AND a.date='2026-01-29'
""")
rows = cur.fetchall()
print(json.dumps(rows, default=str))

conn.close()
