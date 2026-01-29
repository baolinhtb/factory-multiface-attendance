import sqlite3
import os
import numpy as np

# Database config - Simple SQLite file
DB_PATH = os.path.join(os.path.dirname(__file__), "attendance.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    return conn

def init_db():
    """Initialize the users table."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            embedding BLOB
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS phone_usage (
            user_name TEXT PRIMARY KEY,
            total_seconds REAL DEFAULT 0,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}.")

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
