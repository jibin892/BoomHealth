export type RevenueRow = {
  month: string
  bookings: number
  collected: number
  pending: number
  net: number
}

export const revenueRows: RevenueRow[] = [
  { month: "Jan 2026", bookings: 312, collected: 82460, pending: 11230, net: 71230 },
  { month: "Feb 2026", bookings: 338, collected: 89510, pending: 12340, net: 77170 },
  { month: "Mar 2026", bookings: 355, collected: 93420, pending: 10480, net: 82940 },
  { month: "Apr 2026", bookings: 362, collected: 95980, pending: 10820, net: 85160 },
  { month: "May 2026", bookings: 348, collected: 90210, pending: 11790, net: 78420 },
  { month: "Jun 2026", bookings: 371, collected: 98740, pending: 12060, net: 86680 },
]
