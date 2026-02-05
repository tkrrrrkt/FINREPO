"use client"

import * as React from "react"
import { Factory, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiClient } from "@/lib/api-client"
import type { Industry } from "@/lib/types"

interface IndustrySelectorProps {
  className?: string
  compact?: boolean
  value?: string | null
  onChange?: (code: string | null) => void
}

export function IndustrySelector({
  className,
  compact = false,
  value,
  onChange,
}: IndustrySelectorProps) {
  const [industries, setIndustries] = React.useState<Industry[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchIndustries = async () => {
      try {
        setLoading(true)
        const response = await apiClient.getIndustries()
        setIndustries(response.industries)
      } catch (err) {
        console.error("Failed to fetch industries:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchIndustries()
  }, [])

  if (loading || industries.length === 0) {
    return null
  }

  const selectedIndustry = industries.find((i) => i.code === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between",
            compact ? "h-9 px-3" : "h-10",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-muted-foreground" />
            <span className="truncate max-w-[150px]">
              {selectedIndustry ? selectedIndustry.name : "全業種"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
        <DropdownMenuItem
          onClick={() => onChange?.(null)}
          className={cn(!value && "bg-accent")}
        >
          全業種
        </DropdownMenuItem>
        {industries.map((industry) => (
          <DropdownMenuItem
            key={industry.code}
            onClick={() => onChange?.(industry.code)}
            className={cn(value === industry.code && "bg-accent")}
          >
            {industry.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
