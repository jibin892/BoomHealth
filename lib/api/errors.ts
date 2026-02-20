import axios from "axios"

type ApiErrorPayload = {
  error?: string
  message?: string
  missing_patient_ids?: string[]
}

export class ApiRequestError extends Error {
  status?: number
  code?: string
  details?: unknown

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message)
    this.name = "ApiRequestError"
    this.status = options?.status
    this.code = options?.code
    this.details = options?.details
  }
}

export function toApiRequestError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error
  }

  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const status = error.response?.status
    const payload = error.response?.data
    const code = payload?.error
    const message =
      payload?.message ||
      code ||
      error.message ||
      "Failed to connect to booking API"

    return new ApiRequestError(message, {
      status,
      code,
      details: payload,
    })
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message)
  }

  return new ApiRequestError("Unexpected error while calling booking API")
}

export function getApiErrorMessage(error: unknown) {
  return toApiRequestError(error).message
}
