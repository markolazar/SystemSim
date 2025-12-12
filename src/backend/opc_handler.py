"""OPC UA server connection and node handling"""

from opcua import Client
from pydantic import BaseModel


class OPCTestRequest(BaseModel):
    url: str
    prefix: str


class OPCSaveRequest(BaseModel):
    url: str
    prefix: str


class OPCDiscoverRequest(BaseModel):
    url: str
    prefix: str
    selected_nodes: list[str] | None = None


class OPCChildrenRequest(BaseModel):
    url: str
    prefix: str


class OPCDiscoverUnderRequest(BaseModel):
    url: str
    parent_id: str
    prefix: str


def generate_short_node_id(node_id: str, prefix: str = "") -> str:
    """
    Generate a short node ID by removing the prefix from the full node ID.
    Examples:
        node_id: ns=2;s=MyPrefix.dbMotors.Variable1, prefix: ns=2;s=MyPrefix -> dbMotors.Variable1
        node_id: ns=2;s=dbAnalogSensors.EI_1000.ManValueEgu, prefix: ns=2;s= -> dbAnalogSensors.EI_1000.ManValueEgu

    Args:
        node_id: Full OPC node ID
        prefix: OPC prefix to remove from the node_id

    Returns:
        Short node ID string with prefix removed
    """
    if not prefix:
        # If no prefix, just extract value after ns=X;s= or similar patterns
        try:
            if ";" in node_id and "=" in node_id:
                parts = node_id.split(";")
                if len(parts) >= 2:
                    value_part = parts[-1]
                    if "=" in value_part:
                        return value_part.split("=", 1)[1]
                    return value_part
        except:
            pass
        return node_id

    # Remove the prefix and the following dot
    if prefix in node_id:
        short_id = node_id.replace(prefix + ".", "")
        if short_id != node_id:  # Successfully removed prefix with dot
            return short_id
        # Try without dot (in case prefix is at the end)
        return node_id.replace(prefix, "")

    return node_id


def discover_nodes_recursive(
    node, parent_id=None, max_depth=6, current_depth=0, prefix=""
):
    """
    Recursively discover all nodes in the OPC server

    Args:
        node: Current node to process
        parent_id: Parent node ID
        max_depth: Maximum depth to traverse (prevents infinite loops)
        current_depth: Current recursion depth
        prefix: OPC prefix for generating short node IDs

    Returns:
        List of discovered nodes
    """
    nodes = []

    if current_depth >= max_depth:
        return nodes

    try:
        # Get current node info
        node_id = node.nodeid.to_string()
        browse_name = str(node.get_browse_name())

        # Try to get additional info
        try:
            data_type = str(node.get_data_type())
        except:
            data_type = None

        try:
            value_rank = node.get_value_rank()
        except:
            value_rank = None

        # Add current node (exclude if contains "spare" case-insensitive)
        if "spare" not in node_id.lower() and "spare" not in browse_name.lower():
            shortnodeid = generate_short_node_id(node_id, prefix)
            node_dict = {
                "node_id": node_id,
                "browse_name": browse_name,
                "parent_id": parent_id,
                "data_type": data_type,
                "value_rank": value_rank,
                "shortnodeid": shortnodeid,
            }
            nodes.append(node_dict)

        # Try to get children
        try:
            children = node.get_children()
            for child in children:
                child_nodes = discover_nodes_recursive(
                    child,
                    parent_id=node_id,
                    max_depth=max_depth,
                    current_depth=current_depth + 1,
                    prefix=prefix,
                )
                nodes.extend(child_nodes)
        except Exception as e:
            print(f"Could not get children for node {node_id}: {e}")

    except Exception as e:
        print(f"Error processing node: {e}")

    return nodes


def list_child_nodes(url: str, prefix: str):
    """List immediate children of the given prefix node."""
    client = None
    try:
        client = Client(url)
        client.connect()
        node = client.get_node(prefix)
        children = node.get_children()
        result = []
        for child in children:
            try:
                result.append(
                    {
                        "node_id": child.nodeid.to_string(),
                        "browse_name": str(child.get_browse_name()),
                    }
                )
            except Exception:
                result.append({"node_id": child.nodeid.to_string(), "browse_name": ""})
        return {"success": True, "children": result}
    except Exception as e:
        import traceback

        traceback_str = traceback.format_exc()
        print(f"OPC Children Error: {e}")
        print(traceback_str)
        return {"success": False, "message": f"Failed to list children: {e}"}
    finally:
        if client is not None:
            try:
                client.disconnect()
            except Exception:
                pass


def connect_to_opc_server(url: str, prefix: str):
    """
    Connect to OPC UA server and retrieve node information

    Args:
        url: OPC server URL (e.g., opc.tcp://localhost:4840)
        prefix: Node ID prefix (e.g., ns=2;s=MyApp)

    Returns:
        dict with success status, message, and node details
    """
    client = None

    try:
        # Create and connect client
        client = Client(url)
        client.connect()
        print(f"Connected to {url}")

        # Get the node
        node = client.get_node(prefix)
        # List children of the node
        children = node.get_children()
        print("Children of node:")
        for child in children:
            print(f"  Child: {child}")

        return {
            "success": True,
            "message": f"Successfully connected to {url} and found node {prefix}",
            "details": {
                "node_id": node.nodeid.to_string(),
                "num_children": len(children),
                "children": [child.nodeid.to_string() for child in children],
            },
        }

    except Exception as e:
        import traceback

        traceback_str = traceback.format_exc()
        print(f"OPC Connection Error: {e}")
        print(traceback_str)
        return {
            "success": False,
            "message": f"Failed to connect or read node: {e}",
        }

    finally:
        if client is not None:
            try:
                client.disconnect()
                print("Disconnected from OPC UA server")
            except Exception as disconnect_error:
                print(f"Error disconnecting: {disconnect_error}")


def discover_nodes(url: str, prefix: str, selected_nodes: list[str] | None = None):
    """
    Discover all nodes recursively from the specified node

    Args:
        url: OPC server URL
        prefix: Starting node ID prefix

    Returns:
        dict with success status and list of discovered nodes
    """
    client = None

    try:
        # Create and connect client
        client = Client(url)
        client.connect()
        print(f"Connected to {url}")

        start_ids = selected_nodes if selected_nodes else [prefix]
        discovered_nodes = []

        for node_id in start_ids:
            try:
                node = client.get_node(node_id)
                print(f"Starting discovery from node: {node_id}")
                discovered_nodes.extend(discover_nodes_recursive(node, prefix=prefix))
            except Exception as e:
                print(f"Could not start discovery at {node_id}: {e}")

        print(f"Discovered {len(discovered_nodes)} total nodes")

        return {
            "success": True,
            "message": f"Successfully discovered {len(discovered_nodes)} nodes",
            "nodes": discovered_nodes,
        }

    except Exception as e:
        import traceback

        traceback_str = traceback.format_exc()
        print(f"OPC Discovery Error: {e}")
        print(traceback_str)
        return {
            "success": False,
            "message": f"Failed to discover nodes: {e}",
        }

    finally:
        if client is not None:
            try:
                client.disconnect()
                print("Disconnected from OPC UA server")
            except Exception as disconnect_error:
                print(f"Error disconnecting: {disconnect_error}")
