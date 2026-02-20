import { TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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

export function OverviewCards({ items }: OverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:px-6 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.title}
          className="from-primary/5 to-card bg-gradient-to-t shadow-xs"
        >
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
      ))}
    </div>
  )
}
