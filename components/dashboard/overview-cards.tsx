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
}

function OverviewCard({ item }: { item: OverviewCardItem }) {
  return (
    <Card className="from-primary/5 to-card bg-gradient-to-t shadow-xs">
      <CardHeader>
        <CardDescription>{item.title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {item.value}
        </CardTitle>
        <div className="pt-1">
          <Badge variant="outline" className="gap-1.5">
            {item.trend === "up" ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {item.change}
          </Badge>
        </div>
      </CardHeader>
      <CardFooter className="text-muted-foreground pt-0 text-sm">
        {item.summary}
      </CardFooter>
    </Card>
  )
}

export function OverviewCards({ items }: OverviewCardsProps) {
  const [isMobileExpanded, setIsMobileExpanded] = React.useState(false)

  return (
    <>
      <Collapsible
        open={isMobileExpanded}
        onOpenChange={setIsMobileExpanded}
        className="space-y-3 px-4 md:hidden"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            aria-expanded={isMobileExpanded}
            aria-label="Toggle booking overview cards"
          >
            Booking Overview
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

      <div className="hidden grid-cols-1 gap-4 px-4 md:grid md:grid-cols-2 lg:px-6 xl:grid-cols-4">
        {items.map((item) => (
          <OverviewCard key={item.title} item={item} />
        ))}
      </div>
    </>
  )
}
