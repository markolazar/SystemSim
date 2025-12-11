"""SFC Execution Manager - Handles SFC execution state and node execution"""

import asyncio
import json
import time
from fastapi import WebSocket, WebSocketDisconnect
from opcua import Client, ua


class SFCExecutionManager:
    """Manages SFC execution tasks and WebSocket clients"""

    def __init__(self):
        self.active_executions = (
            {}
        )  # design_id: {"task": ..., "clients": set(), "status": {...}}

    async def register_client(self, design_id, websocket: WebSocket):
        """Register a WebSocket client for status updates"""
        await websocket.accept()
        if design_id not in self.active_executions:
            self.active_executions[design_id] = {
                "clients": set(),
                "task": None,
                "status": {},
            }
        self.active_executions[design_id]["clients"].add(websocket)

    def unregister_client(self, design_id, websocket: WebSocket):
        """Unregister a WebSocket client"""
        if design_id in self.active_executions:
            self.active_executions[design_id]["clients"].discard(websocket)

    async def broadcast(self, design_id, message: dict):
        """Broadcast message to all connected clients"""
        if design_id in self.active_executions:
            clients = list(self.active_executions[design_id]["clients"])
            for ws in clients:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    self.unregister_client(design_id, ws)

    def set_task(self, design_id, task):
        """Set the execution task for a design"""
        if design_id not in self.active_executions:
            self.active_executions[design_id] = {
                "clients": set(),
                "task": None,
                "status": {},
            }
        self.active_executions[design_id]["task"] = task

    def get_task(self, design_id):
        """Get the execution task for a design"""
        return self.active_executions.get(design_id, {}).get("task")

    def clear(self, design_id):
        """Clear the execution task for a design"""
        if design_id in self.active_executions:
            self.active_executions[design_id]["task"] = None

    def update_node_status(
        self, design_id, node_id, status, error=None, elapsed_time=None
    ):
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
        if elapsed_time is not None:
            self.active_executions[design_id]["status"]["nodes"][node_id][
                "elapsed_time"
            ] = elapsed_time

    def get_status(self, design_id):
        """Get the current execution status for a design"""
        if design_id in self.active_executions:
            return self.active_executions[design_id].get("status", {})
        return {}


def get_variant_type(py_type):
    """Map Python types to OPC UA VariantType"""
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


async def execute_sfc(
    design_id: int,
    nodes: list,
    edges: list,
    opc_url: str,
    opc_prefix: str,
    sfc_manager: SFCExecutionManager,
):
    """
    Execute an SFC design.

    Args:
        design_id: The SFC design ID
        nodes: List of node objects
        edges: List of edge objects
        opc_url: OPC UA server URL
        opc_prefix: OPC UA prefix for nodes
        sfc_manager: SFCExecutionManager instance
    """
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
        """Execute a single setvalue node"""
        node = node_map[node_id]
        node_start_time = time.time()

        await sfc_manager.broadcast(
            design_id, {"node_id": node_id, "status": "running"}
        )
        sfc_manager.update_node_status(design_id, node_id, "running")
        running.add(node_id)

        # Create a background task to broadcast elapsed time updates
        stop_updates = False

        async def broadcast_elapsed_time():
            while not stop_updates:
                elapsed = round(time.time() - node_start_time, 2)
                sfc_manager.update_node_status(
                    design_id, node_id, "running", elapsed_time=elapsed
                )
                await asyncio.sleep(0.2)  # Update every 200ms (less overhead)

        update_task = asyncio.create_task(broadcast_elapsed_time())

        try:
            setValueConfig = node["data"].get("setValueConfig", {})
            opc_node = setValueConfig.get("opcNode")
            start_value = setValueConfig.get("startValue")
            end_value = setValueConfig.get("endValue")
            duration = float(setValueConfig.get("time", 1))
            steps = max(1, int(duration * 10))

            if opc_node:
                await _write_to_opc_node(
                    opc_url,
                    opc_prefix,
                    opc_node,
                    start_value,
                    end_value,
                    steps,
                    duration,
                )
            else:
                await asyncio.sleep(duration)

            stop_updates = True
            await update_task

            elapsed = round(time.time() - node_start_time, 2)
            await sfc_manager.broadcast(
                design_id,
                {"node_id": node_id, "status": "finished", "elapsed_time": elapsed},
            )
            sfc_manager.update_node_status(
                design_id, node_id, "finished", elapsed_time=elapsed
            )

        except Exception as e:
            stop_updates = True
            await update_task

            elapsed = round(time.time() - node_start_time, 2)
            await sfc_manager.broadcast(
                design_id,
                {
                    "node_id": node_id,
                    "status": "error",
                    "error": str(e),
                    "elapsed_time": elapsed,
                },
            )
            sfc_manager.update_node_status(
                design_id, node_id, "error", str(e), elapsed_time=elapsed
            )
            await asyncio.sleep(
                float(node["data"].get("setValueConfig", {}).get("time", 1))
            )
        finally:
            finished.add(node_id)
            running.discard(node_id)

    async def run_sfc():
        """Main SFC execution loop"""
        print(f"DEBUG: Starting SFC execution with {len(setvalue_nodes)} nodes")
        pending = setvalue_nodes.copy()
        iteration = 0
        active_tasks = {}  # Maps node_id -> task

        while pending or active_tasks:
            # Find nodes that can run (all dependencies finished, not already running)
            can_run = [
                nid
                for nid in pending
                if all(src in finished for src in incoming[nid])
                and nid not in active_tasks
            ]

            if iteration % 20 == 0:  # Only print every 20 iterations to reduce spam
                print(
                    f"DEBUG: Pending={pending}, Can run={can_run}, Finished={finished}, Running={list(active_tasks.keys())}"
                )
                for nid in pending:
                    print(
                        f"  Node {nid}: incoming={incoming[nid]}, needs={[src for src in incoming[nid] if src not in finished]}"
                    )
            iteration += 1

            # Start new tasks
            for nid in can_run:
                running.add(nid)
                active_tasks[nid] = asyncio.create_task(execute_node(nid))

            if not active_tasks:
                if not can_run:
                    await asyncio.sleep(0.05)
                continue

            # Wait for at least one task to complete
            done, pending_tasks = await asyncio.wait(
                active_tasks.values(), return_when=asyncio.FIRST_COMPLETED
            )

            # Clean up completed tasks
            for nid in list(active_tasks.keys()):
                if active_tasks[nid] in done:
                    del active_tasks[nid]
                    pending.discard(nid)

            await asyncio.sleep(0.01)

        print("DEBUG: SFC execution completed")
        await sfc_manager.broadcast(design_id, {"status": "all_finished"})

    # Create and start the execution task
    task = asyncio.create_task(run_sfc())
    sfc_manager.set_task(design_id, task)


async def _write_to_opc_node(
    opc_url: str,
    opc_prefix: str,
    opc_node: str,
    start_value: str,
    end_value: str,
    steps: int,
    duration: float,
):
    """
    Write values to an OPC node with interpolation.

    Args:
        opc_url: OPC UA server URL
        opc_prefix: OPC UA prefix
        opc_node: OPC node short ID
        start_value: Starting value
        end_value: Ending value
        steps: Number of interpolation steps
        duration: Total duration in seconds
    """
    client = Client(opc_url)
    try:
        client.connect()

        # Reconstruct full NodeId from short ID
        if opc_prefix and not opc_node.startswith("ns="):
            full_node_id = f"{opc_prefix}.{opc_node}"
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

        variant_type = get_variant_type(value_type)

        try:
            start = value_type(start_value) if start_value else 0
            end = value_type(end_value) if end_value else 0

            # Track overall timing to compensate for accumulated overhead
            overall_start = time.time()

            for i in range(steps):
                step_start = time.time()

                v = start + (end - start) * i / (steps - 1)
                # Convert to correct type and create DataValue with appropriate variant
                typed_value = value_type(v)
                dv = ua.DataValue(ua.Variant(typed_value, variant_type))
                node_obj.set_value(dv)

                # Calculate target time for this step and adjust sleep
                target_elapsed = (i + 1) * (duration / steps)
                actual_elapsed = time.time() - overall_start
                sleep_time = max(0, target_elapsed - actual_elapsed)
                await asyncio.sleep(sleep_time)
        except Exception as e:
            # If conversion or write fails, try setting start value directly
            try:
                typed_start = value_type(start_value)
                dv = ua.DataValue(ua.Variant(typed_start, variant_type))
                node_obj.set_value(dv)
            except:
                node_obj.set_value(start_value)

    finally:
        client.disconnect()
