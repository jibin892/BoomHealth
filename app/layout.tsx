import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { NetworkStatusBanner } from "@/components/network-status-banner"
import { InstallPwaPrompt } from "@/components/pwa/install-pwa-prompt"
import { PwaServiceWorker } from "@/components/pwa/pwa-service-worker"
import { NativeMobileBridge } from "@/components/capacitor/native-mobile-bridge"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "DarDoc",
  description: "Boom Health dashboard design implementation",
  applicationName: "DarDoc",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DarDoc",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#119da4" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1419" },
  ],
}

export const dynamic = "force-dynamic"

const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in"
const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/sign-up"
const afterSignInUrl = "/dashboard/bookings"
const afterSignUpUrl = "/dashboard/bookings"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      dynamic
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      afterSignInUrl={afterSignInUrl}
      afterSignUpUrl={afterSignUpUrl}
    >
      <html lang="en" suppressHydrationWarning>
        <body suppressHydrationWarning className="font-sans antialiased">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PwaServiceWorker />
            <NativeMobileBridge />
            <NetworkStatusBanner />
            {children}
            <InstallPwaPrompt />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
