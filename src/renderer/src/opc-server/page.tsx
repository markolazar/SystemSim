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

export default function OPCServerPage() {
    const [opcServerUrl, setOpcServerUrl] = useState("")
    const [opcServerPrefix, setOpcServerPrefix] = useState("")
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)

    const backendPort = import.meta.env.VITE_BACKEND_PORT

    // Load saved configuration on component mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await fetch(`http://localhost:${backendPort}/opc/config`)
                const data = await response.json()
                
                if (data.success && data.config) {
                    setOpcServerUrl(data.config.url)
                    setOpcServerPrefix(data.config.prefix)
                }
            } catch (error) {
                console.error("Failed to load saved configuration:", error)
            }
        }
        
        loadConfig()
    }, [backendPort])

    const handleTestConnection = async () => {
        if (!opcServerUrl || !opcServerPrefix) {
            setTestResult({
                success: false,
                message: "Please enter both OPC Server URL and Prefix"
            })
            return
        }

        setIsLoading(true)
        setTestResult(null)

        try {
            const response = await fetch(`http://localhost:${backendPort}/opc/test-connection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: opcServerUrl,
                    prefix: opcServerPrefix,
                }),
            })

            const data = await response.json()
            setTestResult(data)
        } catch (error) {
            setTestResult({
                success: false,
                message: `Error connecting to backend: ${error}`
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        if (!opcServerUrl || !opcServerPrefix) {
            setSaveResult({
                success: false,
                message: "Please enter both OPC Server URL and Prefix"
            })
            return
        }

        try {
            const response = await fetch(`http://localhost:${backendPort}/opc/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: opcServerUrl,
                    prefix: opcServerPrefix,
                }),
            })

            const data = await response.json()
            setSaveResult(data)
            
            // Clear message after 3 seconds
            setTimeout(() => setSaveResult(null), 3000)
        } catch (error) {
            setSaveResult({
                success: false,
                message: `Error saving configuration: ${error}`
            })
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
                                    <button 
                                        onClick={handleTestConnection}
                                        disabled={isLoading}
                                        className="rounded border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        className="rounded bg-green-600 px-4 py-2 text-white text-sm font-medium hover:opacity-90"
                                    >
                                        Save
                                    </button>
                                </div>

                                {saveResult && (
                                    <div className={`mt-4 p-3 rounded ${saveResult.success ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                                        <p className="text-sm font-medium">
                                            {saveResult.success ? '✓ Saved' : '✗ Error'}
                                        </p>
                                        <p className="text-sm mt-1">{saveResult.message}</p>
                                    </div>
                                )}

                                {testResult && (
                                    <div className={`mt-4 p-3 rounded ${testResult.success ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                                        <p className="text-sm font-medium">
                                            {testResult.success ? '✓ Success' : '✗ Error'}
                                        </p>
                                        <p className="text-sm mt-1">{testResult.message}</p>
                                    </div>
                                )}

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
