"use client"

import * as React from "react"
import {
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  FlaskConical,
  UserRound,
} from "lucide-react"

import type { BookingPatient, BookingTableRow } from "@/lib/bookings/types"
import {
  getApiErrorCode,
  getApiErrorMessage,
  getMissingPatientIds,
} from "@/lib/api/errors"
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

export type BookingPatientUpdate = {
  currentPatientId: string
  newPatientId?: string
  name?: string
  age?: number
  gender?: string
  nationalId?: string
}

export type SaveBookingPatientsInput = {
  booking: BookingTableRow
  updates: BookingPatientUpdate[]
}

export type SubmitSampleCollectionInput = SaveBookingPatientsInput & {
  idDocumentFile: File
}

type BookingFormDialogProps = {
  booking: BookingTableRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSavePatientUpdates?: (payload: SaveBookingPatientsInput) => Promise<void>
  onSubmitSampleCollection?: (
    payload: SubmitSampleCollectionInput
  ) => Promise<void>
}

type BookingPatientForm = {
  currentPatientId: string
  newPatientId: string
  name: string
  age: string
  gender: string
  nationalId: string
  testsCount: number | null
}

const sectionItems = [
  { name: "Booking Details", icon: ClipboardList },
  { name: "Patient Snapshot", icon: UserRound },
  { name: "Sample Collection", icon: FlaskConical },
  { name: "Schedule", icon: CalendarClock },
  { name: "Billing", icon: CircleDollarSign },
]

function mapPatientsToForms(patients: BookingPatient[]): BookingPatientForm[] {
  return patients.map((patient) => ({
    currentPatientId: patient.patientId,
    newPatientId: "",
    name: patient.name || "",
    age: patient.age === null || patient.age === undefined ? "" : String(patient.age),
    gender: patient.gender || "",
    nationalId: patient.nationalId || "",
    testsCount: patient.testsCount ?? null,
  }))
}

function parseAge(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const parsed = Number(trimmed)
  if (Number.isNaN(parsed)) return undefined

  return parsed
}

function buildPatientUpdates(
  forms: BookingPatientForm[],
  sourcePatients: BookingPatient[]
): BookingPatientUpdate[] {
  const sourceMap = new Map(sourcePatients.map((patient) => [patient.patientId, patient]))

  return forms
    .map<BookingPatientUpdate | null>((form) => {
      const sourcePatient = sourceMap.get(form.currentPatientId)
      if (!sourcePatient) return null

      const nextName = form.name.trim()
      const nextNewPatientId = form.newPatientId.trim()
      const nextGender = form.gender.trim()
      const nextNationalId = form.nationalId.trim()
      const nextAge = parseAge(form.age)

      const update: BookingPatientUpdate = {
        currentPatientId: form.currentPatientId,
      }

      if (nextNewPatientId && nextNewPatientId !== form.currentPatientId) {
        update.newPatientId = nextNewPatientId
      }

      if (nextName && nextName !== sourcePatient.name) {
        update.name = nextName
      }

      if (nextAge !== undefined && nextAge !== sourcePatient.age) {
        update.age = nextAge
      }

      if (nextGender && nextGender !== (sourcePatient.gender || "")) {
        update.gender = nextGender
      }

      if (nextNationalId !== (sourcePatient.nationalId || "")) {
        update.nationalId = nextNationalId
      }

      return Object.keys(update).length > 1 ? update : null
    })
    .filter((item): item is BookingPatientUpdate => Boolean(item))
}

function getSourcePatients(booking: BookingTableRow | null) {
  return booking?.patients || []
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed)
}

function getSampleSubmissionError(error: unknown) {
  const code = getApiErrorCode(error)
  const message = getApiErrorMessage(error)

  if (code === "missing_patient_national_id") {
    const missingIds = getMissingPatientIds(error)
    if (missingIds.length > 0) {
      return `${message} Missing: ${missingIds.join(", ")}`
    }
  }

  return message
}

export function BookingFormDialog({
  booking,
  open,
  onOpenChange,
  onSavePatientUpdates,
  onSubmitSampleCollection,
}: BookingFormDialogProps) {
  const [patientForms, setPatientForms] = React.useState<BookingPatientForm[]>([])
  const [showSampleCollection, setShowSampleCollection] = React.useState(false)
  const [isCaptureDevice, setIsCaptureDevice] = React.useState(false)
  const [idDocumentFile, setIdDocumentFile] = React.useState<File | null>(null)
  const [isSavingPatients, setIsSavingPatients] = React.useState(false)
  const [isSubmittingSample, setIsSubmittingSample] = React.useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = React.useState<string | null>(
    null
  )
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null)
  const [sampleSuccessMessage, setSampleSuccessMessage] = React.useState<
    string | null
  >(null)
  const [sampleErrorMessage, setSampleErrorMessage] = React.useState<
    string | null
  >(null)

  const desktopUploadInputRef = React.useRef<HTMLInputElement>(null)
  const captureInputRef = React.useRef<HTMLInputElement>(null)

  const sourcePatients = React.useMemo(() => getSourcePatients(booking), [booking])

  React.useEffect(() => {
    if (open) {
      setPatientForms(mapPatientsToForms(sourcePatients))
      setShowSampleCollection(false)
      setIdDocumentFile(null)
      setIsSavingPatients(false)
      setIsSubmittingSample(false)
      setSaveSuccessMessage(null)
      setSaveErrorMessage(null)
      setSampleSuccessMessage(null)
      setSampleErrorMessage(null)
    }
  }, [open, sourcePatients])

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

  const patientUpdates = React.useMemo(
    () => buildPatientUpdates(patientForms, sourcePatients),
    [patientForms, sourcePatients]
  )

  const missingNationalIdPatientIds = React.useMemo(
    () =>
      patientForms
        .filter((patient) => !patient.nationalId.trim())
        .map((patient) => patient.currentPatientId),
    [patientForms]
  )

  const hasAllNationalIds = missingNationalIdPatientIds.length === 0

  const handlePatientFieldChange = React.useCallback(
    (
      patientId: string,
      field: keyof Omit<BookingPatientForm, "currentPatientId" | "testsCount">,
      value: string
    ) => {
      setPatientForms((current) =>
        current.map((patient) =>
          patient.currentPatientId === patientId
            ? {
                ...patient,
                [field]: value,
              }
            : patient
        )
      )

      setSaveErrorMessage(null)
      setSaveSuccessMessage(null)
      setSampleErrorMessage(null)
      setSampleSuccessMessage(null)
    },
    []
  )

  const handleSavePatients = React.useCallback(async () => {
    if (!booking) return

    if (patientUpdates.length === 0) {
      setSaveSuccessMessage("No patient changes to save.")
      setSaveErrorMessage(null)
      return
    }

    if (!onSavePatientUpdates) {
      setSaveSuccessMessage("Patient details are ready for submission.")
      setSaveErrorMessage(null)
      return
    }

    setIsSavingPatients(true)
    setSaveSuccessMessage(null)
    setSaveErrorMessage(null)

    try {
      await onSavePatientUpdates({
        booking,
        updates: patientUpdates,
      })

      setSaveSuccessMessage("Patient details updated successfully.")
    } catch (error) {
      setSaveErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSavingPatients(false)
    }
  }, [booking, onSavePatientUpdates, patientUpdates])

  const handleSampleSubmit = React.useCallback(async () => {
    if (!booking) {
      return
    }

    if (!idDocumentFile) {
      setSampleSuccessMessage(null)
      setSampleErrorMessage("Attach EID/Passport image before submitting.")
      return
    }

    if (!hasAllNationalIds) {
      setSampleSuccessMessage(null)
      setSampleErrorMessage(
        `National ID is required for all patients. Missing: ${missingNationalIdPatientIds.join(
          ", "
        )}`
      )
      return
    }

    if (!onSubmitSampleCollection) {
      setSampleErrorMessage(null)
      setSampleSuccessMessage("Sample collection request prepared successfully.")
      return
    }

    setIsSubmittingSample(true)
    setSampleSuccessMessage(null)
    setSampleErrorMessage(null)

    try {
      await onSubmitSampleCollection({
        booking,
        updates: patientUpdates,
        idDocumentFile,
      })

      setSampleSuccessMessage("Sample collection submitted successfully.")
    } catch (error) {
      setSampleErrorMessage(getSampleSubmissionError(error))
    } finally {
      setIsSubmittingSample(false)
    }
  }, [
    booking,
    hasAllNationalIds,
    idDocumentFile,
    missingNationalIdPatientIds,
    onSubmitSampleCollection,
    patientUpdates,
  ])

  const amount = formatAedAmount(booking?.amount ?? 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[95dvh] max-h-[95dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-[680px] md:h-auto md:max-h-[620px] md:max-w-[980px] lg:max-w-[1120px]">
        <DialogTitle className="sr-only">Booking Details</DialogTitle>
        <DialogDescription className="sr-only">
          Review booking details, update patient information, and submit sample collection.
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

          <main className="flex h-[calc(95dvh-4rem)] flex-1 flex-col overflow-hidden md:h-[580px]">
            <header className="flex h-16 shrink-0 items-center border-b">
              <div className="flex min-w-0 items-center gap-2 px-3 sm:px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage>Bookings</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" />
                    <BreadcrumbItem className="hidden sm:block">
                      <BreadcrumbPage>{booking?.bookingId ?? "Details"}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
              <section className="space-y-3 rounded-lg border p-3 md:p-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Booking ID</p>
                    <p className="text-sm font-medium">{booking?.apiBookingId ?? "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Order ID</p>
                    <p className="text-sm font-medium">{booking?.orderId || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Booking Status</p>
                    <p className="text-sm font-medium">{booking?.bookingStatusRaw || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Order Status</p>
                    <p className="text-sm font-medium">{booking?.orderStatus || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Start</p>
                    <p className="text-sm font-medium">{formatDateTime(booking?.startAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">End</p>
                    <p className="text-sm font-medium">{formatDateTime(booking?.endAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Created</p>
                    <p className="text-sm font-medium">{formatDateTime(booking?.createdAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Paid At</p>
                    <p className="text-sm font-medium">{formatDateTime(booking?.paidAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Amount</p>
                    <p className="text-sm font-medium tabular-nums">{amount}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border p-3 md:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Patient Details</p>
                    <p className="text-muted-foreground text-xs">
                      Update patient snapshot fields before sample collection.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={isSavingPatients}
                    onClick={() => {
                      void handleSavePatients()
                    }}
                  >
                    {isSavingPatients ? "Saving..." : "Save Patient Details"}
                  </Button>
                </div>

                {patientForms.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No patients found in this booking snapshot.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {patientForms.map((patient) => (
                      <div
                        key={patient.currentPatientId}
                        className="rounded-md border p-3 md:p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            Patient ID: {patient.currentPatientId}
                          </p>
                          {patient.testsCount !== null ? (
                            <span className="text-muted-foreground text-xs">
                              Tests: {patient.testsCount}
                            </span>
                          ) : null}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`new-id-${patient.currentPatientId}`}>
                              New Patient ID (optional)
                            </Label>
                            <Input
                              id={`new-id-${patient.currentPatientId}`}
                              value={patient.newPatientId}
                              onChange={(event) =>
                                handlePatientFieldChange(
                                  patient.currentPatientId,
                                  "newPatientId",
                                  event.target.value
                                )
                              }
                              placeholder="PAT_NEW_001"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`name-${patient.currentPatientId}`}>Name</Label>
                            <Input
                              id={`name-${patient.currentPatientId}`}
                              value={patient.name}
                              onChange={(event) =>
                                handlePatientFieldChange(
                                  patient.currentPatientId,
                                  "name",
                                  event.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`age-${patient.currentPatientId}`}>Age</Label>
                            <Input
                              id={`age-${patient.currentPatientId}`}
                              inputMode="numeric"
                              value={patient.age}
                              onChange={(event) =>
                                handlePatientFieldChange(
                                  patient.currentPatientId,
                                  "age",
                                  event.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`gender-${patient.currentPatientId}`}>Gender</Label>
                            <Input
                              id={`gender-${patient.currentPatientId}`}
                              value={patient.gender}
                              onChange={(event) =>
                                handlePatientFieldChange(
                                  patient.currentPatientId,
                                  "gender",
                                  event.target.value
                                )
                              }
                              placeholder="Female / Male"
                            />
                          </div>
                          <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
                            <Label htmlFor={`national-id-${patient.currentPatientId}`}>
                              National ID / Passport
                            </Label>
                            <Input
                              id={`national-id-${patient.currentPatientId}`}
                              value={patient.nationalId}
                              onChange={(event) =>
                                handlePatientFieldChange(
                                  patient.currentPatientId,
                                  "nationalId",
                                  event.target.value
                                )
                              }
                              placeholder="784-1987-1234567-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {saveErrorMessage ? (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {saveErrorMessage}
                  </p>
                ) : null}
                {saveSuccessMessage ? (
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {saveSuccessMessage}
                  </p>
                ) : null}
              </section>

              <section className="space-y-3 rounded-lg border p-3 md:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Sample Collection</p>
                    <p className="text-muted-foreground text-xs">
                      API sequence: update patient snapshot, then submit sample collected.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => setShowSampleCollection(true)}
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
                        setSampleErrorMessage(null)
                        setSampleSuccessMessage(null)
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
                        setSampleErrorMessage(null)
                        setSampleSuccessMessage(null)
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

                    {!hasAllNationalIds ? (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Missing National IDs: {missingNationalIdPatientIds.join(", ")}
                      </p>
                    ) : null}

                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      disabled={!idDocumentFile || isSubmittingSample || !hasAllNationalIds}
                      onClick={() => {
                        void handleSampleSubmit()
                      }}
                    >
                      {isSubmittingSample ? "Submitting..." : "Submit Sample Collection"}
                    </Button>

                    {sampleErrorMessage ? (
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        {sampleErrorMessage}
                      </p>
                    ) : null}

                    {sampleSuccessMessage ? (
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {sampleSuccessMessage}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <div className="flex justify-end border-t pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
