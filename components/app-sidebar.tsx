"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  BarChart3,
  CalendarCheck2,
  Settings2,
} from "lucide-react"

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
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
  user: {
    name: "BoomHealth Ops",
    email: "ops@boomhealth.ae",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Bookings",
      url: "/dashboard/bookings",
      icon: CalendarCheck2,
    },
    {
      title: "Revenue Tracker",
      url: "/dashboard/revenue-tracker",
      icon: BarChart3,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings2,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard/bookings">
                <Image
                  src="/favicon-32x32.png"
                  alt="DarDoc"
                  width={32}
                  height={32}
                  className="size-8 rounded-lg"
                  priority
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">BoomHealth</span>
                  <span className="truncate text-xs">Lab Bookings</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
