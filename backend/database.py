import sqlite3
import os
import numpy as np

# Database config - Simple SQLite file
DB_PATH = os.path.join(os.path.dirname(__file__), "attendance.db")

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        print(f"✓ Database connection successful: {DB_PATH}")
        return conn
    except Exception as e:
        print(f"✗ Database connection FAILED: {e}")
        raise

def init_db():
    """Initialize the users table."""
    print(f"[DB] Initializing database at: {DB_PATH}")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        print("[DB] Creating 'users' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                embedding BLOB
            );
        """)
        
        print("[DB] Creating 'phone_usage' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS phone_usage (
                user_name TEXT PRIMARY KEY,
                total_seconds REAL DEFAULT 0,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        
        # Default settings
        print("[DB] Inserting default settings...")
        default_settings = [
            ('camera_src', '0'),
            ('show_age_gender', 'true'),
            ('enable_alarm', 'true'),
            ('enable_phone_det', 'true')
        ]
        cur.executemany("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", default_settings)
        
        conn.commit()
        conn.close()
        print(f"✓ Database initialized successfully at {DB_PATH}")
    except Exception as e:
        print(f"✗ Database initialization FAILED: {e}")
        raise

def add_user(name: str, embedding: np.ndarray):
    """Save user name and embedding to database."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Convert numpy array to bytes for storage
    embedding_bytes = embedding.tobytes()
    
    cur.execute(
        "INSERT INTO users (name, embedding) VALUES (?, ?)",
        (name, embedding_bytes)
    )
    conn.commit()
    conn.close()

def get_all_users():
    """Retrieve all users and their embeddings."""
    if not os.path.exists(DB_PATH):
        return []
        
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT name, embedding FROM users")
    rows = cur.fetchall()
    
    users = []
    for row in rows:
        name = row[0]
        embedding_bytes = row[1]
        # Convert bytes back to numpy array (InsightFace standard is float32)
        embedding = np.frombuffer(embedding_bytes, dtype=np.float32)
        users.append({"name": name, "embedding": embedding})
        
    conn.close()
    return users

def update_phone_usage(name: str, seconds: float):
    """Increment total phone usage seconds for a user."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO phone_usage (user_name, total_seconds, last_seen)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_name) DO UPDATE SET
            total_seconds = total_seconds + EXCLUDED.total_seconds,
            last_seen = CURRENT_TIMESTAMP
    """, (name, seconds))
    conn.commit()
    conn.close()

def get_phone_stats():
    """Get all phone usage statistics."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_name, total_seconds FROM phone_usage ORDER BY total_seconds DESC")
    rows = cur.fetchall()
    conn.close()
    return [{"name": r[0], "seconds": r[1]} for r in rows]

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
