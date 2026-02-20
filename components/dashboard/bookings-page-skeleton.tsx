import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function OverviewCardSkeleton() {
  return (
    <Card className="from-primary/5 to-card bg-gradient-to-t shadow-xs">
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  )
}

function MobileBookingCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/70 p-4 shadow-xs">
      <div className="space-y-2 border-b border-border/60 pb-3">
        <Skeleton className="h-3 w-20" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[84px_1fr] items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="grid grid-cols-[84px_1fr] items-center gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <Skeleton className="mt-4 h-9 w-full rounded-md" />
    </div>
  )
}

function DesktopTableRowSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-4 border-b py-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
}

export function BookingsPageSkeleton() {
  return (
    <>
      <div className="space-y-3 px-4 md:hidden">
        <Skeleton className="h-10 w-full rounded-md" />
        <OverviewCardSkeleton />
        <OverviewCardSkeleton />
      </div>

      <div className="hidden grid-cols-1 gap-4 px-4 md:grid md:grid-cols-2 lg:px-6 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <OverviewCardSkeleton key={`overview-skeleton-${index}`} />
        ))}
      </div>

      <div className="px-4 pb-4 lg:px-6 lg:pb-6">
        <Card className="shadow-xs">
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <div className="flex flex-col gap-3 md:flex-row">
              <Skeleton className="h-10 w-full md:max-w-sm" />
              <Skeleton className="h-10 w-full md:w-28" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`filter-skeleton-${index}`} className="h-8 w-24 shrink-0" />
              ))}
            </div>
            <Skeleton className="h-3 w-48" />
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="space-y-3 md:hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <MobileBookingCardSkeleton key={`mobile-row-skeleton-${index}`} />
              ))}
            </div>

            <div className="hidden space-y-1 md:block">
              <div className="grid grid-cols-6 gap-4 border-b pb-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-12" />
              </div>
              {Array.from({ length: 8 }).map((_, index) => (
                <DesktopTableRowSkeleton key={`desktop-row-skeleton-${index}`} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
