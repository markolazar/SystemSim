"""SFC Configuration Routes - API endpoints for SFC Designer node selection"""

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import (
    save_sfc_nodes,
    get_sfc_nodes,
    get_sfc_nodes_full,
    get_sfc_regex_pattern,
    get_opc_nodes,
)

router = APIRouter(prefix="/sfc", tags=["sfc"])


class SFCConfigRequest(BaseModel):
    """Request model for SFC configuration"""

    regex_pattern: str
    selected_nodes: list[str]


@router.post("/config")
async def save_sfc_configuration(request: SFCConfigRequest):
    """Save SFC node selection configuration"""
    try:
        # Validate regex pattern
        try:
            re.compile(request.regex_pattern)
        except re.error as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid regex pattern: {str(e)}"
            )

        # Validate that selected nodes exist in OPC nodes
        all_opc_nodes = await get_opc_nodes()
        available_node_ids = set(node["node_id"] for node in all_opc_nodes)

        invalid_nodes = [
            node for node in request.selected_nodes if node not in available_node_ids
        ]

        if invalid_nodes:
            raise HTTPException(
                status_code=400, detail=f"Invalid OPC nodes: {invalid_nodes}"
            )

        # Save configuration to database
        await save_sfc_nodes(request.selected_nodes, request.regex_pattern)

        return {
            "success": True,
            "message": f"Saved {len(request.selected_nodes)} nodes for SFC Designer",
            "selected_count": len(request.selected_nodes),
            "nodes": request.selected_nodes,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save SFC config: {str(e)}"
        )


@router.get("/config")
async def get_sfc_configuration():
    """Get current SFC node selection configuration"""
    try:
        nodes = await get_sfc_nodes()  # Returns just node IDs as strings
        regex_pattern = await get_sfc_regex_pattern()
        return {
            "success": True,
            "regex_pattern": regex_pattern,
            "selected_nodes": nodes,
            "selected_count": len(nodes),
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to load SFC config: {str(e)}",
        }


@router.get("/selected-nodes")
async def get_sfc_selected_nodes():
    """Get list of nodes selected for SFC Designer"""
    try:
        nodes = await get_sfc_nodes()
        return {"success": True, "nodes": nodes, "count": len(nodes)}
    except Exception as e:
        return {"success": False, "message": f"Failed to load selected nodes: {str(e)}"}
