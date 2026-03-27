"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { CalendarCheck2 } from "lucide-react"

import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const data = {
  navMain: [
    {
      title: "Bookings",
      url: "/dashboard/bookings",
      icon: CalendarCheck2,
      description: "Collector queue and samples",
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUser()

  const sidebarUser = React.useMemo(
    () => ({
      name:
        user?.fullName?.trim() ||
        user?.username ||
        user?.firstName ||
        "Signed In User",
      email:
        user?.primaryEmailAddress?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress ||
        "",
      avatar: user?.imageUrl,
    }),
    [user]
  )

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/70 p-3 md:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="mobile-touch-target h-12 rounded-xl md:h-10 md:rounded-md"
            >
              <Link href="/dashboard/bookings">
                <Image
                  src="/icon.png"
                  alt="DarDoc"
                  width={32}
                  height={32}
                  className="size-9 rounded-xl md:size-8"
                  priority
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">DarDoc</span>
                  <span className="truncate text-[11px] text-sidebar-foreground/70 md:text-xs">
                    Lab Bookings
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
