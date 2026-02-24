"use client"

import * as React from "react"
import {
  ClipboardList,
  ExternalLink,
  FlaskConical,
  Loader2,
  MapPin,
  RotateCcw,
  UserRound,
  X,
} from "lucide-react"

import type { BookingPatient, BookingTableRow } from "@/lib/bookings/types"
import {
  getDocumentProcessingErrorDetails,
  processDocumentImage,
} from "@/lib/api/document-processing"
import { triggerHapticFeedback } from "@/lib/mobile/haptics"
import {
  getApiErrorCode,
  getApiErrorId,
  getApiErrorMessage,
} from "@/lib/api/errors"
import type {
  DocumentExtractionData,
  DocumentValidation,
  OpenAiDocumentType,
} from "@/lib/document-processing/types"
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
  idDocumentFile?: File
  croppedDocumentImageBase64List?: string[]
}

export type SubmitSampleCollectionResult = {
  syncState: "synced" | "pending" | "failed"
  queueId?: string
}

type IdDocumentType = "passport" | "eid"

type BookingFormDialogProps = {
  booking: BookingTableRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSavePatientUpdates?: (payload: SaveBookingPatientsInput) => Promise<void>
  onSubmitSampleCollection?: (
    payload: SubmitSampleCollectionInput
  ) => Promise<SubmitSampleCollectionResult | void>
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

type ProcessedImageDocument = {
  file: File
  previewDataUrl: string
  croppedImageBase64: string
  extractedData: DocumentExtractionData
  validation: DocumentValidation
  confidenceScore: number
}

type DocumentScanSource = "upload" | "capture"

type SampleErrorDetails = {
  reason: string | null
  retryable: boolean
  errorId: string | null
}

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

function mergeMissingNationalIdsFromDocument(
  baseUpdates: BookingPatientUpdate[],
  missingPatientIds: string[],
  documentNumber: string
) {
  if (!documentNumber || missingPatientIds.length === 0) {
    return baseUpdates
  }

  const updatesByPatientId = new Map(
    baseUpdates.map((update) => [update.currentPatientId, { ...update }])
  )

  for (const patientId of missingPatientIds) {
    const existing = updatesByPatientId.get(patientId) ?? {
      currentPatientId: patientId,
    }
    updatesByPatientId.set(patientId, {
      ...existing,
      nationalId: documentNumber,
    })
  }

  return Array.from(updatesByPatientId.values())
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

function formatReadableVisitDateTime(value?: string | null) {
  if (!value) return "-"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dubai",
  }).formatToParts(parsed)

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || ""

  const weekday = part("weekday")
  const day = part("day")
  const month = part("month")
  const year = part("year")
  const hour = part("hour")
  const minute = part("minute")
  const dayPeriod = part("dayPeriod").toUpperCase()

  return `${weekday}, ${day} ${month} ${year} at ${hour}:${minute} ${dayPeriod}`
}

function getSampleSubmissionError(error: unknown) {
  const code = getApiErrorCode(error)

  if (code === "missing_patient_national_id") {
    return "Patient document number is required. For EID use EID number. For Passport use Document No."
  }

  return getApiErrorMessage(error)
}

function formatDocumentErrorReason(reason: string | null) {
  if (!reason) return null

  const labels: Record<string, string> = {
    invalid_document_type: "Invalid document type selected",
    file_required: "Image file is required",
    unsupported_file_type: "Unsupported file type",
    file_too_large: "File size exceeds limit",
    document_not_configured: "Scanner service is not configured",
    openai_request_failed: "Scanner service request failed",
    invalid_openai_response: "Scanner returned invalid output",
    validation_failed: "Document validation failed",
    timeout: "Scanner timed out",
    document_not_clear: "Document was unclear",
  }

  return labels[reason] || reason
}

function toPreviewDataUrl(base64: string) {
  const normalizeBase64Body = (rawValue: string) => {
    const compact = rawValue
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/")
    const paddingLength = compact.length % 4

    if (paddingLength === 0) {
      return compact
    }

    return compact.padEnd(compact.length + (4 - paddingLength), "=")
  }

  const detectImageMimeType = (rawBase64: string) => {
    if (rawBase64.startsWith("/9j/")) return "image/jpeg"
    if (rawBase64.startsWith("iVBORw0KGgo")) return "image/png"
    if (rawBase64.startsWith("R0lGOD")) return "image/gif"
    if (rawBase64.startsWith("UklGR")) return "image/webp"
    if (rawBase64.startsWith("Qk")) return "image/bmp"

    return "image/jpeg"
  }

  const trimmed = base64.trim()
  if (!trimmed) return ""

  if (trimmed.startsWith("data:")) {
    const commaIndex = trimmed.indexOf(",")
    if (commaIndex === -1) return trimmed

    const header = trimmed.slice(0, commaIndex + 1)
    const normalized = normalizeBase64Body(trimmed.slice(commaIndex + 1))
    return `${header}${normalized}`
  }

  const normalized = normalizeBase64Body(trimmed)
  const mimeType = detectImageMimeType(normalized)
  return `data:${mimeType};base64,${normalized}`
}

function PreviewImage({
  src,
  label,
  fallbackFile,
}: {
  src: string
  label: string
  fallbackFile?: File | null
}) {
  const [resolvedSrc, setResolvedSrc] = React.useState(src)
  const [fallbackFileUrl, setFallbackFileUrl] = React.useState<string | null>(null)
  const [hasError, setHasError] = React.useState(false)
  const [didTryRawDataUrl, setDidTryRawDataUrl] = React.useState(false)
  const [didTryFallbackFile, setDidTryFallbackFile] = React.useState(false)

  React.useEffect(() => {
    if (!fallbackFile) {
      setFallbackFileUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(fallbackFile)
    setFallbackFileUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [fallbackFile])

  React.useEffect(() => {
    setHasError(false)
    setDidTryRawDataUrl(false)
    setDidTryFallbackFile(false)
    setResolvedSrc(src)

    if (!src || !src.startsWith("data:") || !src.includes(";base64,")) {
      return
    }

    const commaIndex = src.indexOf(",")
    if (commaIndex === -1) return

    const mimeMatch = /^data:([^;]+);base64$/i.exec(src.slice(0, commaIndex))
    const mimeType = mimeMatch?.[1] || "image/jpeg"
    const base64Value = src.slice(commaIndex + 1)

    try {
      const binaryString = atob(base64Value)
      const bytes = new Uint8Array(binaryString.length)
      for (let index = 0; index < binaryString.length; index += 1) {
        bytes[index] = binaryString.charCodeAt(index)
      }

      const blob = new Blob([bytes], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)
      setResolvedSrc(blobUrl)

      return () => {
        URL.revokeObjectURL(blobUrl)
      }
    } catch {
      setResolvedSrc(src)
      return
    }
  }, [src])

  if (hasError || !resolvedSrc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30 px-3 text-center text-xs text-muted-foreground">
        Preview unavailable. Please recapture or re-upload this document.
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={label}
      className="h-full w-full object-contain"
      onError={() => {
        if (!didTryRawDataUrl && resolvedSrc !== src && src) {
          setDidTryRawDataUrl(true)
          setResolvedSrc(src)
          return
        }

        if (!didTryFallbackFile && fallbackFileUrl && resolvedSrc !== fallbackFileUrl) {
          setDidTryFallbackFile(true)
          setResolvedSrc(fallbackFileUrl)
          return
        }

        setHasError(true)
      }}
    />
  )
}

function getProcessingLabel(documentType: OpenAiDocumentType | null) {
  if (documentType === "PASSPORT") return "Scanning passport front side"
  if (documentType === "EID_FRONT") return "Scanning Emirates ID front side"
  if (documentType === "EID_BACK") return "Scanning Emirates ID back side"
  return "Processing document"
}

function ProcessingDocumentState({
  documentType,
}: {
  documentType: OpenAiDocumentType | null
}) {
  if (!documentType) return null

  return (
    <div className="rounded-xl border border-primary/35 bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Processing document</p>
          <p className="text-muted-foreground text-xs">
            {getProcessingLabel(documentType)}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="rounded-md bg-background/70 px-2 py-1">Detecting edges</div>
        <div className="rounded-md bg-background/70 px-2 py-1">
          Cleaning background
        </div>
        <div className="rounded-md bg-background/70 px-2 py-1">
          Preparing preview
        </div>
      </div>
    </div>
  )
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
  const [passportFrontDocument, setPassportFrontDocument] =
    React.useState<ProcessedImageDocument | null>(null)
  const [eidFrontDocument, setEidFrontDocument] =
    React.useState<ProcessedImageDocument | null>(null)
  const [eidBackDocument, setEidBackDocument] =
    React.useState<ProcessedImageDocument | null>(null)
  const [processingDocumentType, setProcessingDocumentType] = React.useState<
    OpenAiDocumentType | null
  >(null)
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
  const [sampleErrorDetails, setSampleErrorDetails] =
    React.useState<SampleErrorDetails | null>(null)
  const [lastDocumentScan, setLastDocumentScan] = React.useState<{
    documentType: OpenAiDocumentType
    source: DocumentScanSource
  } | null>(null)

  const passportUploadInputRef = React.useRef<HTMLInputElement>(null)
  const eidFrontUploadInputRef = React.useRef<HTMLInputElement>(null)
  const eidBackUploadInputRef = React.useRef<HTMLInputElement>(null)
  const passportCaptureInputRef = React.useRef<HTMLInputElement>(null)
  const eidFrontCaptureInputRef = React.useRef<HTMLInputElement>(null)
  const eidBackCaptureInputRef = React.useRef<HTMLInputElement>(null)

  const sourcePatients = React.useMemo(() => getSourcePatients(booking), [booking])
  const isDocumentProcessing = processingDocumentType !== null

  React.useEffect(() => {
    if (open) {
      setActiveSection("booking")
      setPatientForms(mapPatientsToForms(sourcePatients))
      setShowSampleCollection(false)
      setSelectedDocumentType("passport")
      setPassportFrontDocument(null)
      setEidFrontDocument(null)
      setEidBackDocument(null)
      setProcessingDocumentType(null)
      setHasCameraPermission(false)
      setIsRequestingCameraPermission(false)
      setIsSavingPatients(false)
      setIsSubmittingSample(false)
      setSaveSuccessMessage(null)
      setSaveErrorMessage(null)
      setSampleSuccessMessage(null)
      setSampleErrorMessage(null)
      setSampleErrorDetails(null)
      setLastDocumentScan(null)
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
  const requiresDocumentProof = !hasAllNationalIds

  const isSampleDocumentReady = React.useMemo(() => {
    if (selectedDocumentType === "passport") {
      return Boolean(passportFrontDocument)
    }

    return Boolean(eidFrontDocument && eidBackDocument)
  }, [
    eidBackDocument,
    eidFrontDocument,
    passportFrontDocument,
    selectedDocumentType,
  ])

  const submissionDocumentFile = React.useMemo(() => {
    return selectedDocumentType === "passport"
      ? passportFrontDocument?.file
      : eidFrontDocument?.file
  }, [eidFrontDocument, passportFrontDocument, selectedDocumentType])

  const croppedDocumentImageBase64List = React.useMemo(() => {
    const values =
      selectedDocumentType === "passport"
        ? [passportFrontDocument?.croppedImageBase64]
        : [eidFrontDocument?.croppedImageBase64, eidBackDocument?.croppedImageBase64]

    return values.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    )
  }, [
    eidBackDocument?.croppedImageBase64,
    eidFrontDocument?.croppedImageBase64,
    passportFrontDocument?.croppedImageBase64,
    selectedDocumentType,
  ])

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
      setSampleErrorDetails({
        reason: "unsupported_file_type",
        retryable: false,
        errorId: null,
      })
      return false
    }

    setIsRequestingCameraPermission(true)
    setSampleErrorMessage(null)
    setSampleErrorDetails(null)

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
      setSampleErrorDetails({
        reason: "validation_failed",
        retryable: true,
        errorId: null,
      })
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

  const clearProcessedDocument = React.useCallback(
    (documentType: OpenAiDocumentType) => {
      if (documentType === "PASSPORT") {
        setPassportFrontDocument(null)
        return
      }

      if (documentType === "EID_FRONT") {
        setEidFrontDocument(null)
        return
      }

      setEidBackDocument(null)
    },
    []
  )

  const handleProcessDocument = React.useCallback(
    async (
      file: File | null,
      documentType: OpenAiDocumentType,
      source: DocumentScanSource
    ) => {
      if (!file) return

      setLastDocumentScan({ documentType, source })

      if (!file.type.startsWith("image/")) {
        setSampleErrorMessage("Only image files are supported.")
        setSampleErrorDetails({
          reason: "unsupported_file_type",
          retryable: false,
          errorId: null,
        })
        return
      }

      if (file.size > 8 * 1024 * 1024) {
        setSampleErrorMessage("Image is too large. Maximum allowed size is 8MB.")
        setSampleErrorDetails({
          reason: "file_too_large",
          retryable: false,
          errorId: null,
        })
        return
      }

      setSampleErrorMessage(null)
      setSampleSuccessMessage(null)
      setSampleErrorDetails(null)
      setProcessingDocumentType(documentType)

      try {
        const processed = await processDocumentImage({
          file,
          documentType,
        })

        const normalizedDocument: ProcessedImageDocument = {
          file,
          previewDataUrl: toPreviewDataUrl(processed.croppedDocumentImageBase64),
          croppedImageBase64: processed.croppedDocumentImageBase64,
          extractedData: processed.extractedData,
          validation: processed.validation,
          confidenceScore: processed.confidenceScore,
        }

        if (documentType === "PASSPORT") {
          setPassportFrontDocument(normalizedDocument)
        } else if (documentType === "EID_FRONT") {
          if (!processed.validation.startsWith784) {
            setEidFrontDocument(null)
            setSampleErrorMessage(
              "Emirates ID must start with 784. Please recapture or upload a valid EID front."
            )
            setSampleErrorDetails({
              reason: "validation_failed",
              retryable: true,
              errorId: null,
            })
            return
          }
          setEidFrontDocument(normalizedDocument)
        } else {
          setEidBackDocument(normalizedDocument)
        }

        if (processed.confidenceScore < 0.6) {
          setSampleErrorMessage(
            "Document processed with low confidence. Please recapture for better clarity."
          )
          setSampleErrorDetails({
            reason: "document_not_clear",
            retryable: true,
            errorId: null,
          })
        }
      } catch (error) {
        clearProcessedDocument(documentType)
        const details = getDocumentProcessingErrorDetails(error)
        setSampleErrorMessage(details.message || getApiErrorMessage(error))
        setSampleErrorDetails(details)
      } finally {
        setProcessingDocumentType(null)
      }
    },
    [clearProcessedDocument]
  )

  const triggerDocumentInput = React.useCallback(
    async (documentType: OpenAiDocumentType, source: DocumentScanSource) => {
      if (source === "capture") {
        if (documentType === "PASSPORT") {
          await openCaptureInput(passportCaptureInputRef)
          return
        }

        if (documentType === "EID_FRONT") {
          await openCaptureInput(eidFrontCaptureInputRef)
          return
        }

        await openCaptureInput(eidBackCaptureInputRef)
        return
      }

      if (documentType === "PASSPORT") {
        passportUploadInputRef.current?.click()
        return
      }

      if (documentType === "EID_FRONT") {
        eidFrontUploadInputRef.current?.click()
        return
      }

      eidBackUploadInputRef.current?.click()
    },
    [openCaptureInput]
  )

  const handleRetryLastDocumentScan = React.useCallback(() => {
    if (!lastDocumentScan || isDocumentProcessing) return
    void triggerDocumentInput(lastDocumentScan.documentType, lastDocumentScan.source)
  }, [isDocumentProcessing, lastDocumentScan, triggerDocumentInput])

  const sampleIssueReportHref = React.useMemo(() => {
    if (!sampleErrorMessage) return null

    const bookingRef = booking?.bookingId || booking?.apiBookingId || "Unknown Booking"
    const errorId = sampleErrorDetails?.errorId || "NA"
    const subject = encodeURIComponent(
      `DarDoc Sample Collection Issue - ${String(bookingRef)}`
    )
    const body = encodeURIComponent(
      [
        `Booking: ${String(bookingRef)}`,
        `Error ID: ${errorId}`,
        `Reason: ${sampleErrorDetails?.reason || "unknown"}`,
        `Message: ${sampleErrorMessage}`,
        "",
        "Please investigate this issue.",
      ].join("\n")
    )

    return `mailto:support@dardoc.com?subject=${subject}&body=${body}`
  }, [booking?.apiBookingId, booking?.bookingId, sampleErrorDetails, sampleErrorMessage])

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
      setSampleErrorDetails(null)
      setSampleSuccessMessage(null)
    },
    []
  )

  const handleSavePatients = React.useCallback(async () => {
    if (!booking) return

    if (patientUpdates.length === 0) {
      setSaveSuccessMessage("No patient changes to save.")
      setSaveErrorMessage(null)
      void triggerHapticFeedback("light")
      return
    }

    if (!onSavePatientUpdates) {
      setSaveSuccessMessage("Patient details are ready for submission.")
      setSaveErrorMessage(null)
      void triggerHapticFeedback("light")
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
      void triggerHapticFeedback("success")
    } catch (error) {
      setSaveErrorMessage(getApiErrorMessage(error))
      void triggerHapticFeedback("error")
    } finally {
      setIsSavingPatients(false)
    }
  }, [booking, onSavePatientUpdates, patientUpdates])

  const handleSampleSubmit = React.useCallback(async () => {
    if (!booking) {
      return
    }

    if (requiresDocumentProof && (!isSampleDocumentReady || !submissionDocumentFile)) {
      setSampleSuccessMessage(null)
      setSampleErrorDetails(null)
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
      void triggerHapticFeedback("warning")
      return
    }

    const selectedDocumentNumber =
      selectedDocumentType === "passport"
        ? (passportFrontDocument?.extractedData.documentNumber || "").trim()
        : (eidFrontDocument?.extractedData.documentNumber || "").trim()

    if (requiresDocumentProof && !selectedDocumentNumber) {
      setSampleSuccessMessage(null)
      setSampleErrorDetails({
        reason: "validation_failed",
        retryable: true,
        errorId: null,
      })
      setSampleErrorMessage(
        selectedDocumentType === "passport"
          ? "Passport Document No. not detected. Please recapture or re-upload."
          : "EID number not detected. Please recapture or re-upload EID front."
      )
      void triggerHapticFeedback("warning")
      return
    }

    if (requiresDocumentProof && croppedDocumentImageBase64List.length === 0) {
      setSampleSuccessMessage(null)
      setSampleErrorDetails({
        reason: "validation_failed",
        retryable: true,
        errorId: null,
      })
      setSampleErrorMessage(
        "Cropped document preview is not ready. Please recapture or re-upload."
      )
      void triggerHapticFeedback("warning")
      return
    }

    if (
      requiresDocumentProof &&
      selectedDocumentType === "eid" &&
      !eidFrontDocument?.validation.startsWith784
    ) {
      setSampleSuccessMessage(null)
      setSampleErrorDetails({
        reason: "validation_failed",
        retryable: true,
        errorId: null,
      })
      setSampleErrorMessage(
        "Invalid EID number. EID number must start with 784."
      )
      void triggerHapticFeedback("warning")
      return
    }

    const updatesForSubmission = requiresDocumentProof
      ? mergeMissingNationalIdsFromDocument(
          patientUpdates,
          missingNationalIdPatientIds,
          selectedDocumentNumber
        )
      : patientUpdates

    if (!onSubmitSampleCollection) {
      setSampleErrorMessage(null)
      setSampleErrorDetails(null)
      setSampleSuccessMessage("Sample collection request prepared successfully.")
      void triggerHapticFeedback("light")
      return
    }

    setIsSubmittingSample(true)
    setSampleSuccessMessage(null)
    setSampleErrorMessage(null)
    setSampleErrorDetails(null)

    try {
      const result = await onSubmitSampleCollection({
        booking,
        updates: updatesForSubmission,
        idDocumentFile: submissionDocumentFile,
        croppedDocumentImageBase64List,
      })

      if (result?.syncState === "pending") {
        setSampleSuccessMessage(
          "Sample submission saved offline. It will sync automatically when your connection is back."
        )
        void triggerHapticFeedback("warning")
      } else if (result?.syncState === "failed") {
        setSampleSuccessMessage(
          "Sample submission saved with sync failure state. Please retry sync from bookings page."
        )
        void triggerHapticFeedback("warning")
      } else {
        setSampleSuccessMessage("Sample collection submitted successfully.")
        void triggerHapticFeedback("success")
      }
    } catch (error) {
      setSampleErrorMessage(getSampleSubmissionError(error))
      setSampleErrorDetails({
        reason: getApiErrorCode(error),
        retryable: true,
        errorId: getApiErrorId(error),
      })
      void triggerHapticFeedback("error")
    } finally {
      setIsSubmittingSample(false)
    }
  }, [
    booking,
    croppedDocumentImageBase64List,
    isCaptureDevice,
    isSampleDocumentReady,
    eidFrontDocument,
    missingNationalIdPatientIds,
    onSubmitSampleCollection,
    passportFrontDocument,
    patientUpdates,
    requiresDocumentProof,
    selectedDocumentType,
    submissionDocumentFile,
  ])

  const bookingDetailItems: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Booking ID", value: booking?.apiBookingId ?? "-" },
    { label: "Order ID", value: booking?.orderId || "-" },
    { label: "Start Time", value: formatReadableVisitDateTime(booking?.startAt) },
    { label: "End Time", value: formatReadableVisitDateTime(booking?.endAt) },
    { label: "Created At", value: formatDateTime(booking?.createdAt) },
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
    return null
  }, [booking])
  const locationDetailItems: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Resource Type", value: booking?.resourceType || "-" },
    { label: "Resource ID", value: booking?.resourceId || "-" },
    { label: "Destination", value: locationDestination },
    { label: "Visit Date", value: booking?.date || "-" },
    { label: "Visit Slot", value: booking?.slot || "-" },
  ]
  const pendingPatientChangesCount = patientUpdates.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bottom-0 left-0 top-auto h-[94dvh] max-h-[94dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-2xl rounded-b-none border border-border/70 p-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom [&>button]:hidden sm:h-[95dvh] sm:max-h-[95dvh] sm:w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)] sm:rounded-xl sm:border sm:p-0 md:bottom-auto md:left-[50%] md:top-[50%] md:h-auto md:max-h-[620px] md:max-w-[980px] md:translate-x-[-50%] md:translate-y-[-50%] lg:max-w-[1120px]">
        <DialogTitle className="sr-only">Booking Details</DialogTitle>
        <DialogDescription className="sr-only">
          Review booking details, update patient information, and submit sample collection.
        </DialogDescription>
        <SidebarProvider className="h-full items-start">
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

          <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden md:h-[580px]">
            <header className="safe-area-top flex min-h-14 shrink-0 items-center border-b md:h-16">
              <div className="flex w-full min-w-0 items-center justify-between gap-2 px-3 sm:px-4">
                <Breadcrumb className="min-w-0">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mobile-touch-target h-9 shrink-0 rounded-full border-border/70 px-3"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-4" />
                  <span className="text-xs font-medium">Close</span>
                </Button>
              </div>
            </header>

            <div className="border-b px-3 py-3 md:hidden">
              <div
                role="tablist"
                aria-label="Booking details sections"
                className="grid grid-cols-2 gap-2"
              >
                {sectionItems.map((item) => {
                  const isActive = activeSection === item.key

                  return (
                    <Button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className="mobile-touch-target h-11 w-full justify-start rounded-xl px-3"
                      onClick={() => setActiveSection(item.key)}
                    >
                      <item.icon className="size-4" />
                      <span className="truncate">{item.name}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] [touch-action:pan-y] md:p-6 md:pb-6">
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
                          <CardTitle className="text-base font-semibold">
                            <span className="break-words">{item.value}</span>
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
                          variant="default"
                          className="mobile-touch-target h-11 w-full sm:h-10 sm:w-auto"
                          disabled={isSavingPatients}
                          onClick={() => {
                            void handleSavePatients()
                          }}
                        >
                          {isSavingPatients ? (
                            "Saving..."
                          ) : (
                            <>
                              <span className="sm:hidden">Save Details</span>
                              <span className="hidden sm:inline">Save Patient Details</span>
                            </>
                          )}
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
                        {mapRouteUrl && hasCoordinates ? (
                          <Button asChild type="button" variant="default" size="sm">
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
                        {hasCoordinates ? <Badge variant="outline">Map ready</Badge> : null}
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
                            <span className="break-words">{item.value}</span>
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
                        onChange={async (event) => {
                          const input = event.currentTarget
                          const file = input.files?.[0] ?? null
                          await handleProcessDocument(file, "PASSPORT", "upload")
                          input.value = ""
                        }}
                      />

                      <input
                        ref={eidFrontUploadInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (event) => {
                          const input = event.currentTarget
                          const file = input.files?.[0] ?? null
                          await handleProcessDocument(file, "EID_FRONT", "upload")
                          input.value = ""
                        }}
                      />

                      <input
                        ref={eidBackUploadInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (event) => {
                          const input = event.currentTarget
                          const file = input.files?.[0] ?? null
                          await handleProcessDocument(file, "EID_BACK", "upload")
                          input.value = ""
                        }}
                      />

                      <input
                        ref={passportCaptureInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (event) => {
                          const input = event.currentTarget
                          const file = input.files?.[0] ?? null
                          await handleProcessDocument(file, "PASSPORT", "capture")
                          input.value = ""
                        }}
                      />

                      <input
                        ref={eidFrontCaptureInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (event) => {
                          const input = event.currentTarget
                          const file = input.files?.[0] ?? null
                          await handleProcessDocument(file, "EID_FRONT", "capture")
                          input.value = ""
                        }}
                      />

                      <input
                        ref={eidBackCaptureInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (event) => {
                          const input = event.currentTarget
                          const file = input.files?.[0] ?? null
                          await handleProcessDocument(file, "EID_BACK", "capture")
                          input.value = ""
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
                                  setSampleErrorDetails(null)
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
                                  setSampleErrorDetails(null)
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
                              {requiresDocumentProof
                                ? "Provide document proof to continue submission."
                                : "Optional when all patients already have a document ID."}
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
                                    disabled={
                                      isRequestingCameraPermission || isDocumentProcessing
                                    }
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
                                    disabled={
                                      isRequestingCameraPermission || isDocumentProcessing
                                    }
                                    onClick={() => {
                                      void openCaptureInput(passportCaptureInputRef)
                                    }}
                                  >
                                    {processingDocumentType === "PASSPORT"
                                      ? "Scanning Passport Front..."
                                      : passportFrontDocument
                                      ? "Recapture Passport Front"
                                      : "Capture Passport Front"}
                                  </Button>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <p className="text-xs font-medium">EID Front</p>
                                        <Badge
                                          variant={
                                            eidFrontDocument ? "secondary" : "outline"
                                          }
                                        >
                                          {eidFrontDocument ? "Processed" : "Pending"}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <p className="text-xs font-medium">EID Back</p>
                                        <Badge
                                          variant={
                                            eidBackDocument ? "secondary" : "outline"
                                          }
                                        >
                                          {eidBackDocument ? "Processed" : "Pending"}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        disabled={
                                          isRequestingCameraPermission || isDocumentProcessing
                                        }
                                        onClick={() => {
                                          void openCaptureInput(eidFrontCaptureInputRef)
                                        }}
                                      >
                                        {processingDocumentType === "EID_FRONT"
                                          ? "Scanning EID Front..."
                                          : eidFrontDocument
                                          ? "Recapture EID Front"
                                          : "Capture EID Front"}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        disabled={
                                          isRequestingCameraPermission || isDocumentProcessing
                                        }
                                        onClick={() => {
                                          void openCaptureInput(eidBackCaptureInputRef)
                                        }}
                                      >
                                        {processingDocumentType === "EID_BACK"
                                          ? "Scanning EID Back..."
                                          : eidBackDocument
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
                                disabled={isDocumentProcessing}
                                onClick={() => passportUploadInputRef.current?.click()}
                              >
                                {processingDocumentType === "PASSPORT"
                                  ? "Scanning Passport Front..."
                                  : passportFrontDocument
                                  ? "Re-upload Passport Front"
                                  : "Upload Passport Front"}
                              </Button>
                            ) : (
                              <div className="space-y-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <p className="text-xs font-medium">EID Front</p>
                                    <Badge
                                      variant={eidFrontDocument ? "secondary" : "outline"}
                                    >
                                      {eidFrontDocument ? "Processed" : "Pending"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <p className="text-xs font-medium">EID Back</p>
                                    <Badge
                                      variant={eidBackDocument ? "secondary" : "outline"}
                                    >
                                      {eidBackDocument ? "Processed" : "Pending"}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    disabled={isDocumentProcessing}
                                    onClick={() => eidFrontUploadInputRef.current?.click()}
                                  >
                                    {processingDocumentType === "EID_FRONT"
                                      ? "Scanning EID Front..."
                                      : eidFrontDocument
                                      ? "Re-upload EID Front"
                                      : "Upload EID Front"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    disabled={isDocumentProcessing}
                                    onClick={() => eidBackUploadInputRef.current?.click()}
                                  >
                                    {processingDocumentType === "EID_BACK"
                                      ? "Scanning EID Back..."
                                      : eidBackDocument
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
                                {passportFrontDocument?.file.name ||
                                  (isCaptureDevice
                                    ? "Not captured"
                                    : "Not uploaded")}
                              </p>
                              {passportFrontDocument ? (
                                <div className="space-y-1">
                                  <p className="text-muted-foreground text-[11px]">
                                    Passport front preview (auto-cropped)
                                  </p>
                                  <div className="relative h-44 w-full overflow-hidden rounded-md border bg-black/5">
                                    <PreviewImage
                                      src={passportFrontDocument.previewDataUrl}
                                      label="Passport front preview"
                                      fallbackFile={passportFrontDocument.file}
                                    />
                                  </div>
                                  <div className="grid gap-2 rounded-md border p-2 text-xs sm:grid-cols-2">
                                    <p>
                                      <span className="text-muted-foreground">
                                        Full Name:{" "}
                                      </span>
                                      {passportFrontDocument.extractedData.fullName || "-"}
                                    </p>
                                    <p>
                                      <span className="text-muted-foreground">
                                        Document No:{" "}
                                      </span>
                                      {passportFrontDocument.extractedData.documentNumber || "-"}
                                    </p>
                                    <p>
                                      <span className="text-muted-foreground">Gender: </span>
                                      {passportFrontDocument.extractedData.gender || "-"}
                                    </p>
                                    <p>
                                      <span className="text-muted-foreground">
                                        Nationality:{" "}
                                      </span>
                                      {passportFrontDocument.extractedData.nationality || "-"}
                                    </p>
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
                                      {eidFrontDocument?.file.name || "-"}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={eidFrontDocument ? "secondary" : "outline"}
                                  >
                                    {eidFrontDocument ? "Processed" : "Pending"}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium">EID Back</p>
                                    <p className="text-muted-foreground truncate text-[11px]">
                                      {eidBackDocument?.file.name || "-"}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={eidBackDocument ? "secondary" : "outline"}
                                  >
                                    {eidBackDocument ? "Processed" : "Pending"}
                                  </Badge>
                                </div>
                              </div>
                              {eidFrontDocument || eidBackDocument ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {eidFrontDocument ? (
                                    <div className="space-y-1">
                                      <p className="text-muted-foreground text-[11px]">
                                        EID front preview (auto-cropped)
                                      </p>
                                      <div className="relative h-40 w-full overflow-hidden rounded-md border bg-black/5">
                                        <PreviewImage
                                          src={eidFrontDocument.previewDataUrl}
                                          label="EID front preview"
                                          fallbackFile={eidFrontDocument.file}
                                        />
                                      </div>
                                      <div className="grid gap-1 rounded-md border p-2 text-xs">
                                        <p>
                                          <span className="text-muted-foreground">
                                            Full Name:{" "}
                                          </span>
                                          {eidFrontDocument.extractedData.fullName || "-"}
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">
                                            Document No:{" "}
                                          </span>
                                          {eidFrontDocument.extractedData.documentNumber || "-"}
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">
                                            Starts with 784:{" "}
                                          </span>
                                          {eidFrontDocument.validation.startsWith784
                                            ? "Yes"
                                            : "No"}
                                        </p>
                                      </div>
                                    </div>
                                  ) : null}
                                  {eidBackDocument ? (
                                    <div className="space-y-1">
                                      <p className="text-muted-foreground text-[11px]">
                                        EID back preview (auto-cropped)
                                      </p>
                                      <div className="relative h-40 w-full overflow-hidden rounded-md border bg-black/5">
                                        <PreviewImage
                                          src={eidBackDocument.previewDataUrl}
                                          label="EID back preview"
                                          fallbackFile={eidBackDocument.file}
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          )}

                          {sampleErrorMessage ? (
                            <div className="space-y-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-300">
                              <p>{sampleErrorMessage}</p>
                              {sampleErrorDetails?.reason ? (
                                <p className="text-[11px]">
                                  Reason: {formatDocumentErrorReason(sampleErrorDetails.reason)}
                                </p>
                              ) : null}
                              {sampleErrorDetails?.errorId ? (
                                <p className="text-[11px]">
                                  Error ID: {sampleErrorDetails.errorId}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                {sampleErrorDetails?.retryable && lastDocumentScan ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isDocumentProcessing}
                                    onClick={handleRetryLastDocumentScan}
                                  >
                                    <RotateCcw className="size-4" />
                                    Retry Scan
                                  </Button>
                                ) : null}
                                {sampleIssueReportHref ? (
                                  <Button type="button" variant="ghost" size="sm" asChild>
                                    <a href={sampleIssueReportHref}>Report issue</a>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ) : null}

                          {sampleSuccessMessage ? (
                            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                              {sampleSuccessMessage}
                            </div>
                          ) : null}

                          <ProcessingDocumentState documentType={processingDocumentType} />

                          <Separator />

                          <Button
                            type="button"
                            className="w-full sm:w-auto"
                            disabled={
                              (requiresDocumentProof && !isSampleDocumentReady) ||
                              isSubmittingSample ||
                              isDocumentProcessing
                            }
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

              <div className="hidden justify-end border-t pt-4 md:flex">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="safe-area-bottom border-t border-border/70 bg-background/95 p-3 md:hidden">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="mobile-touch-target h-11 rounded-xl"
                  disabled={isSavingPatients}
                  onClick={() => {
                    setActiveSection("patients")
                    void handleSavePatients()
                  }}
                >
                  {isSavingPatients ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  className="mobile-touch-target h-11 rounded-xl"
                  disabled={isSubmittingSample || isDocumentProcessing}
                  onClick={() => {
                    if (activeSection !== "sample" || !showSampleCollection) {
                      setActiveSection("sample")
                      setShowSampleCollection(true)
                      return
                    }
                    void handleSampleSubmit()
                  }}
                >
                  {isSubmittingSample
                    ? "Submitting..."
                    : activeSection !== "sample" || !showSampleCollection
                    ? "Submit Sample"
                    : "Submit Sample"}
                </Button>
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
