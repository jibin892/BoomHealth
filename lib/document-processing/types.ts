export const OPENAI_DOCUMENT_TYPES = [
  "PASSPORT",
  "EID_FRONT",
  "EID_BACK",
] as const

export type OpenAiDocumentType = (typeof OPENAI_DOCUMENT_TYPES)[number]

export type DocumentExtractionData = {
  fullName: string
  gender: string
  documentNumber: string
  nationality: string
}

export type DocumentValidation = {
  isValidEID: boolean
  startsWith784: boolean
}

export type ProcessedDocumentPayload = {
  documentType: OpenAiDocumentType
  extractedData: DocumentExtractionData
  validation: DocumentValidation
  croppedDocumentImageBase64: string
  confidenceScore: number
}

export type ProcessedDocumentErrorReason =
  | "invalid_document_type"
  | "file_required"
  | "unsupported_file_type"
  | "file_too_large"
  | "document_not_configured"
  | "openai_request_failed"
  | "invalid_openai_response"
  | "validation_failed"
  | "timeout"
  | "document_not_clear"

export type ProcessedDocumentErrorPayload = {
  error: true
  message: string
  confidenceScore: number
  reason?: ProcessedDocumentErrorReason
  retryable?: boolean
  errorId?: string
}
