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
  bookingStatusRaw?: string
  orderStatus?: string | null
  resourceType?: string | null
  resourceId?: string | null
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
