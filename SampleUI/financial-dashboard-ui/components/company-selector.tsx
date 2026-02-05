"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Building2, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useCompany } from "@/contexts/company-context"

interface CompanySelectorProps {
  className?: string
}

export function CompanySelector({ className }: CompanySelectorProps) {
  const [open, setOpen] = React.useState(false)
  const { companies, selectedDocId, selectedCompany, loading, error, selectCompany } = useCompany()

  if (loading) {
    return (
      <Button
        variant="outline"
        className={cn("w-full justify-between h-10", className)}
        disabled
      >
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">企業一覧を読み込み中...</span>
        </div>
      </Button>
    )
  }

  if (error) {
    return (
      <Button
        variant="outline"
        className={cn("w-full justify-between h-10 border-destructive", className)}
        onClick={() => window.location.reload()}
      >
        <div className="flex items-center gap-2 text-destructive">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">エラー: {error}</span>
        </div>
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-10", className)}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedCompany ? (
              <span className="truncate">
                <span className="text-muted-foreground mr-1.5 tabular-nums">
                  {selectedCompany.sec_code || "-"}
                </span>
                {selectedCompany.company_name}
              </span>
            ) : (
              <span className="text-muted-foreground">企業を選択...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="企業名または証券コードで検索..." />
          <CommandList>
            <CommandEmpty>企業が見つかりません</CommandEmpty>
            <CommandGroup heading={`企業一覧 (${companies.length}社)`}>
              {companies.map((company) => (
                <CommandItem
                  key={company.doc_id}
                  value={`${company.sec_code || ""} ${company.company_name}`}
                  onSelect={() => {
                    selectCompany(company.doc_id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedDocId === company.doc_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground mr-2 tabular-nums w-12">
                    {company.sec_code || "-"}
                  </span>
                  <span className="truncate">{company.company_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
