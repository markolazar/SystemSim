"""SFC Design Routes - API endpoints for SFC designs"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database import (
    create_sfc_design,
    get_all_sfc_designs,
    get_sfc_design,
    save_sfc_design_data,
    update_sfc_design,
    delete_sfc_design,
    get_opc_config,
)
from sfc_manager import SFCExecutionManager, execute_sfc
import json

router = APIRouter(prefix="/sfc", tags=["sfc"])


def setup_sfc_routes(app, sfc_manager: SFCExecutionManager):
    """Setup SFC routes with manager dependency"""

    @app.websocket("/sfc/ws/{design_id}")
    async def sfc_status_ws(websocket: WebSocket, design_id: int):
        """WebSocket endpoint for real-time SFC execution status"""
        await sfc_manager.register_client(design_id, websocket)
        try:
            while True:
                await websocket.receive_text()  # keep alive, not used
        except WebSocketDisconnect:
            sfc_manager.unregister_client(design_id, websocket)

    @app.post("/sfc/designs/{design_id}/execute")
    async def execute_sfc_endpoint(design_id: int, request: dict):
        """Start SFC execution for a design"""
        # Cancel previous execution if running
        task = sfc_manager.get_task(design_id)
        if task and not task.done():
            task.cancel()

        # Clear previous execution status
        sfc_manager.clear_status(design_id)

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
        opc_prefix = config.get("prefix", "")

        # Start SFC execution
        await execute_sfc(design_id, nodes, edges, opc_url, opc_prefix, sfc_manager)
        return {"success": True, "message": "SFC execution started"}

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
            return {
                "success": False,
                "message": f"Failed to retrieve designs: {str(e)}",
            }

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
        """Get the current execution status of an SFC design"""
        status = sfc_manager.get_status(design_id)
        return {"success": True, "status": status}

    @app.post("/sfc/designs/{design_id}/save")
    async def save_design_data(design_id: int, request: dict):
        """Save SFC design data (nodes and edges)"""
        try:
            await save_sfc_design_data(
                design_id,
                request.get("nodes", "[]"),
                request.get("edges", "[]"),
                request.get("viewport"),
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
