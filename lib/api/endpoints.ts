function encodeSegment(value: string | number) {
  return encodeURIComponent(String(value))
}

export const collectorBookingEndpoints = {
  current(collectorPartyId: string) {
    return `/collectors/${encodeSegment(collectorPartyId)}/bookings/current`
  },
  past(collectorPartyId: string) {
    return `/collectors/${encodeSegment(collectorPartyId)}/bookings/past`
  },
  patients(collectorPartyId: string, bookingId: string | number) {
    return `/collectors/${encodeSegment(collectorPartyId)}/bookings/${encodeSegment(bookingId)}/patients`
  },
  sampleCollected(collectorPartyId: string, bookingId: string | number) {
    return `/collectors/${encodeSegment(collectorPartyId)}/bookings/${encodeSegment(bookingId)}/sample-collected`
  },
}
