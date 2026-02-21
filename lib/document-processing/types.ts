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
  startsWith789: boolean
}

export type ProcessedDocumentPayload = {
  documentType: OpenAiDocumentType
  extractedData: DocumentExtractionData
  validation: DocumentValidation
  croppedDocumentImageBase64: string
  confidenceScore: number
}

export type ProcessedDocumentErrorPayload = {
  error: true
  message: string
  confidenceScore: number
}
