"use client"

import { useEffect } from "react"

export function PwaServiceWorker() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Failed to register service worker:", error)
    })
  }, [])

  return null
}
