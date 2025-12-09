import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { useState, useEffect } from "react"

interface OPCNode {
    node_id: string
    browse_name: string
    parent_id: string | null
    data_type: string | null
    value_rank: number | null
    discovered_at: string
}

export default function OPCNodesPage() {
    const [nodes, setNodes] = useState<OPCNode[]>([])
    const [isDiscovering, setIsDiscovering] = useState(false)
    const [discoveryResult, setDiscoveryResult] = useState<{
        success: boolean
        message: string
    } | null>(null)
    const [config, setConfig] = useState<{ url: string; prefix: string } | null>(null)

    const backendPort = import.meta.env.VITE_BACKEND_PORT

    // Load saved configuration on component mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await fetch(`http://localhost:${backendPort}/opc/config`)
                const data = await response.json()

                if (data.success && data.config) {
                    setConfig(data.config)
                }
            } catch (error) {
                console.error("Failed to load configuration:", error)
            }
        }

        loadConfig()
    }, [backendPort])

    // Load discovered nodes on component mount
    useEffect(() => {
        const loadNodes = async () => {
            try {
                const response = await fetch(`http://localhost:${backendPort}/opc/nodes`)
                const data = await response.json()

                if (data.success && data.nodes) {
                    setNodes(data.nodes)
                }
            } catch (error) {
                console.error("Failed to load nodes:", error)
            }
        }

        loadNodes()
    }, [backendPort])

    const handleDiscoverNodes = async () => {
        if (!config) {
            setDiscoveryResult({
                success: false,
                message: "No OPC server configuration found. Please configure the server first.",
            })
            return
        }

        setIsDiscovering(true)
        setDiscoveryResult(null)

        try {
            const response = await fetch(`http://localhost:${backendPort}/opc/discover-nodes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url: config.url,
                    prefix: config.prefix,
                }),
            })

            const data = await response.json()
            setDiscoveryResult(data)

            if (data.success) {
                // Reload nodes
                const nodesResponse = await fetch(`http://localhost:${backendPort}/opc/nodes`)
                const nodesData = await nodesResponse.json()
                if (nodesData.success && nodesData.nodes) {
                    setNodes(nodesData.nodes)
                }
            }
        } catch (error) {
            setDiscoveryResult({
                success: false,
                message: `Error discovering nodes: ${error}`,
            })
        } finally {
            setIsDiscovering(false)
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex flex-col h-screen">
                <header className="flex h-16 shrink-0 items-center gap-2 border-b">
                    <div className="flex items-center gap-2 px-3">
                        <SidebarTrigger />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="#">Configuration</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>OPC Nodes</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="ml-auto px-3">
                        <ModeToggle />
                    </div>
                </header>

                <main className="flex-1 min-h-0 p-4 overflow-auto">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Node Discovery</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDiscoverNodes}
                                        disabled={isDiscovering || !config}
                                        className="rounded bg-primary px-4 py-2 text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isDiscovering ? "Discovering..." : "Discover Nodes"}
                                    </button>
                                </div>

                                {discoveryResult && (
                                    <div
                                        className={`mt-4 p-3 rounded ${discoveryResult.success
                                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                            }`}
                                    >
                                        <p className="text-sm font-medium">
                                            {discoveryResult.success ? "✓ Success" : "✗ Error"}
                                        </p>
                                        <p className="text-sm mt-1">{discoveryResult.message}</p>
                                    </div>
                                )}

                                {config && (
                                    <div className="mt-4 p-3 rounded bg-muted/50 text-sm">
                                        <p className="text-muted-foreground">
                                            <strong>Connected to:</strong> {config.url}
                                        </p>
                                        <p className="text-muted-foreground">
                                            <strong>Prefix:</strong> {config.prefix}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {nodes.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Discovered Nodes ({nodes.length})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b">
                                                <tr>
                                                    <th className="text-left px-4 py-2 font-medium">Node ID</th>
                                                    <th className="text-left px-4 py-2 font-medium">Browse Name</th>
                                                    <th className="text-left px-4 py-2 font-medium">Parent ID</th>
                                                    <th className="text-left px-4 py-2 font-medium">Data Type</th>
                                                    <th className="text-center px-4 py-2 font-medium">Value Rank</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {nodes.map((node, idx) => (
                                                    <tr key={idx} className="border-b hover:bg-muted/50">
                                                        <td className="px-4 py-2 font-mono text-xs break-all">
                                                            {node.node_id}
                                                        </td>
                                                        <td className="px-4 py-2">{node.browse_name}</td>
                                                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                                                            {node.parent_id || "-"}
                                                        </td>
                                                        <td className="px-4 py-2 text-xs text-muted-foreground">
                                                            {node.data_type || "-"}
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            {node.value_rank !== null ? node.value_rank : "-"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
