"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  BookingFormDialog,
  type SubmitSampleCollectionInput,
} from "@/components/dashboard/booking-form-dialog"
import { BookingsTable } from "@/components/dashboard/bookings-table"
import { OverviewCards } from "@/components/dashboard/overview-cards"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
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
import { getApiErrorMessage } from "@/lib/api/errors"
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

  const overviewCards = React.useMemo(() => buildBookingOverviewCards(rows), [rows])

  const handleRowSelect = React.useCallback((row: BookingTableRow) => {
    setSelectedBooking(row)
    setIsBookingFormOpen(true)
  }, [])

  const loadBookings = React.useCallback(async (bucket: CollectorBookingBucket) => {
    setIsRefreshing(true)
    setApiError(null)

    try {
      const response =
        bucket === "current"
          ? await getCurrentCollectorBookings({ limit: 200 })
          : await getPastCollectorBookings({ limit: 200 })

      setRows(response.items.map(mapCollectorBookingToTableRow))
    } catch (error) {
      setRows([])
      setApiError(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    void loadBookings(activeBucket)
  }, [activeBucket, loadBookings])

  const handleSampleCollectionSubmit = React.useCallback(
    async ({ booking, nationalId }: SubmitSampleCollectionInput) => {
      if (!booking.apiBookingId) {
        throw new Error("Unable to submit. Booking API id is missing.")
      }

      const patientUpdates = (booking.patients || [])
        .filter((patient) => patient.patientId)
        .map((patient) => ({
          current_patient_id: patient.patientId,
          national_id: patient.nationalId?.trim() || nationalId,
        }))

      if (patientUpdates.length > 0) {
        await updateCollectorBookingPatients({
          bookingId: booking.apiBookingId,
          updates: patientUpdates,
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
            {apiError ? (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {apiError}
              </p>
            ) : null}
          </div>
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
              void loadBookings(activeBucket)
            }}
            isRefreshing={isRefreshing}
          />
        </div>
        <MobileBottomNav />
      </SidebarInset>
      <BookingFormDialog
        booking={selectedBooking}
        open={isBookingFormOpen}
        onOpenChange={setIsBookingFormOpen}
        onSubmitSampleCollection={handleSampleCollectionSubmit}
      />
    </SidebarProvider>
  )
}
