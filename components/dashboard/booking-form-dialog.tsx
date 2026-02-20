"use client"

import * as React from "react"
import Image from "next/image"
import {
  ClipboardList,
  FlaskConical,
  MapPin,
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

type IdDocumentType = "passport" | "eid"

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

type DialogSection = "booking" | "patients" | "location" | "sample"

const sectionItems = [
  { key: "booking" as const, name: "Booking Details", icon: ClipboardList },
  { key: "patients" as const, name: "Patient Details", icon: UserRound },
  { key: "location" as const, name: "Location Details", icon: MapPin },
  { key: "sample" as const, name: "Sample Collection", icon: FlaskConical },
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

function useFilePreview(file: File | null) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return previewUrl
}

export function BookingFormDialog({
  booking,
  open,
  onOpenChange,
  onSavePatientUpdates,
  onSubmitSampleCollection,
}: BookingFormDialogProps) {
  const [activeSection, setActiveSection] = React.useState<DialogSection>("booking")
  const [patientForms, setPatientForms] = React.useState<BookingPatientForm[]>([])
  const [showSampleCollection, setShowSampleCollection] = React.useState(false)
  const [isCaptureDevice, setIsCaptureDevice] = React.useState(false)
  const [selectedDocumentType, setSelectedDocumentType] =
    React.useState<IdDocumentType>("passport")
  const [passportFrontFile, setPassportFrontFile] = React.useState<File | null>(null)
  const [eidFrontFile, setEidFrontFile] = React.useState<File | null>(null)
  const [eidBackFile, setEidBackFile] = React.useState<File | null>(null)
  const [hasCameraPermission, setHasCameraPermission] = React.useState(false)
  const [isRequestingCameraPermission, setIsRequestingCameraPermission] =
    React.useState(false)
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

  const passportUploadInputRef = React.useRef<HTMLInputElement>(null)
  const eidFrontUploadInputRef = React.useRef<HTMLInputElement>(null)
  const eidBackUploadInputRef = React.useRef<HTMLInputElement>(null)
  const passportCaptureInputRef = React.useRef<HTMLInputElement>(null)
  const eidFrontCaptureInputRef = React.useRef<HTMLInputElement>(null)
  const eidBackCaptureInputRef = React.useRef<HTMLInputElement>(null)

  const sourcePatients = React.useMemo(() => getSourcePatients(booking), [booking])
  const passportFrontPreviewUrl = useFilePreview(passportFrontFile)
  const eidFrontPreviewUrl = useFilePreview(eidFrontFile)
  const eidBackPreviewUrl = useFilePreview(eidBackFile)

  React.useEffect(() => {
    if (open) {
      setActiveSection("booking")
      setPatientForms(mapPatientsToForms(sourcePatients))
      setShowSampleCollection(false)
      setSelectedDocumentType("passport")
      setPassportFrontFile(null)
      setEidFrontFile(null)
      setEidBackFile(null)
      setHasCameraPermission(false)
      setIsRequestingCameraPermission(false)
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

  const isSampleDocumentReady = React.useMemo(() => {
    if (selectedDocumentType === "passport") {
      return Boolean(passportFrontFile)
    }

    return Boolean(eidFrontFile && eidBackFile)
  }, [eidBackFile, eidFrontFile, passportFrontFile, selectedDocumentType])

  const submissionDocumentFile = React.useMemo(() => {
    return selectedDocumentType === "passport" ? passportFrontFile : eidFrontFile
  }, [eidFrontFile, passportFrontFile, selectedDocumentType])

  const requestCameraPermission = React.useCallback(async () => {
    if (!isCaptureDevice) {
      return true
    }

    if (hasCameraPermission) {
      return true
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setSampleErrorMessage(
        "Camera capture is not supported on this device. Use a desktop/laptop upload."
      )
      return false
    }

    setIsRequestingCameraPermission(true)
    setSampleErrorMessage(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      stream.getTracks().forEach((track) => track.stop())
      setHasCameraPermission(true)
      return true
    } catch {
      setHasCameraPermission(false)
      setSampleErrorMessage(
        "Camera permission is required. Please allow camera access and try again."
      )
      return false
    } finally {
      setIsRequestingCameraPermission(false)
    }
  }, [hasCameraPermission, isCaptureDevice])

  const openCaptureInput = React.useCallback(
    async (ref: React.MutableRefObject<HTMLInputElement | null>) => {
      const hasPermission = await requestCameraPermission()
      if (!hasPermission) {
        return
      }
      ref.current?.click()
    },
    [requestCameraPermission]
  )

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

    if (!isSampleDocumentReady || !submissionDocumentFile) {
      setSampleSuccessMessage(null)
      if (selectedDocumentType === "passport") {
        setSampleErrorMessage(
          isCaptureDevice
            ? "Capture passport front side before submitting."
            : "Upload passport front side before submitting."
        )
      } else {
        setSampleErrorMessage(
          isCaptureDevice
            ? "Capture EID front and back side before submitting."
            : "Upload EID front and back side before submitting."
        )
      }
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
        idDocumentFile: submissionDocumentFile,
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
    isCaptureDevice,
    isSampleDocumentReady,
    missingNationalIdPatientIds,
    onSubmitSampleCollection,
    patientUpdates,
    selectedDocumentType,
    submissionDocumentFile,
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
                    {sectionItems.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          isActive={activeSection === item.key}
                          onClick={() => setActiveSection(item.key)}
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

            <div className="border-b px-3 py-2 md:hidden">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {sectionItems.map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant={activeSection === item.key ? "default" : "outline"}
                    className="shrink-0"
                    onClick={() => setActiveSection(item.key)}
                  >
                    <item.icon className="mr-1 size-4" />
                    {item.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
              {activeSection === "booking" ? (
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
              ) : null}

              {activeSection === "patients" ? (
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
              ) : null}

              {activeSection === "location" ? (
                <section className="space-y-3 rounded-lg border p-3 md:p-4">
                  <div>
                    <p className="text-sm font-medium">Location Details</p>
                    <p className="text-muted-foreground text-xs">
                      Booking assignment and visit location information.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Resource Type</p>
                      <p className="text-sm font-medium">{booking?.resourceType || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Resource ID</p>
                      <p className="text-sm font-medium">{booking?.resourceId || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Visit Date</p>
                      <p className="text-sm font-medium">{booking?.date || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Visit Slot</p>
                      <p className="text-sm font-medium">{booking?.slot || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Start Time</p>
                      <p className="text-sm font-medium">{formatDateTime(booking?.startAt)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">End Time</p>
                      <p className="text-sm font-medium">{formatDateTime(booking?.endAt)}</p>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeSection === "sample" ? (
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
                        ? "Select document type and capture required sides (Mobile/Tablet)"
                        : "Select document type and upload required sides (Desktop/Laptop)"}
                    </p>

                    <input
                      ref={passportUploadInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setPassportFrontFile(file)
                        setSampleErrorMessage(null)
                        setSampleSuccessMessage(null)
                      }}
                    />

                    <input
                      ref={eidFrontUploadInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setEidFrontFile(file)
                        setSampleErrorMessage(null)
                        setSampleSuccessMessage(null)
                      }}
                    />

                    <input
                      ref={eidBackUploadInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setEidBackFile(file)
                        setSampleErrorMessage(null)
                        setSampleSuccessMessage(null)
                      }}
                    />

                    <input
                      ref={passportCaptureInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setPassportFrontFile(file)
                        setSampleErrorMessage(null)
                        setSampleSuccessMessage(null)
                      }}
                    />

                    <input
                      ref={eidFrontCaptureInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setEidFrontFile(file)
                        setSampleErrorMessage(null)
                        setSampleSuccessMessage(null)
                      }}
                    />

                    <input
                      ref={eidBackCaptureInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setEidBackFile(file)
                        setSampleErrorMessage(null)
                        setSampleSuccessMessage(null)
                      }}
                    />

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={
                            selectedDocumentType === "passport" ? "default" : "outline"
                          }
                          className="w-full"
                          onClick={() => {
                            setSelectedDocumentType("passport")
                            setSampleErrorMessage(null)
                            setSampleSuccessMessage(null)
                          }}
                        >
                          Passport
                        </Button>
                        <Button
                          type="button"
                          variant={selectedDocumentType === "eid" ? "default" : "outline"}
                          className="w-full"
                          onClick={() => {
                            setSelectedDocumentType("eid")
                            setSampleErrorMessage(null)
                            setSampleSuccessMessage(null)
                          }}
                        >
                          EID
                        </Button>
                      </div>

                      {isCaptureDevice ? (
                        <>
                          {!hasCameraPermission ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full sm:w-auto"
                              disabled={isRequestingCameraPermission}
                              onClick={() => {
                                void requestCameraPermission()
                              }}
                            >
                              {isRequestingCameraPermission
                                ? "Requesting Camera Permission..."
                                : "Allow Camera Permission"}
                            </Button>
                          ) : (
                            <p className="text-muted-foreground text-xs">
                              Camera permission granted.
                            </p>
                          )}

                          {selectedDocumentType === "passport" ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full sm:w-auto"
                              disabled={isRequestingCameraPermission}
                              onClick={() => {
                                void openCaptureInput(passportCaptureInputRef)
                              }}
                            >
                              Capture Passport Front
                            </Button>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                disabled={isRequestingCameraPermission}
                                onClick={() => {
                                  void openCaptureInput(eidFrontCaptureInputRef)
                                }}
                              >
                                Capture EID Front
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                disabled={isRequestingCameraPermission}
                                onClick={() => {
                                  void openCaptureInput(eidBackCaptureInputRef)
                                }}
                              >
                                Capture EID Back
                              </Button>
                            </div>
                          )}
                        </>
                      ) : selectedDocumentType === "passport" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => passportUploadInputRef.current?.click()}
                        >
                          Upload Passport Front
                        </Button>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => eidFrontUploadInputRef.current?.click()}
                          >
                            Upload EID Front
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => eidBackUploadInputRef.current?.click()}
                          >
                            Upload EID Back
                          </Button>
                        </div>
                      )}
                    </div>

                    {selectedDocumentType === "passport" ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs">
                          Passport front:{" "}
                          {passportFrontFile?.name ||
                            (isCaptureDevice ? "Not captured" : "Not uploaded")}
                        </p>
                        {passportFrontPreviewUrl ? (
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-[11px]">
                              Passport front preview
                            </p>
                            <div className="relative h-44 w-full overflow-hidden rounded-md border bg-black/5">
                              <Image
                                src={passportFrontPreviewUrl}
                                alt="Passport front preview"
                                fill
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {selectedDocumentType === "eid" ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs">
                          EID front:{" "}
                          {eidFrontFile?.name ||
                            (isCaptureDevice ? "Not captured" : "Not uploaded")}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          EID back:{" "}
                          {eidBackFile?.name ||
                            (isCaptureDevice ? "Not captured" : "Not uploaded")}
                        </p>
                        {eidFrontPreviewUrl || eidBackPreviewUrl ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {eidFrontPreviewUrl ? (
                              <div className="space-y-1">
                                <p className="text-muted-foreground text-[11px]">
                                  EID front preview
                                </p>
                                <div className="relative h-40 w-full overflow-hidden rounded-md border bg-black/5">
                                  <Image
                                    src={eidFrontPreviewUrl}
                                    alt="EID front preview"
                                    fill
                                    unoptimized
                                    className="object-contain"
                                  />
                                </div>
                              </div>
                            ) : null}
                            {eidBackPreviewUrl ? (
                              <div className="space-y-1">
                                <p className="text-muted-foreground text-[11px]">
                                  EID back preview
                                </p>
                                <div className="relative h-40 w-full overflow-hidden rounded-md border bg-black/5">
                                  <Image
                                    src={eidBackPreviewUrl}
                                    alt="EID back preview"
                                    fill
                                    unoptimized
                                    className="object-contain"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {!hasAllNationalIds ? (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Missing National IDs: {missingNationalIdPatientIds.join(", ")}
                      </p>
                    ) : null}

                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      disabled={
                        !isSampleDocumentReady || isSubmittingSample || !hasAllNationalIds
                      }
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
              ) : null}

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
