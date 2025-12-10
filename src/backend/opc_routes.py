"""OPC Routes - API endpoints for OPC server operations"""

from fastapi import APIRouter
from database import (
    save_opc_config,
    get_opc_config,
    save_opc_nodes,
    get_opc_nodes,
    save_selected_nodes,
    get_selected_nodes,
    get_opc_node_autocomplete,
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

router = APIRouter(prefix="/opc", tags=["opc"])


@router.post("/test-connection")
async def test_opc_connection(request: OPCTestRequest):
    """Test OPC UA server connection and check if node exists"""
    result = connect_to_opc_server(request.url, request.prefix)
    return result


@router.post("/save")
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


@router.get("/config")
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


@router.post("/discover-nodes")
async def discover_opc_nodes(request: OPCDiscoverRequest):
    """Discover all OPC nodes recursively and save to database"""
    try:
        # Save selected nodes for future use
        if request.selected_nodes:
            await save_selected_nodes(request.selected_nodes)

        result = discover_nodes(request.url, request.prefix, request.selected_nodes)

        if result["success"]:
            # Save discovered nodes to database
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


@router.post("/children")
async def list_opc_children(request: OPCChildrenRequest):
    """List immediate child nodes under the provided prefix"""
    result = list_child_nodes(request.url, request.prefix)
    return result


@router.get("/nodes")
async def get_discovered_nodes():
    """Get all discovered OPC nodes from database"""
    try:
        nodes = await get_opc_nodes()
        return {"success": True, "nodes": nodes, "count": len(nodes)}
    except Exception as e:
        return {"success": False, "message": f"Failed to retrieve nodes: {str(e)}"}


@router.get("/selected-nodes")
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


@router.get("/autocomplete")
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
