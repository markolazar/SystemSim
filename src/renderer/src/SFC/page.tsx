import { useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
    { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Node 2' } },
];
const initialEdges = [{ id: 'n1-n2', source: 'n1', target: 'n2' }];

export default function SFC() {
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [nextNodeId, setNextNodeId] = useState(3);
    const contextMenuRef = useRef<HTMLDivElement>(null);

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

    const addBlock = (blockType: string) => {
        const newNode = {
            id: `n${nextNodeId}`,
            position: contextMenu ? { x: contextMenu.x - 200, y: contextMenu.y - 100 } : { x: 0, y: 0 },
            data: { label: `${blockType} ${nextNodeId}` },
        };
        setNodes([...nodes, newNode]);
        setNextNodeId(nextNodeId + 1);
        setContextMenu(null);
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    // Close context menu on click outside
    useEffect(() => {
        if (!contextMenu) return;
        
        const handleClick = () => closeContextMenu();
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu]);

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
        <div className="w-full h-full min-h-0 flex flex-col relative" onContextMenu={handleContextMenu}>
            <div className="flex-1 min-h-0">
                <div className="h-full w-full min-h-0">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        fitView
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            </div>

            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    className="fixed bg-white dark:bg-slate-950 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => addBlock('Step')}
                        className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-900 text-sm border-b border-gray-200 dark:border-gray-700"
                    >
                        Add Step Block
                    </button>
                    <button
                        onClick={() => addBlock('Transition')}
                        className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-900 text-sm border-b border-gray-200 dark:border-gray-700"
                    >
                        Add Transition Block
                    </button>
                    <button
                        onClick={() => addBlock('Action')}
                        className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-900 text-sm border-b border-gray-200 dark:border-gray-700"
                    >
                        Add Action Block
                    </button>
                    <button
                        onClick={() => addBlock('Placeholder')}
                        className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-900 text-sm"
                    >
                        Add Placeholder
                    </button>
                </div>
            )}
        </div>
    );
}