"use client"

import * as React from "react"
import Image from "next/image"
import {
  ClipboardList,
  ExternalLink,
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
  const bookingDetailItems: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Booking ID", value: booking?.apiBookingId ?? "-" },
    { label: "Order ID", value: booking?.orderId || "-" },
    { label: "Start Time", value: formatDateTime(booking?.startAt) },
    { label: "End Time", value: formatDateTime(booking?.endAt) },
    { label: "Created At", value: formatDateTime(booking?.createdAt) },
    { label: "Paid At", value: formatDateTime(booking?.paidAt) },
    { label: "Amount", value: amount },
  ]
  const hasCoordinates =
    typeof booking?.locationLatitude === "number" &&
    Number.isFinite(booking.locationLatitude) &&
    typeof booking?.locationLongitude === "number" &&
    Number.isFinite(booking.locationLongitude)
  const locationDestination =
    booking?.locationAddress || booking?.locationLabel || booking?.resourceId || "-"
  const mapRouteUrl = React.useMemo(() => {
    if (!booking) return null

    if (
      typeof booking.locationLatitude === "number" &&
      Number.isFinite(booking.locationLatitude) &&
      typeof booking.locationLongitude === "number" &&
      Number.isFinite(booking.locationLongitude)
    ) {
      const destination = `${booking.locationLatitude},${booking.locationLongitude}`
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
    }

    const destinationQuery = [
      booking.locationAddress,
      booking.locationLabel,
      booking.patientName,
      "Dubai UAE",
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(", ")

    if (!destinationQuery) return null

    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`
  }, [booking])
  const locationDetailItems: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Resource Type", value: booking?.resourceType || "-" },
    { label: "Resource ID", value: booking?.resourceId || "-" },
    { label: "Destination", value: locationDestination },
    {
      label: "Coordinates",
      value: hasCoordinates
        ? `${booking?.locationLatitude}, ${booking?.locationLongitude}`
        : "-",
    },
    { label: "Visit Date", value: booking?.date || "-" },
    { label: "Visit Slot", value: booking?.slot || "-" },
    { label: "Start Time", value: formatDateTime(booking?.startAt) },
    { label: "End Time", value: formatDateTime(booking?.endAt) },
  ]
  const pendingPatientChangesCount = patientUpdates.length

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
                <section className="space-y-4">
                  <Card className="shadow-none">
                    <CardHeader className="space-y-3 p-4">
                      <div className="space-y-1">
                        <CardTitle className="text-base">Booking Details</CardTitle>
                        <CardDescription>
                          Core booking, status, and billing snapshot.
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          Booking: {booking?.bookingStatusRaw || "Unknown"}
                        </Badge>
                        <Badge variant="outline">Order: {booking?.orderStatus || "-"}</Badge>
                        <Badge variant="outline">
                          Patients: {booking?.patientCount ?? sourcePatients.length}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {bookingDetailItems.map((item) => (
                      <Card key={item.label} className="shadow-none">
                        <CardHeader className="space-y-1 p-4">
                          <CardDescription className="text-xs uppercase tracking-wide">
                            {item.label}
                          </CardDescription>
                          <CardTitle
                            className={`text-base font-semibold ${
                              item.label === "Amount" ? "tabular-nums" : ""
                            }`}
                          >
                            {item.value}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeSection === "patients" ? (
                <section className="space-y-4">
                  <Card className="shadow-none">
                    <CardHeader className="space-y-3 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">Patient Details</CardTitle>
                          <CardDescription>
                            Update patient snapshot data before sample collection.
                          </CardDescription>
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
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Patients: {patientForms.length}</Badge>
                        <Badge
                          variant={
                            pendingPatientChangesCount > 0 ? "secondary" : "outline"
                          }
                        >
                          Pending Changes: {pendingPatientChangesCount}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>

                  {patientForms.length === 0 ? (
                    <Card className="shadow-none">
                      <CardContent className="p-4">
                        <p className="text-muted-foreground text-sm">
                          No patients found in this booking snapshot.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {patientForms.map((patient, index) => (
                        <Card key={patient.currentPatientId} className="shadow-none">
                          <CardHeader className="gap-3 p-4 pb-2">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <CardTitle className="text-base">
                                  {patient.name.trim() || `Patient ${index + 1}`}
                                </CardTitle>
                                <CardDescription>
                                  Patient ID: {patient.currentPatientId}
                                </CardDescription>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {patient.testsCount !== null ? (
                                  <Badge variant="outline">
                                    Tests: {patient.testsCount}
                                  </Badge>
                                ) : null}
                                {!patient.nationalId.trim() ? (
                                  <Badge variant="destructive">National ID required</Badge>
                                ) : (
                                  <Badge variant="secondary">ID available</Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-2">
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
                                <Label htmlFor={`gender-${patient.currentPatientId}`}>
                                  Gender
                                </Label>
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
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {saveErrorMessage ? (
                    <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-300">
                      {saveErrorMessage}
                    </div>
                  ) : null}
                  {saveSuccessMessage ? (
                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                      {saveSuccessMessage}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {activeSection === "location" ? (
                <section className="space-y-4">
                  <Card className="shadow-none">
                    <CardHeader className="space-y-3 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">Location Details</CardTitle>
                          <CardDescription>
                            Assignment and visit schedule details for this booking.
                          </CardDescription>
                        </div>
                        {mapRouteUrl ? (
                          <Button asChild type="button" variant="outline" size="sm">
                            <a href={mapRouteUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" />
                              View Route in Map
                            </a>
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" disabled>
                            View Route in Map
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{booking?.date || "-"}</Badge>
                        <Badge variant="secondary">{booking?.slot || "-"}</Badge>
                        {hasCoordinates ? (
                          <Badge variant="outline">GPS route ready</Badge>
                        ) : (
                          <Badge variant="outline">Query route fallback</Badge>
                        )}
                      </div>
                    </CardHeader>
                  </Card>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {locationDetailItems.map((item) => (
                      <Card key={item.label} className="shadow-none">
                        <CardHeader className="space-y-1 p-4">
                          <CardDescription className="text-xs uppercase tracking-wide">
                            {item.label}
                          </CardDescription>
                          <CardTitle className="text-base font-semibold">
                            {item.value}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeSection === "sample" ? (
                <section className="space-y-4">
                  <Card className="shadow-none">
                    <CardHeader className="space-y-3 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">Sample Collection</CardTitle>
                          <CardDescription>
                            Complete the patient update flow and submit collection proof.
                          </CardDescription>
                        </div>
                        <Button
                          type="button"
                          className="w-full sm:w-auto"
                          onClick={() => setShowSampleCollection(true)}
                        >
                          Mark as Sample Collected
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {showSampleCollection ? (
                    <>
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

                      <div className="grid gap-4 xl:grid-cols-2">
                        <Card className="shadow-none">
                          <CardHeader className="space-y-2 p-4 pb-2">
                            <CardTitle className="text-base">
                              1. Choose Document Type
                            </CardTitle>
                            <CardDescription>
                              Passport needs front side. EID needs front and back.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3 p-4 pt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                variant={
                                  selectedDocumentType === "passport"
                                    ? "default"
                                    : "outline"
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
                                variant={
                                  selectedDocumentType === "eid" ? "default" : "outline"
                                }
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
                            <p className="text-muted-foreground text-xs">
                              {isCaptureDevice
                                ? "Mobile/Tablet mode: capture required sides."
                                : "Desktop mode: upload required sides."}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="shadow-none">
                          <CardHeader className="space-y-2 p-4 pb-2">
                            <CardTitle className="text-base">
                              2. {isCaptureDevice ? "Capture Images" : "Upload Images"}
                            </CardTitle>
                            <CardDescription>
                              Provide document proof to continue submission.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3 p-4 pt-2">
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
                                  <Badge variant="secondary" className="w-fit">
                                    Camera permission granted
                                  </Badge>
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
                                    {passportFrontFile
                                      ? "Recapture Passport Front"
                                      : "Capture Passport Front"}
                                  </Button>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <p className="text-xs font-medium">EID Front</p>
                                        <Badge
                                          variant={eidFrontFile ? "secondary" : "outline"}
                                        >
                                          {eidFrontFile ? "Uploaded" : "Pending"}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <p className="text-xs font-medium">EID Back</p>
                                        <Badge
                                          variant={eidBackFile ? "secondary" : "outline"}
                                        >
                                          {eidBackFile ? "Uploaded" : "Pending"}
                                        </Badge>
                                      </div>
                                    </div>
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
                                        {eidFrontFile
                                          ? "Recapture EID Front"
                                          : "Capture EID Front"}
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
                                        {eidBackFile
                                          ? "Recapture EID Back"
                                          : "Capture EID Back"}
                                      </Button>
                                    </div>
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
                                {passportFrontFile
                                  ? "Re-upload Passport Front"
                                  : "Upload Passport Front"}
                              </Button>
                            ) : (
                              <div className="space-y-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <p className="text-xs font-medium">EID Front</p>
                                    <Badge
                                      variant={eidFrontFile ? "secondary" : "outline"}
                                    >
                                      {eidFrontFile ? "Uploaded" : "Pending"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <p className="text-xs font-medium">EID Back</p>
                                    <Badge
                                      variant={eidBackFile ? "secondary" : "outline"}
                                    >
                                      {eidBackFile ? "Uploaded" : "Pending"}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => eidFrontUploadInputRef.current?.click()}
                                  >
                                    {eidFrontFile
                                      ? "Re-upload EID Front"
                                      : "Upload EID Front"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => eidBackUploadInputRef.current?.click()}
                                  >
                                    {eidBackFile
                                      ? "Re-upload EID Back"
                                      : "Upload EID Back"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="shadow-none">
                        <CardHeader className="space-y-2 p-4 pb-2">
                          <CardTitle className="text-base">
                            3. Preview and Submit
                          </CardTitle>
                          <CardDescription>
                            Verify captured files and complete submission.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4 pt-2">
                          {selectedDocumentType === "passport" ? (
                            <div className="space-y-2">
                              <p className="text-muted-foreground text-xs">
                                Passport front:{" "}
                                {passportFrontFile?.name ||
                                  (isCaptureDevice
                                    ? "Not captured"
                                    : "Not uploaded")}
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
                          ) : (
                            <div className="space-y-2">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium">EID Front</p>
                                    <p className="text-muted-foreground truncate text-[11px]">
                                      {eidFrontFile?.name || "-"}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={eidFrontFile ? "secondary" : "outline"}
                                  >
                                    {eidFrontFile ? "Uploaded" : "Pending"}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium">EID Back</p>
                                    <p className="text-muted-foreground truncate text-[11px]">
                                      {eidBackFile?.name || "-"}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={eidBackFile ? "secondary" : "outline"}
                                  >
                                    {eidBackFile ? "Uploaded" : "Pending"}
                                  </Badge>
                                </div>
                              </div>
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
                          )}

                          {!hasAllNationalIds ? (
                            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                              Missing National IDs:{" "}
                              {missingNationalIdPatientIds.join(", ")}
                            </div>
                          ) : null}

                          {sampleErrorMessage ? (
                            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-300">
                              {sampleErrorMessage}
                            </div>
                          ) : null}

                          {sampleSuccessMessage ? (
                            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                              {sampleSuccessMessage}
                            </div>
                          ) : null}

                          <Separator />

                          <Button
                            type="button"
                            className="w-full sm:w-auto"
                            disabled={!isSampleDocumentReady || isSubmittingSample}
                            onClick={() => {
                              void handleSampleSubmit()
                            }}
                          >
                            {isSubmittingSample
                              ? "Submitting..."
                              : "Submit Sample Collection"}
                          </Button>
                        </CardContent>
                      </Card>
                    </>
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
