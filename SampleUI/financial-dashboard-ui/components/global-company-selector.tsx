"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2, Clock, Heart, Search, Star, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCompany } from "@/contexts/company-context"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface GlobalCompanySelectorProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GlobalCompanySelector({
  open: controlledOpen,
  onOpenChange,
}: GlobalCompanySelectorProps) {
  const router = useRouter()
  const {
    companies,
    allCompanies,
    recentlyViewed,
    favorites,
    selectCompany,
    toggleFavorite,
    isFavorite,
  } = useCompany()

  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  // Cmd+K / Ctrl+K でダイアログを開く
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, setOpen])

  // 企業を選択してダイアログを閉じる
  const handleSelect = React.useCallback(
    (docId: string) => {
      selectCompany(docId)
      setOpen(false)
      // 財務分析ページに遷移
      router.push(`/financial-analysis?docId=${docId}`)
    },
    [selectCompany, setOpen, router]
  )

  // お気に入りトグル（イベント伝播を止める）
  const handleToggleFavorite = React.useCallback(
    (e: React.MouseEvent, docId: string) => {
      e.stopPropagation()
      toggleFavorite(docId)
    },
    [toggleFavorite]
  )

  // お気に入り企業リスト
  const favoriteCompanies = React.useMemo(() => {
    return allCompanies.filter((c) => favorites.includes(c.doc_id))
  }, [allCompanies, favorites])

  // 最近閲覧した企業リスト（allCompaniesから取得）
  const recentCompanies = React.useMemo(() => {
    return recentlyViewed
      .map((r) => allCompanies.find((c) => c.doc_id === r.docId))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .slice(0, 5)
  }, [recentlyViewed, allCompanies])

  // 業種別にグループ化
  const companiesByIndustry = React.useMemo(() => {
    const grouped = new Map<string, typeof companies>()

    for (const company of companies) {
      const industry = company.industry_name || "その他"
      const existing = grouped.get(industry) || []
      grouped.set(industry, [...existing, company])
    }

    // 業種名でソート
    return Array.from(grouped.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "ja")
    )
  }, [companies])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="企業名・証券コードで検索..." />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <Search className="h-10 w-10 mb-2 opacity-50" />
            <p>該当する企業が見つかりません</p>
          </div>
        </CommandEmpty>

        {/* お気に入り */}
        {favoriteCompanies.length > 0 && (
          <>
            <CommandGroup heading="お気に入り">
              {favoriteCompanies.map((company) => (
                <CompanyItem
                  key={company.doc_id}
                  company={company}
                  isFavorite={true}
                  onSelect={() => handleSelect(company.doc_id)}
                  onToggleFavorite={(e) =>
                    handleToggleFavorite(e, company.doc_id)
                  }
                />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* 最近閲覧 */}
        {recentCompanies.length > 0 && (
          <>
            <CommandGroup heading="最近閲覧">
              {recentCompanies.map((company) => (
                <CompanyItem
                  key={`recent-${company.doc_id}`}
                  company={company}
                  isFavorite={isFavorite(company.doc_id)}
                  showClock
                  onSelect={() => handleSelect(company.doc_id)}
                  onToggleFavorite={(e) =>
                    handleToggleFavorite(e, company.doc_id)
                  }
                />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* 業種別 */}
        {companiesByIndustry.map(([industry, industryCompanies]) => (
          <CommandGroup key={industry} heading={industry}>
            {industryCompanies.slice(0, 10).map((company) => (
              <CompanyItem
                key={company.doc_id}
                company={company}
                isFavorite={isFavorite(company.doc_id)}
                onSelect={() => handleSelect(company.doc_id)}
                onToggleFavorite={(e) =>
                  handleToggleFavorite(e, company.doc_id)
                }
              />
            ))}
            {industryCompanies.length > 10 && (
              <CommandItem
                className="text-muted-foreground text-sm justify-center"
                disabled
              >
                他 {industryCompanies.length - 10} 社
              </CommandItem>
            )}
          </CommandGroup>
        ))}
      </CommandList>

      <div className="border-t p-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
          <span>で開く</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ↑↓
          </kbd>
          <span>で選択</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            Enter
          </kbd>
          <span>で決定</span>
        </div>
      </div>
    </CommandDialog>
  )
}

// 企業アイテムコンポーネント
interface CompanyItemProps {
  company: {
    doc_id: string
    company_name: string
    sec_code: string | null
    industry_name?: string | null
    fiscal_year?: number | null
  }
  isFavorite: boolean
  showClock?: boolean
  onSelect: () => void
  onToggleFavorite: (e: React.MouseEvent) => void
}

function CompanyItem({
  company,
  isFavorite,
  showClock,
  onSelect,
  onToggleFavorite,
}: CompanyItemProps) {
  return (
    <CommandItem
      value={`${company.company_name} ${company.sec_code || ""}`}
      onSelect={onSelect}
      className="flex items-center justify-between py-3"
    >
      <div className="flex items-center gap-3">
        {showClock ? (
          <Clock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex flex-col">
          <span className="font-medium">{company.company_name}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {company.sec_code && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {company.sec_code}
              </Badge>
            )}
            {company.fiscal_year && (
              <span>{company.fiscal_year}年度</span>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8",
          isFavorite ? "text-yellow-500" : "text-muted-foreground"
        )}
        onClick={onToggleFavorite}
      >
        <Star
          className={cn("h-4 w-4", isFavorite && "fill-current")}
        />
        <span className="sr-only">
          {isFavorite ? "お気に入りから削除" : "お気に入りに追加"}
        </span>
      </Button>
    </CommandItem>
  )
}

// トリガーボタン（ヘッダー用）
export function GlobalCompanySelectorTrigger() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "relative h-9 w-full justify-start rounded-md bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        )}
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">企業を検索...</span>
        <span className="inline-flex lg:hidden">検索...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <GlobalCompanySelector open={open} onOpenChange={setOpen} />
    </>
  )
}
