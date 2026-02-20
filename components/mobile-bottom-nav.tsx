"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, CalendarCheck2 } from "lucide-react"

import { cn } from "@/lib/utils"

const navItems = [
  {
    label: "Bookings",
    href: "/dashboard/bookings",
    icon: CalendarCheck2,
  },
  {
    label: "Revenue",
    href: "/dashboard/revenue-tracker",
    icon: BarChart3,
  },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:hidden"
    >
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/85 mx-auto grid max-w-screen-sm grid-cols-2 gap-1 rounded-2xl border p-1 shadow-lg backdrop-blur">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
