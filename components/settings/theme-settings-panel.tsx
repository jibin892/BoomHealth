"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const themeOptions = [
  {
    key: "light",
    label: "Light",
    icon: Sun,
    description: "Use light colors",
  },
  {
    key: "dark",
    label: "Dark",
    icon: Moon,
    description: "Use dark colors",
  },
  {
    key: "system",
    label: "System",
    icon: Monitor,
    description: "Match your device",
  },
] as const

export function ThemeSettingsPanel() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted ? theme : "system"

  return (
    <Card className="max-w-2xl shadow-xs">
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>
          Choose how the dashboard should look for your team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {themeOptions.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant={activeTheme === option.key ? "default" : "outline"}
              onClick={() => setTheme(option.key)}
              className={cn(
                "h-auto flex-col items-start justify-start p-4 text-left",
                activeTheme === option.key && "ring-2 ring-primary/40"
              )}
            >
              <span className="flex items-center gap-2">
                <option.icon className="size-4" />
                <span className="font-medium">{option.label}</span>
              </span>
              <span className="text-muted-foreground mt-1 block text-xs">
                {option.description}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
