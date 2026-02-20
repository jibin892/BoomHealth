const FALLBACK_API_BASE_URL = "https://api-staging.dardoc.com"
const FALLBACK_COLLECTOR_PARTY_ID = "BOOM_HEALTH"

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

export function getApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()

  if (!configuredBaseUrl) {
    return FALLBACK_API_BASE_URL
  }

  return trimTrailingSlash(configuredBaseUrl)
}

export function getCollectorPartyId() {
  const collectorPartyId = process.env.NEXT_PUBLIC_COLLECTOR_PARTY_ID?.trim()
  return collectorPartyId || FALLBACK_COLLECTOR_PARTY_ID
}
