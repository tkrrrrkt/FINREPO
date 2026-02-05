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
import { Skeleton } from "@/components/ui/skeleton"
import { Scale, AlertCircle } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { FinancialItem, FinancialStatementResponse } from "@/lib/types"

interface BSTabProps {
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

// APIは百万円単位で値を返す（例: 1418.0 = 1,418百万円）
// 金額フォーマット（テーブル用：百万円表示）
function formatMillions(valueInMillions: number | null): string {
  if (valueInMillions === null) return "-"
  return `${valueInMillions.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}百万円`
}

// 大きな金額フォーマット（サマリーカード用）
function formatCurrency(valueInMillions: number | null): string {
  if (valueInMillions === null) return "-"
  // 実際の円に変換
  const value = valueInMillions * 1000000
  const absValue = Math.abs(value)
  if (absValue >= 1e12) return `${(value / 1e12).toFixed(1)}兆円`
  if (absValue >= 1e8) return `${(value / 1e8).toFixed(0)}億円`
  return `${valueInMillions.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}百万円`
}

export function BSTab({ docId }: BSTabProps) {
  const [data, setData] = React.useState<FinancialStatementResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      if (!docId) return

      try {
        setLoading(true)
        setError(null)
        const bs = await apiClient.getBalanceSheet(docId)
        setData(bs)
      } catch (err) {
        setError(err instanceof Error ? err.message : "データの取得に失敗しました")
        console.error("Failed to fetch balance sheet:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [docId])

  if (loading) {
    return <BSTabSkeleton />
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
          貸借対照表データがありません
        </CardContent>
      </Card>
    )
  }

  // 資産、負債、純資産を分類（sectionまたはラベルから推測）
  const items = data.items

  // 合計値を計算（is_totalがtrueの項目から取得、またはindent_level=0で「合計」を含む項目）
  const totalAssets = items.find(
    (item) => item.is_total && (item.label.includes("資産") || item.label.includes("Assets"))
  )?.value || items.reduce((sum, item) => {
    if (item.section === "assets" && !item.is_total && !item.is_subtotal) {
      return sum + (item.value || 0)
    }
    return sum
  }, 0)

  const totalLiabilities = items.find(
    (item) => item.is_total && (item.label.includes("負債") || item.label.includes("Liabilities"))
  )?.value || 0

  const totalEquity = items.find(
    (item) => item.is_total && (item.label.includes("純資産") || item.label.includes("Equity"))
  )?.value || 0

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">総資産</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(totalAssets)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">負債合計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(totalLiabilities)}</div>
            {totalAssets > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                負債比率: {((totalLiabilities / totalAssets) * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">純資産</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(totalEquity)}</div>
            {totalAssets > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                自己資本比率: {((totalEquity / totalAssets) * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 貸借対照表テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            貸借対照表 (Balance Sheet)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">勘定科目</TableHead>
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

function BSTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
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
