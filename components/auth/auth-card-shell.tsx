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
        "safe-area-top safe-area-bottom bg-background flex min-h-svh flex-col items-center justify-start px-4 py-10 sm:justify-center sm:p-6 md:p-10",
        className
      )}
    >
      <div className={cn("w-full max-w-sm sm:max-w-md", contentClassName)}>
        {children}
      </div>
    </div>
  )
}
