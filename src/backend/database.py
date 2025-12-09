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
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS opc_server_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                prefix TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create OPC nodes table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS opc_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL UNIQUE,
                browse_name TEXT,
                parent_id TEXT,
                data_type TEXT,
                value_rank INTEGER,
                discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

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
            await db.execute(
                """
                UPDATE opc_server_config 
                SET url = ?, prefix = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """,
                (url, prefix, row[0]),
            )
        else:
            # Insert new config
            await db.execute(
                """
                INSERT INTO opc_server_config (url, prefix)
                VALUES (?, ?)
            """,
                (url, prefix),
            )

        await db.commit()


async def get_opc_config():
    """Get the current OPC server configuration"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT url, prefix, updated_at
            FROM opc_server_config
            ORDER BY id DESC
            LIMIT 1
        """
        )
        row = await cursor.fetchone()

        if row:
            return {"url": row[0], "prefix": row[1], "updated_at": row[2]}
        return None


async def save_opc_nodes(nodes: list):
    """Save discovered OPC nodes to database"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        # Clear existing nodes
        await db.execute("DELETE FROM opc_nodes")

        # Insert new nodes
        for node in nodes:
            try:
                await db.execute(
                    """
                    INSERT OR IGNORE INTO opc_nodes 
                    (node_id, browse_name, parent_id, data_type, value_rank)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    (
                        node.get("node_id"),
                        node.get("browse_name"),
                        node.get("parent_id"),
                        node.get("data_type"),
                        node.get("value_rank"),
                    ),
                )
            except Exception as e:
                print(f"Error saving node {node.get('node_id')}: {e}")

        await db.commit()


async def get_opc_nodes():
    """Retrieve all discovered OPC nodes from database"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT node_id, browse_name, parent_id, data_type, value_rank, discovered_at
            FROM opc_nodes
            ORDER BY node_id
        """
        )
        rows = await cursor.fetchall()

        return [dict(row) for row in rows]
