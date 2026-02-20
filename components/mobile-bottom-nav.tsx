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
      className="bg-background/95 supports-[backdrop-filter]:bg-background/85 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-screen-sm grid-cols-2 px-1 py-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-muted-foreground flex h-14 flex-col items-center justify-center rounded-md gap-1 text-[11px] font-medium transition-colors",
                isActive && "bg-muted text-foreground"
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
