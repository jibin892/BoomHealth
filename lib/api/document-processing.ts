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
const MAX_PROCESS_ATTEMPTS = 2

function isErrorPayload(value: unknown): value is ProcessedDocumentErrorPayload {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return record.error === true && typeof record.message === "string"
}

export async function processDocumentImage({
  file,
  documentType,
}: ProcessDocumentInput): Promise<ProcessDocumentOutput> {
  let bestAttempt: ProcessDocumentOutput | null = null

  for (let attempt = 1; attempt <= MAX_PROCESS_ATTEMPTS; attempt += 1) {
    const formData = new FormData()
    formData.append("file", file)
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
