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
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 md:hidden"
      aria-label="Primary navigation"
    >
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/82 mx-auto grid max-w-screen-sm grid-cols-2 gap-1 rounded-3xl border border-border/70 p-1.5 shadow-[0_-12px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "mobile-touch-target group flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold tracking-wide transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 active:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full transition-colors",
                  isActive ? "bg-primary-foreground/15" : "bg-muted/40 group-active:bg-muted"
                )}
              >
                <item.icon className="size-[17px]" />
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
