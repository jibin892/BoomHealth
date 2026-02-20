"use client"

import * as React from "react"
import { CalendarX2, ChevronLeft, ChevronRight, SearchX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TablePagination } from "@/components/dashboard/table-pagination"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BookingTableRow } from "@/lib/bookings/types"
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

const apiStatusFilters = ["All", "ACTIVE", "FULFILLED", "CANCELLED"] as const
type ApiStatusFilter = (typeof apiStatusFilters)[number]
type RowApiStatus = Exclude<ApiStatusFilter, "All"> | "CREATED" | "UNKNOWN"
const pageSizeOptions = [5, 10, 20]

const statusFilterLabel: Record<ApiStatusFilter, string> = {
  All: "All",
  ACTIVE: "Active",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
}

const statusStyles: Record<BookingTableRow["status"], string> = {
  Pending: "text-amber-300 border-amber-400/40 bg-amber-500/10",
  Confirmed: "text-blue-300 border-blue-400/40 bg-blue-500/10",
  "Result Ready": "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  Cancelled: "text-rose-300 border-rose-400/40 bg-rose-500/10",
  Unknown: "text-slate-300 border-slate-400/40 bg-slate-500/10",
}

const DISPLAY_TIME_ZONE = "Asia/Dubai"

function formatReadableDate(value?: string | null) {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(parsed)
}

function formatReadableTime(value?: string | null) {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: DISPLAY_TIME_ZONE,
  }).format(parsed)
}

function getReadableDate(row: BookingTableRow) {
  return formatReadableDate(row.startAt) || row.date
}

function getReadableTimeSlot(row: BookingTableRow) {
  const start = formatReadableTime(row.startAt)
  const end = formatReadableTime(row.endAt)

  if (start && end) return `${start} - ${end}`
  if (start) return start
  return row.slot
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
  const [status, setStatus] = React.useState<ApiStatusFilter>("All")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState<number>(pageSizeOptions[0])
  const mobileTabsRef = React.useRef<HTMLDivElement>(null)

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter((row) => {
      const rowApiStatus = getRowApiStatus(row)
      const matchesStatus = status === "All" || rowApiStatus === status
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
  const clearFilters = React.useCallback(() => {
    setSearch("")
    setStatus("All")
  }, [])
  const scrollMobileTabs = React.useCallback((direction: "left" | "right") => {
    const node = mobileTabsRef.current
    if (!node) return

    const offset = direction === "left" ? -140 : 140
    node.scrollBy({ left: offset, behavior: "smooth" })
  }, [])

  return (
    <div className="px-4 pb-4 lg:px-6 lg:pb-6">
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-14 z-10 -mx-4 mb-3 space-y-3 border-b px-4 pt-2 pb-3 backdrop-blur md:hidden">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by booking ID, patient, or test"
        />

        <div className="overflow-hidden rounded-lg border bg-card/80">
          <div className="flex items-center gap-1 border-b px-1">
            <button
              type="button"
              aria-label="Scroll status tabs left"
              className="text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-muted"
              onClick={() => scrollMobileTabs("left")}
            >
              <ChevronLeft className="size-4" />
            </button>

            <div
              ref={mobileTabsRef}
              role="tablist"
              aria-label="Booking status filter"
              className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {apiStatusFilters.map((option) => {
                const isActive = status === option

                return (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setStatus(option)}
                    className={cn(
                      "relative shrink-0 px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {statusFilterLabel[option]}
                    <span
                      className={cn(
                        "absolute right-1 left-1 bottom-0 h-0.5 rounded-full bg-primary transition-opacity",
                        isActive ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              aria-label="Scroll status tabs right"
              className="text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-muted"
              onClick={() => scrollMobileTabs("right")}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        {hasFilters ? (
          <Button variant="outline" className="w-full" onClick={clearFilters}>
            Clear Filters
          </Button>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Showing {filteredRows.length} of {rows.length} bookings
        </p>
      </div>

      <Card className="border-0 bg-transparent shadow-none md:border md:bg-card md:shadow-xs">
        <CardHeader className="hidden md:flex">
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
                  className="w-full md:w-auto"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              ) : null}
            </div>
            <div className="-mx-1 hidden gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 md:flex">
              {apiStatusFilters.map((option) => (
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
        <CardContent className="p-0 md:p-6 md:pt-0">
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
                  <Button variant="outline" onClick={clearFilters}>
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
                {paginatedRows.map((row) => {
                  const readableDate = getReadableDate(row)
                  const readableTimeSlot = getReadableTimeSlot(row)

                  return (
                    <div
                      key={row.bookingId}
                      className="bg-card rounded-2xl border border-border/70 p-4 shadow-xs transition-transform active:scale-[0.995]"
                    >
                      <div className="border-b border-border/60 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                              Booking ID
                            </p>
                            <p className="truncate text-sm font-semibold">{row.bookingId}</p>
                          </div>
                          <Badge variant="outline" className={statusStyles[row.status]}>
                            {row.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {readableDate}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {readableTimeSlot}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="grid grid-cols-[84px_1fr] items-start gap-2">
                          <span className="text-muted-foreground text-xs font-medium">
                            Patient
                          </span>
                          <span className="truncate text-right">{row.patientName}</span>
                        </div>
                        <div className="grid grid-cols-[84px_1fr] items-start gap-2">
                          <span className="text-muted-foreground text-xs font-medium">
                            Test
                          </span>
                          <span className="truncate text-right">{row.testName}</span>
                        </div>
                      </div>
                      {onRowSelect ? (
                        <Button
                          type="button"
                          size="sm"
                          className="mt-4 w-full justify-between"
                          onClick={() => onRowSelect(row)}
                        >
                          View Details
                          <ChevronRight className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((row) => {
                      const readableDate = getReadableDate(row)
                      const readableTimeSlot = getReadableTimeSlot(row)

                      return (
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
                          <TableCell>{readableDate}</TableCell>
                          <TableCell>{readableTimeSlot}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusStyles[row.status]}
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            filteredCount={filteredRows.length}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            isEmpty={isEmpty}
            pageSizeId="bookings-page-size"
            entityLabel="bookings"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function getRowApiStatus(row: BookingTableRow): RowApiStatus {
  if (row.bookingStatusRaw === "CREATED") return "CREATED"
  if (row.bookingStatusRaw === "ACTIVE") return "ACTIVE"
  if (row.bookingStatusRaw === "FULFILLED") return "FULFILLED"
  if (row.bookingStatusRaw === "CANCELLED") return "CANCELLED"

  if (row.status === "Pending") return "CREATED"
  if (row.status === "Confirmed") return "ACTIVE"
  if (row.status === "Result Ready") return "FULFILLED"
  if (row.status === "Cancelled") return "CANCELLED"

  return "UNKNOWN"
}
