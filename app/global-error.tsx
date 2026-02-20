"use client"

import { useEffect } from "react"

import { PageErrorState } from "@/components/ui/page-error-state"
import { getErrorPresentation } from "@/lib/error-presentation"

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const errorPresentation = getErrorPresentation(error)

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
            />
          </div>
        </main>
      </body>
    </html>
  )
}
