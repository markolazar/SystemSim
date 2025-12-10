import * as React from "react"
import { GalleryVerticalEnd } from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const handleNavigate = (page: string) => {
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
                        {[
                            { title: "OPC Server", page: "opc-server" },
                            { title: "OPC Nodes", page: "opc-nodes" },
                            { title: "SFC Designer", page: "dashboard" },
                            { title: "Simulation Control", page: "#" },
                            { title: "Report / Historian", page: "#" },
                        ].map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild>
                                    <button
                                        onClick={() => handleNavigate(item.page)}
                                        className="font-medium w-full text-left"
                                    >
                                        {item.title}
                                    </button>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    )
}
