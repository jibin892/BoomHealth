import axios from "axios"
import { isLikelyNetworkErrorMessage } from "@/lib/error-utils"

type ApiErrorPayload = {
  error?: string
  message?: string
  missing_patient_ids?: string[]
  error_id?: string
  request_id?: string
}

const API_ERROR_MESSAGES: Record<string, string> = {
  invalid_collector_party_id: "Collector party ID is invalid.",
  collector_not_found: "Collector not found.",
  party_type_mismatch: "Configured party is not a COLLECTOR.",
  collector_inactive: "Collector is inactive.",
  invalid_booking_id: "Booking ID is invalid.",
  booking_not_found: "Booking was not found.",
  invalid_booking_state:
    "Booking is in a locked state and cannot be updated.",
  booking_patients_not_found:
    "Patients could not be found for this booking snapshot.",
  missing_patient_national_id:
    "National ID is required for all patients before sample collection.",
  validation_error: "Provided booking details failed validation.",
  patient_not_in_booking: "One or more patients do not belong to this booking.",
  duplicate_patient_id_after_update:
    "Updated patient IDs would create duplicates in the booking.",
  invalid_document_type: "Invalid document type.",
  file_required: "Please upload or capture an image.",
  unsupported_file_type:
    "Unsupported image type. Please use JPG, PNG, WEBP, HEIC, or HEIF.",
  file_too_large: "Image is too large. Maximum allowed size is 8MB.",
  document_not_configured: "Document scanner is not configured.",
  openai_request_failed: "Document scanner request failed. Please retry.",
  invalid_openai_response:
    "Scanner response was invalid. Please recapture and try again.",
  validation_failed: "Document validation failed. Please verify the image.",
  timeout: "Scanner timed out. Please retry with a clear image.",
  document_not_clear: "Document is unclear. Please recapture.",
}

export class ApiRequestError extends Error {
  status?: number
  code?: string
  details?: unknown
  isNetworkError?: boolean
  errorId?: string

  constructor(
    message: string,
    options?: {
      status?: number
      code?: string
      details?: unknown
      isNetworkError?: boolean
      errorId?: string
    }
  ) {
    super(message)
    this.name = "ApiRequestError"
    this.status = options?.status
    this.code = options?.code
    this.details = options?.details
    this.isNetworkError = options?.isNetworkError
    this.errorId = options?.errorId
  }
}

function toUserFacingMessage(error: ApiRequestError) {
  if (error.isNetworkError) {
    return "Network error. Please check your internet connection and retry."
  }

  if (error.code && API_ERROR_MESSAGES[error.code]) {
    return API_ERROR_MESSAGES[error.code]
  }

  if (error.status && error.status >= 500) {
    return "Server is currently unavailable. Please try again in a moment."
  }

  if (error.status === 404) {
    return "Requested resource was not found."
  }

  if (error.status === 401 || error.status === 403) {
    return "Your session is not authorized for this action."
  }

  if (error.status === 429) {
    return "Too many requests. Please wait a moment and retry."
  }

  return error.message
}

export function toApiRequestError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error
  }

  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const status = error.response?.status
    const payload = error.response?.data
    const code = payload?.error
    const isNetworkError =
      !status ||
      error.code === "ERR_NETWORK" ||
      error.code === "ECONNABORTED" ||
      isLikelyNetworkErrorMessage(error.message)
    const message =
      payload?.message ||
      code ||
      error.message ||
      "Failed to connect to booking API"
    const errorId =
      payload?.error_id || payload?.request_id || `req_${Date.now().toString(36)}`

    return new ApiRequestError(message, {
      status,
      code,
      details: payload,
      isNetworkError,
      errorId,
    })
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message, {
      isNetworkError: isLikelyNetworkErrorMessage(error.message),
    })
  }

  return new ApiRequestError("Unexpected error while calling booking API")
}

export function getApiErrorMessage(error: unknown) {
  return toUserFacingMessage(toApiRequestError(error))
}

export function isNetworkApiError(error: unknown) {
  return Boolean(toApiRequestError(error).isNetworkError)
}

export function getApiErrorCode(error: unknown) {
  return toApiRequestError(error).code || null
}

export function getApiErrorId(error: unknown) {
  return toApiRequestError(error).errorId || null
}

export function getMissingPatientIds(error: unknown) {
  const apiError = toApiRequestError(error)
  const payload = apiError.details as ApiErrorPayload | undefined
  return payload?.missing_patient_ids ?? []
}
