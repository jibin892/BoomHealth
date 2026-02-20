const NETWORK_PATTERNS = [
  "network error",
  "failed to fetch",
  "fetch failed",
  "network request failed",
  "internet",
  "offline",
  "timed out",
  "timeout",
  "enotfound",
  "econnreset",
  "econnaborted",
  "err_network",
  "invalid url",
]

export function isLikelyNetworkErrorMessage(message?: string | null) {
  if (!message) return false

  const normalized = message.toLowerCase()
  return NETWORK_PATTERNS.some((pattern) => normalized.includes(pattern))
}

export function isLikelyNetworkError(error: unknown) {
  if (error instanceof Error) {
    return isLikelyNetworkErrorMessage(error.message)
  }

  if (typeof error === "string") {
    return isLikelyNetworkErrorMessage(error)
  }

  return false
}
