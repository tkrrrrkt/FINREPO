"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Building2,
  Target,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  FileText,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type {
  QualitativeCategory,
  QualitativeItem,
  QualitativeSummaryResponse,
  QualitativeDetailResponse,
} from "@/lib/types"

interface QualitativeTabProps {
  docId: string
}

// カテゴリコードとアイコンのマッピング
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  BIZ_DESC: Building2,
  MGMT_POLICY: Target,
  BIZ_RISK: AlertTriangle,
  MDA: TrendingUp,
  RND: Lightbulb,
  CONTRACTS: FileText,
}

// カテゴリラベル
const CATEGORY_LABELS: Record<string, string> = {
  BIZ_DESC: "事業の内容",
  MGMT_POLICY: "経営方針・戦略",
  BIZ_RISK: "事業等のリスク",
  MDA: "経営者による分析（MD&A）",
  RND: "研究開発活動",
  CONTRACTS: "重要な契約",
}

export function QualitativeTab({ docId }: QualitativeTabProps) {
  const [summary, setSummary] = React.useState<QualitativeSummaryResponse | null>(null)
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<QualitativeDetailResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // サマリーの取得
  React.useEffect(() => {
    const fetchSummary = async () => {
      if (!docId) return

      try {
        setLoading(true)
        setError(null)
        const data = await apiClient.getQualitativeSummary(docId)
        setSummary(data)
        // 最初のカテゴリを自動選択
        if (data.categories && data.categories.length > 0) {
          setSelectedCategory(data.categories[0].category_code)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "データの取得に失敗しました")
        console.error("Failed to fetch qualitative summary:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [docId])

  // 詳細の取得
  React.useEffect(() => {
    const fetchDetail = async () => {
      if (!docId || !selectedCategory) return

      try {
        setDetailLoading(true)
        const data = await apiClient.getQualitativeDetail(docId, selectedCategory)
        setDetail(data)
      } catch (err) {
        console.error("Failed to fetch qualitative detail:", err)
        setDetail(null)
      } finally {
        setDetailLoading(false)
      }
    }

    fetchDetail()
  }, [docId, selectedCategory])

  if (loading) {
    return <QualitativeTabSkeleton />
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

  if (!summary || !summary.categories || summary.categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          定性情報データがありません
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* カテゴリ概要カード */}
      <div>
        <h3 className="text-lg font-semibold mb-4">カテゴリ別データ概要</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.category_code] || FileText
            const isSelected = selectedCategory === category.category_code

            return (
              <Card
                key={category.category_code}
                className={`cursor-pointer transition-all ${
                  isSelected ? "ring-2 ring-primary" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedCategory(category.category_code)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : ""}`} />
                    {CATEGORY_LABELS[category.category_code] || category.category_name_ja}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold tabular-nums">
                        {category.item_count}件
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {category.total_chars.toLocaleString()}文字
                      </p>
                    </div>
                    {isSelected && (
                      <ChevronRight className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* 選択したカテゴリの詳細 */}
      {selectedCategory && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {(() => {
                const Icon = CATEGORY_ICONS[selectedCategory] || FileText
                return <Icon className="h-5 w-5 text-primary" />
              })()}
              {CATEGORY_LABELS[selectedCategory] || detail?.category_name_ja || selectedCategory}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ))}
              </div>
            ) : detail && detail.items && detail.items.length > 0 ? (
              <div className="space-y-6">
                {detail.items.map((item, index) => (
                  <QualitativeItemCard key={index} item={item} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                このカテゴリのデータはありません
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface QualitativeItemCardProps {
  item: QualitativeItem
}

function QualitativeItemCard({ item }: QualitativeItemCardProps) {
  const [expanded, setExpanded] = React.useState(false)

  // HTMLコンテンツをサニタイズしつつ表示用に整形
  const cleanHtml = React.useMemo(() => {
    // 危険なタグを除去（script, style, iframe等）
    let html = item.text_content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "") // イベントハンドラ除去

    // インラインスタイルを適切なクラスに変換
    html = html
      .replace(/style="[^"]*font-weight:\s*bold[^"]*"/gi, 'class="font-semibold"')
      .replace(/style="[^"]*"/gi, "") // その他のスタイルは除去

    return html
  }, [item.text_content])

  // プレーンテキストの文字数で折りたたみ判定
  const plainText = item.text_content.replace(/<[^>]*>/g, "")
  const shouldTruncate = plainText.length > 2000

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <h4 className="font-medium text-sm break-words">{item.concept_name}</h4>
          <div className="flex items-center gap-2 flex-wrap">
            {item.consolidation_type && (
              <Badge variant="outline" className="text-xs">
                {item.consolidation_type}
              </Badge>
            )}
            {item.period_category && (
              <Badge variant="secondary" className="text-xs">
                {item.period_category}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {item.text_length.toLocaleString()}文字
            </span>
          </div>
        </div>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${expanded || !shouldTruncate ? "" : "max-h-[300px]"}`}>
        <div
          className="prose prose-sm max-w-full dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-li:my-1 break-words [word-break:break-word] [&_*]:max-w-full [&_table]:table-fixed [&_table]:w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      </div>
      {shouldTruncate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded ? "折りたたむ" : `続きを表示（残り${(plainText.length - 2000).toLocaleString()}文字）`}
        </Button>
      )}
    </div>
  )
}

function QualitativeTabSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
