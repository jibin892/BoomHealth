"use client"

import * as React from "react"
import { WifiOff } from "lucide-react"

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine)

    updateStatus()
    window.addEventListener("online", updateStatus)
    window.addEventListener("offline", updateStatus)

    return () => {
      window.removeEventListener("online", updateStatus)
      window.removeEventListener("offline", updateStatus)
    }
  }, [])

  if (isOnline) {
    return null
  }

  return (
    <div className="safe-area-top bg-amber-500/15 text-amber-700 dark:text-amber-300 sticky top-0 z-[60] border-b border-amber-400/30">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium sm:text-sm">
        <WifiOff className="size-4" />
        <span>No internet connection. Check your network and try again.</span>
      </div>
    </div>
  )
}
