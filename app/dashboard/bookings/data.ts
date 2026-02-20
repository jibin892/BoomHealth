import type { OverviewCardItem } from "@/components/dashboard/overview-cards"
import type { BookingTableRow } from "@/lib/bookings/types"

const patientNames = [
  "Fatima A.",
  "Omar S.",
  "Aisha K.",
  "Noah M.",
  "Mariam R.",
  "Yousef N.",
  "Leila H.",
  "Ibrahim T.",
  "Sarah J.",
  "Khalid B.",
  "Nora W.",
  "Zain P.",
  "Hana L.",
  "Rayan Q.",
  "Mina D.",
  "Aria F.",
  "Tariq C.",
  "Lina G.",
  "Adam X.",
  "Reem V.",
]

const testNames = [
  "CBC + Vitamin D Panel",
  "Lipid Profile",
  "Thyroid Function Test",
  "HbA1c",
  "Comprehensive Metabolic Panel",
  "Liver Function Test",
  "Kidney Function Test",
  "Iron Profile",
  "CRP",
  "PCR Test",
]

const slots = [
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
]

const statuses: BookingTableRow["status"][] = [
  "Pending",
  "Confirmed",
  "Result Ready",
  "Cancelled",
  "Unknown",
]

export const bookingRows: BookingTableRow[] = Array.from(
  { length: 100 },
  (_, index) => {
    const bookingNumber = 11000 + index
    const day = ((index % 28) + 1).toString().padStart(2, "0")
    const amount = 120 + ((index * 11) % 290)

    return {
      bookingId: `BH-${bookingNumber}`,
      patientName: patientNames[index % patientNames.length],
      testName: testNames[index % testNames.length],
      date: `${day} Feb 2026`,
      slot: slots[index % slots.length],
      status: statuses[index % statuses.length],
      amount: `AED ${amount}`,
    }
  }
)

const pendingCount = bookingRows.filter(
  (booking) => booking.status === "Pending"
).length
const activeCount = bookingRows.filter(
  (booking) => booking.status === "Confirmed"
).length
const resultReadyCount = bookingRows.filter(
  (booking) => booking.status === "Result Ready"
).length

export const bookingOverviewCards: OverviewCardItem[] = [
  {
    title: "Total Bookings",
    value: `${bookingRows.length}`,
    change: "+12.4%",
    summary: "Compared to previous 7 days",
    trend: "up",
  },
  {
    title: "Pending Confirmation",
    value: `${pendingCount}`,
    change: "-8.1%",
    summary: "Pending callbacks by operations",
    trend: "down",
  },
  {
    title: "Active Bookings",
    value: `${activeCount}`,
    change: "+5.7%",
    summary: "Active collector assignments",
    trend: "up",
  },
  {
    title: "Results Delivered",
    value: `${resultReadyCount}`,
    change: "+10.2%",
    summary: "Delivered to patients this week",
    trend: "up",
  },
]
