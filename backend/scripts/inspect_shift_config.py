import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import database
import json

database.init_db()
conn = database.get_db_connection()
cur = conn.cursor()

cur.execute("SELECT * FROM shifts WHERE name='Ca Sáng'")
rows = cur.fetchall()
print(json.dumps(rows, default=str))

cur.execute("SELECT * FROM shifts WHERE name='Ca Chiều'")
rows2 = cur.fetchall()
print(json.dumps(rows2, default=str))

conn.close()
