import aiosqlite
import os
from pathlib import Path


def get_db_path():
    """Get the path to the database file"""
    # Store database in the backend directory
    backend_dir = Path(__file__).parent
    db_path = backend_dir / "systemsim.db"
    return str(db_path)


async def init_database():
    """Initialize the database with required tables"""
    db_path = get_db_path()
    
    async with aiosqlite.connect(db_path) as db:
        # Create OPC server configuration table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS opc_server_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                prefix TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        await db.commit()


async def save_opc_config(url: str, prefix: str):
    """Save or update OPC server configuration"""
    db_path = get_db_path()
    
    async with aiosqlite.connect(db_path) as db:
        # Check if config already exists
        cursor = await db.execute("SELECT id FROM opc_server_config LIMIT 1")
        row = await cursor.fetchone()
        
        if row:
            # Update existing config
            await db.execute("""
                UPDATE opc_server_config 
                SET url = ?, prefix = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (url, prefix, row[0]))
        else:
            # Insert new config
            await db.execute("""
                INSERT INTO opc_server_config (url, prefix)
                VALUES (?, ?)
            """, (url, prefix))
        
        await db.commit()


async def get_opc_config():
    """Get the current OPC server configuration"""
    db_path = get_db_path()
    
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT url, prefix, updated_at
            FROM opc_server_config
            ORDER BY id DESC
            LIMIT 1
        """)
        row = await cursor.fetchone()
        
        if row:
            return {
                "url": row[0],
                "prefix": row[1],
                "updated_at": row[2]
            }
        return None
