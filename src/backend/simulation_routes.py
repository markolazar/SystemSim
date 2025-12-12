"""Simulation Routes - API endpoints for simulation configuration"""

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import (
    save_simulation_config,
    get_simulation_config,
    get_tracked_nodes,
    get_opc_nodes,
    list_simulation_runs,
    get_run_samples,
    delete_simulation_run,
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


@router.get("/runs")
async def list_runs():
    """List recent simulation runs"""
    try:
        runs = await list_simulation_runs()
        return {"success": True, "runs": runs, "count": len(runs)}
    except Exception as e:
        return {"success": False, "message": f"Failed to list runs: {str(e)}"}


@router.get("/runs/{run_id}/samples")
async def get_run_samples_api(run_id: str, node_ids: str | None = None, limit: int = 0):
    """Fetch samples for a simulation run. node_ids is a comma-separated list. limit=0 means no limit."""
    try:
        ids_list = [nid for nid in node_ids.split(",") if nid] if node_ids else None
        # If no limit specified, use a very high value to get all data
        effective_limit = limit if limit > 0 else 1000000
        samples = await get_run_samples(run_id, ids_list, effective_limit)
        return {"success": True, "samples": samples, "count": len(samples)}
    except Exception as e:
        return {"success": False, "message": f"Failed to load samples: {str(e)}"}


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str):
    """Delete a simulation run and all its samples."""
    try:
        await delete_simulation_run(run_id)
        return {"success": True, "message": f"Deleted simulation run {run_id}"}
    except Exception as e:
        return {"success": False, "message": f"Failed to delete run: {str(e)}"}
