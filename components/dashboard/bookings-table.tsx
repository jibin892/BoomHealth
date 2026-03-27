"use client"

import * as React from "react"
import { CalendarX2, ChevronRight, SearchX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  pageSize?: number
  onPageSizeChange?: (nextSize: number) => void
}

const apiStatusFilters = ["All", "ACTIVE", "FULFILLED", "CANCELLED"] as const
type ApiStatusFilter = (typeof apiStatusFilters)[number]
type RowApiStatus = Exclude<ApiStatusFilter, "All"> | "CREATED" | "UNKNOWN"
const dateFilterModes = ["all", "today", "next7", "past", "single", "range"] as const
type DateFilterMode = (typeof dateFilterModes)[number]
const sampleFilterOptions = ["all", "doc-required", "doc-complete", "unknown"] as const
type SampleFilterOption = (typeof sampleFilterOptions)[number]
const sortOptions = ["start-desc", "start-asc", "status"] as const
type SortOption = (typeof sortOptions)[number]
const pageSizeOptions = [50, 100, 200]

const statusFilterLabel: Record<ApiStatusFilter, string> = {
  All: "All",
  ACTIVE: "Active",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
}

const dateFilterModeLabel: Record<DateFilterMode, string> = {
  all: "All dates",
  today: "Today",
  next7: "Next 7 days",
  past: "Past",
  single: "Single date",
  range: "Date range",
}

const sampleFilterLabel: Record<SampleFilterOption, string> = {
  all: "All sample states",
  "doc-required": "Document required",
  "doc-complete": "Document complete",
  unknown: "Unknown",
}

const sortLabel: Record<SortOption, string> = {
  "start-desc": "Newest first",
  "start-asc": "Oldest first",
  status: "Status",
}

const statusStyles: Record<BookingTableRow["status"], string> = {
  Pending: "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300",
  Confirmed: "border-blue-500/30 bg-blue-500/12 text-blue-700 dark:text-blue-300",
  "Result Ready":
    "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  Cancelled: "border-rose-500/30 bg-rose-500/12 text-rose-700 dark:text-rose-300",
  Unknown: "border-slate-500/30 bg-slate-500/12 text-slate-700 dark:text-slate-300",
}

const DISPLAY_TIME_ZONE = "Asia/Dubai"
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
})
type SampleState = Exclude<SampleFilterOption, "all">

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

function getComparableTimestamp(row: BookingTableRow) {
  const source = row.startAt || row.createdAt
  if (!source) return 0
  const parsed = Date.parse(source)
  return Number.isNaN(parsed) ? 0 : parsed
}

function normalizeDateInputValue(value: string) {
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : ""
}

function toDateKeyInDisplayTimeZone(date: Date) {
  const parts = DATE_KEY_FORMATTER.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  if (!year || !month || !day) return ""
  return `${year}-${month}-${day}`
}

function addDaysToDateKey(dateKey: string, days: number) {
  const parsed = new Date(`${dateKey}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return dateKey
  parsed.setUTCDate(parsed.getUTCDate() + days)
  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0")
  const day = String(parsed.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateSummary(value: string) {
  const normalized = normalizeDateInputValue(value)
  if (!normalized) return value
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return normalized

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

function getRowDateKey(row: BookingTableRow) {
  const source = row.startAt || row.createdAt || row.date
  if (!source) return null

  const parsed = new Date(source)
  if (Number.isNaN(parsed.getTime())) return null

  const dateKey = toDateKeyInDisplayTimeZone(parsed)
  return dateKey || null
}

function matchesDateFilter(
  row: BookingTableRow,
  dateFilterMode: DateFilterMode,
  singleDate: string,
  rangeFrom: string,
  rangeTo: string
) {
  if (dateFilterMode === "all") return true

  const rowDateKey = getRowDateKey(row)
  if (!rowDateKey) return false

  const todayDateKey = toDateKeyInDisplayTimeZone(new Date())
  if (!todayDateKey) return false

  if (dateFilterMode === "today") {
    return rowDateKey === todayDateKey
  }

  if (dateFilterMode === "next7") {
    const next7DateKey = addDaysToDateKey(todayDateKey, 7)
    return rowDateKey >= todayDateKey && rowDateKey < next7DateKey
  }

  if (dateFilterMode === "past") {
    return rowDateKey < todayDateKey
  }

  if (dateFilterMode === "single") {
    const normalizedSingleDate = normalizeDateInputValue(singleDate)
    if (!normalizedSingleDate) return true
    return rowDateKey === normalizedSingleDate
  }

  const normalizedRangeFrom = normalizeDateInputValue(rangeFrom)
  const normalizedRangeTo = normalizeDateInputValue(rangeTo)

  if (!normalizedRangeFrom && !normalizedRangeTo) return true

  const [rangeStart, rangeEnd] =
    normalizedRangeFrom && normalizedRangeTo && normalizedRangeFrom > normalizedRangeTo
      ? [normalizedRangeTo, normalizedRangeFrom]
      : [normalizedRangeFrom, normalizedRangeTo]

  if (rangeStart && rowDateKey < rangeStart) return false
  if (rangeEnd && rowDateKey > rangeEnd) return false
  return true
}

function compareRows(rowA: BookingTableRow, rowB: BookingTableRow, sort: SortOption) {
  if (sort === "status") {
    return rowA.status.localeCompare(rowB.status)
  }

  const tsA = getComparableTimestamp(rowA)
  const tsB = getComparableTimestamp(rowB)
  if (sort === "start-asc") return tsA - tsB
  return tsB - tsA
}

function normalizeValue(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  return ""
}

function getSampleCollectionState(row: BookingTableRow): SampleState {
  const patients = row.patients || []
  if (patients.length === 0) return "unknown"

  const hasMissingDocument = patients.some((patient) => !patient.nationalId?.trim())
  return hasMissingDocument ? "doc-required" : "doc-complete"
}

function matchesSampleFilter(row: BookingTableRow, sampleFilter: SampleFilterOption) {
  if (sampleFilter === "all") return true
  return getSampleCollectionState(row) === sampleFilter
}

function getSampleStateBadgeClass(state: SampleState) {
  if (state === "doc-required") {
    return "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300"
  }
  if (state === "doc-complete") {
    return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
  }
  return "border-slate-500/30 bg-slate-500/12 text-slate-700 dark:text-slate-300"
}

function getSearchHaystack(row: BookingTableRow, sampleState: SampleState) {
  const patientIndex =
    row.patients?.flatMap((patient) => [
      patient.patientId,
      patient.name,
      patient.gender || "",
      patient.nationalId || "",
    ]) || []

  return [
    row.bookingId,
    row.orderId || "",
    row.apiBookingId || "",
    row.patientName,
    row.testName,
    row.date,
    row.slot,
    row.status,
    row.bookingStatusRaw || "",
    row.orderStatus || "",
    row.locationAddress || "",
    row.locationLabel || "",
    row.resourceType || "",
    row.resourceId || "",
    sampleFilterLabel[sampleState],
    ...patientIndex,
  ]
    .map(normalizeValue)
    .join(" ")
    .toLowerCase()
}

export function BookingsTable({
  rows,
  title = "Bookings",
  description = "Live booking visibility for BoomHealth lab test operations",
  onRowSelect,
  emptyTitle = "No bookings found",
  emptyDescription = "No bookings are available right now. Pull to refresh or try again shortly.",
  onRefresh,
  isRefreshing = false,
  pageSize: controlledPageSize,
  onPageSizeChange: onControlledPageSizeChange,
}: BookingsTableProps) {
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<ApiStatusFilter>("All")
  const [dateFilterMode, setDateFilterMode] = React.useState<DateFilterMode>("all")
  const [singleDate, setSingleDate] = React.useState("")
  const [rangeFrom, setRangeFrom] = React.useState("")
  const [rangeTo, setRangeTo] = React.useState("")
  const [sampleFilter, setSampleFilter] = React.useState<SampleFilterOption>("all")
  const [sortBy, setSortBy] = React.useState<SortOption>("start-desc")
  const [page, setPage] = React.useState(1)
  const [internalPageSize, setInternalPageSize] = React.useState<number>(pageSizeOptions[0])
  const deferredSearch = React.useDeferredValue(search)
  const pageSize = controlledPageSize ?? internalPageSize

  const handlePageSizeChange = React.useCallback(
    (nextSize: number) => {
      if (onControlledPageSizeChange) {
        onControlledPageSizeChange(nextSize)
        return
      }

      setInternalPageSize(nextSize)
    },
    [onControlledPageSizeChange]
  )

  const filteredRows = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return rows.filter((row) => {
      const rowApiStatus = getRowApiStatus(row)
      const matchesStatus = status === "All" || rowApiStatus === status
      if (!matchesStatus) return false

      if (!matchesDateFilter(row, dateFilterMode, singleDate, rangeFrom, rangeTo)) {
        return false
      }
      if (!matchesSampleFilter(row, sampleFilter)) return false

      if (!query) return true

      const sampleState = getSampleCollectionState(row)
      return getSearchHaystack(row, sampleState).includes(query)
    })
  }, [dateFilterMode, deferredSearch, rangeFrom, rangeTo, rows, sampleFilter, singleDate, status])

  const sortedRows = React.useMemo(
    () => [...filteredRows].sort((rowA, rowB) => compareRows(rowA, rowB, sortBy)),
    [filteredRows, sortBy]
  )

  React.useEffect(() => {
    setPage(1)
  }, [dateFilterMode, pageSize, rangeFrom, rangeTo, sampleFilter, search, singleDate, sortBy, status])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))

  React.useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages))
  }, [totalPages])

  const paginatedRows = React.useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return sortedRows.slice(startIndex, startIndex + pageSize)
  }, [sortedRows, page, pageSize])

  const mobileRows = React.useMemo(
    () => sortedRows.slice(0, page * pageSize),
    [page, pageSize, sortedRows]
  )

  const rangeStart = sortedRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, sortedRows.length)
  const hasDateFilter = React.useMemo(() => {
    if (dateFilterMode === "all") return false
    if (dateFilterMode === "single") {
      return Boolean(normalizeDateInputValue(singleDate))
    }
    if (dateFilterMode === "range") {
      return Boolean(
        normalizeDateInputValue(rangeFrom) || normalizeDateInputValue(rangeTo)
      )
    }
    return true
  }, [dateFilterMode, rangeFrom, rangeTo, singleDate])

  const hasFilters =
    search.trim().length > 0 ||
    status !== "All" ||
    hasDateFilter ||
    sampleFilter !== "all"
  const isEmpty = sortedRows.length === 0
  const emptyStateTitle = hasFilters ? "No matching bookings" : emptyTitle
  const emptyStateDescription = hasFilters
    ? "Try a different search or reset the status filter."
    : emptyDescription
  const clearFilters = React.useCallback(() => {
    setSearch("")
    setStatus("All")
    setDateFilterMode("all")
    setSingleDate("")
    setRangeFrom("")
    setRangeTo("")
    setSampleFilter("all")
    setSortBy("start-desc")
  }, [])
  const activeFilterSummary = React.useMemo(() => {
    const summaries: string[] = []
    if (status !== "All") {
      summaries.push(`Status: ${statusFilterLabel[status]}`)
    }
    if (hasDateFilter) {
      if (dateFilterMode === "single") {
        summaries.push(`Date: ${formatDateSummary(singleDate)}`)
      } else if (dateFilterMode === "range") {
        const normalizedRangeFrom = normalizeDateInputValue(rangeFrom)
        const normalizedRangeTo = normalizeDateInputValue(rangeTo)
        if (normalizedRangeFrom && normalizedRangeTo) {
          const [rangeStart, rangeEnd] =
            normalizedRangeFrom > normalizedRangeTo
              ? [normalizedRangeTo, normalizedRangeFrom]
              : [normalizedRangeFrom, normalizedRangeTo]
          summaries.push(
            `Date: ${formatDateSummary(rangeStart)} - ${formatDateSummary(rangeEnd)}`
          )
        } else if (normalizedRangeFrom) {
          summaries.push(`Date: From ${formatDateSummary(normalizedRangeFrom)}`)
        } else if (normalizedRangeTo) {
          summaries.push(`Date: Until ${formatDateSummary(normalizedRangeTo)}`)
        }
      } else {
        summaries.push(`Date: ${dateFilterModeLabel[dateFilterMode]}`)
      }
    }
    if (sampleFilter !== "all") {
      summaries.push(`Sample: ${sampleFilterLabel[sampleFilter]}`)
    }
    if (search.trim().length > 0) {
      summaries.push(`Query: "${search.trim()}"`)
    }
    if (sortBy !== "start-desc") {
      summaries.push(`Sort: ${sortLabel[sortBy]}`)
    }
    return summaries
  }, [dateFilterMode, hasDateFilter, rangeFrom, rangeTo, sampleFilter, search, singleDate, sortBy, status])

  const statusCounts = React.useMemo(() => {
    const counts: Record<ApiStatusFilter, number> = {
      All: rows.length,
      ACTIVE: 0,
      FULFILLED: 0,
      CANCELLED: 0,
    }

    for (const row of rows) {
      const rowApiStatus = getRowApiStatus(row)
      if (rowApiStatus === "ACTIVE") counts.ACTIVE += 1
      if (rowApiStatus === "FULFILLED") counts.FULFILLED += 1
      if (rowApiStatus === "CANCELLED") counts.CANCELLED += 1
    }

    return counts
  }, [rows])

  return (
    <div className="mobile-page-shell pb-4 lg:pb-6">
      <div className="mb-3 space-y-3 rounded-2xl border border-border/70 bg-card/85 p-3 md:hidden">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search booking, patient, order ID, or test"
          className="mobile-touch-target h-11 rounded-xl"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={dateFilterMode}
            onValueChange={(value) => setDateFilterMode(value as DateFilterMode)}
          >
            <SelectTrigger className="mobile-touch-target h-10 rounded-xl text-xs">
              <SelectValue placeholder="Date filter" />
            </SelectTrigger>
            <SelectContent>
              {dateFilterModes.map((option) => (
                <SelectItem key={option} value={option}>
                  {dateFilterModeLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="mobile-touch-target h-10 rounded-xl text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {sortLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sampleFilter}
            onValueChange={(value) => setSampleFilter(value as SampleFilterOption)}
          >
            <SelectTrigger className="mobile-touch-target col-span-2 h-10 rounded-xl text-xs">
              <SelectValue placeholder="Sample status" />
            </SelectTrigger>
            <SelectContent>
              {sampleFilterOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {sampleFilterLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dateFilterMode === "single" ? (
            <Input
              type="date"
              value={singleDate}
              onChange={(event) => setSingleDate(event.target.value)}
              className="mobile-touch-target col-span-2 h-10 rounded-xl text-xs"
              aria-label="Single date filter"
            />
          ) : null}
          {dateFilterMode === "range" ? (
            <>
              <Input
                type="date"
                value={rangeFrom}
                onChange={(event) => setRangeFrom(event.target.value)}
                className="mobile-touch-target h-10 rounded-xl text-xs"
                aria-label="Date range start"
              />
              <Input
                type="date"
                value={rangeTo}
                onChange={(event) => setRangeTo(event.target.value)}
                className="mobile-touch-target h-10 rounded-xl text-xs"
                aria-label="Date range end"
              />
            </>
          ) : null}
        </div>
        <Tabs
          value={status}
          onValueChange={(value) => setStatus(value as ApiStatusFilter)}
        >
          <TabsList className="group-data-horizontal/tabs:h-auto grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
            {apiStatusFilters.map((option) => (
              <TabsTrigger
                key={option}
                value={option}
                className="mobile-touch-target h-9 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-background"
              >
                {statusFilterLabel[option]} ({statusCounts[option]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {activeFilterSummary.length > 0 ? (
          <Alert className="rounded-xl border-primary/20 bg-primary/5 px-3 py-2">
            <AlertDescription className="flex flex-wrap items-center gap-1.5 text-xs">
              {activeFilterSummary.map((item) => (
                <Badge key={item} variant="outline" className="text-[11px]">
                  {item}
                </Badge>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}
        {hasFilters ? (
          <Button
            variant="outline"
            className="mobile-touch-target h-10 w-full rounded-xl"
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Showing {sortedRows.length} of {rows.length} bookings
        </p>
      </div>

      <Card className="border-0 bg-transparent shadow-none md:border md:bg-card md:shadow-none">
        <CardHeader className="hidden md:flex">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by booking ID, patient, order ID, or test"
                className="md:max-w-sm"
              />
              <Select
                value={dateFilterMode}
                onValueChange={(value) => setDateFilterMode(value as DateFilterMode)}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Date filter" />
                </SelectTrigger>
                <SelectContent>
                  {dateFilterModes.map((option) => (
                    <SelectItem key={option} value={option}>
                      {dateFilterModeLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dateFilterMode === "single" ? (
                <Input
                  type="date"
                  value={singleDate}
                  onChange={(event) => setSingleDate(event.target.value)}
                  className="w-full md:w-[180px]"
                  aria-label="Single date filter"
                />
              ) : null}
              {dateFilterMode === "range" ? (
                <>
                  <Input
                    type="date"
                    value={rangeFrom}
                    onChange={(event) => setRangeFrom(event.target.value)}
                    className="w-full md:w-[180px]"
                    aria-label="Date range start"
                  />
                  <Input
                    type="date"
                    value={rangeTo}
                    onChange={(event) => setRangeTo(event.target.value)}
                    className="w-full md:w-[180px]"
                    aria-label="Date range end"
                  />
                </>
              ) : null}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-full md:w-[170px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {sortLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sampleFilter}
                onValueChange={(value) => setSampleFilter(value as SampleFilterOption)}
              >
                <SelectTrigger className="w-full md:w-[190px]">
                  <SelectValue placeholder="Sample status" />
                </SelectTrigger>
                <SelectContent>
                  {sampleFilterOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {sampleFilterLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Tabs
              value={status}
              onValueChange={(value) => setStatus(value as ApiStatusFilter)}
            >
              <TabsList className="group-data-horizontal/tabs:h-auto h-10 rounded-lg bg-muted/70 p-1">
                {apiStatusFilters.map((option) => (
                  <TabsTrigger
                    key={option}
                    value={option}
                    className="h-8 px-3 text-xs font-semibold data-[state=active]:bg-background"
                  >
                    {statusFilterLabel[option]} ({statusCounts[option]})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {activeFilterSummary.length > 0 ? (
              <Alert className="rounded-lg border-primary/20 bg-primary/5 px-3 py-2">
                <AlertDescription className="flex flex-wrap items-center gap-1.5 text-xs">
                  {activeFilterSummary.map((item) => (
                    <Badge key={item} variant="outline" className="text-[11px]">
                      {item}
                    </Badge>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Showing {sortedRows.length} of {rows.length} bookings
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {isEmpty ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
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
                {mobileRows.map((row) => {
                  const readableDate = getReadableDate(row)
                  const readableTimeSlot = getReadableTimeSlot(row)
                  const sampleState = getSampleCollectionState(row)

                  return (
                    <div
                      key={row.bookingId}
                      className="mobile-surface p-4 shadow-none transition-transform active:scale-[0.995]"
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
                          <Badge
                            variant="outline"
                            className={cn("text-xs", getSampleStateBadgeClass(sampleState))}
                          >
                            {sampleFilterLabel[sampleState]}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="grid grid-cols-[84px_1fr] items-start gap-2">
                          <span className="text-muted-foreground text-xs font-medium">
                            Patient
                          </span>
                          <span className="truncate font-medium">{row.patientName}</span>
                        </div>
                        <div className="grid grid-cols-[84px_1fr] items-start gap-2">
                          <span className="text-muted-foreground text-xs font-medium">
                            Order
                          </span>
                          <span className="truncate font-medium">
                            {row.orderId || "-"}
                          </span>
                        </div>
                        <div className="grid grid-cols-[84px_1fr] items-start gap-2">
                          <span className="text-muted-foreground text-xs font-medium">
                            Test
                          </span>
                          <span className="truncate font-medium">{row.testName}</span>
                        </div>
                      </div>
                      {onRowSelect ? (
                        <Button
                          type="button"
                          size="sm"
                          className="mobile-touch-target mt-4 h-10 w-full justify-between rounded-xl"
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
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/55">
                  <Table className="min-w-[920px]">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-b-border/70 hover:bg-transparent">
                        <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Booking ID
                        </TableHead>
                        <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Patient
                        </TableHead>
                        <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Test
                        </TableHead>
                        <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Date
                        </TableHead>
                        <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Slot
                        </TableHead>
                        <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Status
                        </TableHead>
                        <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Sample
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRows.map((row) => {
                        const readableDate = getReadableDate(row)
                        const readableTimeSlot = getReadableTimeSlot(row)
                        const sampleState = getSampleCollectionState(row)

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
                            className={cn(
                              "border-b-border/60 even:bg-muted/10",
                              onRowSelect &&
                                "cursor-pointer hover:bg-primary/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            )}
                          >
                            <TableCell className="py-3.5 font-semibold tracking-tight">
                              {row.bookingId}
                            </TableCell>
                            <TableCell className="py-3.5 font-medium">
                              {row.patientName}
                            </TableCell>
                            <TableCell className="py-3.5 text-muted-foreground">
                              {row.testName}
                            </TableCell>
                            <TableCell className="py-3.5 text-muted-foreground">
                              {readableDate}
                            </TableCell>
                            <TableCell className="py-3.5 text-muted-foreground">
                              {readableTimeSlot}
                            </TableCell>
                            <TableCell className="py-3.5">
                              <Badge
                                variant="outline"
                                className={statusStyles[row.status]}
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3.5">
                              <Badge
                                variant="outline"
                                className={getSampleStateBadgeClass(sampleState)}
                              >
                                {sampleFilterLabel[sampleState]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            filteredCount={sortedRows.length}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            isEmpty={isEmpty}
            pageSizeId="bookings-page-size"
            entityLabel="bookings"
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
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
