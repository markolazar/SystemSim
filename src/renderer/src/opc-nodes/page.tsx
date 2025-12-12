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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect, useMemo } from "react"

interface OPCNode {
    node_id: string
    browse_name: string
    parent_id: string | null
    data_type: string | null
    value_rank: number | null
    discovered_at: string
    short_node_id?: string
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
    const [children, setChildren] = useState<{ node_id: string; browse_name: string }[]>([])
    const [isChildrenLoading, setIsChildrenLoading] = useState(true)
    // Removed child selection state
    const [childrenSearch, setChildrenSearch] = useState("")
    const [childrenSortKey, setChildrenSortKey] = useState<"node_id" | "browse_name" | "last_discovered" | "duration_ms">("last_discovered")
    const [childrenSortDir, setChildrenSortDir] = useState<"asc" | "desc">("desc")
    const [childrenPageSize, setChildrenPageSize] = useState(10)
    const [childrenPage, setChildrenPage] = useState(1)
    const [sortKey, setSortKey] = useState<keyof OPCNode>("node_id")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
    const [pageSize, setPageSize] = useState(25)
    const [page, setPage] = useState(1)
    const [childListHeight, setChildListHeight] = useState(384) // Default 384px (max-h-96)
    const [discoveryLog, setDiscoveryLog] = useState<Record<string, { last_discovered: number; duration_ms: number }>>({})
    const [discoveringNodeId, setDiscoveringNodeId] = useState<string | null>(null)

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

    // Load first-level child nodes for selection when config is available
    useEffect(() => {
        const loadChildren = async () => {
            if (!config) {
                setChildren([])
                return
            }
            try {
                setIsChildrenLoading(true)
                const response = await fetch(`http://localhost:${backendPort}/opc/children`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: config.url, prefix: config.prefix }),
                })
                const data = await response.json()
                if (data.success && data.children) {
                    setChildren(data.children)

                    // Load saved selections, or default to all children
                    try {
                        const savedResponse = await fetch(`http://localhost:${backendPort}/opc/selected-nodes`)
                        const savedData = await savedResponse.json()
                        if (savedData.success && savedData.selected_nodes && savedData.selected_nodes.length > 0) {
                            setSelectedChildIds(savedData.selected_nodes)
                        } else {
                            setSelectedChildIds(data.children.map((c: any) => c.node_id))
                        }
                    } catch (error) {
                        // If loading saved selections fails, default to all selected
                        setSelectedChildIds(data.children.map((c: any) => c.node_id))
                    }
                }
            } catch (error) {
                console.error("Failed to load children:", error)
            } finally {
                setIsChildrenLoading(false)
            }
        }

        loadChildren()
    }, [backendPort, config])

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

    // Load discovery log map
    useEffect(() => {
        const loadLog = async () => {
            try {
                const res = await fetch(`http://localhost:${backendPort}/opc/discovery-log`)
                const data = await res.json()
                if (data.success && data.log) {
                    setDiscoveryLog(data.log)
                }
            } catch { }
        }
        loadLog()
    }, [backendPort, isDiscovering])

    // Compute short node IDs (with prefix removed)
    const nodesWithShortId = useMemo(() => {
        if (!config) return nodes
        return nodes.map(node => ({
            ...node,
            short_node_id: node.node_id.replace(config.prefix + '.', '')
        }))
    }, [nodes, config])

    const sortedNodes = useMemo(() => {
        const copy = [...nodesWithShortId]
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
    }, [nodesWithShortId, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sortedNodes.length / pageSize))
    const currentPage = Math.min(page, totalPages)

    const pagedNodes = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return sortedNodes.slice(start, start + pageSize)
    }, [sortedNodes, currentPage, pageSize])

    // Sorting and filtering for children
    const filteredChildren = useMemo(() => {
        return children.filter(child =>
            child.node_id.toLowerCase().includes(childrenSearch.toLowerCase()) ||
            (child.browse_name && child.browse_name.toLowerCase().includes(childrenSearch.toLowerCase()))
        )
    }, [children, childrenSearch])

    const sortedChildren = useMemo(() => {
        const copy = [...filteredChildren]
        copy.sort((a, b) => {
            if (childrenSortKey === "last_discovered") {
                const timeA = discoveryLog[a.node_id]?.last_discovered ?? 0
                const timeB = discoveryLog[b.node_id]?.last_discovered ?? 0
                return childrenSortDir === "asc" ? timeA - timeB : timeB - timeA
            }
            if (childrenSortKey === "duration_ms") {
                const durationA = discoveryLog[a.node_id]?.duration_ms ?? 0
                const durationB = discoveryLog[b.node_id]?.duration_ms ?? 0
                return childrenSortDir === "asc" ? durationA - durationB : durationB - durationA
            }

            const valA = a[childrenSortKey]
            const valB = b[childrenSortKey]

            if (valA == null && valB == null) return 0
            if (valA == null) return 1
            if (valB == null) return -1

            return childrenSortDir === "asc"
                ? String(valA).localeCompare(String(valB))
                : String(valB).localeCompare(String(valA))
        })
        return copy
    }, [filteredChildren, childrenSortKey, childrenSortDir, discoveryLog])

    const totalChildrenPages = Math.max(1, Math.ceil(sortedChildren.length / childrenPageSize))
    const currentChildrenPage = Math.min(childrenPage, totalChildrenPages)

    const pagedChildren = useMemo(() => {
        const start = (currentChildrenPage - 1) * childrenPageSize
        return sortedChildren.slice(start, start + childrenPageSize)
    }, [sortedChildren, currentChildrenPage, childrenPageSize])

    const goToChildrenPage = (newPage: number) => {
        const safePage = Math.min(Math.max(newPage, 1), totalChildrenPages)
        setChildrenPage(safePage)
    }

    const toggleChildrenSort = (key: "node_id" | "browse_name" | "last_discovered" | "duration_ms") => {
        if (childrenSortKey === key) {
            setChildrenSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
        } else {
            setChildrenSortKey(key)
            setChildrenSortDir("asc")
        }
    }

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

    // Removed selection handlers

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
                    selected_nodes: children.map(c => c.node_id),
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
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">Select child nodes to discover</p>
                                    {isChildrenLoading ? (
                                        <div className="space-y-2">
                                            {Array.from({ length: 4 }).map((_, idx) => (
                                                <Skeleton key={idx} className="h-4 w-64" />
                                            ))}
                                        </div>
                                    ) : children.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No child nodes found under this prefix.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Search Box */}
                                            <Input
                                                placeholder="Search by node ID or name..."
                                                value={childrenSearch}
                                                onChange={(e) => setChildrenSearch(e.target.value)}
                                                className="h-9 text-sm"
                                            />

                                            <div className="flex items-center justify-between gap-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Rows per page:</span>
                                                    <select
                                                        value={childrenPageSize}
                                                        onChange={(e) => {
                                                            setChildrenPageSize(Number(e.target.value))
                                                            setChildrenPage(1)
                                                        }}
                                                        className="rounded border px-2 py-1 text-sm bg-background"
                                                    >
                                                        {[10, 25, 50, 100].map((size) => (
                                                            <option key={size} value={size}>{size}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <span className="text-muted-foreground">
                                                    Showing {(currentChildrenPage - 1) * childrenPageSize + 1}–{Math.min(currentChildrenPage * childrenPageSize, sortedChildren.length)} of {sortedChildren.length}
                                                </span>
                                            </div>

                                            {/* Children DataGrid */}
                                            <div className="border rounded-lg overflow-x-auto">
                                                <Table className="min-w-full">
                                                    <TableHeader>
                                                        <TableRow className="bg-muted">
                                                            <TableHead
                                                                className="cursor-pointer hover:bg-muted/80"
                                                                onClick={() => toggleChildrenSort("node_id")}
                                                            >
                                                                Node ID {childrenSortKey === "node_id" && (childrenSortDir === "asc" ? "↑" : "↓")}
                                                            </TableHead>
                                                            <TableHead
                                                                className="cursor-pointer hover:bg-muted/80"
                                                                onClick={() => toggleChildrenSort("browse_name")}
                                                            >
                                                                Browse Name {childrenSortKey === "browse_name" && (childrenSortDir === "asc" ? "↑" : "↓")}
                                                            </TableHead>
                                                            <TableHead
                                                                className="text-left cursor-pointer hover:bg-muted/80"
                                                                onClick={() => toggleChildrenSort("last_discovered")}
                                                            >
                                                                Last Discovered {childrenSortKey === "last_discovered" && (childrenSortDir === "asc" ? "↑" : "↓")}
                                                            </TableHead>
                                                            <TableHead
                                                                className="text-right cursor-pointer hover:bg-muted/80"
                                                                onClick={() => toggleChildrenSort("duration_ms")}
                                                            >
                                                                Duration (sec) {childrenSortKey === "duration_ms" && (childrenSortDir === "asc" ? "↑" : "↓")}
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {pagedChildren.map((child) => (
                                                            <TableRow key={child.node_id} className="hover:bg-muted/50">

                                                                <TableCell className="font-mono text-xs">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="break-all">{child.node_id}</span>
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={async () => {
                                                                                    if (!config) return
                                                                                    setDiscoveringNodeId(child.node_id)
                                                                                    setDiscoveryResult(null)
                                                                                    try {
                                                                                        const res = await fetch(`http://localhost:${backendPort}/opc/discover-under`, {
                                                                                            method: "POST",
                                                                                            headers: { "Content-Type": "application/json" },
                                                                                            body: JSON.stringify({ url: config.url, prefix: config.prefix, parent_id: child.node_id }),
                                                                                        })
                                                                                        const data = await res.json()
                                                                                        setDiscoveryResult(data)
                                                                                        // Refresh nodes table
                                                                                        setIsNodesLoading(true)
                                                                                        const nodesResponse = await fetch(`http://localhost:${backendPort}/opc/nodes`)
                                                                                        const nodesData = await nodesResponse.json()
                                                                                        if (nodesData.success && nodesData.nodes) {
                                                                                            setNodes(nodesData.nodes)
                                                                                        }
                                                                                        setIsNodesLoading(false)
                                                                                        // Refresh discovery log
                                                                                        try {
                                                                                            const logRes = await fetch(`http://localhost:${backendPort}/opc/discovery-log`)
                                                                                            const logData = await logRes.json()
                                                                                            if (logData.success && logData.log) setDiscoveryLog(logData.log)
                                                                                        } catch { }
                                                                                    } catch (e) {
                                                                                        setDiscoveryResult({ success: false, message: `Error: ${e}` })
                                                                                    } finally {
                                                                                        setDiscoveringNodeId(null)
                                                                                    }
                                                                                }}
                                                                            >
                                                                                Discover
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="destructive"
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        const res = await fetch(`http://localhost:${backendPort}/opc/delete-under?parent_id=${encodeURIComponent(child.node_id)}`, { method: "POST" })
                                                                                        const data = await res.json()
                                                                                        setDiscoveryResult(data)
                                                                                        // Clear discovery log entry for this child immediately
                                                                                        setDiscoveryLog(prev => {
                                                                                            const updated = { ...prev }
                                                                                            delete updated[child.node_id]
                                                                                            return updated
                                                                                        })
                                                                                        // Refresh nodes table
                                                                                        setIsNodesLoading(true)
                                                                                        const nodesResponse = await fetch(`http://localhost:${backendPort}/opc/nodes`)
                                                                                        const nodesData = await nodesResponse.json()
                                                                                        if (nodesData.success && nodesData.nodes) {
                                                                                            setNodes(nodesData.nodes)
                                                                                        }
                                                                                        setIsNodesLoading(false)
                                                                                        // Refresh discovery log
                                                                                        try {
                                                                                            const logRes = await fetch(`http://localhost:${backendPort}/opc/discovery-log`)
                                                                                            const logData = await logRes.json()
                                                                                            if (logData.success && logData.log) setDiscoveryLog(logData.log)
                                                                                        } catch { }
                                                                                    } catch (e) {
                                                                                        setDiscoveryResult({ success: false, message: `Error: ${e}` })
                                                                                    }
                                                                                }}
                                                                            >
                                                                                Delete
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">{child.browse_name}</TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">
                                                                    {discoveryLog[child.node_id]?.last_discovered
                                                                        ? new Date(discoveryLog[child.node_id].last_discovered).toLocaleString()
                                                                        : "-"}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground text-right">
                                                                    {discoveryLog[child.node_id]?.duration_ms
                                                                        ? (discoveryLog[child.node_id].duration_ms / 1000).toFixed(2)
                                                                        : "-"}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => goToChildrenPage(currentChildrenPage - 1)}
                                                        disabled={currentChildrenPage === 1}
                                                        className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
                                                    >
                                                        Prev
                                                    </button>
                                                    <span className="px-2">
                                                        Page {currentChildrenPage} / {totalChildrenPages}
                                                    </span>
                                                    <button
                                                        onClick={() => goToChildrenPage(currentChildrenPage + 1)}
                                                        disabled={currentChildrenPage === totalChildrenPages}
                                                        className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Selection Controls removed */}
                                        </div>
                                    )}
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
                                        {discoveryResult && (
                                            <div className="text-sm text-muted-foreground">
                                                <span>Last discovery: </span>
                                                <span>{new Date().toLocaleString()}</span>
                                                {"duration_ms" in (discoveryResult as any) && (
                                                    <span className="ml-2">Duration: {(discoveryResult as any).duration_ms} ms</span>
                                                )}
                                            </div>
                                        )}
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
                                                        { key: "short_node_id", label: "Short Node ID", align: "left" },
                                                        { key: "browse_name", label: "Browse Name", align: "left" },
                                                        { key: "node_id", label: "Full Node ID", align: "left" },
                                                        { key: "parent_id", label: "Parent ID", align: "left" },
                                                        { key: "data_type", label: "Data Type", align: "left" },
                                                        { key: "value_rank", label: "Value Rank", align: "center" },
                                                    ] as const).map((col) => (
                                                        <th
                                                            key={col.key}
                                                            className={`${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"} px-4 py-2 font-medium cursor-pointer select-none`}
                                                            onClick={() => toggleSort(col.key as any)}
                                                        >
                                                            <div className={`flex items-center gap-1 ${col.align === "center" ? "justify-center" : col.align === "right" ? "justify-end" : ""}`}>
                                                                <span>{col.label}</span>
                                                                {sortKey === (col.key as any) && (
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
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-48" /></td>
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-32" /></td>
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-40" /></td>
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-32" /></td>
                                                            <td className="px-4 py-2"><Skeleton className="h-4 w-24" /></td>
                                                            <td className="px-4 py-2 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                                                        </tr>
                                                    ))
                                                    : pagedNodes.map((node, idx) => (
                                                        <tr key={`${node.node_id}-${idx}`} className="border-b hover:bg-muted/50">
                                                            <td className="px-4 py-2 font-mono text-xs break-all">
                                                                {node.short_node_id || node.node_id}
                                                            </td>
                                                            <td className="px-4 py-2">{node.browse_name}</td>
                                                            <td className="px-4 py-2 font-mono text-xs break-all text-muted-foreground">
                                                                {node.node_id}
                                                            </td>
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

            {/* Discovering Dialog */}
            <Dialog open={discoveringNodeId !== null} onOpenChange={() => { }}>
                <DialogContent className="sm:max-w-md [&_button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Discovering Nodes</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center gap-4 py-6">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">
                                Discovering child nodes for:
                            </p>
                            <p className="text-sm font-mono font-medium break-all mt-2">
                                {discoveringNodeId || ""}
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </SidebarProvider>
    )
}
