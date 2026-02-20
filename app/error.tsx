"use client"

import { useEffect } from "react"

import { PageErrorState } from "@/components/ui/page-error-state"
import { getErrorPresentation } from "@/lib/error-presentation"

type AppErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const errorPresentation = getErrorPresentation(error)

  return (
    <main className="min-h-svh p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <PageErrorState
          title={errorPresentation.title}
          description={errorPresentation.description}
          onRetry={reset}
          isNetworkError={errorPresentation.isNetworkError}
        />
      </div>
    </main>
  )
}
