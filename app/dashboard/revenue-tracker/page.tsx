import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatAedAmount } from "@/lib/currency"

import { revenueRows } from "./data"

const formatCurrency = (value: number) =>
  formatAedAmount(value.toLocaleString("en-US"))

export default function RevenueTrackerPage() {
  const totalBookings = revenueRows.reduce((sum, row) => sum + row.bookings, 0)
  const totalCollected = revenueRows.reduce((sum, row) => sum + row.collected, 0)
  const totalPending = revenueRows.reduce((sum, row) => sum + row.pending, 0)
  const totalNet = revenueRows.reduce((sum, row) => sum + row.net, 0)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 px-3 sm:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
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

        <div className="flex flex-1 flex-col gap-4 px-4 pb-20 lg:px-6 lg:pb-6">
          <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2 xl:grid-cols-4">
            <Card className="shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription>Total Bookings</CardDescription>
                <CardTitle className="text-xl sm:text-2xl">{totalBookings}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription>Collected Revenue</CardDescription>
                <CardTitle className="text-xl sm:text-2xl">
                  {formatCurrency(totalCollected)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription>Pending Receivables</CardDescription>
                <CardTitle className="text-xl sm:text-2xl">
                  {formatCurrency(totalPending)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription>Net Revenue</CardDescription>
                <CardTitle className="text-xl sm:text-2xl">
                  {formatCurrency(totalNet)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle>Monthly Revenue</CardTitle>
              <CardDescription>
                Booking and collection summary for the current cycle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {revenueRows.map((row) => (
                  <div key={row.month} className="rounded-lg border p-3">
                    <p className="text-sm font-semibold">{row.month}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <p className="text-muted-foreground">Bookings</p>
                      <p className="text-right tabular-nums">{row.bookings}</p>
                      <p className="text-muted-foreground">Collected</p>
                      <p className="text-right tabular-nums">
                        {formatCurrency(row.collected)}
                      </p>
                      <p className="text-muted-foreground">Pending</p>
                      <p className="text-right tabular-nums">
                        {formatCurrency(row.pending)}
                      </p>
                      <p className="text-muted-foreground font-medium">Net</p>
                      <p className="text-right font-medium tabular-nums">
                        {formatCurrency(row.net)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueRows.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.bookings}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.collected)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.pending)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.net)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
