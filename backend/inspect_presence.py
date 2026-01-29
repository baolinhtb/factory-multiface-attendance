import database
import json

database.init_db()
conn = database.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT * FROM employee_presence_logs WHERE employee_id='NV001' ORDER BY timestamp DESC LIMIT 20")
rows = cur.fetchall()
print(rows)
conn.close()
