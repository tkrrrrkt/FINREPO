"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Building2,
  Wallet,
  BarChart3,
  PiggyBank,
  Target,
  ShieldCheck,
  Activity,
  AlertCircle,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { FinancialSummary } from "@/lib/types"

interface SummaryTabProps {
  docId: string
}

export function SummaryTab({ docId }: SummaryTabProps) {
  const [data, setData] = React.useState<FinancialSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      if (!docId) return

      try {
        setLoading(true)
        setError(null)
        const summary = await apiClient.getFinancialSummary(docId)
        setData(summary)
      } catch (err) {
        setError(err instanceof Error ? err.message : "データの取得に失敗しました")
        console.error("Failed to fetch financial summary:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [docId])

  if (loading) {
    return <SummaryTabSkeleton />
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

  if (!data) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          財務データがありません
        </CardContent>
      </Card>
    )
  }

  // APIは百万円単位で値を返す（例: 34113.097 = 34,113百万円）
  const formatNumber = (valueInMillions: number | null): string => {
    if (valueInMillions === null) return "-"
    // 実際の円に変換
    const value = valueInMillions * 1000000
    if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(1)}兆円`
    if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(0)}億円`
    return `${valueInMillions.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}百万円`
  }

  const formatPercent = (value: number | null): string => {
    if (value === null) return "-"
    return `${value.toFixed(1)}%`
  }

  const getROEStatus = (roe: number | null) => {
    if (roe === null) return "neutral"
    if (roe > 8) return "good"
    if (roe > 0) return "warning"
    return "danger"
  }

  const getMarginStatus = (margin: number | null) => {
    if (margin === null) return "neutral"
    if (margin > 10) return "good"
    if (margin > 0) return "warning"
    return "danger"
  }

  const getEquityRatioStatus = (ratio: number | null) => {
    if (ratio === null) return "neutral"
    if (ratio > 40) return "good"
    if (ratio > 20) return "warning"
    return "danger"
  }

  return (
    <div className="space-y-6">
      {/* 主要財務指標 */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          主要財務指標
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="総資産"
            value={formatNumber(data.total_assets)}
            icon={Building2}
          />
          <MetricCard
            label="純資産"
            value={formatNumber(data.net_assets)}
            icon={Wallet}
          />
          <MetricCard
            label="売上高"
            value={formatNumber(data.revenue)}
            icon={BarChart3}
          />
          <MetricCard
            label="当期純利益"
            value={formatNumber(data.net_income)}
            icon={PiggyBank}
          />
        </div>
      </div>

      {/* 財務比率分析 */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          財務比率分析
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <RatioCard
            label="ROE（自己資本利益率）"
            value={formatPercent(data.roe)}
            status={getROEStatus(data.roe)}
            benchmark="8.0%"
            description={data.roe && data.roe > 8 ? "業界平均を上回る" : "業界平均水準"}
          />
          <RatioCard
            label="ROA（総資産利益率）"
            value={formatPercent(data.roa || null)}
            status={getMarginStatus(data.roa || null)}
            benchmark="5.0%"
            description="資産効率を示す"
          />
          <RatioCard
            label="営業利益率"
            value={formatPercent(data.operating_margin)}
            status={getMarginStatus(data.operating_margin)}
            benchmark="6.0%"
            description={data.operating_margin && data.operating_margin > 10 ? "高収益体質" : "収益性を示す"}
          />
          <RatioCard
            label="自己資本比率"
            value={formatPercent(data.equity_ratio)}
            status={getEquityRatioStatus(data.equity_ratio)}
            benchmark="40.0%"
            description={data.equity_ratio && data.equity_ratio > 40 ? "財務安定性が高い" : "財務安定性を示す"}
          />
        </div>
      </div>

      {/* 財務健全性サマリー */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            財務健全性評価
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <HealthBar
              label="収益性"
              status={getROEStatus(data.roe)}
              percentage={Math.min((data.roe || 0) / 15 * 100, 100)}
              description={`ROE: ${formatPercent(data.roe)}`}
            />
            <HealthBar
              label="安全性"
              status={getEquityRatioStatus(data.equity_ratio)}
              percentage={Math.min((data.equity_ratio || 0) / 60 * 100, 100)}
              description={`自己資本比率: ${formatPercent(data.equity_ratio)}`}
            />
            <HealthBar
              label="効率性"
              status={getMarginStatus(data.operating_margin)}
              percentage={Math.min((data.operating_margin || 0) / 15 * 100, 100)}
              description={`営業利益率: ${formatPercent(data.operating_margin)}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string
  icon: React.ElementType
}

function MetricCard({ label, value, icon: Icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

interface RatioCardProps {
  label: string
  value: string
  benchmark: string
  status: "good" | "warning" | "danger" | "neutral"
  description: string
}

function RatioCard({ label, value, benchmark, status, description }: RatioCardProps) {
  const statusConfig = {
    good: { color: "text-primary", badge: "良好" },
    warning: { color: "text-warning", badge: "注意" },
    danger: { color: "text-destructive", badge: "要改善" },
    neutral: { color: "text-muted-foreground", badge: "-" },
  }

  const config = statusConfig[status]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums ${config.color}`}>{value}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            ベンチマーク: {benchmark}
          </span>
          <Badge variant="outline" className={config.color}>
            {config.badge}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  )
}

interface HealthBarProps {
  label: string
  status: "good" | "warning" | "danger" | "neutral"
  percentage: number
  description: string
}

function HealthBar({ label, status, percentage, description }: HealthBarProps) {
  const statusConfig = {
    good: { badge: "良好", bgColor: "bg-primary" },
    warning: { badge: "注意", bgColor: "bg-warning" },
    danger: { badge: "要改善", bgColor: "bg-destructive" },
    neutral: { badge: "-", bgColor: "bg-muted" },
  }

  const config = statusConfig[status]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge variant="default" className={config.bgColor}>
          {config.badge}
        </Badge>
      </div>
      <div className="h-2 bg-secondary rounded-full">
        <div
          className={`h-full ${config.bgColor} rounded-full transition-all`}
          style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function SummaryTabSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
