import { useState, useCallback, useEffect } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge, useReactFlow, ReactFlowProvider, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { OPCAutocomplete } from '@/components/opc-autocomplete';

const nodeTypesConfig = [
    { type: 'start', label: 'Start', color: '#10b981', bgColor: '#d1fae5', description: 'Starting point of the flow', shape: 'circle' },
    { type: 'condition', label: 'Condition', color: '#f59e0b', bgColor: '#fef3c7', description: 'Decision or branching logic', shape: 'diamond' },
    { type: 'setvalue', label: 'Set Value', color: '#8b5cf6', bgColor: '#ede9fe', description: 'Assign or modify values', shape: 'rectangle' },
    { type: 'wait', label: 'Wait', color: '#06b6d4', bgColor: '#cffafe', description: 'Pause or delay execution', shape: 'circle' },
    { type: 'end', label: 'End', color: '#ef4444', bgColor: '#fee2e2', description: 'End point of the flow', shape: 'circle' },
];

// Custom node components with different shapes
const StartNode = ({ data }: any) => (
    <div style={{
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
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        padding: '8px',
    }}>
        {data.label}
        <Handle type="source" position={Position.Right} style={{ background: data.color }} />
    </div>
);

const ConditionNode = ({ data }: any) => (
    <div style={{
        position: 'relative',
        width: '110px',
        height: '110px',
    }}>
        <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            transform: 'rotate(45deg)',
            border: `3px solid ${data.color}`,
            backgroundColor: data.bgColor,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }} />
        <div style={{
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
            padding: '8px',
        }}>
            {data.label}
        </div>
        <Handle type="target" position={Position.Left} style={{ background: data.color, left: '-2px' }} />
        <Handle type="source" position={Position.Right} style={{ background: data.color, right: '-2px' }} />
    </div>
);

const SetValueNode = ({ data }: any) => {
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const event = new CustomEvent('openSetValueModal', { detail: { nodeId: data.nodeId } });
        window.dispatchEvent(event);
    };

    // Display OPC node if configured, otherwise show default label
    const displayText = (data as any).setValueConfig?.opcNode || data.label;

    return (
        <div
            style={{
                padding: '12px 18px',
                border: `3px solid ${data.color}`,
                backgroundColor: data.bgColor,
                minWidth: '110px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '13px',
                color: '#1f2937',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                borderRadius: '4px',
                cursor: 'pointer',
                wordWrap: 'break-word',
                wordBreak: 'break-word',
            }}
            onDoubleClick={handleDoubleClick}
        >
            <Handle type="target" position={Position.Left} style={{ background: data.color }} />
            {displayText}
            <Handle type="source" position={Position.Right} style={{ background: data.color }} />
        </div>
    );
};

const WaitNode = ({ data }: any) => (
    <div style={{
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        border: `3px solid ${data.color}`,
        backgroundColor: data.bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '600',
        fontSize: '14px',
        color: '#1f2937',
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        padding: '8px',
    }}>
        <Handle type="target" position={Position.Left} style={{ background: data.color }} />
        {data.label}
        <Handle type="source" position={Position.Right} style={{ background: data.color }} />
    </div>
);

const EndNode = ({ data }: any) => (
    <div style={{
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
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        padding: '8px',
    }}>
        <Handle type="target" position={Position.Left} style={{ background: data.color }} />
        {data.label}
    </div>
);

const customNodeTypes = {
    start: StartNode,
    condition: ConditionNode,
    setvalue: SetValueNode,
    wait: WaitNode,
    end: EndNode,
};

const initialNodes = [
    { id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', color: '#10b981', bgColor: '#d1fae5', nodeId: 'n1' } },
    { id: 'n2', type: 'setvalue', position: { x: 250, y: 0 }, data: { label: 'Set Value', color: '#8b5cf6', bgColor: '#ede9fe', nodeId: 'n2' } },
];
const initialEdges = [{ id: 'n1-n2', source: 'n1', target: 'n2', animated: true, style: { strokeWidth: 2 }, markerEnd: { type: 'arrowclosed' as const } }];

// Main editor component that uses ReactFlow
function SFCEditor() {
    const reactFlowInstance = useReactFlow();
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
    const [nextNodeId, setNextNodeId] = useState(3);
    const [copiedNode, setCopiedNode] = useState<any>(null);

    // Set Value modal state
    const [showSetValueModal, setShowSetValueModal] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [setValueForm, setSetValueForm] = useState({
        type: 'float',
        opcNode: '',
        startValue: '',
        endValue: '',
        time: '',
    });

    const onNodesChange = useCallback(
        (changes) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
        [],
    );
    const onConnect = useCallback(
        (params) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
        [],
    );

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
    };

    const onNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
        event.preventDefault();
        setNodeContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
        setContextMenu(null);
    }, []);

    const deleteNode = (nodeId: string) => {
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
        setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        setNodeContextMenu(null);
    };

    const copyNode = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (node && node.type !== 'start' && node.type !== 'end') {
            setCopiedNode(node);
        }
        setNodeContextMenu(null);
    };

    const pasteNode = () => {
        if (!copiedNode || !contextMenu) return;

        const position = reactFlowInstance.screenToFlowPosition({
            x: contextMenu.x,
            y: contextMenu.y,
        });

        const nodeId = `n${nextNodeId}`;
        const newNode = {
            ...copiedNode,
            id: nodeId,
            position,
            data: { ...copiedNode.data, nodeId },
        };
        setNodes([...nodes, newNode]);
        setNextNodeId(nextNodeId + 1);
        setContextMenu(null);
    };

    const handleSetValueModalClose = () => {
        setShowSetValueModal(false);
        setSelectedNodeId(null);
        setSetValueForm({
            type: 'float',
            opcNode: '',
            startValue: '',
            endValue: '',
            time: '',
        });
    };

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
                                setValueConfig: { ...setValueForm },
                            },
                        };
                    }
                    return node;
                })
            );
        }
        handleSetValueModalClose();
    };

    const addBlock = (blockType: string, position?: { x: number; y: number }) => {
        const typeConfig = nodeTypesConfig.find(t => t.label === blockType);
        const nodeType = typeConfig?.type || 'step';
        const color = typeConfig?.color || '#10b981';
        const bgColor = typeConfig?.bgColor || '#d1fae5';

        const nodeId = `n${nextNodeId}`;
        const newNode = {
            id: nodeId,
            type: nodeType,
            position: position || (contextMenu ? { x: contextMenu.x - 200, y: contextMenu.y - 100 } : { x: 0, y: 0 }),
            data: { label: `${blockType} ${nextNodeId}`, color, bgColor, nodeId },
        };
        setNodes([...nodes, newNode]);
        setNextNodeId(nextNodeId + 1);
        setContextMenu(null);
    };

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (!type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            addBlock(type, position);
        },
        [reactFlowInstance, nextNodeId, addBlock]
    );

    const closeContextMenu = () => {
        setContextMenu(null);
        setNodeContextMenu(null);
    };

    // Close context menu on click outside
    useEffect(() => {
        if (!contextMenu && !nodeContextMenu) return;

        const handleClick = () => closeContextMenu();
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu, nodeContextMenu]);

    // Handle Set Value modal open event
    useEffect(() => {
        const handleOpenModal = (event: Event) => {
            const customEvent = event as CustomEvent;
            const nodeId = customEvent.detail.nodeId;
            setSelectedNodeId(nodeId);

            // Load existing values from the node if they exist
            const node = nodes.find(n => n.id === nodeId);
            if (node?.data && (node.data as any).setValueConfig) {
                setSetValueForm((node.data as any).setValueConfig);
            } else {
                setSetValueForm({
                    type: 'float',
                    opcNode: '',
                    startValue: '',
                    endValue: '',
                    time: '',
                });
            }

            setShowSetValueModal(true);
        };

        window.addEventListener('openSetValueModal', handleOpenModal);
        return () => window.removeEventListener('openSetValueModal', handleOpenModal);
    }, [nodes]);

    return (
        <div className="w-full h-full min-h-0 flex relative">
            {/* Main canvas area */}
            <div className="flex-1 min-h-0" onContextMenu={handleContextMenu}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={customNodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onNodeContextMenu={onNodeContextMenu}
                    fitView
                    defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2, stroke: '#94a3b8' }, markerEnd: { type: 'arrowclosed' as const } }}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>

            {/* Right pane with draggable nodes */}
            <div className="w-64 border-l border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-950 p-4 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Node Types</h3>
                <div className="space-y-3">
                    {nodeTypesConfig.map((nodeType) => (
                        <div
                            key={nodeType.type}
                            draggable
                            onDragStart={(event) => {
                                event.dataTransfer.setData('application/reactflow', nodeType.label);
                                event.dataTransfer.effectAllowed = 'move';
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
                                <span className="font-medium text-gray-900" style={{ color: nodeType.color }}>{nodeType.label}</span>
                            </div>
                            <p className="text-xs text-gray-700">{nodeType.description}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                        <strong>Tip:</strong> Drag and drop node types onto the canvas or right-click for more options.
                    </p>
                </div>
            </div>

            {/* Canvas context menu */}
            {contextMenu && copiedNode && (
                <div
                    className="fixed bg-white dark:bg-slate-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={pasteNode}
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
                        const node = nodes.find((n) => n.id === nodeContextMenu.nodeId);
                        const canCopy = node && node.type !== 'start' && node.type !== 'end';
                        return canCopy ? (
                            <button
                                onClick={() => copyNode(nodeContextMenu.nodeId)}
                                className="block w-full text-left px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400"
                            >
                                Copy Node
                            </button>
                        ) : null;
                    })()}
                    <button
                        onClick={() => deleteNode(nodeContextMenu.nodeId)}
                        className="block w-full text-left px-4 py-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-sm text-red-600 dark:text-red-400"
                    >
                        Delete Node
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
                            <Select value={setValueForm.type} onValueChange={(value) => setSetValueForm({ ...setValueForm, type: value })}>
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
                        <Button onClick={handleSetValueSubmit}>
                            Save Configuration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Wrapper component that provides ReactFlow context
export default function SFC() {
    // Ensure any ReactFlow attribution/watermark is removed at runtime. Some
    // builds inject the attribution after CSS is applied, so remove it via DOM
    // manipulation and observe for future additions.
    useEffect(() => {
        const removeAttributions = (root: ParentNode | Document = document) => {
            const els = Array.from(root.querySelectorAll('.react-flow__attribution'));
            els.forEach((el) => el.remove());
        };

        // Remove existing attributions immediately
        removeAttributions(document);

        // Observe the whole document for elements being added under react-flow
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length) {
                    m.addedNodes.forEach((node) => {
                        try {
                            if (node instanceof Element) {
                                if (node.matches && node.matches('.react-flow__attribution')) {
                                    node.remove();
                                } else {
                                    // If a container is added, scan its subtree
                                    removeAttributions(node as ParentNode);
                                }
                            }
                        } catch (e) {
                            // ignore
                        }
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    return (
        <ReactFlowProvider>
            <SFCEditor />
        </ReactFlowProvider>
    );
}