import os
import sys

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_database, save_opc_config, get_opc_config

try:
    from asyncua import Client as OPCClient
    ASYNCUA_AVAILABLE = True
except ImportError:
    ASYNCUA_AVAILABLE = False
    OPCClient = None


class OPCTestRequest(BaseModel):
    url: str
    prefix: str


class OPCSaveRequest(BaseModel):
    url: str
    prefix: str


def get_base_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "..")  # pyright: ignore[reportAttributeAccessIssue]
    else:
        return os.path.abspath(os.path.dirname(__file__))


base_path = get_base_path()
env_path = os.path.join(base_path, "..", "..", ".env")
load_dotenv(env_path)

try:
    BACKEND_PORT = int(os.getenv("VITE_BACKEND_PORT"))  # pyright: ignore[reportArgumentType]
    FRONTEND_PORT = int(os.getenv("VITE_FRONTEND_PORT"))  # pyright: ignore[reportArgumentType]
except TypeError:
    print(
        "Error: VITE_BACKEND_PORT and VITE_FRONTEND_PORT must be set in the .env file."
    )
    sys.exit(1)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{FRONTEND_PORT}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_database()


@app.get("/data")
def read_data():
    return {"message": "Hello from python FastAPI!"}


@app.post("/opc/test-connection")
async def test_opc_connection(request: OPCTestRequest):
    """Test OPC UA server connection and check if node exists"""
    
    if not ASYNCUA_AVAILABLE:
        return {
            "success": False,
            "message": "asyncua package is not installed. Please install it with: pip install asyncua"
        }
    
    try:
        client = OPCClient(url=request.url)
        
        try:
            await client.connect()
            
            # Try to get the node specified by prefix
            try:
                node = client.get_node(request.prefix)
                # Try to read the node to verify it exists and is accessible
                browse_name = await node.read_browse_name()
                node_id = node.nodeid
                
                return {
                    "success": True,
                    "message": f"Successfully connected to {request.url} and found node {request.prefix}",
                    "details": {
                        "browse_name": browse_name.Name,
                        "node_id": str(node_id)
                    }
                }
            except Exception as node_error:
                # Try to provide more details about the error
                error_details = str(node_error)
                return {
                    "success": False,
                    "message": f"Connected to server but couldn't access node '{request.prefix}': {error_details}"
                }
        finally:
            try:
                await client.disconnect()
            except:
                pass
                
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        return {
            "success": False,
            "message": f"Failed to connect to OPC server: {error_msg}",
            "traceback": traceback_str
        }


@app.post("/opc/save")
async def save_opc_configuration(request: OPCSaveRequest):
    """Save OPC server configuration to database"""
    try:
        await save_opc_config(request.url, request.prefix)
        return {
            "success": True,
            "message": "OPC server configuration saved successfully"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to save configuration: {str(e)}"
        }


@app.get("/opc/config")
async def get_opc_configuration():
    """Get saved OPC server configuration from database"""
    try:
        config = await get_opc_config()
        if config:
            return {
                "success": True,
                "config": config
            }
        else:
            return {
                "success": True,
                "config": None,
                "message": "No configuration saved yet"
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to load configuration: {str(e)}"
        }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=BACKEND_PORT)
