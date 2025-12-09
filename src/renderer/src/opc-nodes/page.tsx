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
import { Skeleton } from "@/components/ui/skeleton"
import { useState, useEffect, useMemo } from "react"

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
    const [isConfigLoading, setIsConfigLoading] = useState(true)
    const [isNodesLoading, setIsNodesLoading] = useState(true)
    const [sortKey, setSortKey] = useState<keyof OPCNode>("node_id")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
    const [pageSize, setPageSize] = useState(25)
    const [page, setPage] = useState(1)

    const backendPort = import.meta.env.VITE_BACKEND_PORT

    // Load saved configuration on component mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                setIsConfigLoading(true)
                const response = await fetch(`http://localhost:${backendPort}/opc/config`)
                const data = await response.json()

                if (data.success && data.config) {
                    setConfig(data.config)
                }
            } catch (error) {
                console.error("Failed to load configuration:", error)
            } finally {
                setIsConfigLoading(false)
            }
        }

        loadConfig()
    }, [backendPort])

    // Load discovered nodes on component mount
    useEffect(() => {
        const loadNodes = async () => {
            try {
                setIsNodesLoading(true)
                const response = await fetch(`http://localhost:${backendPort}/opc/nodes`)
                const data = await response.json()

                if (data.success && data.nodes) {
                    setNodes(data.nodes)
                    setPage(1)
                }
            } catch (error) {
                console.error("Failed to load nodes:", error)
            } finally {
                setIsNodesLoading(false)
            }
        }

        loadNodes()
    }, [backendPort])

    const sortedNodes = useMemo(() => {
        const copy = [...nodes]
        copy.sort((a, b) => {
            const valA = a[sortKey]
            const valB = b[sortKey]

            if (valA == null && valB == null) return 0
            if (valA == null) return 1
            if (valB == null) return -1

            if (typeof valA === "number" && typeof valB === "number") {
                return sortDir === "asc" ? valA - valB : valB - valA
            }

            return sortDir === "asc"
                ? String(valA).localeCompare(String(valB))
                : String(valB).localeCompare(String(valA))
        })
        return copy
    }, [nodes, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sortedNodes.length / pageSize))
    const currentPage = Math.min(page, totalPages)

    const pagedNodes = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return sortedNodes.slice(start, start + pageSize)
    }, [sortedNodes, currentPage, pageSize])

    const toggleSort = (key: keyof OPCNode) => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
        } else {
            setSortKey(key)
            setSortDir("asc")
        }
        setPage(1)
    }

    const goToPage = (newPage: number) => {
        const safePage = Math.min(Math.max(newPage, 1), totalPages)
        setPage(safePage)
    }

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
                setIsNodesLoading(true)
                const nodesResponse = await fetch(`http://localhost:${backendPort}/opc/nodes`)
                const nodesData = await nodesResponse.json()
                if (nodesData.success && nodesData.nodes) {
                    setNodes(nodesData.nodes)
                }
                setIsNodesLoading(false)
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
                                        disabled={isDiscovering || !config || isConfigLoading}
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

                                {isConfigLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-1/2" />
                                        <Skeleton className="h-5 w-1/3" />
                                    </div>
                                ) : (
                                    config && (
                                        <div className="mt-4 p-3 rounded bg-muted/50 text-sm">
                                            <p className="text-muted-foreground">
                                                <strong>Connected to:</strong> {config.url}
                                            </p>
                                            <p className="text-muted-foreground">
                                                <strong>Prefix:</strong> {config.prefix}
                                            </p>
                                        </div>
                                    )
                                )}
                            </CardContent>
                        </Card>

                        {(isNodesLoading || nodes.length > 0) && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between gap-3">
                                        <CardTitle>Discovered Nodes ({nodes.length})</CardTitle>
                                        <div className="flex items-center gap-3 text-sm">
                                            <label className="text-muted-foreground">Rows per page:</label>
                                            <select
                                                value={pageSize}
                                                onChange={(e) => {
                                                    setPageSize(Number(e.target.value))
                                                    setPage(1)
                                                }}
                                                className="rounded border px-2 py-1 text-sm bg-background"
                                            >
                                                {[10, 25, 50, 100].map((size) => (
                                                    <option key={size} value={size}>{size}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b">
                                                <tr>
                                                    {([
                                                        { key: "node_id", label: "Node ID", align: "left" },
                                                        { key: "browse_name", label: "Browse Name", align: "left" },
                                                        { key: "parent_id", label: "Parent ID", align: "left" },
                                                        { key: "data_type", label: "Data Type", align: "left" },
                                                        { key: "value_rank", label: "Value Rank", align: "center" },
                                                    ] as const).map((col) => (
                                                        <th
                                                            key={col.key}
                                                            className={`${col.align === "center" ? "text-center" : "text-left"} px-4 py-2 font-medium cursor-pointer select-none`}
                                                            onClick={() => toggleSort(col.key)}
                                                        >
                                                            <div className={`flex items-center gap-1 ${col.align === "center" ? "justify-center" : ""}`}>
                                                                <span>{col.label}</span>
                                                                {sortKey === col.key && (
                                                                    <span className="text-xs text-muted-foreground">{sortDir === "asc" ? "▲" : "▼"}</span>
                                                                )}
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {isNodesLoading
                                                    ? Array.from({ length: 5 }).map((_, idx) => (
                                                        <tr key={`skeleton-${idx}`} className="border-b">
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-40" /></td>
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-32" /></td>
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-32" /></td>
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-24" /></td>
                                                            <td className="px-4 py-2 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                                                        </tr>
                                                    ))
                                                    : pagedNodes.map((node, idx) => (
                                                        <tr key={`${node.node_id}-${idx}`} className="border-b hover:bg-muted/50">
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

                                    {!isNodesLoading && (
                                        <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                                            <span>
                                                Showing {(currentPage - 1) * pageSize + 1}–
                                                {Math.min(currentPage * pageSize, sortedNodes.length)} of {sortedNodes.length}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => goToPage(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                    className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
                                                >
                                                    Prev
                                                </button>
                                                <span className="px-2">
                                                    Page {currentPage} / {totalPages}
                                                </span>
                                                <button
                                                    onClick={() => goToPage(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                    className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
