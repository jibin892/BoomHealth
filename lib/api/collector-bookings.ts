import { apiClient } from "@/lib/api/client"
import { getCollectorPartyId } from "@/lib/api/config"
import { collectorBookingEndpoints } from "@/lib/api/endpoints"
import { toApiRequestError } from "@/lib/api/errors"
import type {
  CollectorBookingsQuery,
  CollectorBookingsResponse,
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
    throw toApiRequestError(error)
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
    throw toApiRequestError(error)
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
    throw toApiRequestError(error)
  }
}
