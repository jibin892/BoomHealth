import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  return (
    <main className="safe-area-top safe-area-bottom flex min-h-dvh items-center justify-center px-4 py-6">
      <section className="mobile-surface w-full max-w-md p-5 text-center sm:p-6">
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
