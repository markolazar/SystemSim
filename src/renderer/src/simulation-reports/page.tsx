import { useEffect, useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/mode-toggle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

interface SimulationRun {
    id: string
    name?: string
    sfc_design_id?: number | null
    regex_pattern?: string | null
    started_at?: number | null
    finished_at?: number | null
    note?: string | null
}

interface SampleRow {
    run_id: string
    ts: number
    node_id: string
    short_node_id: string | null
    data_type: string | null
    value: string
    quality: number | null
    source_ts: number | null
}

interface SeriesPoint {
    ts: number
    value: number
}

export default function SimulationReportsPage() {
    const backendPort = import.meta.env.VITE_BACKEND_PORT
    const [runs, setRuns] = useState<SimulationRun[]>([])
    const [runsLoading, setRunsLoading] = useState(true)
    const [selectedRun, setSelectedRun] = useState<string | null>(null)
    const [limit, setLimit] = useState(2000)
    const [samples, setSamples] = useState<SampleRow[]>([])
    const [samplesLoading, setSamplesLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [chartOrder, setChartOrder] = useState<string[]>([])
    const [deleting, setDeleting] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    useEffect(() => {
        const loadRuns = async () => {
            try {
                setRunsLoading(true)
                const res = await fetch(`http://localhost:${backendPort}/simulation/runs`)
                const data = await res.json()
                if (data.success) {
                    setRuns(data.runs)
                    if (data.runs.length > 0) {
                        setSelectedRun(data.runs[0].id)
                    }
                } else {
                    setError(data.message || "Failed to load runs")
                }
            } catch (e) {
                setError(`Failed to load runs: ${e}`)
            } finally {
                setRunsLoading(false)
            }
        }
        loadRuns()
    }, [backendPort])

    useEffect(() => {
        const loadSamples = async () => {
            if (!selectedRun) return
            setSamplesLoading(true)
            setError(null)
            try {
                const res = await fetch(`http://localhost:${backendPort}/simulation/runs/${selectedRun}/samples?limit=${limit}`)
                const data = await res.json()
                if (data.success) {
                    setSamples(data.samples)
                } else {
                    setError(data.message || "Failed to load samples")
                    setSamples([])
                }
            } catch (e) {
                setError(`Failed to load samples: ${e}`)
                setSamples([])
            } finally {
                setSamplesLoading(false)
            }
        }
        loadSamples()
    }, [backendPort, selectedRun, limit])

    const nodeSeries = useMemo(() => {
        const map = new Map<string, SeriesPoint[]>()
        for (const row of samples) {
            const num = Number(row.value)
            if (!Number.isFinite(num)) continue
            if (!map.has(row.node_id)) map.set(row.node_id, [])
            map.get(row.node_id)!.push({ ts: row.ts, value: num })
        }
        // sort by ts and drop single-point series later
        for (const arr of map.values()) {
            arr.sort((a, b) => a.ts - b.ts)
        }
        return map
    }, [samples])

    const nodeShortIdMap = useMemo(() => {
        const map = new Map<string, string | null>()
        for (const row of samples) {
            if (!map.has(row.node_id)) {
                map.set(row.node_id, row.short_node_id)
            }
        }
        return map
    }, [samples])

    const seriesEntries = useMemo(() => {
        const entries: { nodeId: string; shortNodeId: string | null; data: SeriesPoint[] }[] = []
        for (const [nodeId, data] of nodeSeries.entries()) {
            if (data.length > 1) entries.push({ nodeId, shortNodeId: nodeShortIdMap.get(nodeId) || null, data })
        }
        return entries
    }, [nodeSeries, nodeShortIdMap])

    useEffect(() => {
        setChartOrder(seriesEntries.map(e => e.nodeId))
    }, [seriesEntries])

    const orderedEntries = useMemo(() => {
        return chartOrder.map(nodeId => seriesEntries.find(e => e.nodeId === nodeId)).filter(Boolean) as { nodeId: string; shortNodeId: string | null; data: SeriesPoint[] }[]
    }, [chartOrder, seriesEntries])

    const handleDragEnd = (event: any) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            const oldIndex = chartOrder.indexOf(active.id as string)
            const newIndex = chartOrder.indexOf(over.id as string)
            setChartOrder(arrayMove(chartOrder, oldIndex, newIndex))
        }
    }

    const ChartCard = ({ nodeId, shortNodeId, data, color, xDomain }: { nodeId: string; shortNodeId: string | null; data: SeriesPoint[]; color: string; xDomain?: [number, number] }) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: nodeId })
        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        }
        const displayTitle = shortNodeId || nodeId
        return (
            <Card ref={setNodeRef} style={style} className="w-full">
                <CardHeader className="flex flex-row items-center justify-between px-4 py-2">
                    <CardTitle className="text-sm font-semibold break-all">{displayTitle}</CardTitle>
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 0 }} syncId="simReports" syncMethod="value">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                dataKey="ts"
                                domain={xDomain || ["auto", "auto"]}
                                tickFormatter={(v) => new Date(v).toLocaleTimeString()}
                                minTickGap={24}
                                fontSize={12}
                            />
                            <YAxis fontSize={12} domain={["auto", "auto"]} />
                            <Tooltip
                                formatter={(val: number) => val}
                                labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                                trigger="hover"
                                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                dot={false}
                                isAnimationActive={false}
                                name="value"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        )
    }

    const xDomain = useMemo(() => {
        if (seriesEntries.length === 0) return undefined
        let min = Number.POSITIVE_INFINITY
        let max = Number.NEGATIVE_INFINITY
        for (const entry of seriesEntries) {
            if (entry.data.length) {
                min = Math.min(min, entry.data[0].ts)
                max = Math.max(max, entry.data[entry.data.length - 1].ts)
            }
        }
        return [min, max] as [number, number]
    }, [seriesEntries])

    const colorPalette = ["#2563eb", "#db2777", "#16a34a", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#14b8a6"]

    const selectedRunMeta = runs.find((r) => r.id === selectedRun)

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
                                    <BreadcrumbLink href="#">Simulation</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Reports</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="ml-auto px-3">
                        <ModeToggle />
                    </div>
                </header>

                <main className="flex-1 min-h-0 p-4 overflow-auto">
                    <div className="w-full space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold">Simulation Reports</h1>
                                <p className="text-sm text-muted-foreground">Explore tracked node changes for completed runs.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Select
                                    value={selectedRun || undefined}
                                    onValueChange={(val) => setSelectedRun(val)}
                                    disabled={runsLoading || runs.length === 0}
                                >
                                    <SelectTrigger className="w-56">
                                        <SelectValue placeholder={runsLoading ? "Loading runs..." : "Select run"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {runs.map((run) => (
                                            <SelectItem key={run.id} value={run.id}>
                                                {run.name || run.id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">Limit</span>
                                    <Input
                                        type="number"
                                        className="w-24 h-9"
                                        value={limit}
                                        onChange={(e) => setLimit(Math.max(100, Number(e.target.value) || 100))}
                                        min={100}
                                        step={100}
                                    />
                                </div>
                                <Button variant="outline" onClick={() => selectedRun && setSelectedRun(selectedRun)} disabled={samplesLoading}>
                                    Refresh
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setDeleteDialogOpen(true)}
                                    disabled={!selectedRun}
                                >
                                    Delete Run
                                </Button>
                            </div>
                        </div>

                        {selectedRunMeta && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                                <div className="p-3 rounded border bg-muted/40">
                                    <div className="font-medium text-foreground">Run</div>
                                    <div>{selectedRunMeta.name || selectedRunMeta.id}</div>
                                </div>
                                <div className="p-3 rounded border bg-muted/40">
                                    <div className="font-medium text-foreground">Started</div>
                                    <div>{selectedRunMeta.started_at ? new Date(selectedRunMeta.started_at).toLocaleString() : "-"}</div>
                                </div>
                                <div className="p-3 rounded border bg-muted/40">
                                    <div className="font-medium text-foreground">Finished</div>
                                    <div>{selectedRunMeta.finished_at ? new Date(selectedRunMeta.finished_at).toLocaleString() : "-"}</div>
                                </div>
                            </div>
                        )}

                        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

                        {samplesLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, idx) => (
                                    <Card key={idx} className="w-full">
                                        <CardHeader>
                                            <CardTitle>
                                                <Skeleton className="h-5 w-40" />
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Skeleton className="h-56 w-full" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : seriesEntries.length === 0 ? (
                            <div className="text-sm text-muted-foreground">No numeric series with more than one point. Try a different run or increase the limit.</div>
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={chartOrder} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-0">
                                        {orderedEntries.map(({ nodeId, shortNodeId, data }) => (
                                            <ChartCard
                                                key={nodeId}
                                                nodeId={nodeId}
                                                shortNodeId={shortNodeId}
                                                data={data}
                                                color={colorPalette[seriesEntries.findIndex(e => e.nodeId === nodeId) % colorPalette.length]}
                                                xDomain={xDomain}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>
                </main>
            </SidebarInset>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Simulation Run</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this simulation run? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                if (!selectedRun) return
                                setDeleting(true)
                                try {
                                    const res = await fetch(`http://localhost:${backendPort}/simulation/runs/${selectedRun}`, { method: "DELETE" })
                                    const data = await res.json()
                                    if (data.success) {
                                        setRuns(runs.filter(r => r.id !== selectedRun))
                                        const nextRun = runs.find(r => r.id !== selectedRun)
                                        setSelectedRun(nextRun?.id || null)
                                        setDeleteDialogOpen(false)
                                    } else {
                                        setError(data.message || "Failed to delete run")
                                    }
                                } catch (e) {
                                    setError(`Failed to delete: ${e}`)
                                } finally {
                                    setDeleting(false)
                                }
                            }}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SidebarProvider>
    )
}
