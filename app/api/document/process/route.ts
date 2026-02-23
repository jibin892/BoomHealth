import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"

import {
  OPENAI_DOCUMENT_TYPES,
  type OpenAiDocumentType,
  type ProcessedDocumentErrorPayload,
  type ProcessedDocumentErrorReason,
  type ProcessedDocumentPayload,
} from "@/lib/document-processing/types"
import { captureObservedError, trackApiTelemetry } from "@/lib/observability/telemetry"

const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses"
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_DOCUMENT_TIMEOUT_MS || 18_000)
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const OPENAI_DOCUMENT_MODEL = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini"
const MIN_CONFIDENCE_UNSUPPORTED = 0.35
const MIN_CONFIDENCE_PASSPORT = 0.5
const MIN_CONFIDENCE_EID_FRONT = 0.5
const MIN_CONFIDENCE_EID_BACK = 0.45

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

const DEFAULT_EXTRACTED_DATA = {
  fullName: "",
  gender: "",
  documentNumber: "",
  nationality: "",
}

const DEFAULT_VALIDATION = {
  isValidEID: false,
  startsWith784: false,
}

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "documentType",
    "extractedData",
    "validation",
    "croppedDocumentImageBase64",
    "confidenceScore",
  ],
  properties: {
    documentType: {
      type: "string",
      enum: OPENAI_DOCUMENT_TYPES,
    },
    extractedData: {
      type: "object",
      additionalProperties: false,
      required: ["fullName", "gender", "documentNumber", "nationality"],
      properties: {
        fullName: { type: "string" },
        gender: { type: "string" },
        documentNumber: { type: "string" },
        nationality: { type: "string" },
      },
    },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["isValidEID", "startsWith784"],
      properties: {
        isValidEID: { type: "boolean" },
        startsWith784: { type: "boolean" },
      },
    },
    croppedDocumentImageBase64: { type: "string" },
    confidenceScore: { type: "number" },
  },
} as const

type OpenAiResponse = {
  output_text?: string
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>
  }>
}

function toError(
  message: string,
  options?: {
    confidenceScore?: number
    reason?: ProcessedDocumentErrorReason
    retryable?: boolean
    errorId?: string
  }
): ProcessedDocumentErrorPayload {
  return {
    error: true,
    message,
    confidenceScore: options?.confidenceScore ?? 0.45,
    ...(options?.reason ? { reason: options.reason } : {}),
    ...(typeof options?.retryable === "boolean"
      ? { retryable: options.retryable }
      : {}),
    errorId: options?.errorId || randomUUID(),
  }
}

function isDocumentType(value: string): value is OpenAiDocumentType {
  return OPENAI_DOCUMENT_TYPES.includes(value as OpenAiDocumentType)
}

function extractOutputText(payload: OpenAiResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text
  }

  const chunks: string[] = []
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (
        (content.type === "output_text" || content.type === "text") &&
        typeof content.text === "string"
      ) {
        chunks.push(content.text)
      }
    }
  }

  return chunks.join("\n").trim()
}

function parseJsonResponse(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  return JSON.parse(cleaned)
}

function normalizeBase64(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const stripWrappers = (raw: string) => {
    let next = raw.trim()

    if (
      (next.startsWith("b'") && next.endsWith("'")) ||
      (next.startsWith('b"') && next.endsWith('"'))
    ) {
      next = next.slice(2, -1)
    }

    if (
      (next.startsWith("'") && next.endsWith("'")) ||
      (next.startsWith('"') && next.endsWith('"'))
    ) {
      next = next.slice(1, -1)
    }

    return next.trim()
  }

  const normalizeBody = (rawValue: string) => {
    const noWhitespace = rawValue
      .replace(/\\n/g, "")
      .replace(/\\r/g, "")
      .replace(/\s+/g, "")
    const normalizedBase64 = noWhitespace
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/[^A-Za-z0-9+/=]/g, "")
    const paddingLength = normalizedBase64.length % 4

    if (paddingLength === 0) {
      return normalizedBase64
    }

    return normalizedBase64.padEnd(
      normalizedBase64.length + (4 - paddingLength),
      "="
    )
  }

  const unwrapped = stripWrappers(trimmed)
  if (!unwrapped.startsWith("data:")) {
    return normalizeBody(unwrapped)
  }

  const commaIndex = unwrapped.indexOf(",")
  if (commaIndex === -1) return ""
  return normalizeBody(unwrapped.slice(commaIndex + 1))
}

function isLikelyImageBase64(value: string) {
  try {
    const bytes = Buffer.from(value, "base64")
    if (!bytes || bytes.length < 16) return false

    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
    const isBmp = bytes[0] === 0x42 && bytes[1] === 0x4d
    const isWebp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50

    return isJpeg || isPng || isGif || isBmp || isWebp
  } catch {
    return false
  }
}

function isSupportedImageMimeType(mimeType: string) {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType.trim().toLowerCase())
}

function hasSupportedImageSignature(buffer: Buffer) {
  if (buffer.length < 12) return false

  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50

  // HEIC/HEIF use ISOBMFF container with ftyp box markers.
  const ftyp = buffer.toString("ascii", 4, 12).toLowerCase()
  const isHeifContainer = ftyp.startsWith("ftyp")
  const brand = buffer.toString("ascii", 8, 12).toLowerCase()
  const isHeifBrand = ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(
    brand
  )

  return isJpeg || isPng || isWebp || (isHeifContainer && isHeifBrand)
}

function toNormalizedPayload(
  value: unknown,
  expectedType: OpenAiDocumentType
): ProcessedDocumentPayload | null {
  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  const extractedData =
    record.extractedData && typeof record.extractedData === "object"
      ? (record.extractedData as Record<string, unknown>)
      : {}
  const validation =
    record.validation && typeof record.validation === "object"
      ? (record.validation as Record<string, unknown>)
      : {}

  const confidenceValue =
    typeof record.confidenceScore === "number"
      ? record.confidenceScore
      : Number(record.confidenceScore)
  const confidenceScore = Number.isFinite(confidenceValue)
    ? Math.max(0, Math.min(1, confidenceValue))
    : 0

  const rawBase64 =
    typeof record.croppedDocumentImageBase64 === "string"
      ? normalizeBase64(record.croppedDocumentImageBase64)
      : ""

  if (!rawBase64) {
    return null
  }

  if (!isLikelyImageBase64(rawBase64)) {
    return null
  }

  const payload: ProcessedDocumentPayload = {
    documentType: expectedType,
    extractedData: {
      fullName:
        typeof extractedData.fullName === "string"
          ? extractedData.fullName.trim()
          : DEFAULT_EXTRACTED_DATA.fullName,
      gender:
        typeof extractedData.gender === "string"
          ? extractedData.gender.trim()
          : DEFAULT_EXTRACTED_DATA.gender,
      documentNumber:
        typeof extractedData.documentNumber === "string"
          ? extractedData.documentNumber.trim()
          : DEFAULT_EXTRACTED_DATA.documentNumber,
      nationality:
        typeof extractedData.nationality === "string"
          ? extractedData.nationality.trim()
          : DEFAULT_EXTRACTED_DATA.nationality,
    },
    validation: {
      isValidEID:
        typeof validation.isValidEID === "boolean"
          ? validation.isValidEID
          : DEFAULT_VALIDATION.isValidEID,
      startsWith784:
        typeof validation.startsWith784 === "boolean"
          ? validation.startsWith784
          : typeof validation.startsWith789 === "boolean"
          ? validation.startsWith789
          : DEFAULT_VALIDATION.startsWith784,
    },
    croppedDocumentImageBase64: rawBase64,
    confidenceScore,
  }

  if (payload.documentType === "EID_FRONT") {
    const normalizedDocumentNumber = payload.extractedData.documentNumber
      .replace(/\s+/g, "")
      .replace(/-/g, "")

    const startsWith784 = normalizedDocumentNumber.startsWith("784")
    payload.validation.startsWith784 = startsWith784
    payload.validation.isValidEID = startsWith784 && payload.validation.isValidEID
  }

  if (payload.documentType === "PASSPORT" || payload.documentType === "EID_BACK") {
    payload.validation = DEFAULT_VALIDATION
  }

  return payload
}

function normalizeDocumentNumber(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
}

function getDocumentValidationError(
  payload: ProcessedDocumentPayload,
  expectedType: OpenAiDocumentType
) {
  if (payload.confidenceScore < MIN_CONFIDENCE_UNSUPPORTED) {
    return "Unsupported document. Please upload or capture a valid Passport or Emirates ID."
  }

  if (expectedType === "PASSPORT") {
    const passportNumber = normalizeDocumentNumber(payload.extractedData.documentNumber)
    const hasPassportNumber = passportNumber.length >= 5
    const hasName = payload.extractedData.fullName.trim().length >= 3

    if (!hasPassportNumber || !hasName) {
      return "This is not a valid passport front page. Please upload or capture the passport details page."
    }

    if (payload.confidenceScore < MIN_CONFIDENCE_PASSPORT) {
      return "Passport image is unclear. Please recapture the passport front page."
    }
  }

  if (expectedType === "EID_FRONT") {
    const documentNumber = normalizeDocumentNumber(payload.extractedData.documentNumber)
    const startsWith784 = documentNumber.startsWith("784")

    if (!documentNumber || !startsWith784) {
      return "This is not a valid Emirates ID front. Please upload or capture an EID front where the ID number starts with 784."
    }

    if (payload.confidenceScore < MIN_CONFIDENCE_EID_FRONT) {
      return "Emirates ID front image is unclear. Please recapture the document."
    }
  }

  if (expectedType === "EID_BACK" && payload.confidenceScore < MIN_CONFIDENCE_EID_BACK) {
    return "This is not a valid Emirates ID back. Please upload or capture the EID back side."
  }

  return null
}

function buildInstructionPrompt(documentType: OpenAiDocumentType) {
  return [
    "You are an OCR + document cleanup processor.",
    `Expected document type: ${documentType}.`,
    "Process the provided image before any preview is shown:",
    "1) Detect document edges.",
    "2) Perspective-correct the document.",
    "3) Remove all background noise (hands, fingers, shadows, table).",
    "4) Return a tightly cropped professional scanner-style result.",
    "For PASSPORT and EID_FRONT extract: fullName, gender, documentNumber, nationality.",
    "For EID_BACK extraction fields can be empty strings.",
    "For EID_FRONT, startsWith784 must reflect whether documentNumber begins with 784.",
    "If the image is not the expected document type, do not hallucinate values.",
    "For unsupported documents, keep extracted fields empty and set confidenceScore to 0.2 or lower.",
    "Return ONLY strict JSON that matches the provided schema.",
    "croppedDocumentImageBase64 must be raw base64 without data URL prefix.",
    "If image is unclear, return low confidenceScore (<0.6) and best effort fields.",
  ].join("\n")
}

export async function POST(request: Request) {
  const startedAt = Date.now()

  const respond = (
    payload: ProcessedDocumentPayload | ProcessedDocumentErrorPayload,
    status: number,
    options?: {
      success?: boolean
      errorCode?: string
      documentType?: string
    }
  ) => {
    trackApiTelemetry({
      name: "api_document_process",
      durationMs: Date.now() - startedAt,
      success: Boolean(options?.success),
      statusCode: status,
      errorCode: options?.errorCode,
      metadata: options?.documentType
        ? {
            documentType: options.documentType,
          }
        : undefined,
    })

    return NextResponse.json(payload, { status })
  }

  try {
    const formData = await request.formData()

    const documentTypeValue = String(formData.get("documentType") || "").trim()
    if (!isDocumentType(documentTypeValue)) {
      return respond(
        toError("Invalid document type.", {
          reason: "invalid_document_type",
          retryable: false,
        }),
        400,
        { errorCode: "invalid_document_type" }
      )
    }

    const fileEntry = formData.get("file")
    if (!(fileEntry instanceof File)) {
      return respond(
        toError("Image file is required.", {
          reason: "file_required",
          retryable: false,
        }),
        400,
        { errorCode: "file_required", documentType: documentTypeValue }
      )
    }

    if (!isSupportedImageMimeType(fileEntry.type)) {
      return respond(
        toError("Only JPG, PNG, WEBP, HEIC, and HEIF images are supported.", {
          reason: "unsupported_file_type",
          retryable: false,
        }),
        415,
        { errorCode: "unsupported_file_type", documentType: documentTypeValue }
      )
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return respond(
        toError("Image is too large. Maximum allowed size is 8MB.", {
          reason: "file_too_large",
          retryable: false,
        }),
        413,
        { errorCode: "file_too_large", documentType: documentTypeValue }
      )
    }

    const openAiApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_DEV

    if (!openAiApiKey) {
      return respond(
        toError("Document processing is not configured.", {
          reason: "document_not_configured",
          retryable: false,
        }),
        500,
        { errorCode: "document_not_configured", documentType: documentTypeValue }
      )
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer())
    if (!hasSupportedImageSignature(buffer)) {
      return respond(
        toError("Uploaded file is not a valid supported image.", {
          reason: "unsupported_file_type",
          retryable: false,
        }),
        415,
        { errorCode: "unsupported_file_type", documentType: documentTypeValue }
      )
    }

    const base64Image = buffer.toString("base64")
    const imageDataUrl = `data:${fileEntry.type};base64,${base64Image}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(OPENAI_RESPONSES_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_DOCUMENT_MODEL,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildInstructionPrompt(documentTypeValue),
                },
                {
                  type: "input_image",
                  image_url: imageDataUrl,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "document_processing_output",
              schema: JSON_SCHEMA,
              strict: true,
            },
          },
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const fallback = await response.text().catch(() => "")
      const message = fallback
        ? `Document processing failed (${response.status}).`
        : "Document not clear. Please recapture."

      const retryable = response.status >= 500 || response.status === 429
      return respond(
        toError(message, {
          reason: "openai_request_failed",
          retryable,
        }),
        response.status,
        { errorCode: "openai_request_failed", documentType: documentTypeValue }
      )
    }

    const responsePayload = (await response.json()) as OpenAiResponse
    const outputText = extractOutputText(responsePayload)

    if (!outputText) {
      return respond(
        toError("Document not clear. Please recapture.", {
          confidenceScore: 0.5,
          reason: "invalid_openai_response",
          retryable: true,
        }),
        422,
        { errorCode: "invalid_openai_response", documentType: documentTypeValue }
      )
    }

    let parsed: unknown
    try {
      parsed = parseJsonResponse(outputText)
    } catch {
      return respond(
        toError("Invalid AI response. Please retry scanning.", {
          reason: "invalid_openai_response",
          retryable: true,
        }),
        422,
        { errorCode: "invalid_openai_response", documentType: documentTypeValue }
      )
    }

    const normalized = toNormalizedPayload(parsed, documentTypeValue)

    if (!normalized) {
      return respond(
        toError("Document not clear. Please recapture.", {
          confidenceScore: 0.45,
          reason: "document_not_clear",
          retryable: true,
        }),
        422,
        { errorCode: "document_not_clear", documentType: documentTypeValue }
      )
    }

    const validationError = getDocumentValidationError(normalized, documentTypeValue)
    if (validationError) {
      return respond(
        toError(validationError, {
          confidenceScore: normalized.confidenceScore,
          reason: "validation_failed",
          retryable: true,
        }),
        422,
        { errorCode: "validation_failed", documentType: documentTypeValue }
      )
    }

    return respond(normalized, 200, {
      success: true,
      documentType: documentTypeValue,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Document processing timed out. Please try again."
        : "Document not clear. Please recapture."

    captureObservedError(error, {
      area: "api_document_process",
    })

    return respond(
      toError(message, {
        reason: error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "document_not_clear",
        retryable: true,
      }),
      500,
      {
        errorCode:
          error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : "document_not_clear",
      }
    )
  }
}
