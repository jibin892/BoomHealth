import type {
  OpenAiDocumentType,
  ProcessedDocumentErrorPayload,
  ProcessedDocumentPayload,
} from "@/lib/document-processing/types"

type ProcessDocumentInput = {
  file: File
  documentType: OpenAiDocumentType
}

type ProcessDocumentOutput = ProcessedDocumentPayload

const CONFIDENCE_RETRY_THRESHOLD = 0.6
const MAX_PROCESS_ATTEMPTS = 1
const MIN_COMPRESS_BYTES = 600 * 1024
const MAX_IMAGE_DIMENSION = 1600
const COMPRESS_QUALITY = 0.82

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

export async function processDocumentImage({
  file,
  documentType,
}: ProcessDocumentInput): Promise<ProcessDocumentOutput> {
  const optimizedFile = await optimizeImageForProcessing(file)
  let bestAttempt: ProcessDocumentOutput | null = null

  for (let attempt = 1; attempt <= MAX_PROCESS_ATTEMPTS; attempt += 1) {
    const formData = new FormData()
    formData.append("file", optimizedFile)
    formData.append("documentType", documentType)

    const response = await fetch("/api/document/process", {
      method: "POST",
      body: formData,
    })

    const payload = (await response.json().catch(() => null)) as unknown

    if (!response.ok) {
      if (isErrorPayload(payload)) {
        throw new Error(payload.message)
      }

      throw new Error("Document not clear. Please recapture.")
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid document processing response.")
    }

    const normalized = payload as ProcessedDocumentPayload
    if (!normalized.croppedDocumentImageBase64) {
      throw new Error("Document processing did not return a preview.")
    }

    if (!bestAttempt || normalized.confidenceScore > bestAttempt.confidenceScore) {
      bestAttempt = normalized
    }

    if (normalized.confidenceScore >= CONFIDENCE_RETRY_THRESHOLD) {
      return normalized
    }
  }

  if (!bestAttempt) {
    throw new Error("Document not clear. Please recapture.")
  }

  return bestAttempt
}
