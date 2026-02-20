"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TablePaginationProps = {
  page: number
  totalPages: number
  pageSize: number
  pageSizeOptions: number[]
  filteredCount: number
  rangeStart: number
  rangeEnd: number
  isEmpty: boolean
  pageSizeId: string
  entityLabel?: string
  onPageChange: (nextPage: number) => void
  onPageSizeChange: (nextSize: number) => void
}

export function TablePagination({
  page,
  totalPages,
  pageSize,
  pageSizeOptions,
  filteredCount,
  rangeStart,
  rangeEnd,
  isEmpty,
  pageSizeId,
  entityLabel = "bookings",
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  return (
    <div className="mt-4 border-t pt-4">
      <p className="text-muted-foreground text-xs">
        {filteredCount === 0
          ? `Showing 0 ${entityLabel}`
          : `Showing ${rangeStart}-${rangeEnd} of ${filteredCount} filtered ${entityLabel}`}
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="border-border/60 flex w-full flex-col gap-2 rounded-md border px-3 py-2 sm:w-auto sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:rounded-none sm:border-0 sm:px-0 sm:py-0">
          <label
            htmlFor={pageSizeId}
            className="text-muted-foreground shrink-0 text-xs"
          >
            Rows per page
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={isEmpty}
          >
            <SelectTrigger id={pageSizeId} className="h-9 w-full sm:w-[88px]">
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
            onClick={() => onPageChange(page - 1)}
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
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isEmpty}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
