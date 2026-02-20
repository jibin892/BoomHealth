import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          DarDoc cannot reach the network right now. Please reconnect and try
          again.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link href="/dashboard/bookings">Retry</Link>
        </Button>
      </section>
    </main>
  )
}
