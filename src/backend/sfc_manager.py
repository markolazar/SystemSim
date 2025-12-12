"""SFC Execution Manager - Handles SFC execution state and node execution"""

import asyncio
import json
import time
import uuid
from fastapi import WebSocket, WebSocketDisconnect
from opcua import Client, ua
from database import (
    get_tracked_nodes_full,
    get_simulation_config,
    create_simulation_run,
    finish_simulation_run,
    save_simulation_samples,
    get_short_node_id,
)


class SFCExecutionManager:
    """Manages SFC execution tasks and WebSocket clients"""

    def __init__(self):
        self.active_executions = (
            {}
        )  # design_id: {"task": ..., "clients": set(), "status": {...}, "pause_event": asyncio.Event()}
        # monitor tracking per design
        # monitor_task: asyncio.Task
        # monitor_stop: asyncio.Event
        # run_id: str

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
            self.active_executions[design_id].pop("monitor_task", None)
            self.active_executions[design_id].pop("monitor_stop", None)
            self.active_executions[design_id].pop("run_id", None)

    def set_monitor(self, design_id, task, stop_event, run_id: str):
        if design_id not in self.active_executions:
            self.active_executions[design_id] = {
                "clients": set(),
                "task": None,
                "status": {},
            }
        self.active_executions[design_id]["monitor_task"] = task
        self.active_executions[design_id]["monitor_stop"] = stop_event
        self.active_executions[design_id]["run_id"] = run_id

    def get_monitor(self, design_id):
        if design_id not in self.active_executions:
            return None, None, None
        exe = self.active_executions[design_id]
        return (
            exe.get("monitor_task"),
            exe.get("monitor_stop"),
            exe.get("run_id"),
        )

    async def stop_monitor(self, design_id):
        task, stop_event, run_id = self.get_monitor(design_id)
        if stop_event:
            stop_event.set()
        if task:
            try:
                await task
            except Exception:
                pass
        self.clear_monitor(design_id)

    def clear_monitor(self, design_id):
        if design_id in self.active_executions:
            self.active_executions[design_id].pop("monitor_task", None)
            self.active_executions[design_id].pop("monitor_stop", None)
            self.active_executions[design_id].pop("run_id", None)

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

    def clear_status(self, design_id):
        """Clear execution status for a design to prepare for next run"""
        if design_id in self.active_executions:
            self.active_executions[design_id]["status"] = {}

    def get_pause_event(self, design_id):
        """Get or create pause event for a design"""
        if design_id not in self.active_executions:
            self.active_executions[design_id] = {
                "clients": set(),
                "task": None,
                "status": {},
                "pause_event": asyncio.Event(),
            }
        if "pause_event" not in self.active_executions[design_id]:
            self.active_executions[design_id]["pause_event"] = asyncio.Event()
        # Set event initially (not paused)
        self.active_executions[design_id]["pause_event"].set()
        return self.active_executions[design_id]["pause_event"]

    def pause(self, design_id):
        """Pause execution for a design"""
        if (
            design_id in self.active_executions
            and "pause_event" in self.active_executions[design_id]
        ):
            self.active_executions[design_id]["pause_event"].clear()

    def resume(self, design_id):
        """Resume execution for a design"""
        if (
            design_id in self.active_executions
            and "pause_event" in self.active_executions[design_id]
        ):
            self.active_executions[design_id]["pause_event"].set()


async def start_simulation_monitor(
    design_id: int, opc_url: str, opc_prefix: str, sfc_manager: SFCExecutionManager
):
    """Start a background task that polls tracked OPC nodes and records changes."""

    tracked = await get_tracked_nodes_full()
    if not tracked:
        print("Simulation monitor: no tracked nodes configured, skipping monitor")
        return None

    config = await get_simulation_config()
    regex = config.get("regex_pattern") if config else None

    run_id = f"{design_id}-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
    run_name = f"SFC-{design_id}-{time.strftime('%Y%m%d-%H%M%S')}"

    await create_simulation_run(run_id, run_name, design_id, regex)

    stop_event = asyncio.Event()
    task = asyncio.create_task(
        _monitor_tracked_nodes(run_id, tracked, opc_url, opc_prefix, stop_event)
    )
    sfc_manager.set_monitor(design_id, task, stop_event, run_id)
    return run_id


async def _monitor_tracked_nodes(
    run_id: str,
    tracked_nodes: list[dict],
    opc_url: str,
    opc_prefix: str,
    stop_event: asyncio.Event,
):
    """Poll tracked nodes ~40-50ms and store changed values."""

    client = None
    last_values = {}

    try:
        client = Client(opc_url)
        client.connect()

        # Prepare node objects once
        node_objs = []
        for item in tracked_nodes:
            try:
                node_objs.append(client.get_node(item["node_id"]))
            except Exception as e:
                print(f"Monitor: failed to get node {item['node_id']}: {e}")
                node_objs.append(None)

        while not stop_event.is_set():
            samples = []
            ts_ms = int(time.time() * 1000)

            try:
                # Attempt batch read; fallback to individual gets
                try:
                    batch_indices = [
                        i for i, obj in enumerate(node_objs) if obj is not None
                    ]
                    batch_nodes = [node_objs[i] for i in batch_indices]
                    batch_values = client.get_values(batch_nodes) if batch_nodes else []
                    values = [None] * len(node_objs)
                    for idx, val in zip(batch_indices, batch_values):
                        values[idx] = val
                except Exception:
                    values = []
                    for obj in node_objs:
                        if obj is None:
                            values.append(None)
                        else:
                            try:
                                values.append(obj.get_value())
                            except Exception:
                                values.append(None)

                for idx, value in enumerate(values):
                    node_meta = tracked_nodes[idx]
                    node_id = node_meta["node_id"]
                    last = last_values.get(node_id)
                    if last is None or value != last:
                        try:
                            value_str = json.dumps(value, default=str)
                        except Exception:
                            value_str = str(value)

                        # Look up short_node_id from database
                        short_node_id = await get_short_node_id(node_id)

                        samples.append(
                            (
                                run_id,
                                ts_ms,
                                node_id,
                                short_node_id,
                                node_meta.get("data_type"),
                                value_str,
                                None,
                                None,
                            )
                        )
                        last_values[node_id] = value
            except Exception as e:
                print(f"Monitor loop error: {e}")

            if samples:
                try:
                    await save_simulation_samples(samples)
                except Exception as e:
                    print(f"Monitor save error: {e}")

            await asyncio.sleep(0.04)

    except Exception as e:
        print(f"Simulation monitor failed: {e}")
    finally:
        if client is not None:
            try:
                client.disconnect()
            except Exception:
                pass
        try:
            await finish_simulation_run(run_id)
        except Exception as e:
            print(f"Failed to finish run {run_id}: {e}")


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

    # Execute setvalue and wait nodes
    executable_nodes = {n["id"] for n in nodes if n["type"] in ["setvalue", "wait"]}

    print(f"DEBUG: Found {len(executable_nodes)} executable nodes: {executable_nodes}")
    print(f"DEBUG: Node map keys: {list(node_map.keys())}")
    print(f"DEBUG: Incoming edges: {incoming}")
    print(f"DEBUG: Outgoing edges: {outgoing}")

    # Mark non-executable nodes as finished immediately (start, end, condition)
    # IMPORTANT: Initialize fresh for each execution to avoid state persistence
    finished = {n["id"] for n in nodes if n["type"] not in ["setvalue", "wait"]}
    running = set()

    async def execute_node(node_id):
        """Execute a single node (setvalue or wait)"""
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
                await asyncio.sleep(0.05)  # Update every 50ms (4x faster)

        update_task = asyncio.create_task(broadcast_elapsed_time())

        try:
            node_type = node.get("type")

            # Handle SetValue nodes
            if node_type == "setvalue":
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

            # Handle Wait nodes
            elif node_type == "wait":
                waitConfig = node["data"].get("waitConfig", {})
                wait_time = float(waitConfig.get("waitTime", 0))
                await asyncio.sleep(wait_time)

            else:
                # Skip unknown node types
                pass

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

        except asyncio.CancelledError:
            # Task was cancelled - don't add to finished set
            stop_updates = True
            await update_task
            running.discard(node_id)
            raise  # Re-raise to propagate cancellation

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
            # Only add to finished if task completed normally or with error (not cancelled)
            if node_id in running:
                finished.add(node_id)
                running.discard(node_id)

    async def run_sfc():
        """Main SFC execution loop"""
        # Reinitialize state to prevent contamination from previous runs
        nonlocal finished, running
        finished = {n["id"] for n in nodes if n["type"] not in ["setvalue", "wait"]}
        running = set()

        print(f"DEBUG: Starting SFC execution with {len(executable_nodes)} nodes")
        pending = executable_nodes.copy()
        iteration = 0
        active_tasks = {}  # Maps node_id -> task

        try:
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

                await asyncio.sleep(0.01)

                # Remove finished nodes from pending after a short delay to ensure
                # all status updates have propagated
                pending = executable_nodes - finished

            print("DEBUG: SFC execution completed")
            await sfc_manager.broadcast(design_id, {"status": "all_finished"})
            await sfc_manager.stop_monitor(design_id)

        except asyncio.CancelledError:
            print(f"DEBUG: SFC execution cancelled for design {design_id}")
            # Cancel all running node tasks
            for task in active_tasks.values():
                task.cancel()
            # Wait for all tasks to finish cancellation
            if active_tasks:
                await asyncio.gather(*active_tasks.values(), return_exceptions=True)
            await sfc_manager.stop_monitor(design_id)
            raise  # Re-raise to properly handle cancellation

    # Create and start the execution task
    task = asyncio.create_task(run_sfc())
    sfc_manager.set_task(design_id, task)

    # Kick off background monitor of tracked nodes for this run
    await start_simulation_monitor(design_id, opc_url, opc_prefix, sfc_manager)


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
