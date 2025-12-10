import os
import sys

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI()
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
