import { useState, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  Panel,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  BackgroundVariant
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { BottomBar } from '@/components/ui/bottom-bar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { OPCAutocomplete } from '@/components/opc-autocomplete'
import { Skeleton } from '@/components/ui/skeleton'

const nodeTypesConfig = [
  {
    type: 'start',
    label: 'Start',
    color: '#10b981',
    bgColor: '#d1fae5',
    description: 'Starting point of the flow',
    shape: 'circle'
  },
  {
    type: 'condition',
    label: 'Condition',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    description: 'Decision or branching logic',
    shape: 'diamond'
  },
  {
    type: 'setvalue',
    label: 'Set Value',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    description: 'Assign or modify values',
    shape: 'rectangle'
  },
  {
    type: 'wait',
    label: 'Wait',
    color: '#06b6d4',
    bgColor: '#cffafe',
    description: 'Pause or delay execution',
    shape: 'circle'
  },
  {
    type: 'end',
    label: 'End',
    color: '#ef4444',
    bgColor: '#fee2e2',
    description: 'End point of the flow',
    shape: 'circle'
  }
]

// Custom node components with different shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
const StartNode = ({ data, selected }: any) => (
  <div
    style={{
      width: '100px',
      height: '100px',
      borderRadius: '50%',
      border: `3px solid ${data.color}`,
      backgroundColor: data.bgColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '700',
      fontSize: '14px',
      color: '#1f2937',
      textAlign: 'center',
      boxShadow: selected
        ? '0 0 0 3px rgba(59, 130, 246, 0.5)'
        : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      padding: '8px'
    }}
  >
    {data.label}
    <Handle
      type="source"
      position={Position.Right}
      style={{ background: data.color, width: '20px', height: '20px' }}
    />
  </div>
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
const ConditionNode = ({ data, selected }: any) => (
  <div
    style={{
      position: 'relative',
      width: '110px',
      height: '110px'
    }}
  >
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: 'rotate(45deg)',
        border: `3px solid ${data.color}`,
        backgroundColor: data.bgColor,
        boxShadow: selected
          ? '0 0 0 3px rgba(59, 130, 246, 0.5)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}
    />
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '600',
        fontSize: '12px',
        color: '#1f2937',
        textAlign: 'center',
        padding: '8px'
      }}
    >
      {data.label}
    </div>
    <Handle
      type="target"
      position={Position.Left}
      style={{ background: data.color, left: '-2px', width: '20px', height: '20px' }}
    />
    <Handle
      type="source"
      position={Position.Right}
      style={{ background: data.color, right: '-2px', width: '20px', height: '20px' }}
    />
  </div>
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
const SetValueNode = ({ data, selected }: any) => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const event = new CustomEvent('openSetValueModal', { detail: { nodeId: data.nodeId } })
    window.dispatchEvent(event)
  }

  // Display OPC node if configured, otherwise show default label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setValueConfig = (data as any).setValueConfig || {}
  const displayText = setValueConfig.opcNode || data.label
  // Replace dots with newlines for better visibility
  const formattedDisplayText = displayText.replace(/\./g, '\n')

  // Show start/end value and time if available
  const hasDetails = setValueConfig.startValue || setValueConfig.endValue || setValueConfig.time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elapsedTime = (data as any).elapsedTime

  // Debug logging
  if (elapsedTime !== undefined) {
    console.log('Node has elapsedTime:', elapsedTime, 'for node:', data.nodeId)
  }

  return (
    <div
      style={{
        padding: '16px 18px',
        border: `2px solid ${data.color}`,
        backgroundColor: data.bgColor,
        minWidth: '160px',
        maxWidth: '360px',
        minHeight: '80px',
        textAlign: 'left',
        fontWeight: 600,
        fontSize: 13,
        color: '#1f2937',
        boxShadow: selected
          ? '0 0 0 3px rgba(59, 130, 246, 0.5), 0 8px 16px rgba(0, 0, 0, 0.15)'
          : '0 8px 16px rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
        cursor: 'pointer',
        wordBreak: 'break-all',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 12,
        transition: 'all 0.2s ease'
      }}
      onDoubleClick={handleDoubleClick}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: data.color, width: 16, height: 16, alignSelf: 'center' }}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            minHeight: 24,
            fontWeight: 700,
            fontSize: 14,
            color: '#1f2937',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line'
          }}
          title={displayText}
        >
          {formattedDisplayText}
        </div>
        {hasDetails && (
          <div
            style={{ fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.4, opacity: 0.85 }}
          >
            {setValueConfig.type && (
              <span style={{ marginRight: 8 }}>
                Type: <b>{setValueConfig.type}</b>
              </span>
            )}
            {setValueConfig.startValue !== undefined && setValueConfig.startValue !== '' && (
              <span style={{ marginRight: 8 }}>
                Start: <b>{setValueConfig.startValue}</b>
              </span>
            )}
            {setValueConfig.endValue !== undefined && setValueConfig.endValue !== '' && (
              <span style={{ marginRight: 8 }}>
                End: <b>{setValueConfig.endValue}</b>
              </span>
            )}
            {setValueConfig.time !== undefined && setValueConfig.time !== '' && (
              <span>
                Time: <b>{setValueConfig.time}s</b>
              </span>
            )}
          </div>
        )}
        {elapsedTime !== undefined && (
          <div
            style={{
              fontSize: 11,
              marginTop: 6,
              fontWeight: 700,
              backgroundColor: data.color,
              color: 'white',
              padding: '3px 8px',
              borderRadius: '6px',
              display: 'inline-block'
            }}
          >
            Elapsed: {elapsedTime}s
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: data.color, width: 16, height: 16, alignSelf: 'center' }}
      />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
const WaitNode = ({ data, selected }: any) => (
  <div
    style={{
      width: '100px',
      height: '100px',
      borderRadius: '50%',
      border: `3px solid ${data.color}`,
      backgroundColor: data.bgColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '700',
      fontSize: '14px',
      color: '#1f2937',
      textAlign: 'center',
      boxShadow: selected
        ? '0 0 0 3px rgba(59, 130, 246, 0.5)'
        : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      padding: '8px'
    }}
  >
    <Handle
      type="target"
      position={Position.Left}
      style={{ background: data.color, width: '20px', height: '20px' }}
    />
    {data.label}
    <Handle
      type="source"
      position={Position.Right}
      style={{ background: data.color, width: '20px', height: '20px' }}
    />
  </div>
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
const EndNode = ({ data, selected }: any) => (
  <div
    style={{
      width: '100px',
      height: '100px',
      borderRadius: '50%',
      border: `3px solid ${data.color}`,
      backgroundColor: data.bgColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '700',
      fontSize: '14px',
      color: '#1f2937',
      textAlign: 'center',
      boxShadow: selected
        ? '0 0 0 3px rgba(59, 130, 246, 0.5)'
        : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      padding: '8px'
    }}
  >
    <Handle
      type="target"
      position={Position.Left}
      style={{ background: data.color, width: '20px', height: '20px' }}
    />
    {data.label}
  </div>
)

const customNodeTypes = {
  start: StartNode,
  condition: ConditionNode,
  setvalue: SetValueNode,
  wait: WaitNode,
  end: EndNode
}

const initialNodes = [
  {
    id: 'n1',
    type: 'start',
    position: { x: 0, y: 0 },
    data: { label: 'Start', color: '#10b981', bgColor: '#d1fae5', nodeId: 'n1' }
  },
  {
    id: 'n2',
    type: 'setvalue',
    position: { x: 250, y: 0 },
    data: { label: 'Set Value', color: '#8b5cf6', bgColor: '#ede9fe', nodeId: 'n2' }
  },
  {
    id: 'n3',
    type: 'end',
    position: { x: 500, y: 0 },
    data: { label: 'End', color: '#ef4444', bgColor: '#fee2e2', nodeId: 'n3' }
  }
]
const initialEdges = [
  {
    id: 'n1-n2',
    source: 'n1',
    target: 'n2',
    animated: true,
    style: { strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed' as const }
  },
  {
    id: 'n2-n3',
    source: 'n2',
    target: 'n3',
    animated: true,
    style: { strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed' as const }
  }
]

// Main editor component that uses ReactFlow
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function SFCEditor() {
  const reactFlowInstance = useReactFlow()
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    x: number
    y: number
    nodeId: string
  } | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    x: number
    y: number
    edgeId: string
  } | null>(null)
  const [nextNodeId, setNextNodeId] = useState(4)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [copiedNode, setCopiedNode] = useState<any>(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })

  // Node types panel state
  const [nodeTypesPanelCollapsed, setNodeTypesPanelCollapsed] = useState(false)

  // SFC Design state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [designs, setDesigns] = useState<any[]>([])
  const [currentDesignId, setCurrentDesignId] = useState<number | null>(null)
  const [showNewDesignDialog, setShowNewDesignDialog] = useState(false)
  const [showBrowseDesignsDialog, setShowBrowseDesignsDialog] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [newDesignDescription, setNewDesignDescription] = useState('')
  const [showSaveSuccessDialog, setShowSaveSuccessDialog] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [designToDelete, setDesignToDelete] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [showErrorDialog, setShowErrorDialog] = useState(false)

  // Simulation state
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // Log console for execution messages
  const [executionLogs, setExecutionLogs] = useState<
    Array<{ time: string; type: 'info' | 'error' | 'success'; message: string }>
  >([])
  const [isLoading, setIsLoading] = useState(true)

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const addLog = (type: 'info' | 'error' | 'success', message: string) => {
    const time = new Date().toLocaleTimeString()
    setExecutionLogs((prev) => [...prev, { time, type, message }])
  }

  // Set Value modal state
  // Node execution status state
  const [nodeStatus, setNodeStatus] = useState<{
    [nodeId: string]: { status: 'idle' | 'running' | 'finished' | 'error'; elapsedTime?: number }
  }>({})
  const pollingIntervalRef = useState<{ id: NodeJS.Timeout | null }>({ id: null })[0]

  // Simulation control handlers
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleStart = async () => {
    if (!currentDesignId) return

    // Auto-reset before starting
    setIsRunning(false)
    setIsPaused(false)
    setNodeStatus({})
    setExecutionLogs([]) // Clear logs
    if (pollingIntervalRef.id) {
      clearInterval(pollingIntervalRef.id)
      pollingIntervalRef.id = null
    }

    // Auto-save before starting execution
    await saveCurrentDesign()

    addLog('info', 'Starting SFC execution...')
    setIsRunning(true)
    setIsPaused(false)

    const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT

    // Start backend execution
    const response = await fetch(
      `http://localhost:${BACKEND_PORT}/sfc/designs/${currentDesignId}/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }
    )

    if (!response.ok) {
      addLog('error', 'Failed to start SFC execution')
      setIsRunning(false)
      return
    }

    // Poll for status updates
    if (pollingIntervalRef.id) {
      clearInterval(pollingIntervalRef.id)
    }

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(
          `http://localhost:${BACKEND_PORT}/sfc/designs/${currentDesignId}/status`
        )
        const statusData = await statusResponse.json()

        if (statusData.status && statusData.status.nodes) {
          // Update node statuses
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.entries(statusData.status.nodes).forEach(([nodeId, nodeStatus]: [string, any]) => {
            setNodeStatus((prev) => ({
              ...prev,
              [nodeId]: {
                status: nodeStatus.status,
                elapsedTime: nodeStatus.elapsed_time
              }
            }))
            if (nodeStatus.status === 'error' && nodeStatus.error) {
              addLog('error', `Node ${nodeId}: ${nodeStatus.error}`)
            }
          })
        }

        // Check if all nodes are finished
        const nodeStatuses = statusData.status?.nodes || {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allFinished = Object.values(nodeStatuses).every((status: any) => {
          return status.status === 'finished' || status.status === 'error'
        })

        if (allFinished && Object.keys(nodeStatuses).length > 0) {
          const hasErrors = Object.values(nodeStatuses).some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (status: any) => status.status === 'error'
          )
          if (hasErrors) {
            addLog('error', 'Execution completed with errors')
          } else {
            addLog('success', 'Execution completed successfully!')
          }
          setIsRunning(false)
          clearInterval(pollInterval)
          // Trigger confetti celebration
          confetti({
            particleCount: 200,
            spread: 70,
            origin: { y: 0.6 }
          })
        }
      } catch (error) {
        console.error('Error polling SFC status:', error)
      }
    }, 500) // Poll every 500ms

    pollingIntervalRef.id = pollInterval
  }
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handlePause = () => {
    setIsPaused(true)
    // (Pause not implemented in backend yet)
  }
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleStop = () => {
    setIsRunning(false)
    setIsPaused(false)
    // (Stop not implemented in backend yet)
    if (pollingIntervalRef.id) {
      clearInterval(pollingIntervalRef.id)
      pollingIntervalRef.id = null
    }
  }
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleReset = () => {
    setIsRunning(false)
    setIsPaused(false)
    setNodeStatus({})
    setExecutionLogs([])
    if (pollingIntervalRef.id) {
      clearInterval(pollingIntervalRef.id)
      pollingIntervalRef.id = null
    }
  }
  const [showSetValueModal, setShowSetValueModal] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [setValueForm, setSetValueForm] = useState({
    type: 'float',
    opcNode: '',
    startValue: '',
    endValue: '',
    time: ''
  })

  const onNodesChange = useCallback(
    (changes) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  )
  const onEdgesChange = useCallback(
    (changes) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  )
  const onConnect = useCallback(
    (params) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    []
  )

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault()
    setNodeContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
    setContextMenu(null)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: any) => {
    event.preventDefault()
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id })
    setContextMenu(null)
  }, [])

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const deleteNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    // Prevent deletion of start and end nodes
    if (node && (node.type === 'start' || node.type === 'end')) {
      return
    }
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setNodeContextMenu(null)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const deleteEdge = (edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId))
    setEdgeContextMenu(null)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const copyNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (node && node.type !== 'start' && node.type !== 'end') {
        setCopiedNode(node)
      }
      setNodeContextMenu(null)
    },
    [nodes]
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pasteNode = useCallback(
    (position?: { x: number; y: number }) => {
      if (!copiedNode) return

      let pastePosition
      if (position) {
        pastePosition = position
      } else if (contextMenu) {
        pastePosition = reactFlowInstance.screenToFlowPosition({
          x: contextMenu.x,
          y: contextMenu.y
        })
      } else {
        // Paste at center of viewport when using keyboard shortcut
        pastePosition = reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        })
      }

      const nodeId = `n${nextNodeId}`
      const newNode = {
        ...copiedNode,
        id: nodeId,
        position: pastePosition,
        data: { ...copiedNode.data, nodeId }
      }
      setNodes([...nodes, newNode])
      setNextNodeId(nextNodeId + 1)
      setContextMenu(null)
    },
    [copiedNode, contextMenu, nextNodeId, nodes, reactFlowInstance]
  )

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleSetValueModalClose = () => {
    setShowSetValueModal(false)
    setSelectedNodeId(null)
    setSetValueForm({
      type: 'float',
      opcNode: '',
      startValue: '',
      endValue: '',
      time: ''
    })
  }

  // Load all designs from backend
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const loadDesigns = async () => {
    try {
      const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT
      const response = await fetch(`http://localhost:${BACKEND_PORT}/sfc/designs`)
      const data = await response.json()
      if (data.success) {
        setDesigns(data.designs)
      }
    } catch (error) {
      console.error('Failed to load designs:', error)
    }
  }

  // Load a specific design
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const loadDesign = async (designId: number) => {
    try {
      const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT
      const response = await fetch(`http://localhost:${BACKEND_PORT}/sfc/designs/${designId}`)
      const data = await response.json()
      if (data.success && data.design) {
        const design = data.design
        setCurrentDesignId(designId)

        // Parse nodes and edges from JSON strings
        const loadedNodes = JSON.parse(design.nodes || '[]')
        const loadedEdges = JSON.parse(design.edges || '[]')

        setNodes(loadedNodes.length > 0 ? loadedNodes : initialNodes)
        setEdges(loadedEdges.length > 0 ? loadedEdges : initialEdges)

        // Load viewport if saved
        if (design.viewport) {
          try {
            const savedViewport = JSON.parse(design.viewport)
            setViewport(savedViewport)
            reactFlowInstance.setViewport(savedViewport)
          } catch (e) {
            console.error('Failed to parse viewport:', e)
          }
        }

        // Update nextNodeId based on loaded nodes
        if (loadedNodes.length > 0) {
          const maxId = Math.max(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...loadedNodes.map((n: any) => parseInt(n.id.replace('n', '')) || 0)
          )
          setNextNodeId(maxId + 1)
        }
        setShowBrowseDesignsDialog(false)

        // Save as last opened design
        localStorage.setItem('lastOpenedSFCDesign', designId.toString())
      }
    } catch (error) {
      console.error('Failed to load design:', error)
    }
  }

  // Save current design
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveCurrentDesign = useCallback(async () => {
    if (!currentDesignId) {
      setErrorMessage('Please create or select a design first')
      setShowErrorDialog(true)
      return
    }

    try {
      const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT
      // Get current viewport
      const currentViewport = reactFlowInstance.getViewport()
      const response = await fetch(
        `http://localhost:${BACKEND_PORT}/sfc/designs/${currentDesignId}/save`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: JSON.stringify(nodes),
            edges: JSON.stringify(edges),
            viewport: JSON.stringify(currentViewport)
          })
        }
      )
      const data = await response.json()
      if (data.success) {
        setShowSaveSuccessDialog(true)
        await loadDesigns() // Refresh design list
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
          setShowSaveSuccessDialog(false)
        }, 3000)
      } else {
        setErrorMessage('Failed to save design: ' + data.message)
        setShowErrorDialog(true)
      }
    } catch (error) {
      console.error('Failed to save design:', error)
      setErrorMessage('Failed to save design')
      setShowErrorDialog(true)
    }
  }, [currentDesignId, nodes, edges])

  // Create new design
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const createNewDesign = async () => {
    if (!newDesignName.trim()) {
      setErrorMessage('Please enter a design name')
      setShowErrorDialog(true)
      return
    }

    try {
      const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT
      const response = await fetch(`http://localhost:${BACKEND_PORT}/sfc/designs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDesignName,
          description: newDesignDescription
        })
      })
      const data = await response.json()
      if (data.success) {
        setShowNewDesignDialog(false)
        setNewDesignName('')
        setNewDesignDescription('')
        await loadDesigns()
        await loadDesign(data.design_id)
      } else {
        setErrorMessage('Failed to create design: ' + data.message)
        setShowErrorDialog(true)
      }
    } catch (error) {
      console.error('Failed to create design:', error)
      setErrorMessage('Failed to create design')
      setShowErrorDialog(true)
    }
  }

  // Delete a design - show confirmation dialog
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const deleteDesign = (designId: number) => {
    setDesignToDelete(designId)
    setShowDeleteConfirmDialog(true)
  }

  // Confirm and execute delete
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const confirmDeleteDesign = async () => {
    if (!designToDelete) return

    try {
      const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT
      const response = await fetch(
        `http://localhost:${BACKEND_PORT}/sfc/designs/${designToDelete}`,
        {
          method: 'DELETE'
        }
      )
      const data = await response.json()
      if (data.success) {
        if (currentDesignId === designToDelete) {
          setCurrentDesignId(null)
          setNodes(initialNodes)
          setEdges(initialEdges)
          localStorage.removeItem('lastOpenedSFCDesign')
        }
        setShowDeleteConfirmDialog(false)
        setDesignToDelete(null)
        await loadDesigns()
      } else {
        setShowDeleteConfirmDialog(false)
        setErrorMessage('Failed to delete design: ' + data.message)
        setShowErrorDialog(true)
      }
    } catch (error) {
      console.error('Failed to delete design:', error)
      setShowDeleteConfirmDialog(false)
      setErrorMessage('Failed to delete design')
      setShowErrorDialog(true)
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleSetValueSubmit = () => {
    if (selectedNodeId) {
      // Update the node data with the form values
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === selectedNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                setValueConfig: { ...setValueForm }
              }
            }
          }
          return node
        })
      )
    }
    handleSetValueModalClose()
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, @typescript-eslint/explicit-function-return-type
  const addBlock = (blockType: string, position?: { x: number; y: number }) => {
    const typeConfig = nodeTypesConfig.find((t) => t.label === blockType)
    const nodeType = typeConfig?.type || 'step'
    const color = typeConfig?.color || '#10b981'
    const bgColor = typeConfig?.bgColor || '#d1fae5'

    const nodeId = `n${nextNodeId}`
    const newNode = {
      id: nodeId,
      type: nodeType,
      position:
        position ||
        (contextMenu ? { x: contextMenu.x - 200, y: contextMenu.y - 100 } : { x: 0, y: 0 }),
      data: { label: `${blockType} ${nextNodeId}`, color, bgColor, nodeId }
    }
    setNodes([...nodes, newNode])
    setNextNodeId(nextNodeId + 1)
    setContextMenu(null)
  }

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })

      addBlock(type, position)
    },
    [reactFlowInstance, addBlock]
  )

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const closeContextMenu = () => {
    setContextMenu(null)
    setNodeContextMenu(null)
  }

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu && !nodeContextMenu) return

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const handleClick = () => closeContextMenu()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu, nodeContextMenu])

  // Handle Set Value modal open event
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const handleOpenModal = (event: Event) => {
      const customEvent = event as CustomEvent
      const nodeId = customEvent.detail.nodeId
      setSelectedNodeId(nodeId)

      // Load existing values from the node if they exist
      const node = nodes.find((n) => n.id === nodeId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (node?.data && (node.data as any).setValueConfig) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSetValueForm((node.data as any).setValueConfig)
      } else {
        setSetValueForm({
          type: 'float',
          opcNode: '',
          startValue: '',
          endValue: '',
          time: ''
        })
      }

      setShowSetValueModal(true)
    }

    window.addEventListener('openSetValueModal', handleOpenModal)
    return () => window.removeEventListener('openSetValueModal', handleOpenModal)
  }, [nodes])

  // Load designs on mount and restore last opened design
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const loadInitialData = async () => {
      setIsLoading(true)
      await loadDesigns()

      // Try to load last opened design
      const lastOpenedId = localStorage.getItem('lastOpenedSFCDesign')
      if (lastOpenedId) {
        const designId = parseInt(lastOpenedId)
        if (!isNaN(designId)) {
          await loadDesign(designId)
        }
      }
      setIsLoading(false)
    }

    loadInitialData()
  }, [])

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        if (currentDesignId) {
          saveCurrentDesign()
        }
      }
      // Ctrl+C to copy selected node
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedNodes = nodes.filter((node: any) => node.selected)
        if (selectedNodes.length === 1) {
          const node = selectedNodes[0]
          if (node.type !== 'start' && node.type !== 'end') {
            event.preventDefault()
            copyNode(node.id)
          }
        }
      }
      // Ctrl+V to paste copied node
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        if (copiedNode) {
          event.preventDefault()
          pasteNode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentDesignId, nodes, edges, copiedNode, saveCurrentDesign, copyNode, pasteNode])

  // Color mapping for node status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
  const getNodeColor = (node: any) => {
    const status = nodeStatus[node.id]?.status
    if (status === 'running') return '#fde047' // yellow
    if (status === 'finished') return '#22c55e' // green
    if (status === 'error') return '#ef4444' // red
    return node.data?.color || '#8b5cf6'
  }

  // Color mapping for edge status based on source node
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
  const getEdgeColor = (edge: any) => {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sourceStatus = nodeStatus[edge.source]?.status
    const targetStatus = nodeStatus[edge.target]?.status

    // If source is start/end node, use target node's status for coloring
    if (sourceNode?.type === 'start' || sourceNode?.type === 'end') {
      if (targetStatus === 'running') return '#fde047' // yellow
      if (targetStatus === 'finished') return '#22c55e' // green
      if (targetStatus === 'error') return '#ef4444' // red
      return '#94a3b8' // default gray
    }

    if (sourceStatus === 'running') return '#fde047' // yellow - source is running
    if (sourceStatus === 'finished') return '#22c55e' // green - source is finished
    if (sourceStatus === 'error') return '#ef4444' // red - source had error
    return '#94a3b8' // default gray
  }

  // Patch node colors for execution status
  const nodesWithStatus = nodes.map((node) => {
    if (node.type === 'setvalue') {
      return {
        ...node,
        data: {
          ...node.data,
          color: getNodeColor(node),
          elapsedTime: nodeStatus[node.id]?.elapsedTime
        }
      }
    }
    return node
  })

  // Patch edge colors for execution status
  const edgesWithStatus = edges.map((edge) => {
    const color = getEdgeColor(edge)
    return {
      ...edge,
      style: { strokeWidth: 2, stroke: color },
      animated: nodeStatus[edge.source]?.status === 'running'
    }
  })

  return (
    <div className="w-full h-full min-h-0 flex flex-col relative select-none overflow-hidden">
      {/* Compact toolbar */}
      <div className="border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-950 px-4 py-2 flex items-center gap-3">
        <Button onClick={() => setShowBrowseDesignsDialog(true)} size="sm" variant="outline">
          Open Design
        </Button>
        <Button onClick={() => setShowNewDesignDialog(true)} size="sm">
          New Design
        </Button>
        {currentDesignId && (
          <Button onClick={saveCurrentDesign} size="sm" variant="default">
            Save
          </Button>
        )}
        {currentDesignId && designs.find((d) => d.id === currentDesignId) && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {designs.find((d) => d.id === currentDesignId)?.name}
            </span>
          </div>
        )}
      </div>
      {isLoading ? (
        /* Loading skeleton */
        <div className="flex-1 min-h-0 flex relative overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col p-4 gap-4">
            <div className="flex gap-4">
              <Skeleton className="h-24 w-48 rounded-xl" />
              <Skeleton className="h-24 w-48 rounded-xl" />
              <Skeleton className="h-24 w-48 rounded-xl" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-32 w-64 rounded-xl" />
              <Skeleton className="h-32 w-64 rounded-xl" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-24 w-56 rounded-xl" />
              <Skeleton className="h-24 w-56 rounded-xl" />
              <Skeleton className="h-24 w-56 rounded-xl" />
            </div>
            <Skeleton className="h-20 w-full rounded-lg mt-auto" />
          </div>
          <div className="w-64 border-l border-gray-300 dark:border-gray-700 p-4 space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex relative overflow-hidden">
          {/* Main canvas area */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div
              className="flex-1 min-h-0"
              onContextMenu={handleContextMenu}
              onClick={() => {
                setContextMenu(null)
                setNodeContextMenu(null)
                setEdgeContextMenu(null)
              }}
            >
              <ReactFlow
                nodes={nodesWithStatus}
                edges={edgesWithStatus}
                nodeTypes={customNodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onMove={(_, newViewport) => setViewport(newViewport)}
                defaultViewport={viewport}
                defaultEdgeOptions={{
                  animated: true,
                  style: { strokeWidth: 2, stroke: '#94a3b8' },
                  markerEnd: { type: 'arrowclosed' as const }
                }}
                style={{ width: '100%', height: '100%' }}
                fitView
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <Controls
                  showZoom={true}
                  showFitView={true}
                  showInteractive={true}
                  position="bottom-left"
                />
                <MiniMap
                  nodeStrokeWidth={3}
                  zoomable
                  pannable
                  position="bottom-right"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #e5e7eb'
                  }}
                  className="dark:bg-gray-800/90 dark:border-gray-700"
                />
                <Panel
                  position="top-left"
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
                >
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <div className="font-semibold mb-1">Controls:</div>
                    <div>• Drag nodes to reposition</div>
                    <div>• Right-click for context menu</div>
                    <div>• Use controls to zoom/fit view</div>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
            {/* BottomBar for simulation control - at bottom of left column */}
            <BottomBar
              onStart={handleStart}
              onPause={handlePause}
              onStop={handleStop}
              onReset={handleReset}
              isRunning={isRunning}
              isPaused={isPaused}
              executionLogs={executionLogs}
              onClearLogs={() => setExecutionLogs([])}
            />
          </div>
          {/* Right pane with draggable nodes - with external collapse button */}
          <div className="relative flex">
            {/* Collapse/Expand Button - Vertical on left side */}
            <button
              onClick={() => setNodeTypesPanelCollapsed(!nodeTypesPanelCollapsed)}
              className="absolute top-1/2 -left-4 transform -translate-y-1/2 bg-gray-200 dark:bg-gray-800 rounded-full px-1 py-2 text-xs shadow border border-gray-300 dark:border-gray-700"
              aria-label={nodeTypesPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
              style={{ zIndex: 41 }}
            >
              <span className={`inline-block transition-transform rotate-90`}>
                {nodeTypesPanelCollapsed ? '▼' : '▲'}
              </span>
            </button>

            <div
              className={`border-l border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-950 transition-all duration-300 ${
                nodeTypesPanelCollapsed ? 'w-8 overflow-hidden' : 'w-64 overflow-y-auto'
              }`}
            >
              {!nodeTypesPanelCollapsed && (
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                    Node Types
                  </h3>
                  <div className="space-y-3">
                    {nodeTypesConfig
                      .filter((nodeType) => nodeType.type !== 'start' && nodeType.type !== 'end')
                      .map((nodeType) => (
                        <div
                          key={nodeType.type}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('application/reactflow', nodeType.label)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          className="cursor-grab active:cursor-grabbing border-2 rounded-lg p-3 hover:shadow-lg transition-all transform hover:scale-105"
                          style={{
                            borderColor: nodeType.color,
                            backgroundColor: nodeType.bgColor
                          }}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className="w-8 h-8 rounded"
                              style={{
                                backgroundColor: nodeType.color,
                                ...(nodeType.shape === 'diamond' && { transform: 'rotate(45deg)' }),
                                ...(nodeType.shape === 'circle' && { borderRadius: '50%' }),
                                ...(nodeType.shape === 'rounded' && { borderRadius: '8px' })
                              }}
                            />
                            <span
                              className="font-medium text-gray-900"
                              style={{ color: nodeType.color }}
                            >
                              {nodeType.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700">{nodeType.description}</p>
                        </div>
                      ))}
                  </div>
                  <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Tip:</strong> Drag and drop node types onto the canvas or right-click
                      for more options.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Canvas context menu */}
      {contextMenu && copiedNode && (
        <div
          className="fixed bg-white dark:bg-slate-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <button
            onClick={() => pasteNode()}
            className="block w-full text-left px-4 py-2 hover:bg-green-100 dark:hover:bg-green-900/30 text-sm text-green-600 dark:text-green-400"
          >
            Paste Node
          </button>
        </div>
      )}
      {nodeContextMenu && (
        <div
          className="fixed bg-white dark:bg-slate-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50"
          style={{ top: `${nodeContextMenu.y}px`, left: `${nodeContextMenu.x}px` }}
        >
          {(() => {
            const node = nodes.find((n) => n.id === nodeContextMenu.nodeId)
            const canCopy = node && node.type !== 'start' && node.type !== 'end'
            const canDelete = node && node.type !== 'start' && node.type !== 'end'
            return (
              <>
                {canCopy && (
                  <button
                    onClick={() => copyNode(nodeContextMenu.nodeId)}
                    className="block w-full text-left px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400"
                  >
                    Copy Node
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => deleteNode(nodeContextMenu.nodeId)}
                    className="block w-full text-left px-4 py-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-sm text-red-600 dark:text-red-400"
                  >
                    Delete Node
                  </button>
                )}
              </>
            )
          })()}
        </div>
      )}
      {edgeContextMenu && (
        <div
          className="fixed bg-white dark:bg-slate-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50"
          style={{ top: `${edgeContextMenu.y}px`, left: `${edgeContextMenu.x}px` }}
        >
          <button
            onClick={() => deleteEdge(edgeContextMenu.edgeId)}
            className="block w-full text-left px-4 py-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-sm text-red-600 dark:text-red-400"
          >
            Delete Connection
          </button>
        </div>
      )}
      {/* Set Value Modal */}
      <Dialog open={showSetValueModal} onOpenChange={setShowSetValueModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configure Set Value Node</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="type">Value Type</Label>
              <Select
                value={setValueForm.type}
                onValueChange={(value) => setSetValueForm({ ...setValueForm, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="float">Float</SelectItem>
                  <SelectItem value="bool">Boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* OPC Node */}
            <div className="space-y-2">
              <Label htmlFor="opcNode">OPC Node</Label>
              <OPCAutocomplete
                id="opcNode"
                value={setValueForm.opcNode}
                onChange={(value) => setSetValueForm({ ...setValueForm, opcNode: value })}
                placeholder="e.g., ns=2;s=Variable1"
              />
            </div>

            {/* Start Value */}
            <div className="space-y-2">
              <Label htmlFor="startValue">Start Value</Label>
              <Input
                id="startValue"
                placeholder={setValueForm.type === 'bool' ? 'true/false' : '0.0'}
                value={setValueForm.startValue}
                onChange={(e) => setSetValueForm({ ...setValueForm, startValue: e.target.value })}
              />
            </div>

            {/* End Value */}
            <div className="space-y-2">
              <Label htmlFor="endValue">End Value</Label>
              <Input
                id="endValue"
                placeholder={setValueForm.type === 'bool' ? 'true/false' : '100.0'}
                value={setValueForm.endValue}
                onChange={(e) => setSetValueForm({ ...setValueForm, endValue: e.target.value })}
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label htmlFor="time">Time (seconds)</Label>
              <Input
                id="time"
                type="number"
                placeholder="e.g., 10"
                value={setValueForm.time}
                onChange={(e) => setSetValueForm({ ...setValueForm, time: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleSetValueModalClose}>
              Cancel
            </Button>
            <Button onClick={handleSetValueSubmit}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* New Design Dialog */}
      <Dialog open={showNewDesignDialog} onOpenChange={setShowNewDesignDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New SFC Design</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="designName">Design Name</Label>
              <Input
                id="designName"
                placeholder="My SFC Design"
                value={newDesignName}
                onChange={(e) => setNewDesignName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designDescription">Description (optional)</Label>
              <Input
                id="designDescription"
                placeholder="Description of the design"
                value={newDesignDescription}
                onChange={(e) => setNewDesignDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDesignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createNewDesign}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Browse Designs Dialog */}
      <Dialog open={showBrowseDesignsDialog} onOpenChange={setShowBrowseDesignsDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[600px]">
          <DialogHeader>
            <DialogTitle>Open SFC Design</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {designs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No designs found. Create a new design to get started.</p>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Updated
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-950 divide-y divide-gray-200 dark:divide-gray-700">
                    {designs.map((design) => (
                      <tr key={design.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {design.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {design.description || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(design.updated_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right space-x-2">
                          <Button onClick={() => loadDesign(design.id)} size="sm" variant="default">
                            Open
                          </Button>
                          <Button
                            onClick={() => deleteDesign(design.id)}
                            size="sm"
                            variant="destructive"
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBrowseDesignsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Save Success Alert */}
      {showSaveSuccessDialog && (
        <div className="fixed top-4 right-4 z-50 w-96 animate-in slide-in-from-top-5">
          <Alert variant="success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Design saved successfully!</AlertDescription>
          </Alert>
        </div>
      )}{' '}
      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowErrorDialog(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete this design? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirmDialog(false)
                setDesignToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDesign}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Wrapper component that provides ReactFlow context
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function SFC() {
  // Ensure any ReactFlow attribution/watermark is removed at runtime. Some
  // builds inject the attribution after CSS is applied, so remove it via DOM
  // manipulation and observe for future additions.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const removeAttributions = (root: ParentNode | Document = document) => {
      const els = Array.from(root.querySelectorAll('.react-flow__attribution'))
      els.forEach((el) => el.remove())
    }

    // Remove existing attributions immediately
    removeAttributions(document)

    // Observe the whole document for elements being added under react-flow
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((node) => {
            try {
              if (node instanceof Element) {
                if (node.matches && node.matches('.react-flow__attribution')) {
                  node.remove()
                } else {
                  // If a container is added, scan its subtree
                  removeAttributions(node as ParentNode)
                }
              }
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
              // ignore
            }
          })
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return (
    <ReactFlowProvider>
      <SFCEditor />
    </ReactFlowProvider>
  )
}
