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
import { useState } from "react"

export default function OPCServerPage() {
    const [opcServerUrl, setOpcServerUrl] = useState("")
    const [opcServerPrefix, setOpcServerPrefix] = useState("")

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
                                        Configuration
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>OPC Server</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="ml-auto px-3">
                        <ModeToggle />
                    </div>
                </header>

                <main className="flex-1 min-h-0 p-4">
                    <div className="max-w-2xl">
                        <Card>
                            <CardHeader>
                                <CardTitle>OPC Server Configuration</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="opc-url" className="block text-sm font-medium">
                                        OPC Server URL
                                    </label>
                                    <input
                                        id="opc-url"
                                        type="text"
                                        value={opcServerUrl}
                                        onChange={(e) => setOpcServerUrl(e.target.value)}
                                        placeholder="e.g., opc.tcp://localhost:4840"
                                        className="w-full rounded border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="opc-prefix" className="block text-sm font-medium">
                                        OPC Server Prefix
                                    </label>
                                    <input
                                        id="opc-prefix"
                                        type="text"
                                        value={opcServerPrefix}
                                        onChange={(e) => setOpcServerPrefix(e.target.value)}
                                        placeholder="e.g., ns=2;s=MyApp"
                                        className="w-full rounded border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div className="pt-4 flex gap-2">
                                    <button className="rounded bg-primary px-4 py-2 text-primary-foreground text-sm font-medium hover:opacity-90">
                                        Connect
                                    </button>
                                    <button className="rounded border px-4 py-2 text-sm font-medium hover:bg-accent">
                                        Test Connection
                                    </button>
                                    <button className="rounded bg-green-600 px-4 py-2 text-white text-sm font-medium hover:opacity-90">
                                        Save
                                    </button>
                                </div>

                                {opcServerUrl && opcServerPrefix && (
                                    <div className="mt-6 p-3 rounded bg-muted/50">
                                        <p className="text-sm text-muted-foreground">
                                            <strong>Current Configuration:</strong>
                                        </p>
                                        <p className="text-sm mt-2">URL: {opcServerUrl}</p>
                                        <p className="text-sm">Prefix: {opcServerPrefix}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
