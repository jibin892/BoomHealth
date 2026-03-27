"use client"

import * as React from "react"
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export type OverviewCardItem = {
  title: string
  value: string
  change: string
  summary: string
  trend: "up" | "down"
}

type OverviewCardsProps = {
  items: OverviewCardItem[]
  mobileLabel?: string
}

function OverviewCard({ item }: { item: OverviewCardItem }) {
  return (
    <Card className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-card shadow-none">
      <CardHeader className="space-y-2">
        <CardDescription className="text-[11px] uppercase tracking-wide">
          {item.title}
        </CardDescription>
        <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">
          {item.value}
        </CardTitle>
        <div className="pt-0.5">
          <Badge variant="outline" className="gap-1.5 rounded-full px-2.5 text-[11px]">
            {item.trend === "up" ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {item.change}
          </Badge>
        </div>
      </CardHeader>
      <CardFooter className="text-muted-foreground pt-0 text-xs sm:text-sm">
        {item.summary}
      </CardFooter>
    </Card>
  )
}

export function OverviewCards({
  items,
  mobileLabel = "Booking Overview",
}: OverviewCardsProps) {
  const [isMobileExpanded, setIsMobileExpanded] = React.useState(true)

  return (
    <>
      <Collapsible
        open={isMobileExpanded}
        onOpenChange={setIsMobileExpanded}
        className="mobile-page-shell space-y-3 md:hidden"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="mobile-touch-target h-11 w-full justify-between rounded-xl bg-card/70"
            aria-expanded={isMobileExpanded}
            aria-label={`Toggle ${mobileLabel.toLowerCase()} cards`}
          >
            {mobileLabel}
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                isMobileExpanded && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3">
          {items.map((item) => (
            <OverviewCard key={item.title} item={item} />
          ))}
        </CollapsibleContent>
      </Collapsible>

      <div className="mobile-page-shell hidden grid-cols-1 gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <OverviewCard key={item.title} item={item} />
        ))}
      </div>
    </>
  )
}
