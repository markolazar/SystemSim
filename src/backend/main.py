# --- Standard and third-party imports ---
import os
import sys
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- Project-specific imports ---
from database import init_database, migrate_database
from sfc_manager import SFCExecutionManager
from sfc_routes import setup_sfc_routes
from opc_routes import router as opc_router


def get_base_path():
    """Get the base path for the application"""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(
            sys._MEIPASS, ".."
        )  # pyright: ignore[reportAttributeAccessIssue]
    else:
        return os.path.abspath(os.path.dirname(__file__))


def load_environment():
    """Load environment variables from .env file"""
    base_path = get_base_path()
    env_path = os.path.join(base_path, "..", "..", ".env")
    load_dotenv(env_path)

    try:
        backend_port = int(
            os.getenv("VITE_BACKEND_PORT")
        )  # pyright: ignore[reportArgumentType]
        frontend_port = int(
            os.getenv("VITE_FRONTEND_PORT")
        )  # pyright: ignore[reportArgumentType]
        return backend_port, frontend_port
    except TypeError:
        print(
            "Error: VITE_BACKEND_PORT and VITE_FRONTEND_PORT must be set in the .env file."
        )
        sys.exit(1)


def create_app(frontend_port: int):
    """Create and configure the FastAPI application"""
    app = FastAPI(title="SystemSim Backend", version="0.1.0")

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[f"http://localhost:{frontend_port}"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


# Load environment variables
BACKEND_PORT, FRONTEND_PORT = load_environment()

# Create FastAPI app
app = create_app(FRONTEND_PORT)

# Initialize SFC manager
sfc_manager = SFCExecutionManager()

# Setup routes
setup_sfc_routes(app, sfc_manager)
app.include_router(opc_router)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_database()
    await migrate_database()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


@app.get("/data")
def read_data():
    """Simple data endpoint"""
    return {"message": "Hello from python FastAPI!"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=BACKEND_PORT)
