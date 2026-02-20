import { SignIn } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { AuthCardShell } from "@/components/auth/auth-card-shell"

export default async function SignInPage() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard/bookings")
  }

  return (
    <AuthCardShell contentClassName="max-w-md">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard/bookings"
        fallbackRedirectUrl="/dashboard/bookings"
      />
    </AuthCardShell>
  )
}
