import type { OverviewCardItem } from "@/components/dashboard/overview-cards"
import type { CollectorBookingItem } from "@/lib/api/collector-bookings.types"
import type {
  BookingPatient,
  BookingStatus,
  BookingTableRow,
} from "@/lib/bookings/types"

const DISPLAY_TIME_ZONE = "Asia/Dubai"

function formatDate(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(parsed)
}

function formatTime(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DISPLAY_TIME_ZONE,
  }).format(parsed)
}

function formatSlot(startAt: string, endAt?: string | null) {
  if (!endAt) {
    return formatTime(startAt)
  }

  return `${formatTime(startAt)}-${formatTime(endAt)}`
}

function mapBookingStatus(status: string): BookingStatus {
  switch (status) {
    case "CREATED":
      return "Pending"
    case "ACTIVE":
      return "Confirmed"
    case "FULFILLED":
      return "Result Ready"
    case "CANCELLED":
      return "Cancelled"
    default:
      return "Unknown"
  }
}

function mapPatients(item: CollectorBookingItem): BookingPatient[] {
  return (item.patients || []).map((patient) => ({
    patientId: patient.patient_id,
    name: patient.name,
    age: patient.age ?? null,
    gender: patient.gender ?? null,
    nationalId: patient.national_id ?? null,
    testsCount: patient.tests_count ?? null,
  }))
}

function mapTestName(patients: BookingPatient[]) {
  const totalTests = patients.reduce(
    (sum, patient) => sum + (patient.testsCount || 0),
    0
  )

  if (totalTests <= 0) {
    return "Lab Test"
  }

  return `${totalTests} ${totalTests === 1 ? "Test" : "Tests"}`
}

function mapAmountAed(item: CollectorBookingItem) {
  const captured = item.amount_captured_aed_fils || 0
  const expected = item.amount_expected_aed_fils || 0
  const fils = captured > 0 ? captured : expected
  return Number((fils / 100).toFixed(2))
}

function parseNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function getStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

export function mapCollectorBookingToTableRow(
  item: CollectorBookingItem
): BookingTableRow {
  const patients = mapPatients(item)
  const primaryPatientName = patients[0]?.name || "Patient"
  const additionalPatients = Math.max(0, patients.length - 1)
  const rawItem = item as unknown as Record<string, unknown>
  const nestedLocation =
    rawItem.location && typeof rawItem.location === "object"
      ? (rawItem.location as Record<string, unknown>)
      : undefined
  const latitude =
    parseNumberOrNull(item.location_latitude) ??
    parseNumberOrNull(rawItem.latitude) ??
    parseNumberOrNull(rawItem.lat) ??
    parseNumberOrNull(nestedLocation?.latitude) ??
    parseNumberOrNull(nestedLocation?.lat)
  const longitude =
    parseNumberOrNull(item.location_longitude) ??
    parseNumberOrNull(rawItem.longitude) ??
    parseNumberOrNull(rawItem.lng) ??
    parseNumberOrNull(nestedLocation?.longitude) ??
    parseNumberOrNull(nestedLocation?.lng)
  const locationAddress =
    item.location_address ??
    (typeof rawItem.address === "string" ? rawItem.address : null) ??
    (typeof rawItem.location_address === "string" ? rawItem.location_address : null) ??
    (typeof nestedLocation?.formatted === "string" ? nestedLocation.formatted : null) ??
    (typeof rawItem.service_address === "string" ? rawItem.service_address : null) ??
    (typeof rawItem.customer_address === "string" ? rawItem.customer_address : null)
  const locationLabel =
    item.location_label ??
    (typeof rawItem.location_label === "string" ? rawItem.location_label : null) ??
    (typeof rawItem.location_name === "string" ? rawItem.location_name : null)
  const nestedCustomer =
    rawItem.customer && typeof rawItem.customer === "object"
      ? (rawItem.customer as Record<string, unknown>)
      : undefined
  const customerPhone =
    getStringOrNull(item.customer_phone) ??
    getStringOrNull(rawItem.customer_phone) ??
    getStringOrNull(rawItem.phone) ??
    getStringOrNull(rawItem.phone_number) ??
    getStringOrNull(rawItem.mobile) ??
    getStringOrNull(rawItem.mobile_number) ??
    getStringOrNull(rawItem.customer_mobile) ??
    getStringOrNull(rawItem.customer_phone_number) ??
    getStringOrNull(nestedCustomer?.phone) ??
    getStringOrNull(nestedCustomer?.phone_number) ??
    getStringOrNull(nestedCustomer?.mobile) ??
    getStringOrNull(nestedCustomer?.mobile_number)

  return {
    bookingId: item.order_id || `BK-${item.booking_id}`,
    apiBookingId: item.booking_id,
    orderId: item.order_id || null,
    customerPhone,
    bookingStatusRaw: item.booking_status,
    orderStatus: item.order_status ?? null,
    resourceType: item.resource_type ?? null,
    resourceId: item.resource_id ?? null,
    locationId:
      typeof nestedLocation?.address_id === "string" ? nestedLocation.address_id : null,
    locationLabel,
    locationAddress,
    locationLine1: typeof nestedLocation?.line1 === "string" ? nestedLocation.line1 : null,
    locationLine2: typeof nestedLocation?.line2 === "string" ? nestedLocation.line2 : null,
    locationBuildingName:
      typeof nestedLocation?.building_name === "string" ? nestedLocation.building_name : null,
    locationFloorNumber:
      typeof nestedLocation?.floor_number === "string" ? nestedLocation.floor_number : null,
    locationArea: typeof nestedLocation?.area === "string" ? nestedLocation.area : null,
    locationCity: typeof nestedLocation?.city === "string" ? nestedLocation.city : null,
    locationEmirate:
      typeof nestedLocation?.emirate === "string" ? nestedLocation.emirate : null,
    locationCountry:
      typeof nestedLocation?.country === "string" ? nestedLocation.country : null,
    locationLatitude: latitude,
    locationLongitude: longitude,
    startAt: item.start_at,
    endAt: item.end_at ?? null,
    createdAt: item.created_at ?? null,
    paidAt: item.paid_at ?? null,
    patientCount: item.patient_count ?? null,
    patientName:
      additionalPatients > 0
        ? `${primaryPatientName} +${additionalPatients}`
        : primaryPatientName,
    testName: mapTestName(patients),
    date: formatDate(item.start_at),
    slot: formatSlot(item.start_at, item.end_at),
    status: mapBookingStatus(item.booking_status),
    amount: mapAmountAed(item),
    patients,
  }
}

export function buildBookingOverviewCards(rows: BookingTableRow[]): OverviewCardItem[] {
  const total = rows.length
  const pending = rows.filter((row) => row.status === "Pending").length
  const active = rows.filter((row) => row.status === "Confirmed").length
  const completed = rows.filter((row) => row.status === "Result Ready").length

  return [
    {
      title: "Total Bookings",
      value: String(total),
      change: "Live",
      summary: "Bookings loaded from collector API",
      trend: "up",
    },
    {
      title: "Pending Confirmation",
      value: String(pending),
      change: "Live",
      summary: "Requires confirmation from operations",
      trend: pending > 0 ? "up" : "down",
    },
    {
      title: "Active Bookings",
      value: String(active),
      change: "Live",
      summary: "Active bookings currently in execution window",
      trend: active > 0 ? "up" : "down",
    },
    {
      title: "Results Delivered",
      value: String(completed),
      change: "Live",
      summary: "Marked fulfilled and ready for patients",
      trend: completed > 0 ? "up" : "down",
    },
  ]
}
