"use client"

import * as React from "react"
import { Calendar, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCompany } from "@/contexts/company-context"

interface FiscalYearSelectorProps {
  className?: string
  compact?: boolean
}

export function FiscalYearSelector({ className, compact = false }: FiscalYearSelectorProps) {
  const { fiscalYears, selectedFiscalYear, selectFiscalYear, loading } = useCompany()

  if (loading || fiscalYears.length === 0) {
    return null
  }

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
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="tabular-nums">
              {selectedFiscalYear ? `${selectedFiscalYear}年度` : "年度を選択"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[140px]">
        {fiscalYears.map((year) => (
          <DropdownMenuItem
            key={year}
            onClick={() => selectFiscalYear(year)}
            className={cn(
              "tabular-nums",
              selectedFiscalYear === year && "bg-accent"
            )}
          >
            {year}年度
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
