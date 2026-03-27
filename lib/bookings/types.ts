export type BookingStatus =
  | "Pending"
  | "Confirmed"
  | "Result Ready"
  | "Cancelled"
  | "Unknown"

export type BookingPatient = {
  patientId: string
  name: string
  age?: number | null
  gender?: string | null
  nationalId?: string | null
  testsCount?: number | null
}

export type BookingTableRow = {
  bookingId: string
  apiBookingId?: number
  orderId?: string | null
  customerPhone?: string | null
  bookingStatusRaw?: string
  orderStatus?: string | null
  resourceType?: string | null
  resourceId?: string | null
  locationId?: string | null
  locationLabel?: string | null
  locationAddress?: string | null
  locationLine1?: string | null
  locationLine2?: string | null
  locationBuildingName?: string | null
  locationFloorNumber?: string | null
  locationArea?: string | null
  locationCity?: string | null
  locationEmirate?: string | null
  locationCountry?: string | null
  locationLatitude?: number | null
  locationLongitude?: number | null
  startAt?: string
  endAt?: string | null
  createdAt?: string | null
  paidAt?: string | null
  patientCount?: number | null
  patientName: string
  testName: string
  date: string
  slot: string
  status: BookingStatus
  amount: string | number
  patients?: BookingPatient[]
}
