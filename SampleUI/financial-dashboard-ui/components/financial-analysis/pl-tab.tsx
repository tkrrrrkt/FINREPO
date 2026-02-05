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
import { Receipt, AlertCircle } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { FinancialItem, FinancialStatementResponse } from "@/lib/types"

interface PLTabProps {
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
  if (absValue >= 1e12) return `${(value / 1e12).toFixed(1)}兆円`
  if (absValue >= 1e8) return `${(value / 1e8).toFixed(0)}億円`
  return `${valueInMillions.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}百万円`
}

export function PLTab({ docId }: PLTabProps) {
  const [data, setData] = React.useState<FinancialStatementResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      if (!docId) return

      try {
        setLoading(true)
        setError(null)
        const pl = await apiClient.getIncomeStatement(docId)
        setData(pl)
      } catch (err) {
        setError(err instanceof Error ? err.message : "データの取得に失敗しました")
        console.error("Failed to fetch income statement:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [docId])

  if (loading) {
    return <PLTabSkeleton />
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
          損益計算書データがありません
        </CardContent>
      </Card>
    )
  }

  const items = data.items

  // 主要な指標を抽出
  const revenue = items.find((item) =>
    item.label.includes("売上高") || item.label.includes("Revenue") || item.label.includes("営業収益")
  )?.value || 0

  const operatingIncome = items.find((item) =>
    item.label.includes("営業利益") || item.label.includes("Operating")
  )?.value || 0

  const ordinaryIncome = items.find((item) =>
    item.label.includes("経常利益") || item.label.includes("Ordinary")
  )?.value || 0

  const netIncome = items.find((item) =>
    (item.label.includes("当期純利益") || item.label.includes("Net Income")) &&
    (item.is_total || item.is_subtotal || item.indent_level === 0)
  )?.value || items.find((item) =>
    item.label.includes("親会社株主に帰属")
  )?.value || 0

  // 利益率計算
  const operatingMargin = revenue > 0 ? (operatingIncome / revenue) * 100 : 0
  const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">売上高</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">営業利益</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(operatingIncome)}</div>
            <p className="text-sm text-muted-foreground mt-1">
              利益率: {operatingMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">経常利益</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(ordinaryIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">当期純利益</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary tabular-nums">{formatCurrency(netIncome)}</div>
            <p className="text-sm text-muted-foreground mt-1">
              利益率: {netMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">営業利益率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold tabular-nums ${operatingMargin >= 10 ? "text-primary" : operatingMargin >= 5 ? "text-warning" : "text-destructive"}`}>
              {operatingMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 損益計算書テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            損益計算書 (Income Statement)
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

function PLTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-20" />
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
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
