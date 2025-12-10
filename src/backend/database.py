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
                shortnodeid TEXT,
                discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create selected nodes table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS selected_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL UNIQUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create SFC designs table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS sfc_designs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create SFC design data table (stores nodes and edges as JSON)
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS sfc_design_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                design_id INTEGER NOT NULL,
                nodes TEXT NOT NULL,
                edges TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (design_id) REFERENCES sfc_designs (id) ON DELETE CASCADE
            )
        """
        )

        await db.commit()


async def migrate_database():
    """Migrate existing database schema to latest version"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        # Check if shortnodeid column exists in opc_nodes table
        cursor = await db.execute("PRAGMA table_info(opc_nodes)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]

        # Add shortnodeid column if it doesn't exist
        if "shortnodeid" not in column_names:
            try:
                await db.execute("ALTER TABLE opc_nodes ADD COLUMN shortnodeid TEXT")
                await db.commit()
                print("Added shortnodeid column to opc_nodes table")
            except Exception as e:
                print(f"Migration error: {e}")

        # Check if viewport column exists in sfc_design_data table
        cursor = await db.execute("PRAGMA table_info(sfc_design_data)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]

        # Add viewport column if it doesn't exist
        if "viewport" not in column_names:
            try:
                await db.execute("ALTER TABLE sfc_design_data ADD COLUMN viewport TEXT")
                await db.commit()
                print("Added viewport column to sfc_design_data table")
            except Exception as e:
                print(f"Migration error: {e}")


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
                    (node_id, browse_name, parent_id, data_type, value_rank, shortnodeid)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                    (
                        node.get("node_id"),
                        node.get("browse_name"),
                        node.get("parent_id"),
                        node.get("data_type"),
                        node.get("value_rank"),
                        node.get("shortnodeid"),
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
            SELECT node_id, browse_name, parent_id, data_type, value_rank, shortnodeid, discovered_at
            FROM opc_nodes
            ORDER BY node_id
        """
        )
        rows = await cursor.fetchall()

        return [dict(row) for row in rows]


async def save_selected_nodes(node_ids: list[str]):
    """Save selected node IDs for discovery"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        # Clear existing selections
        await db.execute("DELETE FROM selected_nodes")

        # Insert new selections
        for node_id in node_ids:
            await db.execute(
                "INSERT INTO selected_nodes (node_id) VALUES (?)", (node_id,)
            )

        await db.commit()


async def get_selected_nodes():
    """Retrieve selected node IDs from database"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute("SELECT node_id FROM selected_nodes ORDER BY node_id")
        rows = await cursor.fetchall()
        return [row[0] for row in rows]


async def get_opc_node_autocomplete(search_term: str = ""):
    """Get OPC nodes for autocomplete, filtered by search term"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        if search_term:
            cursor = await db.execute(
                """
                SELECT shortnodeid, browse_name, node_id
                FROM opc_nodes
                WHERE shortnodeid LIKE ?
                ORDER BY shortnodeid
                LIMIT 50
            """,
                (f"%{search_term}%",),
            )
        else:
            cursor = await db.execute(
                """
                SELECT shortnodeid, browse_name, node_id
                FROM opc_nodes
                WHERE shortnodeid IS NOT NULL AND shortnodeid != ''
                ORDER BY shortnodeid
                LIMIT 50
            """
            )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


# SFC Design CRUD operations


async def create_sfc_design(name: str, description: str = ""):
    """Create a new SFC design"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute(
            """
            INSERT INTO sfc_designs (name, description)
            VALUES (?, ?)
        """,
            (name, description),
        )
        await db.commit()
        return cursor.lastrowid


async def get_all_sfc_designs():
    """Get all SFC designs"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT id, name, description, created_at, updated_at
            FROM sfc_designs
            ORDER BY updated_at DESC
        """
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_sfc_design(design_id: int):
    """Get a specific SFC design with its data"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row

        # Get design info
        cursor = await db.execute(
            """
            SELECT id, name, description, created_at, updated_at
            FROM sfc_designs
            WHERE id = ?
        """,
            (design_id,),
        )
        design = await cursor.fetchone()
        if not design:
            return None

        # Get design data
        cursor = await db.execute(
            """
            SELECT nodes, edges, viewport
            FROM sfc_design_data
            WHERE design_id = ?
            ORDER BY id DESC
            LIMIT 1
        """,
            (design_id,),
        )
        data = await cursor.fetchone()

        result = dict(design)
        if data:
            result["nodes"] = data[0]
            result["edges"] = data[1]
            result["viewport"] = data[2] if len(data) > 2 else None
        else:
            result["nodes"] = "[]"
            result["edges"] = "[]"
            result["viewport"] = None

        return result


async def save_sfc_design_data(
    design_id: int, nodes: str, edges: str, viewport: str = None
):
    """Save or update SFC design data (nodes and edges as JSON strings)"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        # Insert new design data
        await db.execute(
            """
            INSERT INTO sfc_design_data (design_id, nodes, edges, viewport)
            VALUES (?, ?, ?, ?)
        """,
            (design_id, nodes, edges, viewport),
        )

        # Update the design's updated_at timestamp
        await db.execute(
            """
            UPDATE sfc_designs
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """,
            (design_id,),
        )

        await db.commit()


async def update_sfc_design(design_id: int, name: str, description: str = ""):
    """Update SFC design metadata"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            UPDATE sfc_designs
            SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """,
            (name, description, design_id),
        )
        await db.commit()


async def delete_sfc_design(design_id: int):
    """Delete an SFC design and its data"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "DELETE FROM sfc_design_data WHERE design_id = ?", (design_id,)
        )
        await db.execute("DELETE FROM sfc_designs WHERE id = ?", (design_id,))
        await db.commit()
