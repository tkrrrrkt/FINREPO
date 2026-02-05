"use client"

import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  GitCompare,
  Target,
  Scale,
  Receipt,
  Percent,
  BarChart3,
  ShieldCheck,
  Plus,
  X,
  ArrowUpDown,
  AlertCircle,
  Calendar,
  Building2,
  Check,
  ChevronsUpDown,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import type { Company, FinancialSummary, Industry } from "@/lib/types"
import { IndustrySelector } from "@/components/industry-selector"

// APIは百万円単位で値を返す
function formatCurrency(valueInMillions: number | null): string {
  if (valueInMillions === null) return "-"
  const value = valueInMillions * 1000000
  const absValue = Math.abs(value)
  if (absValue >= 1e12) return `${(value / 1e12).toFixed(1)}兆円`
  if (absValue >= 1e8) return `${(value / 1e8).toFixed(0)}億円`
  return `${valueInMillions.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}百万円`
}

function formatPercent(value: number | null): string {
  if (value === null) return "-"
  return `${value.toFixed(1)}%`
}

// 選択された企業と年度の情報
interface SelectedCompany {
  edinetCode: string
  companyName: string
  docId: string
  fiscalYear: number
}

export default function CompanyComparisonPage() {
  const [allCompanies, setAllCompanies] = React.useState<Company[]>([])
  const [selectedItems, setSelectedItems] = React.useState<SelectedCompany[]>([])
  const [comparisonData, setComparisonData] = React.useState<FinancialSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [comparisonLoading, setComparisonLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState("metrics")
  const [selectedIndustry, setSelectedIndustry] = React.useState<string | null>(null)
  const [companySearchOpen, setCompanySearchOpen] = React.useState(false)

  // 企業一覧の取得
  React.useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiClient.getCompanies()
        setAllCompanies(data.companies || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "企業一覧の取得に失敗しました")
        console.error("Failed to fetch companies:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanies()
  }, [])

  // 利用可能な年度（降順）
  const fiscalYears = React.useMemo(() => {
    return [...new Set(allCompanies.map((c) => c.fiscal_year))]
      .filter((y): y is number => y !== null)
      .sort((a, b) => b - a)
  }, [allCompanies])

  // edinet_codeでユニークな企業一覧（未選択のもの、業種フィルター適用）
  const uniqueCompanies = React.useMemo(() => {
    const selectedCodes = selectedItems.map((s) => s.edinetCode)
    const seen = new Set<string>()
    return allCompanies.filter((c) => {
      if (!c.edinet_code || selectedCodes.includes(c.edinet_code) || seen.has(c.edinet_code)) {
        return false
      }
      // 業種フィルター
      if (selectedIndustry && c.industry_code !== selectedIndustry) {
        return false
      }
      seen.add(c.edinet_code)
      return true
    })
  }, [allCompanies, selectedItems, selectedIndustry])

  // 特定企業の利用可能年度を取得
  const getAvailableYearsForCompany = (edinetCode: string): number[] => {
    return allCompanies
      .filter((c) => c.edinet_code === edinetCode && c.fiscal_year !== null)
      .map((c) => c.fiscal_year as number)
      .sort((a, b) => b - a)
  }

  // 特定企業・年度のdoc_idを取得
  const getDocId = (edinetCode: string, fiscalYear: number): string | null => {
    const company = allCompanies.find(
      (c) => c.edinet_code === edinetCode && c.fiscal_year === fiscalYear
    )
    return company?.doc_id || null
  }

  // 比較データの取得
  React.useEffect(() => {
    const fetchComparison = async () => {
      if (selectedItems.length < 2) {
        setComparisonData([])
        return
      }

      const docIds = selectedItems.map((s) => s.docId)

      try {
        setComparisonLoading(true)
        const data = await apiClient.compareCompanies(docIds)
        setComparisonData(data.companies || [])
      } catch (err) {
        console.error("Failed to fetch comparison:", err)
        setComparisonData([])
      } finally {
        setComparisonLoading(false)
      }
    }

    fetchComparison()
  }, [selectedItems])

  // 企業追加
  const addCompany = (edinetCode: string) => {
    if (!edinetCode || selectedItems.length >= 4) return

    const company = allCompanies.find((c) => c.edinet_code === edinetCode)
    if (!company) return

    const years = getAvailableYearsForCompany(edinetCode)
    const latestYear = years[0]
    const docId = getDocId(edinetCode, latestYear)

    if (docId) {
      setSelectedItems([
        ...selectedItems,
        {
          edinetCode,
          companyName: company.company_name,
          docId,
          fiscalYear: latestYear,
        },
      ])
    }
  }

  // 年度変更
  const changeYear = (edinetCode: string, newYear: number) => {
    const docId = getDocId(edinetCode, newYear)
    if (!docId) return

    setSelectedItems(
      selectedItems.map((s) =>
        s.edinetCode === edinetCode
          ? { ...s, fiscalYear: newYear, docId }
          : s
      )
    )
  }

  // 企業削除
  const removeCompany = (edinetCode: string) => {
    setSelectedItems(selectedItems.filter((s) => s.edinetCode !== edinetCode))
  }

  if (error) {
    return (
      <DashboardLayout
        breadcrumbs={[
          { label: "ホーム", href: "/" },
          { label: "企業比較" },
        ]}
      >
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">エラーが発生しました</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "ホーム", href: "/" },
        { label: "企業比較" },
      ]}
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <GitCompare className="h-6 w-6 text-primary" />
              企業比較
            </h1>
            <p className="text-muted-foreground mt-1">
              複数企業の財務指標を比較分析（各企業の年度を選択可能）
            </p>
          </div>
        </div>

        {/* Company Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">比較する企業を選択（最大4社）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Company with Industry Filter */}
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : selectedItems.length < 4 && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <IndustrySelector
                    compact
                    value={selectedIndustry}
                    onChange={setSelectedIndustry}
                  />
                </div>
                <Popover open={companySearchOpen} onOpenChange={setCompanySearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={companySearchOpen}
                      className="w-[350px] justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">企業を追加...</span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="企業名または証券コードで検索..." />
                      <CommandList>
                        <CommandEmpty>該当する企業がありません</CommandEmpty>
                        <CommandGroup>
                          {uniqueCompanies.map((company) => (
                            <CommandItem
                              key={company.edinet_code}
                              value={`${company.sec_code || ""} ${company.company_name}`}
                              onSelect={() => {
                                addCompany(company.edinet_code || "")
                                setCompanySearchOpen(false)
                              }}
                            >
                              <span className="text-muted-foreground mr-2 font-mono text-sm">
                                {company.sec_code || company.edinet_code}
                              </span>
                              {company.company_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Selected Companies with Year Selection */}
            {selectedItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">選択済み企業</p>
                {selectedItems.map((item) => {
                  const years = getAvailableYearsForCompany(item.edinetCode)

                  return (
                    <div
                      key={item.edinetCode}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                    >
                      <span className="text-sm font-medium flex-1 truncate">
                        <span className="text-muted-foreground mr-2">
                          {allCompanies.find((c) => c.edinet_code === item.edinetCode)?.sec_code || item.edinetCode}
                        </span>
                        {item.companyName}
                      </span>
                      <Select
                        value={item.fiscalYear.toString()}
                        onValueChange={(val) => changeYear(item.edinetCode, parseInt(val))}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}年度
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => removeCompany(item.edinetCode)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparison Content */}
        {selectedItems.length >= 2 && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="metrics" className="gap-2">
                <Target className="h-4 w-4" />
                財務指標
              </TabsTrigger>
              <TabsTrigger value="bs" className="gap-2">
                <Scale className="h-4 w-4" />
                規模比較
              </TabsTrigger>
              <TabsTrigger value="pl" className="gap-2">
                <Receipt className="h-4 w-4" />
                収益性比較
              </TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-6">
              {comparisonLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <MetricsComparison data={comparisonData} items={selectedItems} />
              )}
            </TabsContent>

            <TabsContent value="bs" className="space-y-6">
              {comparisonLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ScaleComparison data={comparisonData} items={selectedItems} />
              )}
            </TabsContent>

            <TabsContent value="pl" className="space-y-6">
              {comparisonLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ProfitabilityComparison data={comparisonData} items={selectedItems} />
              )}
            </TabsContent>
          </Tabs>
        )}

        {selectedItems.length < 2 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                比較する企業を2社以上選択してください
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

interface ComparisonProps {
  data: FinancialSummary[]
  items: SelectedCompany[]
}

// 財務指標比較コンポーネント
function MetricsComparison({ data, items }: ComparisonProps) {
  const metrics = [
    { key: "roe", label: "ROE", unit: "%", icon: Percent, description: "自己資本利益率" },
    { key: "operating_margin", label: "営業利益率", unit: "%", icon: BarChart3, description: "売上高営業利益率" },
    { key: "equity_ratio", label: "自己資本比率", unit: "%", icon: ShieldCheck, description: "財務安定性指標" },
  ]

  const getBestValue = (key: string) => {
    const validData = data.filter((d) => d[key as keyof FinancialSummary] != null)
    if (validData.length === 0) return null
    return validData.reduce((best, current) => {
      const bestVal = best[key as keyof FinancialSummary] as number
      const currentVal = current[key as keyof FinancialSummary] as number
      return currentVal > bestVal ? current : best
    }).doc_id
  }

  const getCompanyLabel = (docId: string) => {
    const item = items.find((i) => i.docId === docId)
    return item ? `${item.companyName.slice(0, 6)} (${item.fiscalYear})` : ""
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          const best = getBestValue(metric.key)

          return (
            <Card key={metric.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {metric.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.map((company) => {
                  const value = company[metric.key as keyof FinancialSummary] as number | null
                  const isBest = company.doc_id === best

                  return (
                    <div key={company.doc_id} className="flex items-center justify-between gap-4">
                      <span className="text-base text-muted-foreground truncate max-w-[200px]">
                        {getCompanyLabel(company.doc_id)}
                      </span>
                      <span className={cn(
                        "text-lg font-bold tabular-nums",
                        isBest ? "text-primary" : "",
                        value != null && value < 0 ? "text-destructive" : ""
                      )}>
                        {formatPercent(value)}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-primary" />
            財務指標詳細比較
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">指標</th>
                  {data.map((company) => (
                    <th key={company.doc_id} className="text-right py-3 px-4 font-medium">
                      <div className="text-sm">{company.company_name?.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {items.find((i) => i.docId === company.doc_id)?.fiscalYear}年度
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => {
                  const best = getBestValue(metric.key)

                  return (
                    <tr key={metric.key} className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-medium">{metric.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{metric.description}</span>
                        </div>
                      </td>
                      {data.map((company) => {
                        const value = company[metric.key as keyof FinancialSummary] as number | null
                        const isBest = company.doc_id === best

                        return (
                          <td key={company.doc_id} className="text-right py-3 px-4">
                            <span className={cn(
                              "font-semibold tabular-nums",
                              isBest ? "text-primary" : "",
                              value != null && value < 0 ? "text-destructive" : ""
                            )}>
                              {formatPercent(value)}
                            </span>
                            {isBest && (
                              <Badge variant="outline" className="ml-2 text-xs text-primary">
                                Best
                              </Badge>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// 規模比較コンポーネント
function ScaleComparison({ data, items }: ComparisonProps) {
  const scaleItems = [
    { key: "total_assets", label: "総資産" },
    { key: "net_assets", label: "純資産" },
    { key: "total_liabilities", label: "負債合計" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          規模比較
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">勘定科目</th>
                {data.map((company) => (
                  <th key={company.doc_id} className="text-right py-3 px-4 font-medium">
                    <div className="text-sm">{company.company_name?.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {items.find((i) => i.docId === company.doc_id)?.fiscalYear}年度
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scaleItems.map((item) => (
                <tr key={item.key} className="border-b last:border-b-0">
                  <td className="py-3 px-4 font-medium">{item.label}</td>
                  {data.map((company) => {
                    const value = company[item.key as keyof FinancialSummary] as number | null
                    return (
                      <td key={company.doc_id} className="text-right py-3 px-4 tabular-nums">
                        {formatCurrency(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// 収益性比較コンポーネント
function ProfitabilityComparison({ data, items }: ComparisonProps) {
  const profitItems = [
    { key: "revenue", label: "売上高" },
    { key: "operating_income", label: "営業利益" },
    { key: "net_income", label: "当期純利益" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          収益性比較
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b">
                <th className="text-left py-4 px-4 font-medium text-muted-foreground text-base">勘定科目</th>
                {data.map((company) => (
                  <th key={company.doc_id} className="text-right py-4 px-4 font-medium">
                    <div className="text-base">{company.company_name?.slice(0, 8)}</div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {items.find((i) => i.docId === company.doc_id)?.fiscalYear}年度
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profitItems.map((item) => (
                <tr key={item.key} className="border-b last:border-b-0">
                  <td className="py-4 px-4 font-medium text-base">{item.label}</td>
                  {data.map((company) => {
                    const value = company[item.key as keyof FinancialSummary] as number | null
                    return (
                      <td key={company.doc_id} className={cn(
                        "text-right py-4 px-4 tabular-nums text-lg font-medium",
                        value != null && value < 0 && "text-destructive"
                      )}>
                        {formatCurrency(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Margin Comparison */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            利益率比較
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { key: "operating_margin", label: "営業利益率" },
              { key: "roe", label: "ROE" },
            ].map((margin) => (
              <div key={margin.key} className="space-y-3">
                <span className="text-base font-medium text-muted-foreground">{margin.label}</span>
                <div className="space-y-3">
                  {data.map((company) => {
                    const value = company[margin.key as keyof FinancialSummary] as number | null
                    const rate = value || 0
                    const item = items.find((i) => i.docId === company.doc_id)

                    return (
                      <div key={company.doc_id} className="flex items-center gap-3">
                        <span className="text-base text-muted-foreground flex-1 min-w-0 truncate">
                          {company.company_name?.slice(0, 10)} ({item?.fiscalYear})
                        </span>
                        <div className="w-72 h-4 bg-secondary rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              rate >= 0 ? "bg-primary" : "bg-destructive"
                            )}
                            style={{ width: `${Math.min(Math.abs(rate), 100)}%` }}
                          />
                        </div>
                        <span className={cn(
                          "text-lg font-bold w-20 text-right tabular-nums flex-shrink-0",
                          rate < 0 && "text-destructive"
                        )}>
                          {formatPercent(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
