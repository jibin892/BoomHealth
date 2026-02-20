"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISS_STORAGE_KEY = "dardoc-pwa-install-dismissed"

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    if (window.matchMedia("(display-mode: standalone)").matches) {
      return
    }

    if (window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1") {
      return
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    const onInstalled = () => {
      setDeferredPrompt(null)
      setIsVisible(false)
      window.localStorage.removeItem(DISMISS_STORAGE_KEY)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismissPrompt = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1")
    }
    setIsVisible(false)
  }, [])

  const installApp = React.useCallback(async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice

    if (result.outcome === "accepted") {
      setIsVisible(false)
    }

    setDeferredPrompt(null)
  }, [deferredPrompt])

  if (!isVisible || !deferredPrompt) return null

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 sm:left-auto sm:right-4 sm:w-[360px]">
      <div className="pointer-events-auto rounded-xl border bg-card p-4 shadow-lg">
        <p className="text-sm font-semibold">Install DarDoc app</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Add DarDoc to your home screen for faster access to bookings.
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={dismissPrompt}>
            Later
          </Button>
          <Button size="sm" onClick={() => void installApp()}>
            Install
          </Button>
        </div>
      </div>
    </div>
  )
}
