"use client"

import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics"

type HapticFeedbackType = "light" | "medium" | "success" | "warning" | "error"

export async function triggerHapticFeedback(type: HapticFeedbackType = "light") {
  if (typeof window === "undefined") return

  if (!Capacitor.isNativePlatform()) {
    if ("vibrate" in navigator) {
      navigator.vibrate(type === "medium" ? 18 : 10)
    }
    return
  }

  try {
    if (type === "success") {
      await Haptics.notification({ type: NotificationType.Success })
      return
    }

    if (type === "warning") {
      await Haptics.notification({ type: NotificationType.Warning })
      return
    }

    if (type === "error") {
      await Haptics.notification({ type: NotificationType.Error })
      return
    }

    await Haptics.impact({
      style: type === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
    })
  } catch {
    if ("vibrate" in navigator) {
      navigator.vibrate(type === "medium" ? 18 : 10)
    }
  }
}
