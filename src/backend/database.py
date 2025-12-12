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

        # Discovery log per parent subtree
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS discovery_log (
                parent_id TEXT PRIMARY KEY,
                last_discovered INTEGER,
                duration_ms INTEGER
            )
            """
        )

        # Create simulation config table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS track_for_simulation (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL UNIQUE,
                data_type TEXT,
                regex_pattern TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Simulation runs metadata
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id TEXT PRIMARY KEY,
                name TEXT,
                sfc_design_id INTEGER,
                regex_pattern TEXT,
                started_at INTEGER,
                finished_at INTEGER,
                note TEXT
            )
        """
        )

        # Time-series samples for simulations
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS simulation_samples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                ts INTEGER NOT NULL,
                node_id TEXT NOT NULL,
                short_node_id TEXT,
                data_type TEXT,
                value TEXT,
                quality INTEGER,
                source_ts INTEGER,
                FOREIGN KEY (run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
            )
        """
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_samples_run_node_ts ON simulation_samples(run_id, node_id, ts)"
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

        # Ensure data_type exists on track_for_simulation
        cursor = await db.execute("PRAGMA table_info(track_for_simulation)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        if "data_type" not in column_names:
            try:
                await db.execute(
                    "ALTER TABLE track_for_simulation ADD COLUMN data_type TEXT"
                )
                await db.commit()
                print("Added data_type column to track_for_simulation table")
            except Exception as e:
                print(f"Migration error: {e}")

        # Ensure short_node_id exists on simulation_samples
        cursor = await db.execute("PRAGMA table_info(simulation_samples)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        if "short_node_id" not in column_names:
            try:
                await db.execute(
                    "ALTER TABLE simulation_samples ADD COLUMN short_node_id TEXT"
                )
                await db.commit()
                print("Added short_node_id column to simulation_samples table")
            except Exception as e:
                print(f"Migration error: {e}")

        # Ensure simulation_runs exists
        try:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS simulation_runs (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    sfc_design_id INTEGER,
                    regex_pattern TEXT,
                    started_at INTEGER,
                    finished_at INTEGER,
                    note TEXT
                )
            """
            )
        except Exception as e:
            print(f"Migration error creating simulation_runs: {e}")

        # Ensure simulation_samples exists and index present
        try:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS simulation_samples (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    ts INTEGER NOT NULL,
                    node_id TEXT NOT NULL,
                    data_type TEXT,
                    value TEXT,
                    quality INTEGER,
                    source_ts INTEGER,
                    FOREIGN KEY (run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
                )
            """
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_samples_run_node_ts ON simulation_samples(run_id, node_id, ts)"
            )
            await db.commit()
        except Exception as e:
            print(f"Migration error creating simulation_samples: {e}")

        # Ensure data_type exists on track_for_simulation
        cursor = await db.execute("PRAGMA table_info(track_for_simulation)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        if "data_type" not in column_names:
            try:
                await db.execute(
                    "ALTER TABLE track_for_simulation ADD COLUMN data_type TEXT"
                )
                await db.commit()
                print("Added data_type column to track_for_simulation table")
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
    """Replace all discovered OPC nodes with provided set (full refresh)."""
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


async def save_opc_nodes_append(nodes: list):
    """Insert discovered OPC nodes without clearing existing ones."""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
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


async def delete_opc_nodes_under(parent_id: str):
    """Delete previously discovered nodes under a given parent subtree."""
    db_path = get_db_path()

    like = parent_id + "%"
    async with aiosqlite.connect(db_path) as db:
        # Delete rows where node_id or parent_id is under the subtree
        await db.execute(
            "DELETE FROM opc_nodes WHERE node_id LIKE ? OR parent_id LIKE ?",
            (like, like),
        )
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


async def save_discovery_log(parent_id: str, last_discovered: int, duration_ms: int):
    """Upsert discovery log for a parent subtree."""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            INSERT INTO discovery_log (parent_id, last_discovered, duration_ms)
            VALUES (?, ?, ?)
            ON CONFLICT(parent_id) DO UPDATE SET last_discovered=excluded.last_discovered, duration_ms=excluded.duration_ms
            """,
            (parent_id, last_discovered, duration_ms),
        )
        await db.commit()


async def get_discovery_log_map() -> dict:
    """Return mapping parent_id -> { last_discovered, duration_ms }"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT parent_id, last_discovered, duration_ms FROM discovery_log"
        )
        rows = await cursor.fetchall()
        return {
            row["parent_id"]: {
                "last_discovered": row["last_discovered"],
                "duration_ms": row["duration_ms"],
            }
            for row in rows
        }


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


async def save_simulation_config(regex_pattern: str, tracked_nodes: list):
    """Save simulation tracking configuration to database"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        # Build lookup for data types from existing OPC nodes
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT node_id, data_type FROM opc_nodes")
        type_rows = await cursor.fetchall()
        data_type_map = {row["node_id"]: row["data_type"] for row in type_rows}

        # Clear existing tracked nodes
        await db.execute("DELETE FROM track_for_simulation")

        # Insert new tracked nodes
        for node_id in tracked_nodes:
            await db.execute(
                """
                INSERT INTO track_for_simulation (node_id, data_type, regex_pattern)
                VALUES (?, ?, ?)
            """,
                (node_id, data_type_map.get(node_id), regex_pattern),
            )

        await db.commit()


async def get_simulation_config():
    """Get simulation tracking configuration from database"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        # Get the latest regex pattern
        cursor = await db.execute(
            """
            SELECT DISTINCT regex_pattern
            FROM track_for_simulation
            ORDER BY updated_at DESC
            LIMIT 1
        """
        )
        pattern_row = await cursor.fetchone()
        regex_pattern = pattern_row[0] if pattern_row else None

        # Get all tracked nodes
        cursor = await db.execute(
            """
            SELECT node_id
            FROM track_for_simulation
            ORDER BY node_id
        """
        )
        rows = await cursor.fetchall()
        tracked_nodes = [row[0] for row in rows]

        return {"regex_pattern": regex_pattern, "tracked_nodes": tracked_nodes}


async def get_tracked_nodes():
    """Get list of tracked nodes for simulation"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute(
            """
            SELECT node_id
            FROM track_for_simulation
            ORDER BY node_id
        """
        )
        rows = await cursor.fetchall()
        return [row[0] for row in rows]


async def get_tracked_nodes_full():
    """Get tracked nodes with data type for simulation monitoring"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT node_id, data_type, regex_pattern
            FROM track_for_simulation
            ORDER BY node_id
            """
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def create_simulation_run(
    run_id: str,
    name: str,
    sfc_design_id: int | None,
    regex_pattern: str | None = None,
    note: str | None = None,
):
    """Create a simulation run metadata record"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO simulation_runs (id, name, sfc_design_id, regex_pattern, started_at, finished_at, note)
            VALUES (?, ?, ?, ?, strftime('%s','now')*1000, NULL, ?)
            """,
            (run_id, name, sfc_design_id, regex_pattern, note),
        )
        await db.commit()


async def finish_simulation_run(run_id: str):
    """Mark simulation run as finished"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "UPDATE simulation_runs SET finished_at = strftime('%s','now')*1000 WHERE id = ?",
            (run_id,),
        )
        await db.commit()


async def save_simulation_samples(samples: list[tuple]):
    """Bulk insert simulation samples: (run_id, ts, node_id, short_node_id, data_type, value, quality, source_ts)"""
    if not samples:
        return

    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        await db.executemany(
            """
            INSERT INTO simulation_samples (run_id, ts, node_id, short_node_id, data_type, value, quality, source_ts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            samples,
        )
        await db.commit()


async def list_simulation_runs():
    """Return recent simulation runs"""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT id, name, sfc_design_id, regex_pattern, started_at, finished_at, note
            FROM simulation_runs
            ORDER BY started_at DESC
            LIMIT 200
            """
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_run_samples(
    run_id: str, node_ids: list[str] | None = None, limit: int = 5000
):
    """Fetch samples for a run, optionally filtered by node_ids."""
    db_path = get_db_path()

    placeholders = ""
    params: list = [run_id]
    if node_ids:
        placeholders = ",".join(["?"] * len(node_ids))
        params.extend(node_ids)

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        if node_ids:
            query = f"""
                SELECT run_id, ts, node_id, short_node_id, data_type, value, quality, source_ts
                FROM simulation_samples
                WHERE run_id = ? AND node_id IN ({placeholders})
                ORDER BY ts
                LIMIT ?
            """
        else:
            query = """
                SELECT run_id, ts, node_id, short_node_id, data_type, value, quality, source_ts
                FROM simulation_samples
                WHERE run_id = ?
                ORDER BY ts
                LIMIT ?
            """
        params.append(limit)
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_short_node_id(node_id: str) -> str | None:
    """Get short_node_id from opc_nodes table by node_id."""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT shortnodeid FROM opc_nodes WHERE node_id = ?", (node_id,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None


async def delete_simulation_run(run_id: str):
    """Delete a simulation run and its samples."""
    db_path = get_db_path()

    async with aiosqlite.connect(db_path) as db:
        # Delete samples first (cascade)
        await db.execute("DELETE FROM simulation_samples WHERE run_id = ?", (run_id,))
        # Delete run metadata
        await db.execute("DELETE FROM simulation_runs WHERE id = ?", (run_id,))
        await db.commit()
