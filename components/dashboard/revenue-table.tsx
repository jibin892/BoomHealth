"use client"

import * as React from "react"
import { CalendarX2, SearchX } from "lucide-react"

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
          placeholder="Search month or amount"
        />
        {hasFilters ? (
          <Button variant="outline" className="w-full" onClick={clearFilters}>
            Clear Filters
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full">
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
            <SelectTrigger className="w-full">
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

      <Card className="border-0 bg-transparent shadow-none md:border md:bg-card md:shadow-xs">
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
            <p className="text-muted-foreground text-xs">
              Showing {filteredRows.length} of {rows.length} months
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
                {paginatedRows.map((row) => (
                  <div
                    key={row.month}
                    className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-transform active:scale-[0.995]"
                  >
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
                    {paginatedRows.map((row) => (
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
