"use client"

import { useEffect } from "react"

import { PageErrorState } from "@/components/ui/page-error-state"
import { getErrorPresentation } from "@/lib/error-presentation"
import { captureObservedError } from "@/lib/observability/telemetry"

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error)
    captureObservedError(error, {
      area: "global_error_boundary",
      metadata: {
        digest: error.digest,
      },
    })
  }, [error])

  const errorPresentation = getErrorPresentation(error)
  const reportIssueHref = `mailto:support@dardoc.com?subject=${encodeURIComponent(
    "DarDoc Global Error"
  )}&body=${encodeURIComponent(
    [
      `Code: ${errorPresentation.code || "NA"}`,
      `Error ID: ${errorPresentation.errorId || "NA"}`,
      `Message: ${errorPresentation.description}`,
      "",
      "Please investigate this issue.",
    ].join("\n")
  )}`

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="min-h-svh p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <PageErrorState
              title={errorPresentation.title}
              description={errorPresentation.description}
              onRetry={reset}
              isNetworkError={errorPresentation.isNetworkError}
              errorCode={errorPresentation.code}
              errorId={errorPresentation.errorId}
              reportIssueHref={reportIssueHref}
            />
          </div>
        </main>
      </body>
    </html>
  )
}
