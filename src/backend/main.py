# --- Standard and third-party imports ---
import os
import sys
import asyncio
import json
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# --- Project-specific imports ---
from database import (
    init_database,
    migrate_database,
    save_opc_config,
    get_opc_config,
    save_opc_nodes,
    get_opc_nodes,
    save_selected_nodes,
    get_selected_nodes,
    get_opc_node_autocomplete,
    create_sfc_design,
    get_all_sfc_designs,
    get_sfc_design,
    save_sfc_design_data,
    update_sfc_design,
    delete_sfc_design,
)
from opc_handler import (
    OPCTestRequest,
    OPCSaveRequest,
    OPCDiscoverRequest,
    OPCChildrenRequest,
    connect_to_opc_server,
    discover_nodes,
    list_child_nodes,
)


# SFC execution state and helpers
class SFCExecutionManager:
    def __init__(self):
        self.active_executions = (
            {}
        )  # design_id: {"task": ..., "clients": set(), "status": {...}}

    async def register_client(self, design_id, websocket: WebSocket):
        await websocket.accept()
        if design_id not in self.active_executions:
            self.active_executions[design_id] = {
                "clients": set(),
                "task": None,
                "status": {},
            }
        self.active_executions[design_id]["clients"].add(websocket)

    def unregister_client(self, design_id, websocket: WebSocket):
        if design_id in self.active_executions:
            self.active_executions[design_id]["clients"].discard(websocket)

    async def broadcast(self, design_id, message: dict):
        if design_id in self.active_executions:
            clients = list(self.active_executions[design_id]["clients"])
            for ws in clients:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    self.unregister_client(design_id, ws)

    def set_task(self, design_id, task):
        if design_id not in self.active_executions:
            self.active_executions[design_id] = {
                "clients": set(),
                "task": None,
                "status": {},
            }
        self.active_executions[design_id]["task"] = task

    def get_task(self, design_id):
        return self.active_executions.get(design_id, {}).get("task")

    def clear(self, design_id):
        if design_id in self.active_executions:
            self.active_executions[design_id]["task"] = None

    def update_node_status(self, design_id, node_id, status, error=None):
        """Update the status of a node in the execution"""
        if design_id not in self.active_executions:
            self.active_executions[design_id] = {
                "clients": set(),
                "task": None,
                "status": {},
            }
        if "nodes" not in self.active_executions[design_id]["status"]:
            self.active_executions[design_id]["status"]["nodes"] = {}
        self.active_executions[design_id]["status"]["nodes"][node_id] = {
            "status": status
        }
        if error:
            self.active_executions[design_id]["status"]["nodes"][node_id][
                "error"
            ] = error

    def get_status(self, design_id):
        """Get the current execution status for a design"""
        if design_id in self.active_executions:
            return self.active_executions[design_id].get("status", {})
        return {}


# SFC execution manager
sfc_manager = SFCExecutionManager()

# Initialize FastAPI app
app = FastAPI()


@app.websocket("/sfc/ws/{design_id}")
async def sfc_status_ws(websocket: WebSocket, design_id: int):
    await sfc_manager.register_client(design_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive, not used
    except WebSocketDisconnect:
        sfc_manager.unregister_client(design_id, websocket)


@app.post("/sfc/designs/{design_id}/execute")
async def execute_sfc(design_id: int, request: dict):
    """Start SFC execution for a design (only setvalue nodes for now)"""
    # Cancel previous execution if running
    task = sfc_manager.get_task(design_id)
    if task and not task.done():
        task.cancel()

    # Get design data
    design = await get_sfc_design(design_id)
    if not design:
        return {"success": False, "message": "Design not found"}
    try:
        nodes = json.loads(design["nodes"])
        edges = json.loads(design["edges"])
    except Exception as e:
        return {"success": False, "message": f"Invalid design data: {e}"}

    # Get OPC config
    config = await get_opc_config()
    if not config:
        return {"success": False, "message": "No OPC config found"}
    opc_url = config["url"]

    # Build node graph
    node_map = {n["id"]: n for n in nodes}
    incoming = {n["id"]: [] for n in nodes}
    outgoing = {n["id"]: [] for n in nodes}
    for e in edges:
        source = e.get("source")
        target = e.get("target")
        # Only add edge if both nodes exist
        if source in node_map and target in node_map:
            outgoing[source].append(target)
            incoming[target].append(source)

    # Only execute setvalue nodes
    setvalue_nodes = {n["id"] for n in nodes if n["type"] == "setvalue"}

    print(f"DEBUG: Found {len(setvalue_nodes)} setvalue nodes: {setvalue_nodes}")
    print(f"DEBUG: Node map keys: {list(node_map.keys())}")
    print(f"DEBUG: Incoming edges: {incoming}")
    print(f"DEBUG: Outgoing edges: {outgoing}")

    # Mark non-setvalue nodes as finished immediately so they don't block execution
    finished = {n["id"] for n in nodes if n["type"] != "setvalue"}
    running = set()

    async def execute_node(node_id):
        node = node_map[node_id]
        await sfc_manager.broadcast(
            design_id, {"node_id": node_id, "status": "running"}
        )
        sfc_manager.update_node_status(design_id, node_id, "running")
        running.add(node_id)
        try:
            setValueConfig = node["data"].get("setValueConfig", {})
            opc_node = setValueConfig.get("opcNode")
            start_value = setValueConfig.get("startValue")
            end_value = setValueConfig.get("endValue")
            duration = float(setValueConfig.get("time", 1))
            steps = max(1, int(duration * 10))

            if opc_node:
                from opcua import Client, ua

                client = Client(opc_url)
                try:
                    client.connect()
                    # Reconstruct full NodeId from short ID
                    prefix = config.get("prefix", "")
                    if prefix and not opc_node.startswith("ns="):
                        full_node_id = f"{prefix}.{opc_node}"
                    else:
                        full_node_id = opc_node

                    print(f"DEBUG: Connecting to OPC node: {full_node_id}")
                    node_obj = client.get_node(full_node_id)

                    # Get the current data type to determine variant type
                    try:
                        current_value = node_obj.get_value()
                        value_type = type(current_value)
                    except:
                        value_type = float

                    # Map Python types to OPC UA VariantType
                    def get_variant_type(py_type):
                        if py_type == int:
                            return ua.VariantType.Int32
                        elif py_type == float:
                            return ua.VariantType.Float
                        elif py_type == bool:
                            return ua.VariantType.Boolean
                        elif py_type == str:
                            return ua.VariantType.String
                        else:
                            return ua.VariantType.Float

                    variant_type = get_variant_type(value_type)

                    try:
                        start = value_type(start_value) if start_value else 0
                        end = value_type(end_value) if end_value else 0

                        for i in range(steps):
                            v = start + (end - start) * i / (steps - 1)
                            # Convert to correct type and create DataValue with appropriate variant
                            typed_value = value_type(v)
                            dv = ua.DataValue(ua.Variant(typed_value, variant_type))
                            node_obj.set_value(dv)
                            await asyncio.sleep(0.05)
                    except Exception as e:
                        # If conversion or write fails, try setting start value directly
                        try:
                            typed_start = value_type(start_value)
                            dv = ua.DataValue(ua.Variant(typed_start, variant_type))
                            node_obj.set_value(dv)
                        except:
                            node_obj.set_value(start_value)
                        await asyncio.sleep(duration)
                finally:
                    client.disconnect()
            else:
                await asyncio.sleep(duration)

            await sfc_manager.broadcast(
                design_id, {"node_id": node_id, "status": "finished"}
            )
            sfc_manager.update_node_status(design_id, node_id, "finished")
        except Exception as e:
            await sfc_manager.broadcast(
                design_id, {"node_id": node_id, "status": "error", "error": str(e)}
            )
            sfc_manager.update_node_status(design_id, node_id, "error", str(e))
            await asyncio.sleep(
                float(node["data"].get("setValueConfig", {}).get("time", 1))
            )
        finally:
            finished.add(node_id)
            running.discard(node_id)

    async def run_sfc():
        print(f"DEBUG: Starting SFC execution with {len(setvalue_nodes)} nodes")
        pending = setvalue_nodes.copy()
        iteration = 0
        while pending:
            can_run = [
                nid
                for nid in pending
                if all(src in finished for src in incoming[nid]) and nid not in running
            ]
            if iteration % 20 == 0:  # Only print every 20 iterations to reduce spam
                print(
                    f"DEBUG: Pending={pending}, Can run={can_run}, Finished={finished}, Running={running}"
                )
                for nid in pending:
                    print(
                        f"  Node {nid}: incoming={incoming[nid]}, needs={[src for src in incoming[nid] if src not in finished]}"
                    )
            iteration += 1
            if not can_run:
                await asyncio.sleep(0.05)
                continue
            tasks = [asyncio.create_task(execute_node(nid)) for nid in can_run]
            running.update(can_run)
            await asyncio.sleep(0.01)
            while not any(nid in finished for nid in can_run):
                await asyncio.sleep(0.05)
            pending -= finished
        print("DEBUG: SFC execution completed")
        await sfc_manager.broadcast(design_id, {"status": "all_finished"})

    task = asyncio.create_task(run_sfc())
    sfc_manager.set_task(design_id, task)
    return {"success": True, "message": "SFC execution started"}


def get_base_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(
            sys._MEIPASS, ".."
        )  # pyright: ignore[reportAttributeAccessIssue]
    else:
        return os.path.abspath(os.path.dirname(__file__))


base_path = get_base_path()
env_path = os.path.join(base_path, "..", "..", ".env")
load_dotenv(env_path)

try:
    BACKEND_PORT = int(
        os.getenv("VITE_BACKEND_PORT")
    )  # pyright: ignore[reportArgumentType]
    FRONTEND_PORT = int(
        os.getenv("VITE_FRONTEND_PORT")
    )  # pyright: ignore[reportArgumentType]
except TypeError:
    print(
        "Error: VITE_BACKEND_PORT and VITE_FRONTEND_PORT must be set in the .env file."
    )
    sys.exit(1)

# Add CORS middleware to the app
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{FRONTEND_PORT}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_database()
    await migrate_database()


@app.get("/data")
def read_data():
    return {"message": "Hello from python FastAPI!"}


@app.post("/opc/test-connection")
async def test_opc_connection(request: OPCTestRequest):
    """Test OPC UA server connection and check if node exists"""
    result = connect_to_opc_server(request.url, request.prefix)
    return result


@app.post("/opc/save")
async def save_opc_configuration(request: OPCSaveRequest):
    """Save OPC server configuration to database"""
    try:
        await save_opc_config(request.url, request.prefix)
        return {
            "success": True,
            "message": "OPC server configuration saved successfully",
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to save configuration: {str(e)}"}


@app.get("/opc/config")
async def get_opc_configuration():
    """Get saved OPC server configuration from database"""
    try:
        config = await get_opc_config()
        if config:
            return {"success": True, "config": config}
        else:
            return {
                "success": True,
                "config": None,
                "message": "No configuration saved yet",
            }
    except Exception as e:
        return {"success": False, "message": f"Failed to load configuration: {str(e)}"}


@app.post("/opc/discover-nodes")
async def discover_opc_nodes(request: OPCDiscoverRequest):
    """Discover all OPC nodes recursively and save to database"""
    try:
        # Save selected nodes for future use
        if request.selected_nodes:
            await save_selected_nodes(request.selected_nodes)

        result = discover_nodes(request.url, request.prefix, request.selected_nodes)

        if result["success"]:
            # Save discovered nodes to database (this clears previous nodes automatically)
            await save_opc_nodes(result["nodes"])
            return {
                "success": True,
                "message": result["message"],
                "node_count": len(result["nodes"]),
            }
        else:
            return result
    except Exception as e:
        return {"success": False, "message": f"Failed to discover nodes: {str(e)}"}


@app.post("/opc/children")
async def list_opc_children(request: OPCChildrenRequest):
    """List immediate child nodes under the provided prefix"""
    result = list_child_nodes(request.url, request.prefix)
    return result


@app.get("/opc/nodes")
async def get_discovered_nodes():
    """Get all discovered OPC nodes from database"""
    try:
        nodes = await get_opc_nodes()
        return {"success": True, "nodes": nodes, "count": len(nodes)}
    except Exception as e:
        return {"success": False, "message": f"Failed to retrieve nodes: {str(e)}"}


@app.get("/opc/selected-nodes")
async def get_saved_selected_nodes():
    """Get saved selected node IDs from database"""
    try:
        node_ids = await get_selected_nodes()
        return {"success": True, "selected_nodes": node_ids}
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to retrieve selected nodes: {str(e)}",
        }


@app.get("/opc/autocomplete")
async def opc_node_autocomplete(search: str = ""):
    """Get OPC nodes for autocomplete, filtered by search term"""
    try:
        nodes = await get_opc_node_autocomplete(search)
        return {"success": True, "nodes": nodes}
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to retrieve autocomplete nodes: {str(e)}",
        }


# SFC Design endpoints


@app.post("/sfc/designs")
async def create_design(request: dict):
    """Create a new SFC design"""
    try:
        design_id = await create_sfc_design(
            request.get("name", "Untitled Design"), request.get("description", "")
        )
        return {
            "success": True,
            "message": "SFC design created successfully",
            "design_id": design_id,
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to create design: {str(e)}"}


@app.get("/sfc/designs")
async def list_designs():
    """Get all SFC designs"""
    try:
        designs = await get_all_sfc_designs()
        return {"success": True, "designs": designs}
    except Exception as e:
        return {"success": False, "message": f"Failed to retrieve designs: {str(e)}"}


@app.get("/sfc/designs/{design_id}")
async def get_design(design_id: int):
    """Get a specific SFC design with its data"""
    try:
        design = await get_sfc_design(design_id)
        if design:
            return {"success": True, "design": design}
        else:
            return {"success": False, "message": "Design not found"}
    except Exception as e:
        return {"success": False, "message": f"Failed to retrieve design: {str(e)}"}


@app.get("/sfc/designs/{design_id}/status")
async def get_sfc_status(design_id: int):
    """Get the current execution status of an SFC design (running nodes, finished nodes, errors)"""
    status = sfc_manager.get_status(design_id)
    return {"success": True, "status": status}


@app.post("/sfc/designs/{design_id}/save")
async def save_design_data(design_id: int, request: dict):
    """Save SFC design data (nodes and edges)"""
    try:
        await save_sfc_design_data(
            design_id, request.get("nodes", "[]"), request.get("edges", "[]")
        )
        return {"success": True, "message": "Design saved successfully"}
    except Exception as e:
        return {"success": False, "message": f"Failed to save design: {str(e)}"}


@app.put("/sfc/designs/{design_id}")
async def update_design_metadata(design_id: int, request: dict):
    """Update SFC design metadata (name and description)"""
    try:
        await update_sfc_design(
            design_id,
            request.get("name", "Untitled Design"),
            request.get("description", ""),
        )
        return {"success": True, "message": "Design updated successfully"}
    except Exception as e:
        return {"success": False, "message": f"Failed to update design: {str(e)}"}


@app.delete("/sfc/designs/{design_id}")
async def delete_design(design_id: int):
    """Delete an SFC design"""
    try:
        await delete_sfc_design(design_id)
        return {"success": True, "message": "Design deleted successfully"}
    except Exception as e:
        return {"success": False, "message": f"Failed to delete design: {str(e)}"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=BACKEND_PORT)
