"use client"

import * as React from "react"
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FlaskConical,
  ImageUp,
  Loader2,
  MapPin,
  Phone,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  documentType: OpenAiDocumentType
  extractedData: DocumentExtractionData
  validation: DocumentValidation
  confidenceScore: number
}

type DocumentScanSource = "upload" | "capture"

type CropArea = {
  x: number
  y: number
  width: number
  height: number
}

type SampleErrorDetails = {
  reason: string | null
  retryable: boolean
  errorId: string | null
}

type DetailListItem = {
  label: string
  value: React.ReactNode
}

const sectionItems = [
  {
    key: "booking" as const,
    name: "Booking Details",
    description: "ID, status, and schedule snapshot",
    icon: ClipboardList,
  },
  {
    key: "patients" as const,
    name: "Patient Details",
    description: "Edit patient demographics and IDs",
    icon: UserRound,
  },
  {
    key: "location" as const,
    name: "Location Details",
    description: "Visit destination and route context",
    icon: MapPin,
  },
  {
    key: "sample" as const,
    name: "Sample Collection",
    description: "Document scan and submit workflow",
    icon: FlaskConical,
  },
]

function mergePatientDocumentsIntoUpdates(
  baseUpdates: BookingPatientUpdate[],
  forms: BookingPatientForm[],
  documents: Record<string, ProcessedImageDocument | null>
) {
  const updatesByPatientId = new Map(
    baseUpdates.map((update) => [update.currentPatientId, { ...update }])
  )

  for (const patient of forms) {
    if (patient.nationalId.trim()) continue
    const document = documents[patient.currentPatientId]
    const documentNumber = document?.extractedData.documentNumber?.trim()
    if (!document || !documentNumber) continue

    const existing = updatesByPatientId.get(patient.currentPatientId) ?? {
      currentPatientId: patient.currentPatientId,
    }

    updatesByPatientId.set(patient.currentPatientId, {
      ...existing,
      nationalId: documentNumber,
      ...(document.extractedData.fullName?.trim()
        ? { name: document.extractedData.fullName.trim() }
        : {}),
      ...(document.extractedData.gender?.trim()
        ? { gender: normalizeExtractedGender(document.extractedData.gender) }
        : {}),
    })
  }

  return Array.from(updatesByPatientId.values())
}

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

function normalizeExtractedGender(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const lowered = trimmed.toLowerCase()
  if (lowered === "m" || lowered === "male") return "Male"
  if (lowered === "f" || lowered === "female") return "Female"

  return trimmed
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

const DOCUMENT_CROP_ASPECTS = [1.42, 1.586]

function getDocumentCropAspect(detectedAspect: number) {
  const fallbackAspect = DOCUMENT_CROP_ASPECTS[0]
  if (!Number.isFinite(detectedAspect) || detectedAspect <= 0) return fallbackAspect

  let bestAspect = fallbackAspect
  let smallestDiff = Number.POSITIVE_INFINITY

  for (const candidate of DOCUMENT_CROP_ASPECTS) {
    const diff = Math.abs(candidate - detectedAspect)
    if (diff < smallestDiff) {
      smallestDiff = diff
      bestAspect = candidate
    }
  }

  return bestAspect
}

function clampCroppedArea(
  area: CropArea,
  imageWidth: number,
  imageHeight: number
) {
  const x = Math.max(0, Math.floor(area.x))
  const y = Math.max(0, Math.floor(area.y))
  const maxWidth = Math.max(1, imageWidth - x)
  const maxHeight = Math.max(1, imageHeight - y)
  const width = Math.max(1, Math.min(Math.floor(area.width), maxWidth))
  const height = Math.max(1, Math.min(Math.floor(area.height), maxHeight))
  return { x, y, width, height }
}

function fitAreaToAspect(
  area: CropArea,
  imageWidth: number,
  imageHeight: number,
  targetAspect: number
) {
  const normalized = clampCroppedArea(area, imageWidth, imageHeight)
  const currentAspect = normalized.width / normalized.height

  if (!Number.isFinite(currentAspect) || !Number.isFinite(targetAspect)) {
    return normalized
  }

  if (Math.abs(currentAspect - targetAspect) <= 0.08) {
    return normalized
  }

  if (currentAspect > targetAspect) {
    const targetHeight = Math.round(normalized.width / targetAspect)
    if (targetHeight <= imageHeight) {
      const centeredY = Math.round(normalized.y - (targetHeight - normalized.height) / 2)
      return clampCroppedArea(
        {
          x: normalized.x,
          y: centeredY,
          width: normalized.width,
          height: targetHeight,
        },
        imageWidth,
        imageHeight
      )
    }

    const targetWidth = Math.round(normalized.height * targetAspect)
    const centeredX = Math.round(normalized.x + (normalized.width - targetWidth) / 2)
    return clampCroppedArea(
      {
        x: centeredX,
        y: normalized.y,
        width: targetWidth,
        height: normalized.height,
      },
      imageWidth,
      imageHeight
    )
  }

  const targetWidth = Math.round(normalized.height * targetAspect)
  if (targetWidth <= imageWidth) {
    const centeredX = Math.round(normalized.x - (targetWidth - normalized.width) / 2)
    return clampCroppedArea(
      {
        x: centeredX,
        y: normalized.y,
        width: targetWidth,
        height: normalized.height,
      },
      imageWidth,
      imageHeight
    )
  }

  const targetHeight = Math.round(normalized.width / targetAspect)
  const centeredY = Math.round(normalized.y + (normalized.height - targetHeight) / 2)
  return clampCroppedArea(
    {
      x: normalized.x,
      y: centeredY,
      width: normalized.width,
      height: targetHeight,
    },
    imageWidth,
    imageHeight
  )
}

async function detectAutoDocumentCropArea(file: File): Promise<CropArea | null> {
  if (typeof window === "undefined") return null

  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image()
      candidate.onload = () => resolve(candidate)
      candidate.onerror = () =>
        reject(new Error("Unable to load image for auto-cropping."))
      candidate.src = sourceUrl
    })

    const maxSide = 1400
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
    const scale = longestSide > maxSide ? maxSide / longestSide : 1
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return null

    context.drawImage(image, 0, 0, width, height)
    const imageData = context.getImageData(0, 0, width, height)
    const { data } = imageData

    const border = Math.max(6, Math.round(Math.min(width, height) * 0.04))
    let borderCount = 0
    let rSum = 0
    let gSum = 0
    let bSum = 0

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const isBorderPixel =
          x < border || y < border || x >= width - border || y >= height - border
        if (!isBorderPixel) continue
        const index = (y * width + x) * 4
        rSum += data[index]
        gSum += data[index + 1]
        bSum += data[index + 2]
        borderCount += 1
      }
    }

    if (borderCount === 0) return null

    const meanR = rSum / borderCount
    const meanG = gSum / borderCount
    const meanB = bSum / borderCount

    let borderDiffSum = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const isBorderPixel =
          x < border || y < border || x >= width - border || y >= height - border
        if (!isBorderPixel) continue
        const index = (y * width + x) * 4
        const diff =
          (Math.abs(data[index] - meanR) +
            Math.abs(data[index + 1] - meanG) +
            Math.abs(data[index + 2] - meanB)) /
          3
        borderDiffSum += diff
      }
    }

    const borderDiffMean = borderDiffSum / borderCount
    const threshold = Math.max(20, borderDiffMean * 3.3)
    const rowCounts = new Uint16Array(height)
    const colCounts = new Uint16Array(width)

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4
        const alpha = data[index + 3]
        if (alpha < 12) continue

        const diff =
          (Math.abs(data[index] - meanR) +
            Math.abs(data[index + 1] - meanG) +
            Math.abs(data[index + 2] - meanB)) /
          3

        if (diff >= threshold) {
          rowCounts[y] += 1
          colCounts[x] += 1
        }
      }
    }

    const rowHitThreshold = Math.max(12, Math.round(width * 0.085))
    const colHitThreshold = Math.max(12, Math.round(height * 0.085))

    let top = -1
    for (let y = 0; y < height; y += 1) {
      if (rowCounts[y] >= rowHitThreshold) {
        top = y
        break
      }
    }

    let bottom = -1
    for (let y = height - 1; y >= 0; y -= 1) {
      if (rowCounts[y] >= rowHitThreshold) {
        bottom = y
        break
      }
    }

    let left = -1
    for (let x = 0; x < width; x += 1) {
      if (colCounts[x] >= colHitThreshold) {
        left = x
        break
      }
    }

    let right = -1
    for (let x = width - 1; x >= 0; x -= 1) {
      if (colCounts[x] >= colHitThreshold) {
        right = x
        break
      }
    }

    if (top < 0 || left < 0 || right <= left || bottom <= top) {
      return null
    }

    const padding = Math.max(4, Math.round(Math.min(width, height) * 0.015))
    const coarseArea = clampCroppedArea(
      {
        x: left - padding,
        y: top - padding,
        width: right - left + 1 + padding * 2,
        height: bottom - top + 1 + padding * 2,
      },
      width,
      height
    )

    const cropCoverage = (coarseArea.width * coarseArea.height) / (width * height)
    if (cropCoverage < 0.16 || cropCoverage > 0.97) {
      return null
    }

    const coarseAspect = coarseArea.width / coarseArea.height
    const aspectAdjustedArea = fitAreaToAspect(
      coarseArea,
      width,
      height,
      getDocumentCropAspect(coarseAspect)
    )

    return clampCroppedArea(
      {
        x: aspectAdjustedArea.x / scale,
        y: aspectAdjustedArea.y / scale,
        width: aspectAdjustedArea.width / scale,
        height: aspectAdjustedArea.height / scale,
      },
      image.naturalWidth,
      image.naturalHeight
    )
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function toCroppedImageFile(file: File, croppedAreaPixels: CropArea | null) {
  if (typeof window === "undefined") {
    throw new Error("Image crop is not supported in this environment.")
  }

  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image()
      candidate.onload = () => resolve(candidate)
      candidate.onerror = () => reject(new Error("Unable to load image for cropping."))
      candidate.src = sourceUrl
    })

    const fallbackArea: CropArea = {
      x: 0,
      y: 0,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
    const sourceArea = croppedAreaPixels || fallbackArea
    const { x, y, width, height } = clampCroppedArea(
      sourceArea,
      image.naturalWidth,
      image.naturalHeight
    )

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Unable to initialize image crop canvas.")
    }

    context.drawImage(image, x, y, width, height, 0, 0, width, height)

    const croppedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    })

    if (!croppedBlob) {
      throw new Error("Unable to generate cropped image.")
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "document"
    return new File([croppedBlob], `${baseName}-cropped.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
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

function DetailRows({ items }: { items: DetailListItem[] }) {
  return (
    <dl className="divide-y divide-border/70">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid gap-1.5 px-4 py-3 sm:grid-cols-[170px_1fr] sm:items-start sm:gap-4"
        >
          <dt className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
            {item.label}
          </dt>
          <dd className="text-sm leading-relaxed font-medium break-words whitespace-normal sm:text-base">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function sanitizePhoneForTel(value?: string | null) {
  if (!value) return null
  const sanitized = value.replace(/[^\d+]/g, "")
  return sanitized || null
}

function getProcessingLabel(documentType: OpenAiDocumentType | null) {
  if (documentType === "PASSPORT" || documentType === "EID_FRONT") {
    return "Scanning document front side"
  }
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
          <p className="text-muted-foreground text-xs">
            Please wait while we scan and prepare the document.
          </p>
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
  const [isCaptureDevice, setIsCaptureDevice] = React.useState(false)
  const [patientDocuments, setPatientDocuments] = React.useState<
    Record<string, ProcessedImageDocument | null>
  >({})
  const [activeUploadPatientId, setActiveUploadPatientId] = React.useState<string | null>(null)
  const [processingDocumentType, setProcessingDocumentType] = React.useState<
    OpenAiDocumentType | null
  >(null)
  const [hasCameraPermission, setHasCameraPermission] = React.useState(false)
  const [isRequestingCameraPermission, setIsRequestingCameraPermission] =
    React.useState(false)
  const [submittingPatientId, setSubmittingPatientId] = React.useState<string | null>(null)
  const [patientActionMessage, setPatientActionMessage] = React.useState<string | null>(null)
  const [patientActionError, setPatientActionError] = React.useState<string | null>(null)
  const [isSubmittingSample, setIsSubmittingSample] = React.useState(false)
  const [sampleSuccessMessage, setSampleSuccessMessage] = React.useState<
    string | null
  >(null)
  const [sampleErrorMessage, setSampleErrorMessage] = React.useState<
    string | null
  >(null)
  const [sampleErrorDetails, setSampleErrorDetails] =
    React.useState<SampleErrorDetails | null>(null)
  const [isSampleSubmitConfirmOpen, setIsSampleSubmitConfirmOpen] =
    React.useState(false)
  const [lastDocumentScan, setLastDocumentScan] = React.useState<{
    source: DocumentScanSource
    patientId: string
  } | null>(null)
  const wasOpenRef = React.useRef(false)

  const passportUploadInputRef = React.useRef<HTMLInputElement>(null)
  const passportCaptureInputRef = React.useRef<HTMLInputElement>(null)

  const sourcePatients = React.useMemo(() => getSourcePatients(booking), [booking])
  const isDocumentProcessing = processingDocumentType !== null
  const bookingStatus = booking?.bookingStatusRaw || "UNKNOWN"
  const isCompletedBooking =
    bookingStatus === "FULFILLED" || bookingStatus === "CANCELLED"

  React.useEffect(() => {
    if (open) {
      setPatientForms(mapPatientsToForms(sourcePatients))
      setPatientDocuments({})
      setActiveUploadPatientId(null)
      setProcessingDocumentType(null)
      setHasCameraPermission(false)
      setIsRequestingCameraPermission(false)
      setSubmittingPatientId(null)
      setPatientActionMessage(null)
      setPatientActionError(null)
      setIsSubmittingSample(false)
      setSampleSuccessMessage(null)
      setSampleErrorMessage(null)
      setSampleErrorDetails(null)
      setIsSampleSubmitConfirmOpen(false)
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
  const uploadedRequiredDocumentCount = React.useMemo(
    () =>
      missingNationalIdPatientIds.filter((patientId) => Boolean(patientDocuments[patientId]))
        .length,
    [missingNationalIdPatientIds, patientDocuments]
  )

  const documentEntries = React.useMemo(
    () =>
      Object.entries(patientDocuments).filter(
        (entry): entry is [string, ProcessedImageDocument] => Boolean(entry[1])
      ),
    [patientDocuments]
  )
  const activeFrontDocument = documentEntries[0]?.[1] ?? null
  const isSampleDocumentReady =
    !requiresDocumentProof ||
    uploadedRequiredDocumentCount === missingNationalIdPatientIds.length

  const submissionDocumentFile = React.useMemo(
    () => activeFrontDocument?.file,
    [activeFrontDocument]
  )

  const croppedDocumentImageBase64List = React.useMemo(() => {
    const values = documentEntries.map(([, document]) => document.croppedImageBase64)

    return values.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    )
  }, [
    documentEntries,
  ])
  const invalidRequiredEidDocument = React.useMemo(
    () =>
      missingNationalIdPatientIds.find((patientId) => {
        const document = patientDocuments[patientId]
        return (
          document?.documentType === "EID_FRONT" &&
          !document.validation.startsWith784
        )
      }) ?? null,
    [missingNationalIdPatientIds, patientDocuments]
  )
  const orderedSectionItems = React.useMemo(() => {
    const order: DialogSection[] = requiresDocumentProof
      ? ["patients", "sample", "booking", "location"]
      : isCompletedBooking
      ? ["booking", "sample", "patients", "location"]
      : ["sample", "booking", "patients", "location"]

    return order
      .map((key) => sectionItems.find((item) => item.key === key) ?? null)
      .filter((item): item is (typeof sectionItems)[number] => Boolean(item))
  }, [isCompletedBooking, requiresDocumentProof])
  const primarySection = orderedSectionItems[0]?.key ?? "booking"

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setActiveSection(primarySection)
    }

    wasOpenRef.current = open
  }, [open, primarySection])

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

  const applyExtractedDataToPatient = React.useCallback(
    (patientId: string, extractedData: DocumentExtractionData) => {
      const extractedName = extractedData.fullName.trim()
      const extractedGender = normalizeExtractedGender(extractedData.gender)
      const extractedDocumentNumber = extractedData.documentNumber.trim()

      if (!extractedName && !extractedGender && !extractedDocumentNumber) {
        return null
      }

      if (patientForms.length === 0) {
        return null
      }

      const nextForms = [...patientForms]
      const targetIndex = nextForms.findIndex(
        (patient) => patient.currentPatientId === patientId
      )

      if (targetIndex < 0) {
        return null
      }

      const target = nextForms[targetIndex]
      const updated: BookingPatientForm = { ...target }
      let didUpdate = false

      if (extractedDocumentNumber) {
        updated.nationalId = extractedDocumentNumber
        didUpdate = true
      }

      if (extractedName) {
        updated.name = extractedName
        didUpdate = true
      }

      if (extractedGender) {
        updated.gender = extractedGender
        didUpdate = true
      }

      if (!didUpdate) {
        return null
      }

      nextForms[targetIndex] = updated
      setPatientForms(nextForms)

      return {
        patientLabel: updated.name.trim() || `Patient ${targetIndex + 1}`,
      }
    },
    [patientForms]
  )

  const clearProcessedDocument = React.useCallback((patientId?: string) => {
    if (!patientId) {
      setPatientDocuments({})
      return
    }

    setPatientDocuments((current) => ({
      ...current,
      [patientId]: null,
    }))
  }, [])

  const processDocumentFromCroppedFile = React.useCallback(
    async (patientId: string, file: File) => {
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
      setProcessingDocumentType("PASSPORT")

      try {
        const processed = await processDocumentImage({
          file,
        })
        const detectedDocumentType = processed.documentType

        const normalizedDocument: ProcessedImageDocument = {
          file,
          previewDataUrl: toPreviewDataUrl(processed.croppedDocumentImageBase64),
          croppedImageBase64: processed.croppedDocumentImageBase64,
          documentType: processed.documentType,
          extractedData: processed.extractedData,
          validation: processed.validation,
          confidenceScore: processed.confidenceScore,
        }

        if (detectedDocumentType === "PASSPORT") {
          setPatientDocuments((current) => ({
            ...current,
            [patientId]: normalizedDocument,
          }))
        } else if (detectedDocumentType === "EID_FRONT") {
          if (!processed.validation.startsWith784) {
            clearProcessedDocument(patientId)
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
          setPatientDocuments((current) => ({
            ...current,
            [patientId]: normalizedDocument,
          }))
        } else {
          clearProcessedDocument(patientId)
          setSampleErrorMessage(
            "Please upload Passport front page or Emirates ID front side only."
          )
          setSampleErrorDetails({
            reason: "validation_failed",
            retryable: true,
            errorId: null,
          })
          return
        }

        const autofillResult = applyExtractedDataToPatient(patientId, processed.extractedData)
        if (autofillResult) {
          setSampleSuccessMessage(
            `Document extracted for ${autofillResult.patientLabel}. Review the extracted data, then submit from Sample Collection.`
          )
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
        clearProcessedDocument(patientId)
        const details = getDocumentProcessingErrorDetails(error)
        setSampleErrorMessage(
          "Document scan failed. Please rescan again with a clearer image."
        )
        setSampleErrorDetails(details)
      } finally {
        setProcessingDocumentType(null)
      }
    },
    [applyExtractedDataToPatient, clearProcessedDocument]
  )

  const handleProcessDocument = React.useCallback(
    async (patientId: string, file: File | null, source: DocumentScanSource) => {
      if (!file) return

      setActiveUploadPatientId(patientId)
      setLastDocumentScan({ source, patientId })

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

      let imageToProcess = file

      try {
        const autoCropArea = await detectAutoDocumentCropArea(file)
        if (autoCropArea) {
          imageToProcess = await toCroppedImageFile(file, autoCropArea)
        }
      } catch {
        imageToProcess = file
      }

      await processDocumentFromCroppedFile(patientId, imageToProcess)
    },
    [processDocumentFromCroppedFile]
  )

  const triggerDocumentInput = React.useCallback(
    async (patientId: string, source: DocumentScanSource) => {
      setActiveUploadPatientId(patientId)
      if (source === "capture") {
        await openCaptureInput(passportCaptureInputRef)
        return
      }
      passportUploadInputRef.current?.click()
    },
    [openCaptureInput]
  )

  const handleRetryLastDocumentScan = React.useCallback(() => {
    if (!lastDocumentScan || isDocumentProcessing) return
    void triggerDocumentInput(lastDocumentScan.patientId, lastDocumentScan.source)
  }, [isDocumentProcessing, lastDocumentScan, triggerDocumentInput])

  const handleSubmitPatientDetails = React.useCallback(
    async (patientId: string) => {
      if (!booking) return

      const mergedUpdates = mergePatientDocumentsIntoUpdates(
        patientUpdates,
        patientForms,
        patientDocuments
      ).filter((update) => update.currentPatientId === patientId)

      if (mergedUpdates.length === 0) {
        setPatientActionError("No extracted patient data is ready to submit yet.")
        setPatientActionMessage(null)
        return
      }

      if (!onSavePatientUpdates) {
        setPatientActionMessage("Patient details are ready. Submit sample collection next.")
        setPatientActionError(null)
        return
      }

      setSubmittingPatientId(patientId)
      setPatientActionMessage(null)
      setPatientActionError(null)

      try {
        await onSavePatientUpdates({
          booking,
          updates: mergedUpdates,
        })
        setPatientActionMessage("Patient details submitted successfully.")
        setPatientActionError(null)
        setActiveSection("sample")
        void triggerHapticFeedback("success")
      } catch (error) {
        setPatientActionError(getApiErrorMessage(error))
        setPatientActionMessage(null)
        void triggerHapticFeedback("error")
      } finally {
        setSubmittingPatientId(null)
      }
    },
    [booking, onSavePatientUpdates, patientDocuments, patientForms, patientUpdates]
  )

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

  const handleSampleSubmit = React.useCallback(async () => {
    if (!booking) {
      return
    }

    if (requiresDocumentProof && (!isSampleDocumentReady || !submissionDocumentFile)) {
      setSampleSuccessMessage(null)
      setSampleErrorDetails(null)
      setSampleErrorMessage(
        isCaptureDevice
          ? "Capture passport or EID front side before submitting."
          : "Upload passport or EID front side before submitting."
      )
      void triggerHapticFeedback("warning")
      return
    }

    if (
      requiresDocumentProof &&
      missingNationalIdPatientIds.some((patientId) => {
        const documentNumber =
          patientDocuments[patientId]?.extractedData.documentNumber?.trim() || ""
        return !documentNumber
      })
    ) {
      setSampleSuccessMessage(null)
      setSampleErrorDetails({
        reason: "validation_failed",
        retryable: true,
        errorId: null,
      })
      setSampleErrorMessage(
        "Document number not detected. Please recapture or re-upload the document front."
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

    if (requiresDocumentProof && invalidRequiredEidDocument) {
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

    const updatesForSubmission = mergePatientDocumentsIntoUpdates(
      patientUpdates,
      patientForms,
      patientDocuments
    )

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
    invalidRequiredEidDocument,
    isCaptureDevice,
    isSampleDocumentReady,
    missingNationalIdPatientIds,
    onSubmitSampleCollection,
    patientDocuments,
    patientForms,
    patientUpdates,
    requiresDocumentProof,
    submissionDocumentFile,
  ])
  const bookingDetailItems: DetailListItem[] = [
    { label: "Booking ID", value: booking?.apiBookingId ?? "-" },
    { label: "Order ID", value: booking?.orderId || "-" },
    {
      label: "Phone Number",
      value: booking?.customerPhone ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>{booking.customerPhone}</span>
          {sanitizePhoneForTel(booking.customerPhone) ? (
            <Button variant="outline" size="sm" asChild className="h-8 rounded-lg px-3">
              <a href={`tel:${sanitizePhoneForTel(booking.customerPhone)}`}>
                <Phone className="size-3.5" />
                Call
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
        "-"
      ),
    },
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
  const locationAddressSummary = [
    booking?.locationLine1,
    booking?.locationBuildingName,
    booking?.locationFloorNumber ? `Floor ${booking.locationFloorNumber}` : null,
    booking?.locationLine2,
    booking?.locationArea,
    booking?.locationCity,
    booking?.locationEmirate,
    booking?.locationCountry,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(", ")
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
  const locationDetailItems: DetailListItem[] = [
    { label: "Destination", value: locationDestination },
    { label: "Address", value: locationAddressSummary || "-" },
    { label: "Building", value: booking?.locationBuildingName || "-" },
    { label: "Floor", value: booking?.locationFloorNumber || "-" },
    { label: "Country", value: booking?.locationCountry || "-" },
  ]
  const sampleFlowCanSubmit =
    !isSubmittingSample &&
    !isDocumentProcessing &&
    !isCompletedBooking &&
    (!requiresDocumentProof || isSampleDocumentReady)
  const isSampleCollected = sampleSuccessMessage === "Sample collection submitted successfully."
  const sampleStatusDescription = isCompletedBooking
    ? "This booking is already closed based on the current API status."
    : requiresDocumentProof
    ? "Collect missing patient ID documents first, then complete the sample flow."
    : "All required patient details are already available. Complete the sample flow now."
  const openSampleSubmitConfirm = React.useCallback(() => {
    if (!sampleFlowCanSubmit) {
      return
    }
    setIsSampleSubmitConfirmOpen(true)
  }, [sampleFlowCanSubmit])
  const confirmSampleSubmit = React.useCallback(() => {
    if (!sampleFlowCanSubmit) {
      return
    }
    setIsSampleSubmitConfirmOpen(false)
    void handleSampleSubmit()
  }, [handleSampleSubmit, sampleFlowCanSubmit])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        overlayClassName="bg-black/55 backdrop-blur-[1px] lg:bg-black/45"
        className="inset-x-0 bottom-0 top-auto h-[92dvh] max-h-[92dvh] w-[100dvw] max-w-[100dvw] overflow-hidden rounded-t-[22px] border border-b-0 border-border/70 p-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom [&>button]:hidden lg:inset-y-0 lg:inset-x-auto lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:h-[100dvh] lg:max-h-[100dvh] lg:w-[min(1120px,92vw)] lg:max-w-[min(1120px,92vw)] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l lg:border-border/70 lg:shadow-2xl lg:data-[state=closed]:slide-out-to-right lg:data-[state=open]:slide-in-from-right"
      >
        <SheetTitle className="sr-only">Booking Details</SheetTitle>
        <SheetDescription className="sr-only">
          Review booking details, update patient information, and submit sample collection.
        </SheetDescription>
        <div className="flex items-center justify-center border-b border-border/70 py-2 lg:hidden">
          <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
        </div>
        <SidebarProvider
          className="h-full items-start overflow-hidden"
          style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
        >
          <Sidebar
            collapsible="none"
            className="hidden border-r border-border/70 bg-card/40 lg:flex"
          >
            <SidebarContent className="gap-0 p-2">
              <SidebarGroup className="p-0">
                <div className="px-2 pt-2 pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Sections
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Navigate booking workflow quickly.
                  </p>
                </div>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {orderedSectionItems.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          size="lg"
                          variant={activeSection === item.key ? "outline" : "default"}
                          isActive={activeSection === item.key}
                          className="h-auto min-h-12 items-start rounded-xl px-3 py-2.5"
                          onClick={() => setActiveSection(item.key)}
                        >
                          <item.icon className="mt-0.5 size-4" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold">
                              {item.name}
                            </span>
                            <span className="text-muted-foreground truncate text-[11px] font-normal">
                              {item.description}
                            </span>
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex h-full w-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
            <header className="safe-area-top bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex min-h-14 shrink-0 items-center border-b backdrop-blur md:h-16 md:bg-transparent md:backdrop-blur-none">
              <div className="flex w-full min-w-0 items-center justify-between gap-2 overflow-x-hidden px-3 sm:px-4">
                <div className="min-w-0 md:hidden">
                  <p className="truncate text-sm font-semibold">Bookings</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {booking?.bookingId ?? "Details"}
                  </p>
                </div>
                <Breadcrumb className="hidden min-w-0 md:block">
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
                  className="mobile-touch-target h-10 shrink-0 rounded-full border-border/70 px-2.5 sm:px-3"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-4" />
                  <span className="hidden text-xs font-medium sm:inline">Close</span>
                  <span className="sr-only">Close panel</span>
                </Button>
              </div>
            </header>

            <div className="border-b border-border/70 bg-background/95 px-3 py-2.5 lg:hidden">
              <Tabs
                value={activeSection}
                onValueChange={(value) => setActiveSection(value as DialogSection)}
              >
                <TabsList className="group-data-horizontal/tabs:h-auto grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
                  {orderedSectionItems.map((item) => (
                    <TabsTrigger
                      key={item.key}
                      value={item.key}
                      className="mobile-touch-target h-10 justify-start rounded-lg px-2.5 text-xs font-semibold data-[state=active]:bg-background"
                    >
                      <item.icon className="size-3.5" />
                      <span className="truncate">{item.name}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-y-contain p-3 pb-[calc(7.25rem+env(safe-area-inset-bottom))] [touch-action:pan-y] sm:p-4 sm:pb-[calc(7.25rem+env(safe-area-inset-bottom))] md:space-y-5 md:p-6 md:pb-[calc(7.25rem+env(safe-area-inset-bottom))] lg:pb-6">
              <input
                ref={passportUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const input = event.currentTarget
                  const file = input.files?.[0] ?? null
                  if (activeUploadPatientId) {
                    await handleProcessDocument(activeUploadPatientId, file, "upload")
                  }
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
                  if (activeUploadPatientId) {
                    await handleProcessDocument(activeUploadPatientId, file, "capture")
                  }
                  input.value = ""
                }}
              />

              {activeSection === "booking" ? (
                <section className="space-y-4">
                  <Card className="overflow-hidden shadow-none">
                    <CardHeader className="border-b border-border/70 p-4">
                      <CardTitle className="text-sm font-semibold">Booking Information</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <DetailRows items={bookingDetailItems} />
                    </CardContent>
                  </Card>
                </section>
              ) : null}

              {activeSection === "patients" ? (
                <section className="space-y-4">
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
                                  <Badge variant="destructive" className="text-white">
                                    National ID required
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">ID available</Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-2">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-xl border border-border/70 bg-card/40 p-3">
                                <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                                  Name
                                </p>
                                <p className="mt-1 text-sm font-medium">
                                  {patient.name.trim() || "-"}
                                </p>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-card/40 p-3">
                                <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                                  Age
                                </p>
                                <p className="mt-1 text-sm font-medium">{patient.age || "-"}</p>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-card/40 p-3">
                                <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                                  Gender
                                </p>
                                <p className="mt-1 text-sm font-medium">
                                  {patient.gender || "-"}
                                </p>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-card/40 p-3">
                                <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                                  National ID / Passport
                                </p>
                                <p className="mt-1 text-sm font-medium">
                                  {patient.nationalId || "-"}
                                </p>
                              </div>
                            </div>
                            {(() => {
                              const patientDocument =
                                patientDocuments[patient.currentPatientId] || null
                              const documentLabel = patientDocument
                                ? patientDocument.documentType === "EID_FRONT"
                                  ? "EID Front"
                                  : "Passport Front"
                                : "Auto Detect"

                              const needsDocument = !patient.nationalId.trim()
                              const shouldShowUploadSection = needsDocument || Boolean(patientDocument)
                              const isProcessingThisPatient =
                                isDocumentProcessing &&
                                activeUploadPatientId === patient.currentPatientId

                              if (!shouldShowUploadSection) {
                                return null
                              }

                              return (
                                <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-card/40 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold">
                                        Document Upload (Passport or EID Front)
                                      </p>
                                      <p className="text-muted-foreground text-xs">
                                        {needsDocument
                                          ? "Upload or capture one clear front image for this patient."
                                          : "ID already exists in the API response for this patient."}
                                      </p>
                                    </div>
                                    <Badge
                                      variant={
                                        isDocumentProcessing &&
                                        activeUploadPatientId === patient.currentPatientId
                                          ? "outline"
                                          : patientDocument
                                          ? "secondary"
                                          : needsDocument
                                          ? "destructive"
                                          : "secondary"
                                      }
                                      className={needsDocument && !patientDocument ? "text-white" : undefined}
                                    >
                                      {isDocumentProcessing &&
                                      activeUploadPatientId === patient.currentPatientId
                                        ? "Scanning"
                                        : patientDocument
                                        ? "Uploaded"
                                        : needsDocument
                                        ? "Required"
                                        : "Not needed"}
                                    </Badge>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">Detected: {documentLabel}</Badge>
                                    {patientDocument?.extractedData.documentNumber ? (
                                      <Badge variant="secondary">Data extracted</Badge>
                                    ) : null}
                                  </div>

                                  {isProcessingThisPatient ? (
                                    <ProcessingDocumentState
                                      documentType={processingDocumentType}
                                    />
                                  ) : null}

                                  {patientDocument ? (
                                    <div className="space-y-3">
                                      <div className="relative h-36 w-full overflow-hidden rounded-lg border bg-black/5">
                                        <PreviewImage
                                          src={patientDocument.previewDataUrl}
                                          label={`${documentLabel} preview`}
                                          fallbackFile={patientDocument.file}
                                        />
                                      </div>
                                      <div className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 text-xs sm:grid-cols-2">
                                        <p>
                                          <span className="text-muted-foreground">Full Name: </span>
                                          {patientDocument.extractedData.fullName || "-"}
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">Document No: </span>
                                          {patientDocument.extractedData.documentNumber || "-"}
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">Gender: </span>
                                          {patientDocument.extractedData.gender || "-"}
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">Nationality: </span>
                                          {patientDocument.extractedData.nationality || "-"}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap justify-end gap-2">
                                        {!isCompletedBooking && !isSampleCollected ? (
                                          <Button
                                            type="button"
                                            className="mobile-touch-target h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                                            disabled={submittingPatientId === patient.currentPatientId}
                                            onClick={() => {
                                              void handleSubmitPatientDetails(
                                                patient.currentPatientId
                                              )
                                            }}
                                          >
                                            {submittingPatientId === patient.currentPatientId ? (
                                              <>
                                                <Loader2 className="size-4 animate-spin" />
                                                Submitting...
                                              </>
                                            ) : (
                                              "Submit Patient Details"
                                            )}
                                          </Button>
                                        ) : null}
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          className="mobile-touch-target h-10 rounded-xl"
                                          disabled
                                        >
                                          <CheckCircle2 className="size-4" />
                                          Completed
                                        </Button>
                                      </div>
                                    </div>
                                  ) : needsDocument ? (
                                    <>
                                      <button
                                        type="button"
                                        className="flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border/70 bg-background/40 transition-colors hover:border-primary/50 hover:bg-background/70"
                                        disabled={
                                          isDocumentProcessing ||
                                          (isCaptureDevice && isRequestingCameraPermission)
                                        }
                                        onClick={() => {
                                          void triggerDocumentInput(
                                            patient.currentPatientId,
                                            isCaptureDevice ? "capture" : "upload"
                                          )
                                        }}
                                      >
                                        <div className="text-muted-foreground flex flex-col items-center gap-2 text-xs">
                                          {isCaptureDevice ? (
                                            <Camera className="size-5" />
                                          ) : (
                                            <ImageUp className="size-5" />
                                          )}
                                          <span>
                                            {isCaptureDevice
                                              ? "Capture document front"
                                              : "Upload document front"}
                                          </span>
                                        </div>
                                      </button>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className="mobile-touch-target h-10 rounded-xl"
                                          disabled={
                                            isDocumentProcessing ||
                                            (isCaptureDevice && isRequestingCameraPermission)
                                          }
                                          onClick={() => {
                                            void triggerDocumentInput(
                                              patient.currentPatientId,
                                              isCaptureDevice ? "capture" : "upload"
                                            )
                                          }}
                                        >
                                          {isCaptureDevice ? "Capture Front" : "Upload Front"}
                                        </Button>
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              )
                            })()}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {patientActionError ? (
                    <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-300">
                      {patientActionError}
                    </div>
                  ) : null}

                  {patientActionMessage ? (
                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                      {patientActionMessage}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {activeSection === "location" ? (
                <section className="space-y-4">
                  <Card className="overflow-hidden shadow-none">
                    <CardHeader className="border-b border-border/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-sm font-semibold">Route Information</CardTitle>
                        {mapRouteUrl && hasCoordinates ? (
                          <Button asChild type="button" variant="outline" size="sm">
                            <a href={mapRouteUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" />
                              View Route in Map
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <DetailRows items={locationDetailItems} />
                    </CardContent>
                  </Card>
                </section>
              ) : null}

              {activeSection === "sample" ? (
                <section className="space-y-4">
                  {requiresDocumentProof ? (
                    <Alert className="border-amber-500/30 bg-amber-500/10">
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-300" />
                      <AlertTitle className="text-sm">
                        Document proof required for submission
                      </AlertTitle>
                      <AlertDescription className="text-xs leading-relaxed">
                        Some patients are missing National ID/Passport.
                        {" Add one clear passport or Emirates ID front image."}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-emerald-500/30 bg-emerald-500/10">
                      <FlaskConical className="size-4 text-emerald-600 dark:text-emerald-300" />
                      <AlertTitle className="text-sm">
                        Ready for quick sample submission
                      </AlertTitle>
                      <AlertDescription className="text-xs leading-relaxed">
                        No document capture is required. You can submit directly.
                      </AlertDescription>
                    </Alert>
                  )}

                  <>
                    <Card className="shadow-none">
                        <CardHeader className="space-y-2 p-4 pb-2">
                          <CardTitle className="text-base">
                            {requiresDocumentProof ? "Missing Patient Documents" : "Review and Complete"}
                          </CardTitle>
                          <CardDescription>
                            {sampleStatusDescription}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4 pt-2">
                          {requiresDocumentProof ? (
                            <div className="space-y-3">
                              {patientForms
                                .filter((patient) => !patient.nationalId.trim())
                                .map((patient, index) => {
                                  const patientDocument =
                                    patientDocuments[patient.currentPatientId] || null

                                  return (
                                    <div
                                      key={patient.currentPatientId}
                                      className="rounded-xl border border-border/70 bg-card/40 p-3"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold">
                                            {patient.name.trim() || `Patient ${index + 1}`}
                                          </p>
                                          <p className="text-muted-foreground text-xs">
                                            {patientDocument
                                              ? "Document uploaded and extracted."
                                              : "Patient ID document still required."}
                                          </p>
                                        </div>
                                        <Badge
                                          variant={patientDocument ? "secondary" : "destructive"}
                                          className={!patientDocument ? "text-white" : undefined}
                                        >
                                          {patientDocument ? "Ready" : "Pending"}
                                        </Badge>
                                      </div>
                                      {patientDocument ? (
                                        <div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr]">
                                          <div className="relative h-32 overflow-hidden rounded-lg border bg-black/5">
                                            <PreviewImage
                                              src={patientDocument.previewDataUrl}
                                              label={`${patient.name} document preview`}
                                              fallbackFile={patientDocument.file}
                                            />
                                          </div>
                                          <div className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 text-xs sm:grid-cols-2">
                                            <p>
                                              <span className="text-muted-foreground">Type: </span>
                                              {patientDocument.documentType === "EID_FRONT"
                                                ? "EID Front"
                                                : "Passport Front"}
                                            </p>
                                            <p>
                                              <span className="text-muted-foreground">Document No: </span>
                                              {patientDocument.extractedData.documentNumber || "-"}
                                            </p>
                                            <p>
                                              <span className="text-muted-foreground">Full Name: </span>
                                              {patientDocument.extractedData.fullName || "-"}
                                            </p>
                                            <p>
                                              <span className="text-muted-foreground">Gender: </span>
                                              {patientDocument.extractedData.gender || "-"}
                                            </p>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                })}
                              {!isSampleDocumentReady ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="mobile-touch-target h-10 rounded-xl"
                                  onClick={() => setActiveSection("patients")}
                                >
                                  Go to Patient Details
                                </Button>
                              ) : null}
                            </div>
                          ) : activeFrontDocument ? (
                            <div className="space-y-2">
                              <div className="rounded-lg border border-border/70 px-3 py-2">
                                <p className="text-xs font-medium">
                                  {activeFrontDocument.documentType === "EID_FRONT"
                                    ? "EID Front"
                                    : "Passport Front"}
                                </p>
                                <p className="text-muted-foreground truncate text-[11px]">
                                  {activeFrontDocument.file.name}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {sampleErrorMessage ? (
                            <div className="space-y-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-300">
                              <p>{sampleErrorMessage}</p>
                              {sampleErrorDetails?.reason ? (
                                <p className="text-[11px]">
                                  Reason: {formatDocumentErrorReason(sampleErrorDetails.reason)}
                                </p>
                              ) : null}
                              {sampleErrorDetails?.errorId ? (
                                <p className="text-[11px]">Error ID: {sampleErrorDetails.errorId}</p>
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

                          {!isSampleCollected && !isCompletedBooking ? (
                            <div className="rounded-md border border-border/70 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                              No booking API is called during scan review. The collector API is only called when you confirm
                              <span className="font-medium text-foreground"> Mark as Sample Collected</span>.
                            </div>
                          ) : null}

                          <ProcessingDocumentState documentType={processingDocumentType} />

                          {isSampleCollected ? (
                            <Button
                              type="button"
                              disabled
                              className="mobile-touch-target h-12 w-full rounded-xl border border-emerald-500/35 bg-emerald-500/15 text-emerald-700 opacity-100 disabled:cursor-default disabled:opacity-100 dark:text-emerald-300"
                            >
                              <CheckCircle2 className="size-4" />
                              Marked as Sample Collected
                            </Button>
                          ) : isCompletedBooking ? (
                            <div className="rounded-xl border border-border/70 bg-card/40 px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                              {sampleStatusDescription}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Button
                                type="button"
                                className="mobile-touch-target h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                                disabled={!sampleFlowCanSubmit}
                                onClick={openSampleSubmitConfirm}
                              >
                                {isSubmittingSample ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Submitting...
                                  </>
                                ) : (
                                  "Mark as Sample Collected"
                                )}
                              </Button>
                              <p className="text-muted-foreground text-center text-xs">
                                Confirm submission in the next step.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                  </>
                </section>
              ) : null}

              <Dialog
                open={isSampleSubmitConfirmOpen}
                onOpenChange={setIsSampleSubmitConfirmOpen}
              >
                <DialogContent className="max-w-sm rounded-2xl p-5">
                  <DialogHeader>
                    <DialogTitle>Confirm Sample Submission</DialogTitle>
                    <DialogDescription>
                      Submit this booking sample collection now?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSampleSubmitConfirmOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={!sampleFlowCanSubmit || isSubmittingSample}
                      onClick={confirmSampleSubmit}
                    >
                      {isSubmittingSample ? "Submitting..." : "Confirm Submit"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="hidden justify-end border-t pt-4 md:flex">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="safe-area-bottom border-t border-border/70 bg-background/95 p-3 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="mobile-touch-target h-11 rounded-xl"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  className="mobile-touch-target h-11 rounded-xl"
                  disabled={activeSection === primarySection}
                  onClick={() => {
                    if (activeSection !== primarySection) {
                      setActiveSection(primarySection)
                    }
                  }}
                >
                  {activeSection === primarySection
                    ? "Current Workflow Section"
                    : primarySection === "patients"
                    ? "Go to Patient Details"
                    : primarySection === "sample"
                    ? "Go to Sample"
                    : "Go to Booking"}
                </Button>
              </div>
            </div>
          </main>
        </SidebarProvider>
      </SheetContent>
    </Sheet>
  )
}
