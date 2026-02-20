"use client"

import * as React from "react"
import { CalendarX2, SearchX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BookingTableRow } from "@/lib/bookings/types"
import { formatAedAmount } from "@/lib/currency"
import { cn } from "@/lib/utils"

type BookingsTableProps = {
  rows: BookingTableRow[]
  title?: string
  description?: string
  onRowSelect?: (row: BookingTableRow) => void
  emptyTitle?: string
  emptyDescription?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

const statusFilters: Array<"All" | BookingTableRow["status"]> = [
  "All",
  "Pending",
  "Confirmed",
  "Result Ready",
  "Cancelled",
  "Unknown",
]
const pageSizeOptions = [5, 10, 20]

const statusStyles: Record<BookingTableRow["status"], string> = {
  Pending: "text-amber-300 border-amber-400/40 bg-amber-500/10",
  Confirmed: "text-blue-300 border-blue-400/40 bg-blue-500/10",
  "Result Ready": "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  Cancelled: "text-rose-300 border-rose-400/40 bg-rose-500/10",
  Unknown: "text-slate-300 border-slate-400/40 bg-slate-500/10",
}

export function BookingsTable({
  rows,
  title = "Recent Bookings",
  description = "Live booking visibility for BoomHealth lab test operations",
  onRowSelect,
  emptyTitle = "No bookings found",
  emptyDescription = "No bookings are available right now. Pull to refresh or try again shortly.",
  onRefresh,
  isRefreshing = false,
}: BookingsTableProps) {
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<"All" | BookingTableRow["status"]>(
    "All"
  )
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState<number>(pageSizeOptions[0])

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesStatus = status === "All" || row.status === status
      if (!matchesStatus) return false

      if (!query) return true

      return (
        row.bookingId.toLowerCase().includes(query) ||
        row.patientName.toLowerCase().includes(query) ||
        row.testName.toLowerCase().includes(query) ||
        row.date.toLowerCase().includes(query) ||
        row.slot.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query)
      )
    })
  }, [rows, search, status])

  React.useEffect(() => {
    setPage(1)
  }, [search, status, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  React.useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages))
  }, [totalPages])

  const paginatedRows = React.useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredRows.slice(startIndex, startIndex + pageSize)
  }, [filteredRows, page, pageSize])

  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, filteredRows.length)
  const hasFilters = search.trim().length > 0 || status !== "All"
  const isEmpty = filteredRows.length === 0
  const emptyStateTitle = hasFilters ? "No matching bookings" : emptyTitle
  const emptyStateDescription = hasFilters
    ? "Try a different search or reset the status filter."
    : emptyDescription

  return (
    <div className="px-4 pb-4 lg:px-6 lg:pb-6">
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by booking ID, patient, or test"
                className="md:max-w-sm"
              />
              {hasFilters ? (
                <Button
                  variant="outline"
                  className="md:w-auto"
                  onClick={() => {
                    setSearch("")
                    setStatus("All")
                  }}
                >
                  Clear Filters
                </Button>
              ) : null}
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {statusFilters.map((option) => (
                <Button
                  key={option}
                  variant={status === option ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setStatus(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Showing {filteredRows.length} of {rows.length} bookings
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center">
              {hasFilters ? (
                <SearchX className="text-muted-foreground mb-3 size-10" />
              ) : (
                <CalendarX2 className="text-muted-foreground mb-3 size-10" />
              )}
              <h3 className="text-base font-semibold">{emptyStateTitle}</h3>
              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                {emptyStateDescription}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("")
                      setStatus("All")
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : null}
                {!hasFilters && onRefresh ? (
                  <Button
                    variant="outline"
                    disabled={isRefreshing}
                    onClick={onRefresh}
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {paginatedRows.map((row) => (
                  <div
                    key={row.bookingId}
                    onClick={() => onRowSelect?.(row)}
                    onKeyDown={(event) => {
                      if (!onRowSelect) return
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onRowSelect(row)
                      }
                    }}
                    tabIndex={onRowSelect ? 0 : undefined}
                    role={onRowSelect ? "button" : undefined}
                    className={cn(
                      "rounded-lg border p-3",
                      onRowSelect &&
                        "cursor-pointer transition-colors hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{row.bookingId}</p>
                      <Badge variant="outline" className={statusStyles[row.status]}>
                        {row.status}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Patient: </span>
                        {row.patientName}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Test: </span>
                        {row.testName}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Date: </span>
                        {row.date}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Slot: </span>
                        {row.slot}
                      </p>
                      <p className="pt-1 font-medium tabular-nums">
                        {formatAedAmount(row.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Test</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((row) => (
                      <TableRow
                        key={row.bookingId}
                        onClick={() => onRowSelect?.(row)}
                        onKeyDown={(event) => {
                          if (!onRowSelect) return
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            onRowSelect(row)
                          }
                        }}
                        tabIndex={onRowSelect ? 0 : undefined}
                        role={onRowSelect ? "button" : undefined}
                        className={cn(onRowSelect && "cursor-pointer hover:bg-muted/40")}
                      >
                        <TableCell className="font-medium">{row.bookingId}</TableCell>
                        <TableCell>{row.patientName}</TableCell>
                        <TableCell>{row.testName}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.slot}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusStyles[row.status]}
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAedAmount(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <div className="mt-4 border-t pt-4">
            <p className="text-muted-foreground text-xs">
              {filteredRows.length === 0
                ? "Showing 0 bookings"
                : `Showing ${rangeStart}-${rangeEnd} of ${filteredRows.length} filtered bookings`}
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="border-border/60 flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:rounded-none sm:border-0 sm:px-0 sm:py-0">
                <label
                  htmlFor="bookings-page-size"
                  className="text-muted-foreground shrink-0 text-xs"
                >
                  Rows per page
                </label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => setPageSize(Number(value))}
                  disabled={isEmpty}
                >
                  <SelectTrigger id="bookings-page-size" className="h-9 w-[88px]">
                    <SelectValue placeholder={String(pageSizeOptions[0])} />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {pageSizeOptions.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full sm:w-auto"
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  disabled={page <= 1 || isEmpty}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground min-w-[88px] text-center text-xs sm:min-w-[96px]">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full sm:w-auto"
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  disabled={page >= totalPages || isEmpty}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
