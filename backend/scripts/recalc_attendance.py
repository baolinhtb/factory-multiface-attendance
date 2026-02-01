import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from core import attendance_calculator
from db import database

# Initialize database (just in case)
database.init_db()

today = datetime.now().strftime("%Y-%m-%d")
yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

print(f"Recalculating for yesterday: {yesterday}")
attendance_calculator.calculate_attendance_for_all_employees(yesterday)

print(f"Recalculating for today: {today}")
attendance_calculator.calculate_attendance_for_all_employees(today)

print("Done.")
