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


def discover_nodes_recursive(node, parent_id=None, max_depth=3, current_depth=0):
    """
    Recursively discover all nodes in the OPC server

    Args:
        node: Current node to process
        parent_id: Parent node ID
        max_depth: Maximum depth to traverse (prevents infinite loops)
        current_depth: Current recursion depth

    Returns:
        List of discovered nodes
    """
    nodes = []

    if current_depth >= max_depth:
        return nodes

    try:
        # Get current node info
        node_id = str(node.nodeid)
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

        # Add current node
        node_dict = {
            "node_id": node_id,
            "browse_name": browse_name,
            "parent_id": parent_id,
            "data_type": data_type,
            "value_rank": value_rank,
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
                )
                nodes.extend(child_nodes)
        except Exception as e:
            print(f"Could not get children for node {node_id}: {e}")

    except Exception as e:
        print(f"Error processing node: {e}")

    return nodes


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
                "node_id": str(node.nodeid),
                "num_children": len(children),
                "children": [str(child) for child in children],
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


def discover_nodes(url: str, prefix: str):
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

        # Get the starting node
        node = client.get_node(prefix)
        print(f"Starting discovery from node: {prefix}")

        # Recursively discover all nodes
        discovered_nodes = discover_nodes_recursive(node)
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
