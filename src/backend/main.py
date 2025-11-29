import os
import sys

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


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


@app.get("/data")
def read_data():
    return {"message": "Hello from python FastAPI!"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=BACKEND_PORT)
