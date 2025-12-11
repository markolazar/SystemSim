"""Simulation Routes - API endpoints for simulation configuration"""

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import (
    save_simulation_config,
    get_simulation_config,
    get_tracked_nodes,
    get_opc_nodes,
)

router = APIRouter(prefix="/simulation", tags=["simulation"])


class SimulationConfigRequest(BaseModel):
    """Request model for simulation configuration"""

    regex_pattern: str
    tracked_nodes: list[str]


@router.post("/config")
async def save_simulation_configuration(request: SimulationConfigRequest):
    """Save simulation tracking configuration"""
    try:
        # Validate regex pattern
        try:
            re.compile(request.regex_pattern)
        except re.error as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid regex pattern: {str(e)}"
            )

        # Validate that tracked nodes exist in OPC nodes
        all_opc_nodes = await get_opc_nodes()
        available_node_ids = set(node["node_id"] for node in all_opc_nodes)

        invalid_nodes = [
            node for node in request.tracked_nodes if node not in available_node_ids
        ]

        if invalid_nodes:
            raise HTTPException(
                status_code=400, detail=f"Invalid OPC nodes: {invalid_nodes}"
            )

        # Save configuration to database
        await save_simulation_config(request.regex_pattern, request.tracked_nodes)

        return {
            "success": True,
            "message": f"Saved {len(request.tracked_nodes)} nodes for simulation tracking",
            "tracked_count": len(request.tracked_nodes),
            "nodes": request.tracked_nodes,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save simulation config: {str(e)}"
        )


@router.get("/config")
async def get_simulation_configuration():
    """Get current simulation tracking configuration"""
    try:
        config = await get_simulation_config()
        return {
            "success": True,
            "regex_pattern": config["regex_pattern"],
            "tracked_nodes": config["tracked_nodes"],
            "tracked_count": len(config["tracked_nodes"]),
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to load simulation config: {str(e)}",
        }


@router.get("/tracked-nodes")
async def get_simulation_tracked_nodes():
    """Get list of nodes to track during simulation"""
    try:
        nodes = await get_tracked_nodes()
        return {"success": True, "nodes": nodes, "count": len(nodes)}
    except Exception as e:
        return {"success": False, "message": f"Failed to load tracked nodes: {str(e)}"}
