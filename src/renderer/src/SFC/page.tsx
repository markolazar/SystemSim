import { useState, useCallback, useEffect } from 'react';
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
        <div className="w-full h-full min-h-0">
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
    );
}