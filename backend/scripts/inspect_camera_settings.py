
import sqlite3
import os
import json
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from db import database

def inspect_settings():
    print("Connecting to database...")
    try:
        conn = database.get_db_connection()
        cur = conn.cursor()
        
        print("\n--- Cameras Config ---")
        cur.execute("SELECT id, name, settings FROM cameras_config")
        rows = cur.fetchall()
        
        for r in rows:
            cam_id, name, settings_json = r
            print(f"ID: {cam_id} | Name: {name}")
            print(f"Raw Settings: {settings_json}")
            if settings_json:
                try:
                    parsed = json.loads(settings_json)
                    print(f"Parsed: {json.dumps(parsed, indent=2)}")
                except:
                    print("ERROR parsing JSON")
            else:
                print("Settings are NULL or Empty")
            print("-" * 30)
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_settings()
