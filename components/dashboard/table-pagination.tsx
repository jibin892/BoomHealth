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
  const canLoadMore = page < totalPages && !isEmpty

  return (
    <div className="mt-4 border-t border-border/70 pt-3 sm:mt-5 sm:pt-4">
      <p className="text-muted-foreground text-xs leading-relaxed sm:hidden">
        {filteredCount === 0
          ? `No ${entityLabel} found`
          : `Showing ${rangeEnd} of ${filteredCount} ${entityLabel}`}
      </p>
      <p className="text-muted-foreground hidden text-xs leading-relaxed sm:block">
        {filteredCount === 0
          ? `Showing 0 ${entityLabel}`
          : `Showing ${rangeStart}-${rangeEnd} of ${filteredCount} filtered ${entityLabel}`}
      </p>

      <div className="mt-3 grid gap-2 sm:hidden">
        <div className="flex h-12 items-stretch overflow-hidden rounded-xl border border-border/80 bg-card/80">
          <label
            htmlFor={pageSizeId}
            className="text-muted-foreground flex min-w-0 flex-1 items-center px-4 text-sm font-medium"
          >
            Rows per page
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={isEmpty}
          >
            <SelectTrigger
              id={pageSizeId}
              className="mobile-touch-target h-full w-[112px] rounded-none border-0 border-l border-border/80 bg-transparent px-4 text-sm shadow-none focus:ring-0 focus:ring-offset-0"
            >
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
        {canLoadMore ? (
          <Button
            variant="outline"
            className="mobile-touch-target h-10 rounded-xl"
            onClick={() => onPageChange(page + 1)}
          >
            Load More
          </Button>
        ) : null}
        {page > 1 ? (
          <Button
            variant="ghost"
            className="mobile-touch-target h-10 rounded-xl"
            onClick={() => onPageChange(1)}
          >
            Reset to First Page
          </Button>
        ) : null}
      </div>

      <div className="mt-3 hidden flex-col gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-11 w-full overflow-hidden rounded-xl border border-border/80 bg-card/80 sm:w-auto">
          <label
            htmlFor={pageSizeId}
            className="text-muted-foreground flex min-w-[136px] shrink-0 items-center px-4 text-sm font-medium leading-none"
          >
            Rows per page
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={isEmpty}
          >
            <SelectTrigger
              id={pageSizeId}
              className="h-full w-full rounded-none border-0 border-l border-border/80 bg-transparent px-4 text-sm shadow-none focus:ring-0 focus:ring-offset-0 sm:w-[108px]"
            >
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-muted-foreground text-center text-xs sm:order-2 sm:min-w-[96px]">
            Page {page} of {totalPages}
          </span>
          <div className="grid grid-cols-2 gap-2 sm:order-1 sm:flex sm:items-center">
            <Button
              variant="outline"
              size="sm"
              className="mobile-touch-target h-10 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isEmpty}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="mobile-touch-target h-10 w-full rounded-xl sm:h-9 sm:w-auto sm:rounded-md"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isEmpty}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
