from datetime import datetime, timedelta
import attendance_calculator
import database

# Initialize database (just in case)
database.init_db()

today = datetime.now().strftime("%Y-%m-%d")
yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

print(f"Recalculating for yesterday: {yesterday}")
attendance_calculator.calculate_attendance_for_all_employees(yesterday)

print(f"Recalculating for today: {today}")
attendance_calculator.calculate_attendance_for_all_employees(today)

print("Done.")
