# Backend Architecture

The backend has been refactored following Single Responsibility Principle (SRP) for better maintainability and organization.

## File Structure

```
src/backend/
├── main.py              # Application entry point and initialization
├── sfc_manager.py       # SFC execution logic and state management
├── sfc_routes.py        # SFC design API endpoints
├── opc_routes.py        # OPC server API endpoints
├── database.py          # Database operations
├── opc_handler.py       # OPC UA connection and discovery
└── __pycache__/         # Python cache
```

## Module Responsibilities

### `main.py`
- **Purpose**: Application initialization and startup
- **Responsibilities**:
  - Environment configuration loading
  - FastAPI app creation and setup
  - CORS middleware configuration
  - Route registration
  - Server startup/shutdown events

### `sfc_manager.py`
- **Purpose**: SFC execution orchestration and state management
- **Responsibilities**:
  - Managing SFC execution tasks
  - Tracking execution state (running nodes, finished nodes, errors)
  - WebSocket client registration/management
  - Broadcasting status updates to connected clients
  - OPC node write operations with type-aware variant conversion
  - Type mapping (Python types → OPC UA VariantType)

### `sfc_routes.py`
- **Purpose**: SFC design API endpoints
- **Responsibilities**:
  - CRUD operations for SFC designs
  - SFC execution endpoints
  - WebSocket endpoint for status streaming
  - Design data persistence

### `opc_routes.py`
- **Purpose**: OPC server integration API endpoints
- **Responsibilities**:
  - OPC server connection testing
  - Configuration management
  - Node discovery and browsing
  - Autocomplete functionality
  - Node selection management

### `database.py`
- **Purpose**: Data persistence layer
- **Existing responsibility**: Database operations for all entities

### `opc_handler.py`
- **Purpose**: OPC UA protocol handling
- **Existing responsibility**: OPC connection, node discovery, and browsing

## Key Features

### SFC Execution Flow
1. Client calls `/sfc/designs/{design_id}/execute`
2. Backend validates design and loads OPC config
3. `execute_sfc()` is called to start execution
4. SFC execution runs as async task with dependency tracking
5. Nodes execute in order respecting graph dependencies
6. Non-setvalue nodes (Start, End, etc.) are marked finished immediately
7. Setvalue nodes write to OPC with proper type conversion
8. Status updates broadcast via WebSocket or REST polling

### Type-Aware OPC Writes
```python
def get_variant_type(py_type):
    """Maps Python types to OPC UA VariantTypes"""
    - int → VariantType.Int32
    - float → VariantType.Float
    - bool → VariantType.Boolean
    - str → VariantType.String
    - default → VariantType.Float
```

## API Endpoints

### SFC Endpoints
- `POST /sfc/designs` - Create design
- `GET /sfc/designs` - List all designs
- `GET /sfc/designs/{id}` - Get design details
- `GET /sfc/designs/{id}/status` - Get execution status
- `POST /sfc/designs/{id}/save` - Save design
- `PUT /sfc/designs/{id}` - Update design metadata
- `DELETE /sfc/designs/{id}` - Delete design
- `POST /sfc/designs/{id}/execute` - Start execution
- `WS /sfc/ws/{id}` - WebSocket for status updates

### OPC Endpoints
- `POST /opc/test-connection` - Test OPC connection
- `POST /opc/save` - Save OPC config
- `GET /opc/config` - Get OPC config
- `POST /opc/discover-nodes` - Discover nodes
- `POST /opc/children` - List child nodes
- `GET /opc/nodes` - Get all discovered nodes
- `GET /opc/selected-nodes` - Get selected nodes
- `GET /opc/autocomplete` - Node autocomplete

## Startup Sequence

1. Load environment variables from `.env`
2. Create FastAPI app with CORS middleware
3. Initialize SFC execution manager
4. Register all routes (SFC + OPC)
5. Initialize database and run migrations
6. Start Uvicorn server on configured port

## Testing

All modules have been verified for syntax errors. To run the server:

```bash
cd src/backend
python main.py
```

The server will start on `http://localhost:49152` (or configured VITE_BACKEND_PORT).
