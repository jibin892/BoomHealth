import type { Metadata } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { NetworkStatusBanner } from "@/components/network-status-banner"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "DarDoc",
  description: "Boom Health dashboard design implementation",
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
            <NetworkStatusBanner />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
