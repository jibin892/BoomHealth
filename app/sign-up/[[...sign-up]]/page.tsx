import { SignUp } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { AuthCardShell } from "@/components/auth/auth-card-shell"

export default async function SignUpPage() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <AuthCardShell contentClassName="max-w-md">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
      />
    </AuthCardShell>
  )
}
