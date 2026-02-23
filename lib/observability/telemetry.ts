import * as Sentry from "@sentry/nextjs"

type ApiTelemetryInput = {
  name: string
  durationMs: number
  success: boolean
  statusCode?: number
  errorCode?: string | null
  metadata?: Record<string, unknown>
}

function telemetryEnabled() {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
}

export function trackApiTelemetry(input: ApiTelemetryInput) {
  const payload = {
    ...input,
    durationMs: Math.max(0, Math.round(input.durationMs)),
  }

  if (process.env.NODE_ENV !== "production") {
    if (payload.success) {
      console.info("[telemetry:api]", payload)
    } else {
      console.warn("[telemetry:api]", payload)
    }
  }

  if (!telemetryEnabled()) return

  Sentry.addBreadcrumb({
    category: "api",
    level: payload.success ? "info" : "error",
    data: payload,
    message: `${payload.name} ${payload.success ? "success" : "failure"}`,
  })
}

export function captureObservedError(
  error: unknown,
  context: {
    area: string
    metadata?: Record<string, unknown>
    tags?: Record<string, string>
  }
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[telemetry:error] ${context.area}`, error, context.metadata || {})
  }

  if (!telemetryEnabled()) return

  Sentry.captureException(error, {
    tags: {
      area: context.area,
      ...context.tags,
    },
    extra: context.metadata,
  })
}
