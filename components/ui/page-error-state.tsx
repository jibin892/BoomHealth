"use client"

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PageErrorStateProps = {
  title: string
  description: string
  onRetry?: () => void
  isRetrying?: boolean
  isNetworkError?: boolean
  className?: string
}

export function PageErrorState({
  title,
  description,
  onRetry,
  isRetrying = false,
  isNetworkError = false,
  className,
}: PageErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center",
        className
      )}
    >
      {isNetworkError ? (
        <WifiOff className="text-muted-foreground mb-3 size-10" />
      ) : (
        <AlertTriangle className="text-muted-foreground mb-3 size-10" />
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">{description}</p>
      {onRetry ? (
        <Button
          variant="outline"
          className="mobile-touch-target mt-4 h-10 rounded-xl px-5"
          disabled={isRetrying}
          onClick={onRetry}
        >
          <RefreshCw className={cn("mr-2 size-4", isRetrying && "animate-spin")} />
          {isRetrying ? "Retrying..." : "Retry"}
        </Button>
      ) : null}
    </div>
  )
}
