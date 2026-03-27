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
import { TablePagination } from "@/components/dashboard/table-pagination"
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
import { formatAedAmount } from "@/lib/currency"
import type { RevenueRow } from "@/app/dashboard/revenue-tracker/data"

type RevenueTableProps = {
  rows: RevenueRow[]
  title?: string
  description?: string
  emptyTitle?: string
  emptyDescription?: string
}

const pageSizeOptions = [5, 10, 20]

function getMonthParts(value: string) {
  const [monthLabel, year] = value.split(" ")
  return {
    monthLabel: monthLabel || value,
    year: year || "",
  }
}

const formatCurrency = (value: number) =>
  formatAedAmount(value.toLocaleString("en-US"))

export function RevenueTable({
  rows,
  title = "Monthly Revenue",
  description = "Booking and collection summary for current cycle",
  emptyTitle = "No revenue data",
  emptyDescription = "No monthly revenue records are available yet.",
}: RevenueTableProps) {
  const [search, setSearch] = React.useState("")
  const [selectedYear, setSelectedYear] = React.useState("all")
  const [selectedMonth, setSelectedMonth] = React.useState("all")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState<number>(pageSizeOptions[0])

  const yearOptions = React.useMemo(() => {
    const years = Array.from(
      new Set(
        rows
          .map((row) => getMonthParts(row.month).year)
          .filter((year) => year.length > 0)
      )
    )

    return years.sort((a, b) => Number(b) - Number(a))
  }, [rows])

  const monthOptions = React.useMemo(
    () =>
      Array.from(new Set(rows.map((row) => getMonthParts(row.month).monthLabel))),
    [rows]
  )

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter((row) => {
      const { monthLabel, year } = getMonthParts(row.month)

      if (selectedYear !== "all" && year !== selectedYear) {
        return false
      }

      if (selectedMonth !== "all" && monthLabel !== selectedMonth) {
        return false
      }

      if (!query) {
        return true
      }

      const searchableContent = [
        row.month,
        row.bookings,
        row.collected,
        row.pending,
        row.net,
      ]
        .join(" ")
        .toLowerCase()

      return searchableContent.includes(query)
    })
  }, [rows, search, selectedYear, selectedMonth])

  React.useEffect(() => {
    setPage(1)
  }, [search, selectedYear, selectedMonth, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  React.useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages))
  }, [totalPages])

  const paginatedRows = React.useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredRows.slice(startIndex, startIndex + pageSize)
  }, [filteredRows, page, pageSize])
  const mobileRows = React.useMemo(
    () => filteredRows.slice(0, page * pageSize),
    [filteredRows, page, pageSize]
  )

  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, filteredRows.length)
  const hasFilters =
    search.trim().length > 0 || selectedYear !== "all" || selectedMonth !== "all"
  const isEmpty = filteredRows.length === 0
  const clearFilters = React.useCallback(() => {
    setSearch("")
    setSelectedYear("all")
    setSelectedMonth("all")
  }, [])
  const activeFilterSummary = React.useMemo(() => {
    const summaries: string[] = []
    if (selectedYear !== "all") summaries.push(`Year: ${selectedYear}`)
    if (selectedMonth !== "all") summaries.push(`Month: ${selectedMonth}`)
    if (search.trim().length > 0) summaries.push(`Query: "${search.trim()}"`)
    return summaries
  }, [search, selectedMonth, selectedYear])

  return (
    <div className="mobile-page-shell pb-4 lg:pb-6">
      <div className="mb-3 space-y-3 rounded-2xl border border-border/70 bg-card/85 p-3 shadow-sm md:hidden">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search month or amount"
          className="mobile-touch-target h-11 rounded-xl"
        />
        {activeFilterSummary.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilterSummary.map((item) => (
              <Badge key={item} variant="outline" className="text-[11px]">
                {item}
              </Badge>
            ))}
          </div>
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
        <div className="grid grid-cols-2 gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="mobile-touch-target h-11 w-full rounded-xl">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="mobile-touch-target h-11 w-full rounded-xl">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-xs">
          Showing {filteredRows.length} of {rows.length} months
        </p>
      </div>

      <Card className="border-0 bg-transparent shadow-none md:border md:bg-card md:shadow-sm">
        <CardHeader className="hidden md:flex">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search month or amount"
                className="md:max-w-sm"
              />
              {hasFilters ? (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {monthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeFilterSummary.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterSummary.map((item) => (
                  <Badge key={item} variant="outline" className="text-[11px]">
                    {item}
                  </Badge>
                ))}
              </div>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Showing {filteredRows.length} of {rows.length} months
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
              <h3 className="text-base font-semibold">
                {hasFilters ? "No matching revenue records" : emptyTitle}
              </h3>
              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                {hasFilters
                  ? "Try a different search term or reset year/month filters."
                  : emptyDescription}
              </p>
              {hasFilters ? (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {mobileRows.map((row) => (
                  <div
                    key={row.month}
                    className="mobile-surface p-4 transition-transform active:scale-[0.995]"
                  >
                    <p className="text-sm font-semibold tracking-tight">{row.month}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
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
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <Table className="min-w-[760px]">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-b-border/70 hover:bg-transparent">
                        <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Month
                        </TableHead>
                        <TableHead className="h-11 text-right text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Bookings
                        </TableHead>
                        <TableHead className="h-11 text-right text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Collected
                        </TableHead>
                        <TableHead className="h-11 text-right text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Pending
                        </TableHead>
                        <TableHead className="h-11 text-right text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/95">
                          Net
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRows.map((row) => (
                        <TableRow
                          key={row.month}
                          className="border-b-border/60 even:bg-muted/10 hover:bg-primary/6"
                        >
                          <TableCell className="py-3.5 font-semibold tracking-tight">
                            {row.month}
                          </TableCell>
                          <TableCell className="py-3.5 text-right tabular-nums">
                            {row.bookings}
                          </TableCell>
                          <TableCell className="py-3.5 text-right font-medium tabular-nums">
                            {formatCurrency(row.collected)}
                          </TableCell>
                          <TableCell className="py-3.5 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(row.pending)}
                          </TableCell>
                          <TableCell className="py-3.5 text-right font-semibold tabular-nums">
                            {formatCurrency(row.net)}
                          </TableCell>
                        </TableRow>
                      ))}
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
            filteredCount={filteredRows.length}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            isEmpty={isEmpty}
            pageSizeId="revenue-page-size"
            entityLabel="months"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  )
}
