"""
Async database connection module using aiosqlite.
Provides connection pooling and async database operations.
"""
import os
import aiosqlite
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

# Database configuration
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'face_attendance.db')
DB_PATH = os.path.abspath(DB_PATH)

# Connection pool settings
MAX_CONNECTIONS = 10
_connection_pool: Optional[asyncio.Queue] = None
_pool_semaphore: Optional[asyncio.Semaphore] = None


async def init_connection_pool():
    """Initialize the connection pool."""
    global _connection_pool, _pool_semaphore
    _connection_pool = asyncio.Queue(maxsize=MAX_CONNECTIONS)
    _pool_semaphore = asyncio.Semaphore(MAX_CONNECTIONS)
    
    # Pre-create connections
    for _ in range(MAX_CONNECTIONS):
        conn = await aiosqlite.connect(DB_PATH)
        conn.row_factory = aiosqlite.Row
        await _connection_pool.put(conn)


async def close_connection_pool():
    """Close all connections in the pool."""
    global _connection_pool
    if _connection_pool:
        while not _connection_pool.empty():
            try:
                conn = await _connection_pool.get_nowait()
                await conn.close()
            except asyncio.QueueEmpty:
                break
        _connection_pool = None


@asynccontextmanager
async def get_db_connection():
    """Get a database connection from the pool."""
    global _connection_pool, _pool_semaphore
    
    if _connection_pool is None:
        await init_connection_pool()
    
    async with _pool_semaphore:
        conn = await _connection_pool.get()
        try:
            yield conn
        finally:
            await _connection_pool.put(conn)


async def init_db():
    """Initialize database tables."""
    async with get_db_connection() as conn:
        # Users table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS system_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Employees table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                embedding BLOB,
                position TEXT,
                department TEXT,
                assigned_config_id INTEGER,
                image_path TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Attendance logs table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS attendance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                log_date DATE NOT NULL,
                check_in TIMESTAMP,
                check_out TIMESTAMP,
                status TEXT,
                work_minutes INTEGER,
                overtime_minutes INTEGER,
                shift_id INTEGER,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
                FOREIGN KEY (shift_id) REFERENCES shifts(id)
            )
        """)
        
        # Presence logs table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS presence_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            )
        """)
        
        # Phone usage table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS phone_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                log_date DATE NOT NULL,
                usage_seconds INTEGER DEFAULT 0,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            )
        """)
        
        # Shift configs table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS shift_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                work_days TEXT DEFAULT '1,1,1,1,1,1,0',
                is_default INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Shifts table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_id INTEGER,
                name TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                late_grace_period INTEGER DEFAULT 0,
                early_grace_period INTEGER DEFAULT 0,
                checkin_start TEXT DEFAULT '00:00',
                checkout_end TEXT DEFAULT '23:59',
                FOREIGN KEY (config_id) REFERENCES shift_configs(id)
            )
        """)
        
        # Cameras table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'usb',
                source TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                description TEXT,
                settings TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Settings table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Chat sessions table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Chat messages table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                images TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
            )
        """)
        
        # Date filter presets table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS date_filter_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                days_offset INTEGER,
                is_active INTEGER DEFAULT 1
            )
        """)
        
        # Create indexes
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_logs(employee_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(log_date)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_presence_employee ON presence_logs(employee_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_presence_timestamp ON presence_logs(timestamp)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_phone_employee ON phone_usage(employee_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_phone_date ON phone_usage(log_date)")
        
        await conn.commit()


# Legacy synchronous wrapper for backward compatibility during migration
import sqlite3
import numpy as np


def get_sync_db_connection():
    """Legacy synchronous connection - for migration only."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
