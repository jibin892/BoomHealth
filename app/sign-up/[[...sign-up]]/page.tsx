import { SignUp } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { AuthCardShell } from "@/components/auth/auth-card-shell"

export default async function SignUpPage() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard/bookings")
  }

  return (
    <AuthCardShell contentClassName="max-w-md">
      <div className="mx-auto flex w-full max-w-[26rem] flex-col items-center space-y-3">
        <div className="space-y-1.5 text-center">
          <p className="text-base font-semibold">DarDoc Collector Dashboard</p>
          <p className="text-muted-foreground text-sm leading-5">
            Create an account to manage bookings and sample collection.
          </p>
        </div>
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full",
            },
          }}
          forceRedirectUrl="/dashboard/bookings"
          fallbackRedirectUrl="/dashboard/bookings"
        />
      </div>
    </AuthCardShell>
  )
}
