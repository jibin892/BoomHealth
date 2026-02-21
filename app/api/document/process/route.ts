import { NextResponse } from "next/server"

import {
  OPENAI_DOCUMENT_TYPES,
  type OpenAiDocumentType,
  type ProcessedDocumentErrorPayload,
  type ProcessedDocumentPayload,
} from "@/lib/document-processing/types"

const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses"
const REQUEST_TIMEOUT_MS = 30_000
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const OPENAI_DOCUMENT_MODEL = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1"
const MIN_CONFIDENCE_UNSUPPORTED = 0.35
const MIN_CONFIDENCE_PASSPORT = 0.5
const MIN_CONFIDENCE_EID_FRONT = 0.5
const MIN_CONFIDENCE_EID_BACK = 0.45

// TEMP: hardcoded for local/dev testing only. Remove before production.
const HARDCODED_DEV_OPENAI_API_KEY = ""

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
  confidenceScore = 0.45
): ProcessedDocumentErrorPayload {
  return {
    error: true,
    message,
    confidenceScore,
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
  try {
    const formData = await request.formData()

    const documentTypeValue = String(formData.get("documentType") || "").trim()
    if (!isDocumentType(documentTypeValue)) {
      return NextResponse.json(toError("Invalid document type."), { status: 400 })
    }

    const fileEntry = formData.get("file")
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(toError("Image file is required."), { status: 400 })
    }

    if (!fileEntry.type.startsWith("image/")) {
      return NextResponse.json(toError("Only image files are supported."), {
        status: 415,
      })
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        toError("Image is too large. Maximum allowed size is 8MB."),
        { status: 413 }
      )
    }

    const openAiApiKey =
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY_DEV ||
      HARDCODED_DEV_OPENAI_API_KEY

    if (!openAiApiKey) {
      return NextResponse.json(toError("Document processing is not configured."), {
        status: 500,
      })
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer())
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

      return NextResponse.json(toError(message), { status: response.status })
    }

    const responsePayload = (await response.json()) as OpenAiResponse
    const outputText = extractOutputText(responsePayload)

    if (!outputText) {
      return NextResponse.json(
        toError("Document not clear. Please recapture.", 0.5),
        { status: 422 }
      )
    }

    const parsed = parseJsonResponse(outputText)
    const normalized = toNormalizedPayload(parsed, documentTypeValue)

    if (!normalized) {
      return NextResponse.json(
        toError("Document not clear. Please recapture.", 0.45),
        { status: 422 }
      )
    }

    const validationError = getDocumentValidationError(normalized, documentTypeValue)
    if (validationError) {
      return NextResponse.json(toError(validationError, normalized.confidenceScore), {
        status: 422,
      })
    }

    return NextResponse.json(normalized)
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Document processing timed out. Please try again."
        : "Document not clear. Please recapture."

    return NextResponse.json(toError(message), {
      status: 500,
    })
  }
}
