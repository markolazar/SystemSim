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
import { useState, useEffect, useMemo } from "react"

interface OPCNode {
    id: string
    node_id: string
    shortnodeid: string | null
    browse_name: string | null
    data_type: string | null
}

export default function SimulationConfigPage() {
    const [regexPattern, setRegexPattern] = useState("")
    const [allNodes, setAllNodes] = useState<OPCNode[]>([])
    const [matchingNodes, setMatchingNodes] = useState<OPCNode[]>([])
    const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
    const [regexError, setRegexError] = useState<string | null>(null)
    const [pageSize, setPageSize] = useState(10)
    const [page, setPage] = useState(1)
    const [sortKey, setSortKey] = useState<"shortnodeid" | "browse_name" | "node_id" | "data_type">("shortnodeid")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

    const backendPort = import.meta.env.VITE_BACKEND_PORT

    // Load available OPC nodes on component mount
    useEffect(() => {
        const loadNodes = async () => {
            try {
                const response = await fetch(`http://localhost:${backendPort}/opc/nodes`)
                const data = await response.json()

                if (data.success && data.nodes) {
                    const nodes = data.nodes.map((node: any) => ({
                        id: node.node_id,
                        node_id: node.node_id,
                        shortnodeid: node.shortnodeid,
                        browse_name: node.browse_name,
                        data_type: node.data_type ?? null
                    }))
                    setAllNodes(nodes)
                } else {
                    console.error("Failed to load OPC nodes")
                }
            } catch (error) {
                console.error("Error loading OPC nodes:", error)
            }
        }

        loadNodes()
    }, [backendPort])

    // Load saved simulation config on component mount
    useEffect(() => {
        const loadSimulationConfig = async () => {
            try {
                const response = await fetch(`http://localhost:${backendPort}/simulation/config`)
                const data = await response.json()

                if (data.success) {
                    // Set regex pattern
                    if (data.regex_pattern) {
                        setRegexPattern(data.regex_pattern)
                    }

                    // Set tracked nodes
                    if (data.tracked_nodes && data.tracked_nodes.length > 0) {
                        setSelectedNodes(new Set(data.tracked_nodes))

                        // Filter allNodes to show only tracked ones as matching
                        const trackedNodeIds = new Set(data.tracked_nodes)
                        const trackedNodesList = allNodes.filter(node => trackedNodeIds.has(node.id))
                        setMatchingNodes(trackedNodesList)
                        setPage(1)
                    }
                }
            } catch (error) {
                console.error("Error loading simulation config:", error)
            }
        }

        if (allNodes.length > 0) {
            loadSimulationConfig()
        }
    }, [allNodes, backendPort])

    const handleSearch = () => {
        setRegexError(null)

        if (!regexPattern.trim()) {
            setMatchingNodes([])
            setSelectedNodes(new Set())
            return
        }

        try {
            const regex = new RegExp(regexPattern, "i") // Case-insensitive
            const matching = allNodes.filter(node => {
                // Match against shortnodeid if available, otherwise node_id
                const searchText = node.shortnodeid || node.node_id || ""
                return regex.test(searchText)
            })
            setMatchingNodes(matching)
            // Auto-select all matching nodes
            setSelectedNodes(new Set(matching.map(n => n.id)))
            setPage(1) // Reset to first page
        } catch (error) {
            setRegexError(`Invalid regex: ${error instanceof Error ? error.message : "Unknown error"}`)
            setMatchingNodes([])
            setSelectedNodes(new Set())
        }
    }

    // Sorting and pagination
    const sortedNodes = useMemo(() => {
        const copy = [...matchingNodes]
        copy.sort((a, b) => {
            const valA = a[sortKey]
            const valB = b[sortKey]

            if (valA == null && valB == null) return 0
            if (valA == null) return 1
            if (valB == null) return -1

            return sortDir === "asc"
                ? String(valA).localeCompare(String(valB))
                : String(valB).localeCompare(String(valA))
        })
        return copy
    }, [matchingNodes, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sortedNodes.length / pageSize))
    const currentPage = Math.min(page, totalPages)

    const pagedNodes = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return sortedNodes.slice(start, start + pageSize)
    }, [sortedNodes, currentPage, pageSize])

    const toggleSort = (key: "shortnodeid" | "browse_name" | "node_id" | "data_type") => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
        } else {
            setSortKey(key)
            setSortDir("asc")
        }
        setPage(1)
    }

    const handleSave = async () => {
        const config = {
            regex_pattern: regexPattern,
            tracked_nodes: Array.from(selectedNodes)
        }

        try {
            const response = await fetch(`http://localhost:${backendPort}/simulation/config`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(config)
            })

            const data = await response.json()
            if (data.success) {
                setToast({ message: "Simulation config saved successfully!", type: "success" })
                setTimeout(() => setToast(null), 3000)
            } else {
                setToast({ message: `Failed to save config: ${data.message || "Unknown error"}`, type: "error" })
                setTimeout(() => setToast(null), 3000)
            }
        } catch (error) {
            console.error("Error saving config:", error)
            setToast({ message: "Error saving configuration", type: "error" })
            setTimeout(() => setToast(null), 3000)
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                {/* Toast Notification */}
                {toast && (
                    <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white z-50 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
                        {toast.message}
                    </div>
                )}

                <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink href="#">Simulation</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Config</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <ModeToggle />
                </header>

                <main className="flex-1 overflow-auto">
                    <div className="p-4 md:p-8 max-w-7xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-2xl md:text-3xl font-bold mb-2">Simulation Configuration</h1>
                            <p className="text-sm md:text-base text-muted-foreground">Select OPC nodes to track during simulation execution</p>
                        </div>

                        <div className="grid gap-6">
                            {/* Regex Pattern Input */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Filter by Regex Pattern</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Regex Pattern (case-insensitive)</label>
                                        <div className="flex gap-2 flex-col sm:flex-row">
                                            <Input
                                                placeholder="e.g., ValueEgu|temperature"
                                                value={regexPattern}
                                                onChange={(e) => setRegexPattern(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        handleSearch()
                                                    }
                                                }}
                                                className="font-mono flex-1"
                                            />
                                            <Button
                                                onClick={handleSearch}
                                                size="sm"
                                                className="w-full sm:w-auto"
                                            >
                                                🔍 Search
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Use standard regex patterns to filter nodes. Example: "ValueEgu" will match nodes with ValueEgu in their name.
                                        </p>
                                        {regexError && (
                                            <p className="text-xs text-red-500 mt-1">{regexError}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Matching Nodes Table */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between gap-3">
                                        <CardTitle>Tracked Nodes ({matchingNodes.length})</CardTitle>
                                        {matchingNodes.length > 0 && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-muted-foreground">Rows per page:</span>
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
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {matchingNodes.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            {regexPattern ? "No nodes match the pattern" : "Enter a regex pattern to see matching nodes"}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="border rounded-lg overflow-x-auto w-full">
                                                <Table className="min-w-full">
                                                    <TableHeader>
                                                        <TableRow className="bg-muted">
                                                            <TableHead
                                                                className="text-xs md:text-sm cursor-pointer select-none"
                                                                onClick={() => toggleSort("shortnodeid")}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    <span>Short Node ID</span>
                                                                    {sortKey === "shortnodeid" && (
                                                                        <span className="text-[10px] text-muted-foreground">{sortDir === "asc" ? "▲" : "▼"}</span>
                                                                    )}
                                                                </div>
                                                            </TableHead>
                                                            <TableHead
                                                                className="text-xs md:text-sm cursor-pointer select-none"
                                                                onClick={() => toggleSort("browse_name")}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    <span>Browse Name</span>
                                                                    {sortKey === "browse_name" && (
                                                                        <span className="text-[10px] text-muted-foreground">{sortDir === "asc" ? "▲" : "▼"}</span>
                                                                    )}
                                                                </div>
                                                            </TableHead>
                                                            <TableHead
                                                                className="text-xs md:text-sm cursor-pointer select-none"
                                                                onClick={() => toggleSort("node_id")}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    <span>Full Node ID</span>
                                                                    {sortKey === "node_id" && (
                                                                        <span className="text-[10px] text-muted-foreground">{sortDir === "asc" ? "▲" : "▼"}</span>
                                                                    )}
                                                                </div>
                                                            </TableHead>
                                                            <TableHead
                                                                className="text-xs md:text-sm cursor-pointer select-none"
                                                                onClick={() => toggleSort("data_type")}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    <span>Data Type</span>
                                                                    {sortKey === "data_type" && (
                                                                        <span className="text-[10px] text-muted-foreground">{sortDir === "asc" ? "▲" : "▼"}</span>
                                                                    )}
                                                                </div>
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {pagedNodes.map((node) => (
                                                            <TableRow key={node.id}>
                                                                <TableCell className="font-mono text-xs md:text-sm break-words">{node.shortnodeid}</TableCell>
                                                                <TableCell className="text-xs md:text-sm text-muted-foreground">{node.browse_name || "-"}</TableCell>
                                                                <TableCell className="font-mono text-xs md:text-xs break-all max-w-xs">{node.node_id}</TableCell>
                                                                <TableCell className="text-xs md:text-sm text-muted-foreground">{node.data_type || "-"}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {/* Pagination Controls */}
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4 text-sm text-muted-foreground">
                                                <span>
                                                    Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedNodes.length)} of {sortedNodes.length}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setPage(Math.max(1, currentPage - 1))}
                                                        disabled={currentPage === 1}
                                                    >
                                                        Prev
                                                    </Button>
                                                    <span className="px-2">Page {currentPage} / {totalPages}</span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                                                        disabled={currentPage === totalPages}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Save Button */}
                            <div className="flex justify-end gap-2">
                                <Button
                                    onClick={handleSave}
                                    className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                                    disabled={selectedNodes.size === 0}
                                >
                                    💾 Save Configuration
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
