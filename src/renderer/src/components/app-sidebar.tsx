import * as React from "react"
import { GalleryVerticalEnd, Settings } from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from "@/components/ui/sidebar"


export function AppSidebar({ isRunning = false, ...props }: React.ComponentProps<typeof Sidebar> & { isRunning?: boolean }) {
    const [configOpen, setConfigOpen] = React.useState(true)
    const [simulationOpen, setSimulationOpen] = React.useState(true)

    const handleNavigate = (page: string) => {
        if (isRunning) return // Prevent navigation when execution is running
        const event = new CustomEvent('navigate', { detail: { page } })
        window.dispatchEvent(event)
    }

    return (
        <Sidebar {...props}>
            <SidebarHeader className="select-none">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <a href="#">
                                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                    <GalleryVerticalEnd className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-medium">SystemSim</span>
                                    <span className="">v1.0.0</span>
                                </div>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => setConfigOpen(!configOpen)}
                                className="font-medium"
                                disabled={isRunning}
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Configuration
                                <span className={`ml-auto text-lg transition-transform ${configOpen ? 'rotate-90' : ''}`}>›</span>
                            </SidebarMenuButton>
                            {configOpen && (
                                <SidebarMenuSub>
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild>
                                            <button
                                                onClick={() => handleNavigate("opc-server")}
                                                className={`w-full text-left ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={isRunning}
                                            >
                                                <span className="mr-2">🖥️</span>
                                                OPC Server
                                            </button>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild>
                                            <button
                                                onClick={() => handleNavigate("opc-nodes")}
                                                className={`w-full text-left ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={isRunning}
                                            >
                                                <span className="mr-2">🔍</span>
                                                OPC Nodes
                                            </button>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                </SidebarMenuSub>
                            )}
                        </SidebarMenuItem>

                        <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                                <button
                                    onClick={() => handleNavigate("dashboard")}
                                    className={`font-medium w-full text-left ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={isRunning}
                                >
                                    <span className="mr-2">🎨</span>
                                    SFC Designer
                                </button>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => setSimulationOpen(!simulationOpen)}
                                className="font-medium"
                                disabled={isRunning}
                            >
                                <span className="mr-2">⚙️</span>
                                Simulation
                                <span className={`ml-auto text-lg transition-transform ${simulationOpen ? 'rotate-90' : ''}`}>›</span>
                            </SidebarMenuButton>
                            {simulationOpen && (
                                <SidebarMenuSub>
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild>
                                            <button
                                                onClick={() => handleNavigate("simulation-config")}
                                                className={`w-full text-left ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={isRunning}
                                            >
                                                <span className="mr-2">🔧</span>
                                                Config
                                            </button>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild>
                                            <button
                                                onClick={() => handleNavigate("simulation-reports")}
                                                className={`w-full text-left ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={isRunning}
                                            >
                                                <span className="mr-2">📊</span>
                                                Reports
                                            </button>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                </SidebarMenuSub>
                            )}
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    )
}