import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type AuthCardShellProps = {
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function AuthCardShell({
  children,
  className,
  contentClassName,
}: AuthCardShellProps) {
  return (
    <div
      className={cn(
        "bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10",
        className
      )}
    >
      <div className={cn("w-full max-w-sm", contentClassName)}>{children}</div>
    </div>
  )
}
