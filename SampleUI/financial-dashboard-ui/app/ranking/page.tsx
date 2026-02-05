"use client"

import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Trophy,
  Medal,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  Download,
  ArrowUpDown,
  Crown,
  AlertCircle,
  Search,
  Hash,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import type { RankingItem } from "@/lib/types"
import { useCompany } from "@/contexts/company-context"
import { FiscalYearSelector } from "@/components/fiscal-year-selector"
import { IndustrySelector } from "@/components/industry-selector"

// 財務指標の定義
const financialIndicators = [
  { id: "roe", name: "ROE（自己資本利益率）", unit: "%", category: "収益性", higherBetter: true },
  { id: "operating_margin", name: "営業利益率", unit: "%", category: "収益性", higherBetter: true },
  { id: "equity_ratio", name: "自己資本比率", unit: "%", category: "安全性", higherBetter: true },
  { id: "revenue", name: "売上高", unit: "百万円", category: "規模", higherBetter: true },
  { id: "net_income", name: "当期純利益", unit: "百万円", category: "規模", higherBetter: true },
  { id: "total_assets", name: "総資産", unit: "百万円", category: "規模", higherBetter: true },
]

// 順位バッジ
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 rounded-full">
        <Crown className="h-5 w-5 text-yellow-600" />
      </div>
    )
  } else if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
        <Medal className="h-5 w-5 text-gray-500" />
      </div>
    )
  } else if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full">
        <Medal className="h-5 w-5 text-orange-600" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full text-sm font-medium text-muted-foreground">
      {rank}
    </div>
  )
}

// 金額フォーマット（value は百万円単位）
function formatValue(value: number | null | undefined, unit: string): string {
  if (value == null) return "-"
  if (unit === "百万円") {
    // 1兆円 = 1,000,000百万円
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}兆円`
    // 1億円 = 100百万円
    if (Math.abs(value) >= 100) return `${Math.round(value / 100).toLocaleString()}億円`
    return `${value.toLocaleString()}百万円`
  }
  return `${value.toFixed(1)}${unit}`
}

// 表示件数オプション
const LIMIT_OPTIONS = [10, 20, 50, 100] as const

export default function RankingPage() {
  const { selectedFiscalYear } = useCompany()
  const [selectedIndicator, setSelectedIndicator] = React.useState("roe")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")
  const [selectedIndustry, setSelectedIndustry] = React.useState<string | null>(null)
  const [rankingData, setRankingData] = React.useState<RankingItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = React.useState<number>(50)
  const [searchQuery, setSearchQuery] = React.useState("")

  const currentIndicator = financialIndicators.find((i) => i.id === selectedIndicator)

  // ランキングデータの取得
  React.useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true)
        setError(null)
        const ascending = currentIndicator?.higherBetter ? sortOrder === "asc" : sortOrder === "desc"
        const data = await apiClient.getRanking(
          selectedIndicator,
          displayLimit,
          ascending,
          selectedFiscalYear ?? undefined,
          selectedIndustry ?? undefined
        )
        setRankingData(data.ranking || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "ランキングの取得に失敗しました")
        console.error("Failed to fetch ranking:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchRanking()
  }, [selectedIndicator, sortOrder, currentIndicator?.higherBetter, selectedFiscalYear, selectedIndustry, displayLimit])

  // 検索フィルター適用後のデータ
  const filteredRankingData = React.useMemo(() => {
    if (!searchQuery.trim()) return rankingData
    const query = searchQuery.toLowerCase()
    return rankingData.filter(
      (item) =>
        item.company_name.toLowerCase().includes(query) ||
        (item.sec_code && item.sec_code.includes(query))
    )
  }, [rankingData, searchQuery])

  // 統計情報
  const stats = React.useMemo(() => {
    if (rankingData.length === 0) return null
    const values = rankingData.map((d) => d.value).filter((v) => v != null) as number[]
    if (values.length === 0) return null
    const max = Math.max(...values)
    const min = Math.min(...values)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    const sortedValues = [...values].sort((a, b) => a - b)
    const median = sortedValues[Math.floor(values.length / 2)]
    return { max, min, avg, median }
  }, [rankingData])

  // TOP3（検索フィルター適用後）
  const top3 = filteredRankingData.slice(0, 3)

  // カテゴリーでグループ化
  const indicatorsByCategory = financialIndicators.reduce(
    (acc, indicator) => {
      if (!acc[indicator.category]) {
        acc[indicator.category] = []
      }
      acc[indicator.category].push(indicator)
      return acc
    },
    {} as Record<string, typeof financialIndicators>
  )

  if (error) {
    return (
      <DashboardLayout>
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* ページヘッダー */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ランキング</h1>
            <p className="text-muted-foreground">
              財務指標別の企業ランキングを確認できます
            </p>
          </div>
          <Button variant="outline" className="gap-2 bg-transparent w-fit">
            <Download className="h-4 w-4" />
            CSVエクスポート
          </Button>
        </div>

        {/* フィルターセクション */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              絞り込み条件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 年度・業種・表示件数・並び順 - 横並び */}
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-2">
                <Label className="text-sm font-medium">年度</Label>
                <FiscalYearSelector compact />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">業種</Label>
                <IndustrySelector
                  compact
                  value={selectedIndustry}
                  onChange={setSelectedIndustry}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  表示件数
                </Label>
                <Select value={displayLimit.toString()} onValueChange={(v) => setDisplayLimit(Number(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map((limit) => (
                      <SelectItem key={limit} value={limit.toString()}>
                        {limit}件
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  並び順
                </Label>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">
                      {currentIndicator?.higherBetter ? "高い順" : "低い順"}（上位）
                    </SelectItem>
                    <SelectItem value="asc">
                      {currentIndicator?.higherBetter ? "低い順" : "高い順"}（下位）
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(selectedFiscalYear || selectedIndustry) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    setSelectedIndustry(null)
                  }}
                >
                  フィルターをクリア
                </Button>
              )}
            </div>

            {/* 企業名検索 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                企業検索
              </Label>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="企業名または証券コードで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 財務指標選択 */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-medium">財務指標</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(indicatorsByCategory).map(([category, indicators]) => (
                  <div key={category} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {category}
                    </p>
                    <div className="space-y-1">
                      {indicators.map((indicator) => (
                        <button
                          key={indicator.id}
                          onClick={() => setSelectedIndicator(indicator.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            selectedIndicator === indicator.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 hover:bg-muted"
                          }`}
                        >
                          {indicator.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 選択中の条件表示 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {currentIndicator?.name}
          </Badge>
          {selectedFiscalYear && (
            <Badge variant="outline" className="text-sm px-3 py-1 tabular-nums">
              {selectedFiscalYear}年度
            </Badge>
          )}
          {selectedIndustry && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              業種フィルター適用中
            </Badge>
          )}
          <span className="text-sm text-muted-foreground ml-2">
            {searchQuery ? (
              <>{filteredRankingData.length}社 / {rankingData.length}社中</>
            ) : (
              <>{rankingData.length}社</>
            )}
          </span>
        </div>

        {/* TOP3 カード */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3.map((company, index) => (
              <Card
                key={company.doc_id}
                className={`relative overflow-hidden ${
                  index === 0
                    ? "border-yellow-300 bg-gradient-to-br from-yellow-50 to-white"
                    : index === 1
                      ? "border-gray-300 bg-gradient-to-br from-gray-50 to-white"
                      : "border-orange-200 bg-gradient-to-br from-orange-50 to-white"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <RankBadge rank={index + 1} />
                        <span className="text-xs text-muted-foreground">
                          {company.sec_code || company.doc_id.slice(0, 8)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg leading-tight">
                        {company.company_name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary tabular-nums">
                        {formatValue(company.value, currentIndicator?.unit || "")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 統計サマリー */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">最大値</p>
                    <p className="text-xl font-bold tabular-nums">
                      {formatValue(stats.max, currentIndicator?.unit || "")}
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">最小値</p>
                    <p className="text-xl font-bold tabular-nums">
                      {formatValue(stats.min, currentIndicator?.unit || "")}
                    </p>
                  </div>
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">平均値</p>
                    <p className="text-xl font-bold tabular-nums">
                      {formatValue(stats.avg, currentIndicator?.unit || "")}
                    </p>
                  </div>
                  <Minus className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">中央値</p>
                    <p className="text-xl font-bold tabular-nums">
                      {formatValue(stats.median, currentIndicator?.unit || "")}
                    </p>
                  </div>
                  <Minus className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ランキングテーブル */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              ランキング一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16 text-center">順位</TableHead>
                      <TableHead className="w-24">証券コード</TableHead>
                      <TableHead>企業名</TableHead>
                      <TableHead className="w-32 text-right">
                        {currentIndicator?.name.split("（")[0]}
                      </TableHead>
                      <TableHead className="w-48">分布</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRankingData.map((company, index) => {
                      const maxValue = stats?.max || 1
                      const percentage = maxValue > 0 ? ((company.value ?? 0) / maxValue) * 100 : 0
                      return (
                        <TableRow key={company.doc_id} className="hover:bg-muted/30">
                          <TableCell className="text-center">
                            <RankBadge rank={index + 1} />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {company.sec_code || "-"}
                          </TableCell>
                          <TableCell className="font-medium">{company.company_name}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatValue(company.value, currentIndicator?.unit || "")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    index < 3
                                      ? "bg-primary"
                                      : index < 10
                                        ? "bg-primary/70"
                                        : "bg-primary/40"
                                  }`}
                                  style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                                {percentage.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
