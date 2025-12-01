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
import SFC from "@/SFC/page"
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card"
import React, { useState, useRef, useEffect } from "react"

function ResizableCard({ children, initialHeight = 320, className = "" }: {
    children: React.ReactNode
    initialHeight?: number
    className?: string
}) {
    const [height, setHeight] = useState<number | null>(initialHeight)
    const ref = useRef<HTMLDivElement | null>(null)
    const startY = useRef(0)
    const startH = useRef(0)

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const delta = e.clientY - startY.current
            const newH = Math.max(100, startH.current + delta)
            setHeight(newH)
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
    }, [])

    const onMouseDown = (e: React.MouseEvent) => {
        startY.current = e.clientY
        startH.current = (ref.current?.getBoundingClientRect().height) || (height || 0)

        const onMove = (ev: MouseEvent) => {
            const delta = ev.clientY - startY.current
            const newH = Math.max(100, startH.current + delta)
            setHeight(newH)
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    return (
        <Card ref={ref as any} className={`relative overflow-hidden ${className}`} style={height ? { height: `${height}px` } : undefined}>
            {children}
            <div
                onMouseDown={onMouseDown}
                className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize bg-transparent"
                aria-hidden
            />
        </Card>
    )
}

export default function Page() {
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
                                    <BreadcrumbLink href="#">
                                        Building Your Application
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="ml-auto px-3">
                        <ModeToggle />
                    </div>
                </header>

                {/* Full layout matching wireframe: 4-column desktop grid (1/2/1), stacks on small screens */}
                <main className="flex-1 min-h-0 p-4">
                    <div className="h-full w-full grid grid-cols-1 md:grid-cols-4 gap-4 min-h-0">
                        {/* Column 1: OPC Server */}
                        <div className="space-y-4 col-span-1 min-h-0">
                            <ResizableCard initialHeight={320} className="min-h-0">
                                <CardHeader>
                                    <CardTitle>OPC Server</CardTitle>
                                </CardHeader>
                                <CardContent className="overflow-auto h-full">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <input className="w-full rounded border px-2 py-1" placeholder="OPC Server URL/IP" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input className="rounded border px-2 py-1" placeholder="Username" />
                                            <input className="rounded border px-2 py-1" placeholder="Password" type="password" />
                                        </div>
                                        <div className="h-40 overflow-auto border rounded p-2">Nodes list...</div>
                                        <div className="flex gap-2">
                                            <button className="rounded bg-primary px-3 py-1 text-primary-foreground">Connect</button>
                                            <button className="rounded border px-3 py-1">Load Selected Nodes</button>
                                            <button className="rounded border px-3 py-1">Refresh Nodes</button>
                                        </div>
                                    </div>
                                </CardContent>
                            </ResizableCard>

                            <ResizableCard initialHeight={220} className="min-h-0">
                                <CardHeader>
                                    <CardTitle>Simulation Control</CardTitle>
                                </CardHeader>
                                <CardContent className="overflow-auto h-full">
                                    <div className="flex gap-2">
                                        <button className="rounded border px-3 py-1">Start All</button>
                                        <button className="rounded border px-3 py-1">Stop All</button>
                                        <button className="rounded border px-3 py-1">Reset</button>
                                    </div>
                                    <div className="mt-3">
                                        <div className="text-sm text-muted-foreground">Live OPC Node Values</div>
                                        <div className="mt-2 border rounded p-2 h-24 overflow-auto">Node / Value / Status</div>
                                    </div>
                                </CardContent>
                            </ResizableCard>
                        </div>

                        {/* Column 2-3: SFC Designer area (spans 2 columns) */}
                        <div className="col-span-1 md:col-span-2 min-h-0 space-y-4">
                            <ResizableCard initialHeight={480} className="min-h-0">
                                <CardHeader>
                                    <CardTitle>SFC Designer</CardTitle>
                                </CardHeader>
                                <CardContent className="min-h-[360px] p-0 overflow-hidden h-full">
                                    <div className="flex h-full min-h-0">
                                        {/* Left tool palette */}
                                        <div className="w-16 p-3 border-r flex flex-col items-center gap-3">
                                            <button className="w-10 h-10 rounded border">■</button>
                                            <button className="w-10 h-10 rounded border">◇</button>
                                            <button className="w-10 h-10 rounded border">→</button>
                                            <button className="w-10 h-10 rounded border">○</button>
                                        </div>

                                        {/* ReactFlow canvas */}
                                        <div className="flex-1 min-h-0">
                                            <SFC />
                                        </div>
                                    </div>
                                </CardContent>
                            </ResizableCard>
                        </div>

                        {/* Column 4: Properties panel */}
                        <div className="col-span-1 min-h-0">
                            <ResizableCard initialHeight={220} className="min-h-0">
                                <CardHeader>
                                    <CardTitle>Properties</CardTitle>
                                </CardHeader>
                                <CardContent className="overflow-auto h-full">
                                    <div className="space-y-2">
                                        <input className="w-full rounded border px-2 py-1" placeholder="Label" />
                                        <input className="w-full rounded border px-2 py-1" placeholder="Linked OPC Node" />
                                    </div>
                                </CardContent>
                            </ResizableCard>
                        </div>

                        {/* Second row: Report / Historian spans center + right columns */}
                        <div className="col-span-1 md:col-span-1 min-h-0">
                            {/* keep left column space for alignment - optionally empty or add controls */}
                        </div>
                        <div className="col-span-1 md:col-span-3 min-h-0">
                            <ResizableCard initialHeight={300}>
                                <CardHeader>
                                    <CardTitle>Report / Historian</CardTitle>
                                </CardHeader>
                                <CardContent className="overflow-auto h-full">
                                    <div className="grid grid-cols-3 gap-2 items-center">
                                        <div className="col-span-2">
                                            <input className="w-full rounded border px-2 py-1" placeholder="Node Selection" />
                                        </div>
                                        <div className="text-right">Start : End</div>
                                    </div>
                                    <div className="mt-4 border rounded overflow-auto h-36">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left">
                                                    <th className="p-2">Timestamp</th>
                                                    <th className="p-2">Node</th>
                                                    <th className="p-2">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="p-2">12:02 PM</td>
                                                    <td className="p-2">Node</td>
                                                    <td className="p-2">Value</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </ResizableCard>
                        </div>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
