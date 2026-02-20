"use client"

import { useEffect } from "react"

import { PageErrorState } from "@/components/ui/page-error-state"
import { isLikelyNetworkError } from "@/lib/error-utils"

type AppErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const isNetworkError = isLikelyNetworkError(error)

  return (
    <main className="min-h-svh p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <PageErrorState
          title={isNetworkError ? "Network Error" : "Something went wrong"}
          description={
            isNetworkError
              ? "We could not reach the server. Check your connection and try again."
              : "An unexpected error occurred while loading this page. Please try again."
          }
          onRetry={reset}
          isNetworkError={isNetworkError}
        />
      </div>
    </main>
  )
}
