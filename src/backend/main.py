import os
import sys

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_database, save_opc_config, get_opc_config
from opc_handler import OPCTestRequest, OPCSaveRequest, connect_to_opc_server


def get_base_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(
            sys._MEIPASS, ".."
        )  # pyright: ignore[reportAttributeAccessIssue]
    else:
        return os.path.abspath(os.path.dirname(__file__))


base_path = get_base_path()
env_path = os.path.join(base_path, "..", "..", ".env")
load_dotenv(env_path)

try:
    BACKEND_PORT = int(
        os.getenv("VITE_BACKEND_PORT")
    )  # pyright: ignore[reportArgumentType]
    FRONTEND_PORT = int(
        os.getenv("VITE_FRONTEND_PORT")
    )  # pyright: ignore[reportArgumentType]
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
    result = connect_to_opc_server(request.url, request.prefix)
    return result


@app.post("/opc/save")
async def save_opc_configuration(request: OPCSaveRequest):
    """Save OPC server configuration to database"""
    try:
        await save_opc_config(request.url, request.prefix)
        return {
            "success": True,
            "message": "OPC server configuration saved successfully",
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to save configuration: {str(e)}"}


@app.get("/opc/config")
async def get_opc_configuration():
    """Get saved OPC server configuration from database"""
    try:
        config = await get_opc_config()
        if config:
            return {"success": True, "config": config}
        else:
            return {
                "success": True,
                "config": None,
                "message": "No configuration saved yet",
            }
    except Exception as e:
        return {"success": False, "message": f"Failed to load configuration: {str(e)}"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=BACKEND_PORT)
