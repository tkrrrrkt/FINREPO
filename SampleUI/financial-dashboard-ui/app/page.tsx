"use client"

import React from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TrendingUp,
  TrendingDown,
  Building2,
  ArrowRight,
  FileSpreadsheet,
  GitCompare,
  Trophy,
  AlertCircle,
  Calendar,
  Factory,
  Clock,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import type { DashboardResponse } from "@/lib/types"

// 最近見た企業をlocalStorageから取得
function getRecentlyViewed(): { docId: string; companyName: string; viewedAt: string }[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem("finrepo_recently_viewed")
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = React.useState<DashboardResponse | null>(null)
  const [recentlyViewed, setRecentlyViewed] = React.useState<{ docId: string; companyName: string; viewedAt: string }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiClient.getDashboard()
        setDashboardData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "データの取得に失敗しました")
        console.error("Failed to fetch dashboard data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    setRecentlyViewed(getRecentlyViewed())
  }, [])

  const clearRecentlyViewed = () => {
    localStorage.removeItem("finrepo_recently_viewed")
    setRecentlyViewed([])
  }

  if (error) {
    return (
      <DashboardLayout
        breadcrumbs={[
          { label: "ホーム", href: "/" },
          { label: "ダッシュボード" },
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

  const stats = dashboardData?.stats

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "ホーム", href: "/" },
        { label: "ダッシュボード" },
      ]}
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
            <p className="text-muted-foreground mt-1">
              FINREPO 財務データベース概要
            </p>
          </div>
          {stats?.latest_submission_date && (
            <Badge variant="outline" className="w-fit">
              最終更新: {new Date(stats.latest_submission_date).toLocaleDateString("ja-JP")}
            </Badge>
          )}
        </div>

        {/* Data Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                登録企業数
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <div className="text-3xl font-bold tabular-nums">{stats?.total_companies.toLocaleString() || 0}<span className="text-lg font-normal text-muted-foreground">社</span></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                有報件数
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <div className="text-3xl font-bold tabular-nums">{stats?.total_documents.toLocaleString() || 0}<span className="text-lg font-normal text-muted-foreground">件</span></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Factory className="h-4 w-4" />
                業種数
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <div className="text-3xl font-bold tabular-nums">{stats?.industry_count || 0}<span className="text-lg font-normal text-muted-foreground">業種</span></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                データ期間
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                <div className="text-xl font-bold">{stats?.fiscal_year_range || "-"}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Reports */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                最新の有価証券報告書
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {dashboardData?.recent_reports.slice(0, 7).map((report) => (
                    <Link
                      key={report.doc_id}
                      href={`/financial-analysis?doc_id=${report.doc_id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-12 flex-shrink-0">
                          {report.sec_code || "-"}
                        </span>
                        <span className="font-medium truncate">{report.company_name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {report.submission_date ? new Date(report.submission_date).toLocaleDateString("ja-JP") : "-"}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recently Viewed */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  最近見た企業
                </CardTitle>
                {recentlyViewed.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearRecentlyViewed} className="h-7 text-xs text-muted-foreground">
                    <X className="h-3 w-3 mr-1" />
                    クリア
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentlyViewed.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">まだ閲覧履歴がありません</p>
                  <p className="text-xs mt-1">企業を閲覧するとここに表示されます</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentlyViewed.slice(0, 7).map((item, index) => (
                    <Link
                      key={`${item.docId}-${index}`}
                      href={`/financial-analysis?doc_id=${item.docId}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <span className="font-medium truncate">{item.companyName}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.viewedAt).toLocaleDateString("ja-JP")}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notable Changes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ROE Improvers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                ROE改善企業 TOP5
                <Badge variant="secondary" className="ml-2 text-xs">前年比</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : dashboardData?.roe_improvers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">データがありません</p>
              ) : (
                <div className="space-y-2">
                  {dashboardData?.roe_improvers.map((item, index) => (
                    <Link
                      key={item.doc_id}
                      href={`/financial-analysis?doc_id=${item.doc_id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <span className="text-lg font-bold text-primary w-6">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{item.sec_code || "-"}</span>
                          <span className="font-medium truncate">{item.company_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.previous_value?.toFixed(1)}% → {item.current_value?.toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <ArrowUpRight className="h-4 w-4" />
                        <span>+{item.change?.toFixed(1)}pt</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ROE Decliners */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                ROE悪化企業 TOP5
                <Badge variant="secondary" className="ml-2 text-xs">前年比</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : dashboardData?.roe_decliners.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">データがありません</p>
              ) : (
                <div className="space-y-2">
                  {dashboardData?.roe_decliners.map((item, index) => (
                    <Link
                      key={item.doc_id}
                      href={`/financial-analysis?doc_id=${item.doc_id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <span className="text-lg font-bold text-destructive w-6">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{item.sec_code || "-"}</span>
                          <span className="font-medium truncate">{item.company_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.previous_value?.toFixed(1)}% → {item.current_value?.toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-destructive font-bold">
                        <ArrowDownRight className="h-4 w-4" />
                        <span>{item.change?.toFixed(1)}pt</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Industry Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Factory className="h-4 w-4 text-primary" />
              業種別スナップショット
              <Badge variant="secondary" className="ml-2 text-xs">直近年度</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : dashboardData?.industry_stats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">データがありません</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {dashboardData?.industry_stats.map((industry) => (
                  <Link
                    key={industry.industry_code}
                    href={`/ranking?industry=${industry.industry_code}`}
                    className="p-3 rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all group"
                  >
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {industry.industry_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {industry.company_count}社
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">平均ROE</span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        (industry.avg_roe || 0) >= 8 ? "text-primary" : ""
                      )}>
                        {industry.avg_roe?.toFixed(1) || "-"}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Access */}
        <div>
          <h2 className="text-lg font-semibold mb-4">クイックアクセス</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/financial-analysis">
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">財務諸表分析</p>
                      <p className="text-xs text-muted-foreground">BS/PL/CFを詳細分析</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/company-comparison">
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <GitCompare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">企業比較</p>
                      <p className="text-xs text-muted-foreground">複数企業を比較分析</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/ranking">
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">ランキング</p>
                      <p className="text-xs text-muted-foreground">指標別ランキング</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
