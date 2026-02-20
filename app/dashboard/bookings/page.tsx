"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  BookingFormDialog,
  type SaveBookingPatientsInput,
  type SubmitSampleCollectionInput,
} from "@/components/dashboard/booking-form-dialog"
import { BookingsTable } from "@/components/dashboard/bookings-table"
import { OverviewCards } from "@/components/dashboard/overview-cards"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
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
import { getApiErrorMessage, isNetworkApiError } from "@/lib/api/errors"
import {
  buildBookingOverviewCards,
  mapCollectorBookingToTableRow,
} from "@/lib/bookings/mappers"
import type { BookingTableRow } from "@/lib/bookings/types"
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

  const overviewCards = React.useMemo(() => buildBookingOverviewCards(rows), [rows])

  const handleRowSelect = React.useCallback((row: BookingTableRow) => {
    setSelectedBooking(row)
    setIsBookingFormOpen(true)
  }, [])

  const loadBookings = React.useCallback(async (bucket: CollectorBookingBucket) => {
    setIsRefreshing(true)

    // Keep error state visible while retrying from an empty/error screen,
    // so the layout does not flash to "Recent Bookings" and back.
    if (rows.length > 0) {
      setApiError(null)
      setIsNetworkError(false)
    }

    try {
      const response =
        bucket === "current"
          ? await getCurrentCollectorBookings({ limit: 200 })
          : await getPastCollectorBookings({ limit: 200 })

      setRows(response.items.map(mapCollectorBookingToTableRow))
      setApiError(null)
      setIsNetworkError(false)
    } catch (error) {
      setRows([])
      setApiError(getApiErrorMessage(error))
      setIsNetworkError(isNetworkApiError(error))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [rows.length])

  React.useEffect(() => {
    void loadBookings(activeBucket)
  }, [activeBucket, loadBookings])

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
    async ({ booking, updates }: SubmitSampleCollectionInput) => {
      if (!booking.apiBookingId) {
        throw new Error("Unable to submit. Booking API id is missing.")
      }

      if (updates.length > 0) {
        await updateCollectorBookingPatients({
          bookingId: booking.apiBookingId,
          updates: mapPatientUpdatesToApi(updates),
        })
      }

      await markCollectorBookingSampleCollected({
        bookingId: booking.apiBookingId,
        eventId: createSampleEventId(booking),
        collectedAt: new Date().toISOString(),
        rawEvent: {
          source: "collector_dashboard_web",
        },
      })

      await loadBookings(activeBucket)
    },
    [activeBucket, loadBookings]
  )

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
        <div className="flex flex-1 flex-col gap-4 py-4 pb-20 md:py-6 md:pb-6">
          <div className="space-y-2 px-4 lg:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {bookingBuckets.map((bucket) => (
                <Button
                  key={bucket.value}
                  size="sm"
                  variant={activeBucket === bucket.value ? "default" : "outline"}
                  onClick={() => setActiveBucket(bucket.value)}
                >
                  {bucket.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={isRefreshing}
                onClick={() => {
                  void loadBookings(activeBucket)
                }}
              >
                <RefreshCw
                  className={cn("mr-2 size-4", isRefreshing && "animate-spin")}
                />
                Refresh
              </Button>
            </div>
            {isLoading ? (
              <p className="text-muted-foreground text-xs">Loading bookings...</p>
            ) : null}
          </div>
          <OverviewCards items={overviewCards} />
          {apiError && rows.length === 0 ? (
            <div className="px-4 lg:px-6">
              <PageErrorState
                title={isNetworkError ? "Network Error" : "Unable to load bookings"}
                description={apiError}
                isNetworkError={isNetworkError}
                onRetry={() => {
                  void loadBookings(activeBucket)
                }}
                isRetrying={isRefreshing}
              />
            </div>
          ) : (
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
                void loadBookings(activeBucket)
              }}
              isRefreshing={isRefreshing}
            />
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
