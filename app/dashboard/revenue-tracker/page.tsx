"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { OverviewCards } from "@/components/dashboard/overview-cards"
import { RevenueTable } from "@/components/dashboard/revenue-table"
import {
  Breadcrumb,
  BreadcrumbItem,
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
import { formatAedAmount } from "@/lib/currency"

import { revenueRows } from "./data"

function formatCurrency(value: number) {
  return formatAedAmount(value.toLocaleString("en-US"))
}

export default function RevenueTrackerPage() {
  const totalBookings = revenueRows.reduce((sum, row) => sum + row.bookings, 0)
  const totalCollected = revenueRows.reduce((sum, row) => sum + row.collected, 0)
  const totalPending = revenueRows.reduce((sum, row) => sum + row.pending, 0)
  const totalNet = revenueRows.reduce((sum, row) => sum + row.net, 0)

  const overviewItems = [
    {
      title: "Total Bookings",
      value: String(totalBookings),
      change: "Live",
      summary: "Bookings across monthly revenue records",
      trend: "up" as const,
    },
    {
      title: "Collected Revenue",
      value: formatCurrency(totalCollected),
      change: "Live",
      summary: "Total successfully collected amount",
      trend: totalCollected > 0 ? ("up" as const) : ("down" as const),
    },
    {
      title: "Pending Receivables",
      value: formatCurrency(totalPending),
      change: "Live",
      summary: "Outstanding receivables pending settlement",
      trend: totalPending > 0 ? ("up" as const) : ("down" as const),
    },
    {
      title: "Net Revenue",
      value: formatCurrency(totalNet),
      change: "Live",
      summary: "Net revenue after pending deductions",
      trend: totalNet > 0 ? ("up" as const) : ("down" as const),
    },
  ]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b backdrop-blur md:static md:h-16 md:bg-transparent md:backdrop-blur-none">
          <div className="flex min-w-0 items-center gap-2 px-3 sm:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 hidden data-[orientation=vertical]:h-4 md:block"
            />
            <h1 className="text-sm font-semibold md:hidden">Revenue Tracker</h1>
            <Breadcrumb className="hidden md:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Revenue Tracker</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem className="hidden sm:block">
                  <BreadcrumbPage>Overview</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
          <OverviewCards items={overviewItems} mobileLabel="Revenue Overview" />
          <RevenueTable
            rows={revenueRows}
            description="Monthly booking and payment collection performance"
          />
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
