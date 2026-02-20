"use client"

import { useEffect } from "react"

import { PageErrorState } from "@/components/ui/page-error-state"
import { isLikelyNetworkError } from "@/lib/error-utils"

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const isNetworkError = isLikelyNetworkError(error)

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="min-h-svh p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <PageErrorState
              title={isNetworkError ? "Network Error" : "Application Error"}
              description={
                isNetworkError
                  ? "We could not reach the server. Check your connection and retry."
                  : "The application hit an unexpected error. Please retry."
              }
              onRetry={reset}
              isNetworkError={isNetworkError}
            />
          </div>
        </main>
      </body>
    </html>
  )
}
