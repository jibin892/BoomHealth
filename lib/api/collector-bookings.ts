import { apiClient } from "@/lib/api/client"
import { getCollectorPartyId } from "@/lib/api/config"
import { collectorBookingEndpoints } from "@/lib/api/endpoints"
import { toApiRequestError } from "@/lib/api/errors"
import { captureObservedError } from "@/lib/observability/telemetry"
import type {
  CollectorBookingItem,
  CollectorBookingsQuery,
  CollectorBookingsResponse,
  CollectorBookingStatus,
  MarkSampleCollectedRequest,
  MarkSampleCollectedResponse,
  UpdateBookingPatientsRequest,
  UpdateBookingPatientsResponse,
} from "@/lib/api/collector-bookings.types"

type ListBookingArgs = CollectorBookingsQuery & {
  collectorPartyId?: string
}

type UpdateBookingPatientsArgs = {
  bookingId: string | number
  collectorPartyId?: string
  updates: UpdateBookingPatientsRequest["updates"]
}

type MarkSampleCollectedArgs = {
  bookingId: string | number
  collectorPartyId?: string
  eventId?: string
  collectedAt?: string
  rawEvent?: Record<string, unknown>
}

function clampLimit(limit?: number) {
  if (!limit) return undefined
  return Math.min(Math.max(limit, 1), 200)
}

function buildBookingsParams({
  limit,
  beforeStartAt,
  statuses,
}: CollectorBookingsQuery = {}) {
  return {
    ...(clampLimit(limit) ? { limit: clampLimit(limit) } : {}),
    ...(beforeStartAt ? { before_start_at: beforeStartAt } : {}),
    ...(statuses && statuses.length > 0 ? { status: statuses.join(",") } : {}),
  }
}

const FALLBACK_STATUSES: CollectorBookingStatus[] = [
  "CREATED",
  "ACTIVE",
  "FULFILLED",
]

const FALLBACK_PATIENT_NAMES = [
  "Amina Hassan",
  "Omar Khalid",
  "Mariam Ali",
  "Yousef Saeed",
  "Noura Ahmed",
  "Hamad Rashid",
  "Fatima Noor",
  "Tariq Ibrahim",
  "Leila Hassan",
  "Zayed Khan",
]

function createFallbackBookingItem(index: number): CollectorBookingItem {
  const now = Date.now()
  const startAt = new Date(now + index * 30 * 60 * 1000)
  const endAt = new Date(startAt.getTime() + 45 * 60 * 1000)
  const createdAt = new Date(startAt.getTime() - 2 * 60 * 60 * 1000)
  const status = FALLBACK_STATUSES[index % FALLBACK_STATUSES.length]
  const amountExpected = 9_500 + (index % 8) * 2_500
  const bookingId = 700_000 + index
  const fallbackLat = 25.2048 + index * 0.002
  const fallbackLng = 55.2708 + index * 0.002

  return {
    booking_id: bookingId,
    order_id: `BH-${bookingId}`,
    booking_status: status,
    resource_type: "HOME_VISIT",
    resource_id: `collector-slot-${index + 1}`,
    location_label: "Dubai Home Visit",
    location_address: `Jumeirah District ${index + 1}, Dubai, UAE`,
    location_latitude: Number(fallbackLat.toFixed(6)),
    location_longitude: Number(fallbackLng.toFixed(6)),
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    created_at: createdAt.toISOString(),
    order_status: status === "FULFILLED" ? "COMPLETED" : "ACTIVE",
    amount_expected_aed_fils: amountExpected,
    amount_captured_aed_fils: status === "FULFILLED" ? amountExpected : 0,
    currency_expected: "AED",
    currency_captured: "AED",
    paid_at: status === "FULFILLED" ? endAt.toISOString() : null,
    patient_count: 1,
    patients: [
      {
        patient_id: `PT-${bookingId}`,
        name: FALLBACK_PATIENT_NAMES[index % FALLBACK_PATIENT_NAMES.length],
        age: 20 + (index % 35),
        gender: index % 2 === 0 ? "female" : "male",
        national_id: index % 4 === 0 ? null : `784-${index.toString().padStart(4, "0")}-0000000-1`,
        tests_count: 1 + (index % 3),
      },
    ],
  }
}

function buildFallbackCurrentBookingsResponse(
  collectorPartyId: string,
  query: CollectorBookingsQuery = {}
): CollectorBookingsResponse {
  const fallbackCount = 5
  const generatedItems = Array.from({ length: fallbackCount }, (_, index) =>
    createFallbackBookingItem(index)
  )

  const beforeStartAtMs = query.beforeStartAt
    ? Date.parse(query.beforeStartAt)
    : NaN
  const hasBeforeStartAt = Number.isFinite(beforeStartAtMs)

  const filteredByStatus =
    query.statuses && query.statuses.length > 0
      ? generatedItems.filter((item) =>
          query.statuses?.includes(item.booking_status as CollectorBookingStatus)
        )
      : generatedItems

  const filteredItems = hasBeforeStartAt
    ? filteredByStatus.filter(
        (item) => Date.parse(item.start_at) < (beforeStartAtMs as number)
      )
    : filteredByStatus

  const safeLimit = Math.min(clampLimit(query.limit) ?? fallbackCount, fallbackCount)
  const items = filteredItems.slice(0, safeLimit)

  return {
    collector: {
      party_id: collectorPartyId,
      display_name: "BoomHealth Collector (Fallback)",
    },
    bucket: "current",
    items,
    next_before_start_at:
      filteredItems.length > safeLimit ? filteredItems[safeLimit - 1]?.start_at : null,
  }
}

async function fetchBookings(
  bucket: "current" | "past",
  args: ListBookingArgs = {}
) {
  const collectorPartyId = args.collectorPartyId || getCollectorPartyId()
  const endpoint =
    bucket === "current"
      ? collectorBookingEndpoints.current(collectorPartyId)
      : collectorBookingEndpoints.past(collectorPartyId)

  try {
    const response = await apiClient.get<CollectorBookingsResponse>(endpoint, {
      params: buildBookingsParams(args),
    })

    return response.data
  } catch (error) {
    const apiError = toApiRequestError(error)

    if (
      bucket === "current" &&
      (apiError.status === 404 || apiError.isNetworkError)
    ) {
      console.warn(
        "[collector-bookings] current bookings request failed; using fallback dummy data for testing.",
        {
          status: apiError.status,
          code: apiError.code,
          message: apiError.message,
        }
      )
      return buildFallbackCurrentBookingsResponse(collectorPartyId, args)
    }

    captureObservedError(apiError, {
      area: "collector_bookings_fetch",
      metadata: {
        bucket,
        collectorPartyId,
        code: apiError.code,
        status: apiError.status,
      },
    })

    throw apiError
  }
}

export async function getCurrentCollectorBookings(args: ListBookingArgs = {}) {
  return fetchBookings("current", args)
}

export async function getPastCollectorBookings(args: ListBookingArgs = {}) {
  return fetchBookings("past", args)
}

export async function updateCollectorBookingPatients({
  bookingId,
  collectorPartyId,
  updates,
}: UpdateBookingPatientsArgs) {
  if (updates.length === 0) {
    throw toApiRequestError(new Error("At least one patient update is required"))
  }

  const endpoint = collectorBookingEndpoints.patients(
    collectorPartyId || getCollectorPartyId(),
    bookingId
  )

  try {
    const response = await apiClient.patch<UpdateBookingPatientsResponse>(
      endpoint,
      {
        updates,
      }
    )

    return response.data
  } catch (error) {
    const apiError = toApiRequestError(error)
    captureObservedError(apiError, {
      area: "collector_booking_patients_update",
      metadata: {
        bookingId: String(bookingId),
        collectorPartyId: collectorPartyId || getCollectorPartyId(),
        code: apiError.code,
        status: apiError.status,
      },
    })
    throw apiError
  }
}

export async function markCollectorBookingSampleCollected({
  bookingId,
  collectorPartyId,
  eventId,
  collectedAt,
  rawEvent,
}: MarkSampleCollectedArgs) {
  const endpoint = collectorBookingEndpoints.sampleCollected(
    collectorPartyId || getCollectorPartyId(),
    bookingId
  )

  const payload: MarkSampleCollectedRequest = {
    ...(eventId ? { event_id: eventId } : {}),
    ...(collectedAt ? { collected_at: collectedAt } : {}),
    ...(rawEvent ? { raw_event: rawEvent } : {}),
  }

  try {
    const response = await apiClient.patch<MarkSampleCollectedResponse>(
      endpoint,
      payload
    )

    return response.data
  } catch (error) {
    const apiError = toApiRequestError(error)
    captureObservedError(apiError, {
      area: "collector_booking_sample_collected",
      metadata: {
        bookingId: String(bookingId),
        collectorPartyId: collectorPartyId || getCollectorPartyId(),
        code: apiError.code,
        status: apiError.status,
      },
    })
    throw apiError
  }
}
