export type CollectorBookingStatus =
  | "CREATED"
  | "ACTIVE"
  | "FULFILLED"
  | "CANCELLED"

export type CollectorBookingBucket = "current" | "past"

export type CollectorBookingsQuery = {
  limit?: number
  beforeStartAt?: string
  statuses?: CollectorBookingStatus[]
}

export type CollectorReference = {
  party_id: string
  display_name: string
}

export type CollectorBookingPatient = {
  patient_id: string
  name: string
  age?: number | null
  gender?: string | null
  national_id?: string | null
  tests_count?: number | null
}

export type CollectorBookingItem = {
  booking_id: number
  order_id?: string | null
  booking_status: CollectorBookingStatus | string
  resource_type?: string | null
  resource_id?: string | null
  start_at: string
  end_at?: string | null
  created_at?: string | null
  order_status?: string | null
  amount_expected_aed_fils?: number | null
  amount_captured_aed_fils?: number | null
  currency_expected?: string | null
  currency_captured?: string | null
  paid_at?: string | null
  patients?: CollectorBookingPatient[]
  patient_count?: number | null
}

export type CollectorBookingsResponse = {
  collector: CollectorReference
  bucket: CollectorBookingBucket | string
  items: CollectorBookingItem[]
  next_before_start_at?: string | null
}

export type UpdateBookingPatientPayload = {
  current_patient_id: string
  new_patient_id?: string
  name?: string
  age?: number
  gender?: string
  national_id?: string
}

export type UpdateBookingPatientsRequest = {
  updates: UpdateBookingPatientPayload[]
}

export type UpdateBookingPatientsResponse = {
  status: "updated" | string
  booking_id: number
  order_id?: string | null
  collector: CollectorReference
  patients: CollectorBookingPatient[]
  remap?: Array<{
    from_patient_id: string
    to_patient_id: string
  }>
}

export type MarkSampleCollectedRequest = {
  event_id?: string
  collected_at?: string
  raw_event?: Record<string, unknown>
}

export type MarkSampleCollectedResponse = {
  status: "started" | string
  event?: string
  booking_id: number
  order_id?: string | null
  booking_status?: string
  collector: CollectorReference
  workflow_run_id?: string | null
  temporal_workflow_id?: string | null
  temporal_run_id?: string | null
}
