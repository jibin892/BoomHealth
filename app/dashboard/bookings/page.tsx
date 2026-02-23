"use client"

import * as React from "react"
import {
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Loader2,
  RefreshCw,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  BookingFormDialog,
  type SaveBookingPatientsInput,
  type SubmitSampleCollectionInput,
  type SubmitSampleCollectionResult,
} from "@/components/dashboard/booking-form-dialog"
import { BookingsPageSkeleton } from "@/components/dashboard/bookings-page-skeleton"
import { BookingsTable } from "@/components/dashboard/bookings-table"
import { OverviewCards } from "@/components/dashboard/overview-cards"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { Badge } from "@/components/ui/badge"
import { PageErrorState } from "@/components/ui/page-error-state"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  getCurrentCollectorBookings,
  getPastCollectorBookings,
  markCollectorBookingSampleCollected,
  updateCollectorBookingPatients,
} from "@/lib/api/collector-bookings"
import type { CollectorBookingBucket } from "@/lib/api/collector-bookings.types"
import {
  getApiErrorCode,
  getApiErrorId,
  getApiErrorMessage,
  isNetworkApiError,
} from "@/lib/api/errors"
import {
  buildBookingOverviewCards,
  mapCollectorBookingToTableRow,
} from "@/lib/bookings/mappers"
import type { BookingTableRow } from "@/lib/bookings/types"
import { triggerHapticFeedback } from "@/lib/mobile/haptics"
import {
  getSampleSubmissionSyncSummary,
  pushSampleSubmissionQueueItem,
  readSampleSubmissionQueue,
  type QueuedSampleSubmission,
  type SampleSubmissionSyncState,
  updateSampleSubmissionQueueItem,
  writeSampleSubmissionQueue,
} from "@/lib/offline/sample-submission-queue"
import { cn } from "@/lib/utils"

const bookingBuckets: Array<{ label: string; value: CollectorBookingBucket }> = [
  { label: "Current", value: "current" },
  { label: "Past", value: "past" },
]

function createSampleEventId(booking: BookingTableRow) {
  return `evt_sample_${booking.orderId || booking.bookingId}_${Date.now()}`
}

function mapPatientUpdatesToApi(
  updates: SaveBookingPatientsInput["updates"]
) {
  return updates.map((update) => ({
    current_patient_id: update.currentPatientId,
    ...(update.newPatientId ? { new_patient_id: update.newPatientId } : {}),
    ...(update.name ? { name: update.name } : {}),
    ...(update.age !== undefined ? { age: update.age } : {}),
    ...(update.gender ? { gender: update.gender } : {}),
    ...(update.nationalId ? { national_id: update.nationalId } : {}),
  }))
}

const sampleSyncStateLabels: Record<SampleSubmissionSyncState, string> = {
  PENDING: "Pending",
  SYNCING: "Syncing",
  FAILED: "Failed",
  SYNCED: "Synced",
}

function mapSyncStateToBadgeVariant(state: SampleSubmissionSyncState) {
  if (state === "FAILED") return "destructive" as const
  if (state === "SYNCED") return "secondary" as const
  return "outline" as const
}

export default function BookingsPage() {
  const [selectedBooking, setSelectedBooking] =
    React.useState<BookingTableRow | null>(null)
  const [isBookingFormOpen, setIsBookingFormOpen] = React.useState(false)
  const [activeBucket, setActiveBucket] =
    React.useState<CollectorBookingBucket>("current")
  const [rows, setRows] = React.useState<BookingTableRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [isNetworkError, setIsNetworkError] = React.useState(false)
  const [apiErrorCode, setApiErrorCode] = React.useState<string | null>(null)
  const [apiErrorId, setApiErrorId] = React.useState<string | null>(null)
  const [queuedSubmissions, setQueuedSubmissions] = React.useState<
    QueuedSampleSubmission[]
  >([])
  const [isSyncingQueue, setIsSyncingQueue] = React.useState(false)
  const [pullDistance, setPullDistance] = React.useState(0)
  const [isPullReady, setIsPullReady] = React.useState(false)
  const isQueueSyncInProgressRef = React.useRef(false)
  const isInitialLoading = isLoading && rows.length === 0

  const overviewCards = React.useMemo(() => buildBookingOverviewCards(rows), [rows])
  const syncSummary = React.useMemo(
    () => getSampleSubmissionSyncSummary(queuedSubmissions),
    [queuedSubmissions]
  )
  const pageErrorReportHref = React.useMemo(() => {
    if (!apiError) return null
    return `mailto:support@dardoc.com?subject=${encodeURIComponent(
      "DarDoc Bookings Load Issue"
    )}&body=${encodeURIComponent(
      [
        `Page: /dashboard/bookings`,
        `Bucket: ${activeBucket}`,
        `Code: ${apiErrorCode || "NA"}`,
        `Error ID: ${apiErrorId || "NA"}`,
        `Message: ${apiError}`,
        "",
        "Please investigate this issue.",
      ].join("\n")
    )}`
  }, [activeBucket, apiError, apiErrorCode, apiErrorId])

  const handleRowSelect = React.useCallback((row: BookingTableRow) => {
    setSelectedBooking(row)
    setIsBookingFormOpen(true)
    void triggerHapticFeedback("medium")
  }, [])

  const loadBookings = React.useCallback(async (bucket: CollectorBookingBucket) => {
    setIsRefreshing(true)

    // Keep error state visible while retrying from an empty/error screen,
    // so the layout does not flash to "Recent Bookings" and back.
    if (rows.length > 0) {
      setApiError(null)
      setIsNetworkError(false)
      setApiErrorCode(null)
      setApiErrorId(null)
    }

    try {
      const response =
        bucket === "current"
          ? await getCurrentCollectorBookings({ limit: 200 })
          : await getPastCollectorBookings({ limit: 200 })

      setRows(response.items.map(mapCollectorBookingToTableRow))
      setApiError(null)
      setIsNetworkError(false)
      setApiErrorCode(null)
      setApiErrorId(null)
    } catch (error) {
      setRows([])
      setApiError(getApiErrorMessage(error))
      setIsNetworkError(isNetworkApiError(error))
      setApiErrorCode(getApiErrorCode(error))
      setApiErrorId(getApiErrorId(error))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [rows.length])

  const refreshQueuedSubmissions = React.useCallback(() => {
    setQueuedSubmissions(readSampleSubmissionQueue())
  }, [])

  const processQueuedSubmissions = React.useCallback(async () => {
    if (typeof window === "undefined" || !navigator.onLine) {
      return
    }

    if (isQueueSyncInProgressRef.current) {
      return
    }

    const currentQueue = readSampleSubmissionQueue()
    const candidateItems = currentQueue.filter(
      (item) => item.state === "PENDING" || item.state === "FAILED"
    )

    if (candidateItems.length === 0) {
      refreshQueuedSubmissions()
      return
    }

    isQueueSyncInProgressRef.current = true
    setIsSyncingQueue(true)
    let didSyncAny = false

    try {
      for (const item of candidateItems) {
        updateSampleSubmissionQueueItem(item.id, (queueItem) => ({
          ...queueItem,
          state: "SYNCING",
        }))
        refreshQueuedSubmissions()

        try {
          if (item.updates.length > 0) {
            await updateCollectorBookingPatients({
              bookingId: item.apiBookingId,
              updates: mapPatientUpdatesToApi(item.updates),
            })
          }

          await markCollectorBookingSampleCollected({
            bookingId: item.apiBookingId,
            eventId: item.eventId,
            collectedAt: item.collectedAt,
            rawEvent: {
              source: "collector_dashboard_web_offline_queue",
              queued_item_id: item.id,
            },
          })

          updateSampleSubmissionQueueItem(item.id, (queueItem) => ({
            ...queueItem,
            state: "SYNCED",
            lastErrorMessage: undefined,
          }))
          didSyncAny = true
          void triggerHapticFeedback("success")
        } catch (error) {
          updateSampleSubmissionQueueItem(item.id, (queueItem) => ({
            ...queueItem,
            state: "FAILED",
            retryCount: queueItem.retryCount + 1,
            lastErrorMessage: getApiErrorMessage(error),
          }))
        }
      }
    } finally {
      // Keep recent synced items visible briefly for status clarity.
      const now = Date.now()
      const compacted = readSampleSubmissionQueue().filter((item) => {
        if (item.state !== "SYNCED") return true
        const syncedAt = Date.parse(item.createdAt)
        if (Number.isNaN(syncedAt)) return false
        return now - syncedAt < 5 * 60 * 1000
      })
      writeSampleSubmissionQueue(compacted)
      refreshQueuedSubmissions()
      setIsSyncingQueue(false)
      isQueueSyncInProgressRef.current = false
    }

    if (didSyncAny) {
      await loadBookings(activeBucket)
    }
  }, [activeBucket, loadBookings, refreshQueuedSubmissions])

  React.useEffect(() => {
    void loadBookings(activeBucket)
  }, [activeBucket, loadBookings])

  React.useEffect(() => {
    refreshQueuedSubmissions()
    if (typeof window !== "undefined" && navigator.onLine) {
      void processQueuedSubmissions()
    }

    const onOnline = () => {
      void processQueuedSubmissions()
    }

    const intervalId = window.setInterval(() => {
      if (navigator.onLine) {
        void processQueuedSubmissions()
      }
    }, 30_000)

    window.addEventListener("online", onOnline)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("online", onOnline)
    }
  }, [processQueuedSubmissions, refreshQueuedSubmissions])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.matchMedia("(max-width: 767px)").matches) return

    let startY: number | null = null
    let latestDistance = 0
    const threshold = 70

    const resetPullState = () => {
      latestDistance = 0
      startY = null
      setPullDistance(0)
      setIsPullReady(false)
    }

    const onTouchStart = (event: TouchEvent) => {
      if (isBookingFormOpen || isRefreshing) return
      if (window.scrollY > 0) return
      startY = event.touches[0]?.clientY ?? null
      latestDistance = 0
      setPullDistance(0)
      setIsPullReady(false)
    }

    const onTouchMove = (event: TouchEvent) => {
      if (startY === null || isBookingFormOpen || isRefreshing) return
      if (window.scrollY > 0) return

      const currentY = event.touches[0]?.clientY ?? startY
      const delta = currentY - startY
      if (delta <= 0) {
        latestDistance = 0
        setPullDistance(0)
        setIsPullReady(false)
        return
      }

      latestDistance = Math.min(delta * 0.45, 88)
      setPullDistance(latestDistance)
      setIsPullReady(latestDistance >= threshold)
    }

    const onTouchEnd = () => {
      if (startY === null) return
      const shouldRefresh = latestDistance >= threshold && !isRefreshing
      resetPullState()

      if (shouldRefresh) {
        void triggerHapticFeedback("light")
        void loadBookings(activeBucket)
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [activeBucket, isBookingFormOpen, isRefreshing, loadBookings])

  const handleSavePatientUpdates = React.useCallback(
    async ({ booking, updates }: SaveBookingPatientsInput) => {
      if (!booking.apiBookingId) {
        throw new Error("Unable to submit. Booking API id is missing.")
      }

      if (updates.length === 0) {
        return
      }

      await updateCollectorBookingPatients({
        bookingId: booking.apiBookingId,
        updates: mapPatientUpdatesToApi(updates),
      })

      await loadBookings(activeBucket)
    },
    [activeBucket, loadBookings]
  )

  const handleSampleCollectionSubmit = React.useCallback(
    async ({
      booking,
      updates,
    }: SubmitSampleCollectionInput): Promise<SubmitSampleCollectionResult> => {
      if (!booking.apiBookingId) {
        throw new Error("Unable to submit. Booking API id is missing.")
      }

      const eventId = createSampleEventId(booking)
      const collectedAt = new Date().toISOString()

      try {
        if (updates.length > 0) {
          await updateCollectorBookingPatients({
            bookingId: booking.apiBookingId,
            updates: mapPatientUpdatesToApi(updates),
          })
        }

        await markCollectorBookingSampleCollected({
          bookingId: booking.apiBookingId,
          eventId,
          collectedAt,
          rawEvent: {
            source: "collector_dashboard_web",
          },
        })

        await loadBookings(activeBucket)
        void triggerHapticFeedback("success")
        return { syncState: "synced" }
      } catch (error) {
        if (isNetworkApiError(error)) {
          const queuedItem = pushSampleSubmissionQueueItem({
            bookingId: booking.bookingId,
            apiBookingId: booking.apiBookingId,
            updates,
            eventId,
            collectedAt,
          })
          refreshQueuedSubmissions()
          void triggerHapticFeedback("warning")
          return { syncState: "pending", queueId: queuedItem.id }
        }

        void triggerHapticFeedback("error")
        throw error
      }
    },
    [activeBucket, loadBookings, refreshQueuedSubmissions]
  )

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-x-hidden">
        <header className="safe-area-top bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex min-h-14 shrink-0 items-center border-b border-border/70 backdrop-blur md:static md:h-16 md:min-h-16 md:bg-transparent md:pt-0 md:backdrop-blur-none">
          <div className="flex min-w-0 items-center gap-2 px-3 py-2 sm:px-4 md:py-0">
            <SidebarTrigger className="-ml-1 h-9 w-9 rounded-full md:h-7 md:w-7" />
            <Separator
              orientation="vertical"
              className="mr-2 hidden data-[orientation=vertical]:h-4 md:block"
            />
            <div className="min-w-0 md:hidden">
              <h1 className="truncate text-sm font-semibold">Bookings</h1>
              <p className="text-muted-foreground text-[11px]">
                {activeBucket === "current" ? "Current queue" : "Past queue"}
              </p>
            </div>
            <Breadcrumb className="hidden md:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Bookings</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem className="hidden sm:block">
                  <BreadcrumbPage>
                    {activeBucket === "current" ? "Current" : "Past"} Overview
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-5 pt-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:py-6 md:pb-6">
          <div className="space-y-3 px-4 lg:px-6">
            {pullDistance > 0 ? (
              <div className="flex items-center justify-center md:hidden">
                <Badge variant="outline" className="gap-2">
                  <RefreshCw
                    className={cn("size-3.5", isPullReady && "animate-spin")}
                  />
                  {isPullReady ? "Release to refresh" : "Pull to refresh"}
                </Badge>
              </div>
            ) : null}
            <div className="grid grid-cols-[1fr_auto] items-center gap-2 md:hidden">
              <div className="bg-muted/60 flex items-center rounded-xl p-1">
                {bookingBuckets.map((bucket) => (
                  <Button
                    key={bucket.value}
                    size="sm"
                    className="mobile-touch-target h-9 flex-1 rounded-lg text-sm"
                    variant={activeBucket === bucket.value ? "default" : "ghost"}
                    onClick={() => {
                      void triggerHapticFeedback("light")
                      setActiveBucket(bucket.value)
                    }}
                  >
                    {bucket.label}
                  </Button>
                ))}
              </div>
              <Button
                size="icon"
                variant="outline"
                className="mobile-touch-target h-10 w-10 rounded-xl"
                disabled={isRefreshing}
                onClick={() => {
                  void triggerHapticFeedback("light")
                  void loadBookings(activeBucket)
                  void processQueuedSubmissions()
                }}
              >
                <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                <span className="sr-only">Refresh bookings</span>
              </Button>
            </div>

            <div className="hidden flex-wrap items-center gap-2 md:flex">
              {bookingBuckets.map((bucket) => (
                <Button
                  key={bucket.value}
                  size="sm"
                  variant={activeBucket === bucket.value ? "default" : "outline"}
                  onClick={() => {
                    void triggerHapticFeedback("light")
                    setActiveBucket(bucket.value)
                  }}
                >
                  {bucket.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={isRefreshing}
                onClick={() => {
                  void triggerHapticFeedback("light")
                  void loadBookings(activeBucket)
                  void processQueuedSubmissions()
                }}
              >
                <RefreshCw
                  className={cn("mr-2 size-4", isRefreshing && "animate-spin")}
                />
                Refresh
              </Button>
            </div>
            {syncSummary.total > 0 ? (
              <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {syncSummary.pending > 0 ? (
                    <Badge variant={mapSyncStateToBadgeVariant("PENDING")}>
                      <CloudOff className="mr-1 size-3.5" />
                      {sampleSyncStateLabels.PENDING}: {syncSummary.pending}
                    </Badge>
                  ) : null}
                  {(syncSummary.syncing > 0 || isSyncingQueue) ? (
                    <Badge variant={mapSyncStateToBadgeVariant("SYNCING")}>
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                      {sampleSyncStateLabels.SYNCING}:{" "}
                      {syncSummary.syncing || 1}
                    </Badge>
                  ) : null}
                  {syncSummary.failed > 0 ? (
                    <Badge variant={mapSyncStateToBadgeVariant("FAILED")}>
                      <CloudUpload className="mr-1 size-3.5" />
                      {sampleSyncStateLabels.FAILED}: {syncSummary.failed}
                    </Badge>
                  ) : null}
                  {syncSummary.synced > 0 ? (
                    <Badge variant={mapSyncStateToBadgeVariant("SYNCED")}>
                      <CheckCircle2 className="mr-1 size-3.5" />
                      {sampleSyncStateLabels.SYNCED}: {syncSummary.synced}
                    </Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={isSyncingQueue}
                    onClick={() => {
                      void processQueuedSubmissions()
                    }}
                  >
                    {isSyncingQueue ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      "Sync now"
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
            {isInitialLoading ? (
              <p className="text-muted-foreground text-xs">Loading bookings...</p>
            ) : null}
          </div>
          {isInitialLoading ? (
            <BookingsPageSkeleton />
          ) : apiError && rows.length === 0 ? (
            <div className="px-4 pb-2 lg:px-6">
              <PageErrorState
                title={isNetworkError ? "Network Error" : "Unable to load bookings"}
                description={apiError}
                isNetworkError={isNetworkError}
                errorCode={apiErrorCode}
                errorId={apiErrorId}
                reportIssueHref={pageErrorReportHref}
                onRetry={() => {
                  void triggerHapticFeedback("light")
                  void loadBookings(activeBucket)
                  void processQueuedSubmissions()
                }}
                isRetrying={isRefreshing}
              />
            </div>
          ) : (
            <>
              <OverviewCards items={overviewCards} />
              <BookingsTable
                rows={rows}
                onRowSelect={handleRowSelect}
                description="Live booking visibility for BoomHealth lab test operations"
                emptyTitle={
                  activeBucket === "current"
                    ? "No current bookings"
                    : "No past bookings"
                }
                emptyDescription={
                  activeBucket === "current"
                    ? "No active bookings are assigned to this collector at the moment."
                    : "No completed or cancelled bookings are available yet."
                }
                onRefresh={() => {
                  void triggerHapticFeedback("light")
                  void loadBookings(activeBucket)
                  void processQueuedSubmissions()
                }}
                isRefreshing={isRefreshing}
              />
            </>
          )}
        </div>
        <MobileBottomNav />
      </SidebarInset>
      <BookingFormDialog
        booking={selectedBooking}
        open={isBookingFormOpen}
        onOpenChange={setIsBookingFormOpen}
        onSavePatientUpdates={handleSavePatientUpdates}
        onSubmitSampleCollection={handleSampleCollectionSubmit}
      />
    </SidebarProvider>
  )
}
