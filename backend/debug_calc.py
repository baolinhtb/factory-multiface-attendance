import attendance_calculator
import database
from datetime import datetime
import traceback

database.init_db()

print("--- DEBUG CALCULATION ---")
try:
    # Test with NV001 and today's date
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"Calculating for NV001, {today}...")
    
    # Check what happens with dynamic calc
    results = attendance_calculator.calculate_attendance_dynamic('NV001', '2026-01-29', '2026-01-30')
    print("Results:", results)
    
except Exception as e:
    print("ERROR OCCURRED:")
    traceback.print_exc()

print("--- DEBUG END ---")
