export type BookingStatus =
  | "Pending"
  | "Confirmed"
  | "Collected"
  | "In Lab"
  | "Result Ready"
  | "Cancelled"

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
  patientName: string
  testName: string
  date: string
  slot: string
  status: BookingStatus
  amount: string | number
  patients?: BookingPatient[]
  bookingStatusRaw?: string
}
