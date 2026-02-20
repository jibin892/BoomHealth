import { getApiErrorMessage, isNetworkApiError, toApiRequestError } from "@/lib/api/errors"
import { isLikelyNetworkError } from "@/lib/error-utils"

type ErrorPresentation = {
  title: string
  description: string
  isNetworkError: boolean
}

const GENERIC_ERROR_MESSAGES = new Set([
  "something went wrong",
  "application error",
  "unexpected error while calling booking api",
  "an unexpected error occurred while loading this page. please try again.",
  "the application hit an unexpected error. please retry.",
])

function isGenericMessage(message: string) {
  return GENERIC_ERROR_MESSAGES.has(message.trim().toLowerCase())
}

export function getErrorPresentation(error: unknown): ErrorPresentation {
  const apiError = toApiRequestError(error)
  const apiMessage = getApiErrorMessage(error)
  const hasNavigator = typeof navigator !== "undefined"
  const isOffline = hasNavigator ? !navigator.onLine : false
  const isNetworkError =
    isOffline || isNetworkApiError(error) || isLikelyNetworkError(error)

  if (isNetworkError) {
    return {
      title: "Network Error",
      description: isOffline
        ? "No internet connection. Please check Wi-Fi or mobile data and retry."
        : "Unable to reach the server. Check your connection and try again.",
      isNetworkError: true,
    }
  }

  const message = apiMessage?.trim()

  if (message && !isGenericMessage(message)) {
    return {
      title: "Unable to Load Page",
      description: message,
      isNetworkError: false,
    }
  }

  if (apiError.status) {
    return {
      title: "Unable to Load Page",
      description: `Request failed with status ${apiError.status}. Please retry.`,
      isNetworkError: false,
    }
  }

  return {
    title: "Unable to Load Page",
    description: "Request could not be completed. Please retry.",
    isNetworkError: false,
  }
}

