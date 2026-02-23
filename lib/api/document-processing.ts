import type {
  OpenAiDocumentType,
  ProcessedDocumentErrorPayload,
  ProcessedDocumentErrorReason,
  ProcessedDocumentPayload,
} from "@/lib/document-processing/types"
import { trackApiTelemetry } from "@/lib/observability/telemetry"

type ProcessDocumentInput = {
  file: File
  documentType: OpenAiDocumentType
}

type ProcessDocumentOutput = ProcessedDocumentPayload

const CONFIDENCE_RETRY_THRESHOLD = 0.6
const MAX_PROCESS_ATTEMPTS = 1
const REQUEST_TIMEOUT_MS = 16_000
const MIN_COMPRESS_BYTES = 600 * 1024
const MAX_IMAGE_DIMENSION = 1600
const COMPRESS_QUALITY = 0.82
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

type DocumentProcessingErrorOptions = {
  reason?: ProcessedDocumentErrorReason
  retryable?: boolean
  errorId?: string
}

export class DocumentProcessingError extends Error {
  reason?: ProcessedDocumentErrorReason
  retryable: boolean
  errorId?: string

  constructor(message: string, options?: DocumentProcessingErrorOptions) {
    super(message)
    this.name = "DocumentProcessingError"
    this.reason = options?.reason
    this.retryable = Boolean(options?.retryable)
    this.errorId = options?.errorId
  }
}

function isSupportedImageMimeType(mimeType: string) {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType.trim().toLowerCase())
}

async function optimizeImageForProcessing(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file
  }

  if (file.size < MIN_COMPRESS_BYTES || typeof window === "undefined") {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const longestSide = Math.max(bitmap.width, bitmap.height)
    const scale =
      longestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longestSide : 1

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) {
      bitmap.close()
      return file
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", COMPRESS_QUALITY)
    })

    if (!compressedBlob) {
      return file
    }

    // Keep original if compression does not provide meaningful size reduction.
    if (compressedBlob.size >= file.size * 0.95) {
      return file
    }

    const baseName = file.name.replace(/\.[^.]+$/, "")
    return new File([compressedBlob], `${baseName}-optimized.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}

function isErrorPayload(value: unknown): value is ProcessedDocumentErrorPayload {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return record.error === true && typeof record.message === "string"
}

function toDocumentProcessingError(
  message: string,
  payload?: Partial<ProcessedDocumentErrorPayload>
) {
  return new DocumentProcessingError(message, {
    reason: payload?.reason,
    retryable: payload?.retryable,
    errorId: payload?.errorId,
  })
}

export function getDocumentProcessingErrorDetails(error: unknown) {
  if (error instanceof DocumentProcessingError) {
    return {
      message: error.message,
      reason: error.reason || null,
      retryable: error.retryable,
      errorId: error.errorId || null,
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      reason: null,
      retryable: false,
      errorId: null,
    }
  }

  return {
    message: "Document not clear. Please recapture.",
    reason: null,
    retryable: false,
    errorId: null,
  }
}

export function processDocumentImage({
  file,
  documentType,
}: ProcessDocumentInput): Promise<ProcessDocumentOutput> {
  return processDocumentImageInternal({ file, documentType })
}

async function processDocumentImageInternal({
  file,
  documentType,
}: ProcessDocumentInput): Promise<ProcessDocumentOutput> {
  if (!isSupportedImageMimeType(file.type)) {
    throw toDocumentProcessingError(
      "Only JPG, PNG, WEBP, HEIC, and HEIF images are supported.",
      {
        reason: "unsupported_file_type",
        retryable: false,
      }
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw toDocumentProcessingError(
      "Image is too large. Maximum allowed size is 8MB.",
      {
        reason: "file_too_large",
        retryable: false,
      }
    )
  }

  const optimizedFile = await optimizeImageForProcessing(file)
  let bestAttempt: ProcessDocumentOutput | null = null

  for (let attempt = 1; attempt <= MAX_PROCESS_ATTEMPTS; attempt += 1) {
    const formData = new FormData()
    formData.append("file", optimizedFile)
    formData.append("documentType", documentType)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now()

    let response: Response
    try {
      response = await fetch("/api/document/process", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timeout)
      trackApiTelemetry({
        name: "/api/document/process",
        durationMs:
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          startedAt,
        success: false,
        errorCode:
          error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : "network_error",
        metadata: {
          documentType,
        },
      })
      if (error instanceof Error && error.name === "AbortError") {
        throw toDocumentProcessingError(
          "Document scan timed out. Please retry with a clearer image.",
          {
            reason: "timeout",
            retryable: true,
          }
        )
      }

      throw toDocumentProcessingError(
        "Unable to reach document scanner. Please check your connection and retry.",
        {
          reason: "openai_request_failed",
          retryable: true,
        }
      )
    }
    clearTimeout(timeout)

    const payload = (await response.json().catch(() => null)) as unknown

    if (!response.ok) {
      trackApiTelemetry({
        name: "/api/document/process",
        durationMs:
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          startedAt,
        success: false,
        statusCode: response.status,
        errorCode: isErrorPayload(payload) ? payload.reason || "scan_failed" : "scan_failed",
        metadata: {
          documentType,
        },
      })
      if (isErrorPayload(payload)) {
        throw toDocumentProcessingError(payload.message, payload)
      }

      throw toDocumentProcessingError("Document not clear. Please recapture.", {
        reason: "document_not_clear",
        retryable: true,
      })
    }

    if (!payload || typeof payload !== "object") {
      trackApiTelemetry({
        name: "/api/document/process",
        durationMs:
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          startedAt,
        success: false,
        statusCode: response.status,
        errorCode: "invalid_openai_response",
        metadata: {
          documentType,
        },
      })
      throw toDocumentProcessingError("Invalid document processing response.", {
        reason: "invalid_openai_response",
        retryable: true,
      })
    }

    const normalized = payload as ProcessedDocumentPayload
    if (!normalized.croppedDocumentImageBase64) {
      trackApiTelemetry({
        name: "/api/document/process",
        durationMs:
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          startedAt,
        success: false,
        statusCode: response.status,
        errorCode: "missing_preview",
        metadata: {
          documentType,
        },
      })
      throw toDocumentProcessingError(
        "Document processing did not return a preview.",
        {
          reason: "invalid_openai_response",
          retryable: true,
        }
      )
    }

    if (!bestAttempt || normalized.confidenceScore > bestAttempt.confidenceScore) {
      bestAttempt = normalized
    }

    if (normalized.confidenceScore >= CONFIDENCE_RETRY_THRESHOLD) {
      trackApiTelemetry({
        name: "/api/document/process",
        durationMs:
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          startedAt,
        success: true,
        statusCode: response.status,
        metadata: {
          documentType,
        },
      })
      return normalized
    }
  }

  if (!bestAttempt) {
    throw toDocumentProcessingError("Document not clear. Please recapture.", {
      reason: "document_not_clear",
      retryable: true,
    })
  }

  trackApiTelemetry({
    name: "/api/document/process",
    durationMs: 0,
    success: true,
    metadata: {
      documentType,
      lowConfidence: true,
    },
  })

  return bestAttempt
}
