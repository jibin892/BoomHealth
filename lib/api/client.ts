import axios from "axios"

import { getApiBaseUrl } from "@/lib/api/config"
import { trackApiTelemetry } from "@/lib/observability/telemetry"

type RequestWithMetadata = {
  metadata?: {
    startedAt: number
  }
}

function now() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }

  return Date.now()
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
})

apiClient.interceptors.request.use((config) => {
  ;(config as RequestWithMetadata).metadata = {
    startedAt: now(),
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const requestConfig = response.config as RequestWithMetadata
    const startedAt = requestConfig.metadata?.startedAt || now()
    const endpoint = response.config.url || "unknown_endpoint"

    trackApiTelemetry({
      name: endpoint,
      durationMs: now() - startedAt,
      success: true,
      statusCode: response.status,
      metadata: {
        method: response.config.method || "GET",
      },
    })

    return response
  },
  (error) => {
    const config = error?.config as (RequestWithMetadata & {
      url?: string
      method?: string
    }) | undefined
    const startedAt = config?.metadata?.startedAt || now()
    const endpoint = config?.url || "unknown_endpoint"
    const status = error?.response?.status
    const code =
      error?.response?.data?.error ||
      error?.code ||
      (typeof error?.message === "string" ? error.message : "unknown_error")

    trackApiTelemetry({
      name: endpoint,
      durationMs: now() - startedAt,
      success: false,
      statusCode: typeof status === "number" ? status : undefined,
      errorCode: String(code || "unknown_error"),
      metadata: {
        method: config?.method || "GET",
      },
    })

    return Promise.reject(error)
  }
)
