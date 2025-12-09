"""OPC UA server connection and node handling"""

from opcua import Client
from pydantic import BaseModel


class OPCTestRequest(BaseModel):
    url: str
    prefix: str


class OPCSaveRequest(BaseModel):
    url: str
    prefix: str


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
