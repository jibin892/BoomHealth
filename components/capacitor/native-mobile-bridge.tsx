"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { App, type URLOpenListenerEvent } from "@capacitor/app"
import { StatusBar, Style } from "@capacitor/status-bar"
import { SplashScreen } from "@capacitor/splash-screen"
import { PushNotifications } from "@capacitor/push-notifications"

export function NativeMobileBridge() {
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return
    }

    const listeners: Array<{ remove: () => Promise<void> }> = []
    let isMounted = true

    const setupNativeBridge = async () => {
      try {
        await SplashScreen.hide().catch(() => undefined)
        await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined)
        await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined)
        await StatusBar.setBackgroundColor({ color: "#0f1419" }).catch(() => undefined)

        const permissions = await PushNotifications.checkPermissions().catch(() => null)
        if (permissions?.receive === "prompt") {
          await PushNotifications.requestPermissions().catch(() => undefined)
        }
        if (permissions?.receive === "granted") {
          await PushNotifications.register().catch(() => undefined)
        }

        const appUrlListener = await App.addListener(
          "appUrlOpen",
          ({ url }: URLOpenListenerEvent) => {
            if (!isMounted) return

            try {
              const parsed = new URL(url)
              const nextPath = `${parsed.pathname}${parsed.search}${parsed.hash}`
              if (nextPath.startsWith("/")) {
                router.push(nextPath || "/dashboard/bookings")
              } else {
                router.push("/dashboard/bookings")
              }
            } catch {
              router.push("/dashboard/bookings")
            }
          }
        )
        listeners.push(appUrlListener)

        const appStateListener = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isMounted || !isActive) return
          if (pathname === "/" || pathname === "") {
            router.replace("/dashboard/bookings")
          }
        })
        listeners.push(appStateListener)
      } catch {
        // Native bridge setup is optional; failures should not break UI.
      }
    }

    void setupNativeBridge()

    return () => {
      isMounted = false
      listeners.forEach((listener) => {
        void listener.remove()
      })
    }
  }, [pathname, router])

  return null
}
