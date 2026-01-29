import database
import json

database.init_db()
conn = database.get_db_connection()
cur = conn.cursor()

# Get assigned config for NV001
cur.execute("SELECT assigned_config_id FROM employees WHERE employee_id='NV001'")
res = cur.fetchone()
config_id = res[0] if res else None

if not config_id:
    cur.execute("SELECT id FROM shift_configs WHERE is_default=1")
    res = cur.fetchone()
    config_id = res[0] if res else None

print(f"Config ID: {config_id}")

if config_id:
    cur.execute("SELECT * FROM shifts WHERE config_id=?", (config_id,))
    shifts = cur.fetchall()
    print(shifts)

conn.close()
