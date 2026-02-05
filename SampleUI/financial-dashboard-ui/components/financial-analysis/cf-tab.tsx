"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Factory,
  Landmark,
  Wallet,
  AlertCircle,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { FinancialItem, FinancialStatementResponse } from "@/lib/types"

interface CFTabProps {
  docId: string
}

// 階層表示用のフォーマット関数
function formatWithIndent(item: FinancialItem): string {
  const { label, indent_level, is_total, is_subtotal } = item

  if (is_total) return `■ ${label}`
  if (is_subtotal) return `  ▸ ${label}`

  switch (indent_level) {
    case 0:
      return `● ${label}`
    case 1:
      return `  ├─ ${label}`
    case 2:
      return `    └─ ${label}`
    default:
      return `      └─ ${label}`
  }
}

// APIは百万円単位で値を返す
// 金額フォーマット（テーブル用：百万円表示）
function formatMillions(valueInMillions: number | null): string {
  if (valueInMillions === null) return "-"
  return `${valueInMillions.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}百万円`
}

// 大きな金額フォーマット（サマリーカード用）
function formatCurrency(valueInMillions: number | null): string {
  if (valueInMillions === null) return "-"
  const value = valueInMillions * 1000000
  const absValue = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (absValue >= 1e12) return `${sign}${(absValue / 1e12).toFixed(1)}兆円`
  if (absValue >= 1e8) return `${sign}${(absValue / 1e8).toFixed(0)}億円`
  return `${valueInMillions.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}百万円`
}

export function CFTab({ docId }: CFTabProps) {
  const [data, setData] = React.useState<FinancialStatementResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      if (!docId) return

      try {
        setLoading(true)
        setError(null)
        const cf = await apiClient.getCashFlow(docId)
        setData(cf)
      } catch (err) {
        setError(err instanceof Error ? err.message : "データの取得に失敗しました")
        console.error("Failed to fetch cash flow:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [docId])

  if (loading) {
    return <CFTabSkeleton />
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">エラーが発生しました</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || !data.items || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          キャッシュフロー計算書データがありません
        </CardContent>
      </Card>
    )
  }

  const items = data.items

  // キャッシュフローの主要指標を抽出
  const operatingCF = items.find((item) =>
    item.is_total && (item.label.includes("営業活動") || item.label.includes("Operating"))
  )?.value || 0

  const investingCF = items.find((item) =>
    item.is_total && (item.label.includes("投資活動") || item.label.includes("Investing"))
  )?.value || 0

  const financingCF = items.find((item) =>
    item.is_total && (item.label.includes("財務活動") || item.label.includes("Financing"))
  )?.value || 0

  const freeCF = operatingCF + investingCF

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Factory className="h-4 w-4" />
              営業CF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${operatingCF >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrency(operatingCF)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {operatingCF >= 0 ? (
                <ArrowUpCircle className="h-4 w-4 text-primary" />
              ) : (
                <ArrowDownCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm text-muted-foreground">
                本業からの資金
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              投資CF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${investingCF >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrency(investingCF)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              設備投資・M&A等
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              財務CF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${financingCF >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrency(financingCF)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              借入・配当等
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              フリーCF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${freeCF >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrency(freeCF)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              営業CF + 投資CF
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CFの構成グラフ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">キャッシュフロー構成</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <CFBar label="営業CF" value={operatingCF} maxValue={Math.max(Math.abs(operatingCF), Math.abs(investingCF), Math.abs(financingCF)) * 1.2 || 1} />
            <CFBar label="投資CF" value={investingCF} maxValue={Math.max(Math.abs(operatingCF), Math.abs(investingCF), Math.abs(financingCF)) * 1.2 || 1} />
            <CFBar label="財務CF" value={financingCF} maxValue={Math.max(Math.abs(operatingCF), Math.abs(investingCF), Math.abs(financingCF)) * 1.2 || 1} />
            <div className="border-t pt-4 mt-4">
              <CFBar label="フリーCF" value={freeCF} maxValue={Math.max(Math.abs(operatingCF), Math.abs(investingCF), Math.abs(financingCF)) * 1.2 || 1} highlight />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* キャッシュフロー計算書テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            キャッシュフロー計算書 (Cash Flow Statement)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">項目</TableHead>
                <TableHead className="text-right">金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow
                  key={`${item.label}-${index}`}
                  className={
                    item.is_total
                      ? "bg-primary/10 font-bold"
                      : item.is_subtotal
                      ? "bg-muted/50 font-medium"
                      : ""
                  }
                >
                  <TableCell
                    className={
                      item.is_total || item.is_subtotal
                        ? ""
                        : item.indent_level === 0
                        ? "font-medium"
                        : ""
                    }
                  >
                    <span className="whitespace-pre">{formatWithIndent(item)}</span>
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      item.value && item.value < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatMillions(item.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function CFBar({
  label,
  value,
  maxValue,
  highlight,
}: {
  label: string
  value: number
  maxValue: number
  highlight?: boolean
}) {
  const percentage = maxValue > 0 ? (Math.abs(value) / maxValue) * 100 : 0
  const isPositive = value >= 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={highlight ? "font-semibold" : ""}>{label}</span>
        <Badge
          variant={isPositive ? "default" : "destructive"}
          className={highlight && isPositive ? "bg-primary" : ""}
        >
          {formatMillions(value)}
        </Badge>
      </div>
      <div className="h-3 bg-secondary rounded-full overflow-hidden flex">
        {isPositive ? (
          <div
            className={`h-full ${highlight ? "bg-primary" : "bg-primary/70"} rounded-full`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        ) : (
          <div className="w-full flex justify-end">
            <div
              className="h-full bg-destructive/70 rounded-full"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function CFTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
