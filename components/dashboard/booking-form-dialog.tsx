"use client"

import * as React from "react"
import {
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  FlaskConical,
  UserRound,
} from "lucide-react"

import type { BookingTableRow } from "@/lib/bookings/types"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatAedAmount } from "@/lib/currency"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"

export type SubmitSampleCollectionInput = {
  booking: BookingTableRow
  nationalId: string
  idDocumentFile: File
}

type BookingFormDialogProps = {
  booking: BookingTableRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitSampleCollection?: (
    payload: SubmitSampleCollectionInput
  ) => Promise<void>
}

type BookingFormState = {
  bookingId: string
  patientName: string
  phone: string
  nationalId: string
  testName: string
  date: string
  slot: string
  status: string
  amount: string
  address: string
  notes: string
}

const sectionItems = [
  { name: "Booking Details", icon: ClipboardList },
  { name: "Patient", icon: UserRound },
  { name: "Test & Sample", icon: FlaskConical },
  { name: "Schedule", icon: CalendarClock },
  { name: "Billing", icon: CircleDollarSign },
]

function getDefaultFormState(booking: BookingTableRow | null): BookingFormState {
  if (!booking) {
    return {
      bookingId: "",
      patientName: "",
      phone: "",
      nationalId: "",
      testName: "",
      date: "",
      slot: "",
      status: "",
      amount: "",
      address: "",
      notes: "",
    }
  }

  return {
    bookingId: booking.bookingId,
    patientName: booking.patientName,
    phone: "+971-5X-XXX-XXXX",
    nationalId: booking.patients?.[0]?.nationalId || "",
    testName: booking.testName,
    date: booking.date,
    slot: booking.slot,
    status: booking.status,
    amount: formatAedAmount(booking.amount),
    address: "Dubai, UAE",
    notes: "",
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Failed to submit sample collection. Please try again."
}

export function BookingFormDialog({
  booking,
  open,
  onOpenChange,
  onSubmitSampleCollection,
}: BookingFormDialogProps) {
  const [formState, setFormState] = React.useState<BookingFormState>(
    getDefaultFormState(booking)
  )
  const [showSampleCollection, setShowSampleCollection] = React.useState(false)
  const [isCaptureDevice, setIsCaptureDevice] = React.useState(false)
  const [idDocumentFile, setIdDocumentFile] = React.useState<File | null>(null)
  const [isSubmitted, setIsSubmitted] = React.useState(false)
  const [isSubmittingSample, setIsSubmittingSample] = React.useState(false)
  const [sampleSubmitError, setSampleSubmitError] = React.useState<string | null>(
    null
  )
  const desktopUploadInputRef = React.useRef<HTMLInputElement>(null)
  const captureInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setFormState(getDefaultFormState(booking))
      setShowSampleCollection(false)
      setIdDocumentFile(null)
      setIsSubmitted(false)
      setIsSubmittingSample(false)
      setSampleSubmitError(null)
    }
  }, [booking, open])

  React.useEffect(() => {
    const detectCaptureDevice = () => {
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches
      const mobileOrTabletAgent =
        /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent)
      setIsCaptureDevice(coarsePointer || mobileOrTabletAgent)
    }

    detectCaptureDevice()
    window.addEventListener("resize", detectCaptureDevice)
    return () => window.removeEventListener("resize", detectCaptureDevice)
  }, [])

  const handleSampleSubmit = React.useCallback(async () => {
    if (!booking || !idDocumentFile) {
      return
    }

    const nationalId = formState.nationalId.trim()

    if (!nationalId) {
      setSampleSubmitError("National ID or Passport number is required")
      setIsSubmitted(false)
      return
    }

    if (!onSubmitSampleCollection) {
      setSampleSubmitError(null)
      setIsSubmitted(true)
      return
    }

    setIsSubmittingSample(true)
    setIsSubmitted(false)
    setSampleSubmitError(null)

    try {
      await onSubmitSampleCollection({
        booking,
        nationalId,
        idDocumentFile,
      })

      setIsSubmitted(true)
      setFormState((previous) => ({ ...previous, status: "Collected" }))
    } catch (error) {
      setSampleSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmittingSample(false)
    }
  }, [booking, formState.nationalId, idDocumentFile, onSubmitSampleCollection])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[95dvh] max-h-[95dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-[640px] md:h-auto md:max-h-[560px] md:max-w-[860px] lg:max-w-[980px]">
        <DialogTitle className="sr-only">Booking Form</DialogTitle>
        <DialogDescription className="sr-only">
          View and edit selected booking details.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden border-r md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sectionItems.map((item, index) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          isActive={index === 0}
                          className="pointer-events-none"
                        >
                          <item.icon />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[calc(95dvh-4rem)] flex-1 flex-col overflow-hidden md:h-[520px]">
            <header className="flex h-16 shrink-0 items-center border-b">
              <div className="flex min-w-0 items-center gap-2 px-3 sm:px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage>Bookings</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" />
                    <BreadcrumbItem className="hidden sm:block">
                      <BreadcrumbPage>
                        {booking?.bookingId ?? "Booking Form"}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <form
                className="space-y-4 md:space-y-5"
                onSubmit={(event) => event.preventDefault()}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="booking-id">Booking ID</Label>
                    <Input
                      id="booking-id"
                      value={formState.bookingId}
                      readOnly
                      className="opacity-90"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Input
                      id="status"
                      value={formState.status}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-name">Patient Name</Label>
                    <Input
                      id="patient-name"
                      value={formState.patientName}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          patientName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formState.phone}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="national-id">National ID / Passport</Label>
                    <Input
                      id="national-id"
                      value={formState.nationalId}
                      onChange={(event) => {
                        setFormState((prev) => ({
                          ...prev,
                          nationalId: event.target.value,
                        }))
                        setIsSubmitted(false)
                        setSampleSubmitError(null)
                      }}
                      placeholder="Enter Emirates ID or Passport number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="test-name">Test Name</Label>
                    <Input
                      id="test-name"
                      value={formState.testName}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          testName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      value={formState.amount}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          amount: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      value={formState.date}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          date: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slot">Time Slot</Label>
                    <Input
                      id="slot"
                      value={formState.slot}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          slot: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formState.address}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        address: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Add lab or operations notes..."
                  />
                </div>
                <div className="space-y-3 rounded-md border p-3 md:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Sample Collection</p>
                      <p className="text-muted-foreground text-xs">
                        Mark this booking as collected and attach EID/Passport.
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setShowSampleCollection(true)
                        setFormState((prev) => ({ ...prev, status: "Collected" }))
                      }}
                    >
                      Mark as Sample Collected
                    </Button>
                  </div>

                  {showSampleCollection ? (
                    <div className="space-y-3 border-t pt-3">
                      <p className="text-muted-foreground text-xs">
                        {isCaptureDevice
                          ? "Capture EID/Passport image (Mobile/Tablet)"
                          : "Upload EID/Passport image (Desktop/Laptop)"}
                      </p>

                      <input
                        ref={desktopUploadInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setIdDocumentFile(file)
                          setIsSubmitted(false)
                          setSampleSubmitError(null)
                        }}
                      />

                      <input
                        ref={captureInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setIdDocumentFile(file)
                          setIsSubmitted(false)
                          setSampleSubmitError(null)
                        }}
                      />

                      {isCaptureDevice ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => captureInputRef.current?.click()}
                        >
                          Capture EID / Passport
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => desktopUploadInputRef.current?.click()}
                        >
                          Upload EID / Passport
                        </Button>
                      )}

                      {idDocumentFile ? (
                        <p className="text-muted-foreground text-xs">
                          Selected file: {idDocumentFile.name}
                        </p>
                      ) : null}

                      <Button
                        type="button"
                        className="w-full sm:w-auto"
                        disabled={!idDocumentFile || isSubmittingSample}
                        onClick={() => {
                          void handleSampleSubmit()
                        }}
                      >
                        {isSubmittingSample ? "Submitting..." : "Submit"}
                      </Button>

                      {sampleSubmitError ? (
                        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                          {sampleSubmitError}
                        </p>
                      ) : null}

                      {isSubmitted ? (
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Sample collection submitted successfully.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => onOpenChange(false)}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
