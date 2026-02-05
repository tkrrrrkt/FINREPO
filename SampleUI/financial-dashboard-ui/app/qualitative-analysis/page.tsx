"use client"

import React from "react"
import ReactMarkdown from "react-markdown"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
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
  Brain,
  Search,
  Filter,
  Sparkles,
  AlertCircle,
  Building2,
  Loader2,
  Coins,
  Download,
  Factory,
  Plus,
  X,
  ChevronsUpDown,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useCompany } from "@/contexts/company-context"
import { FiscalYearSelector } from "@/components/fiscal-year-selector"
import { IndustrySelector } from "@/components/industry-selector"
import type { AnalysisCategory, AnalysisResponse, Company } from "@/lib/types"

// 分析タイプの定義
const analysisTypes = [
  { id: "executive", name: "経営層向けサマリー", description: "市場環境、リスク、戦略の概要" },
  { id: "fpna", name: "FP&A向け分析", description: "収益ドライバー、コスト、投資分析" },
  { id: "risk", name: "リスク分析", description: "リスク一覧、カテゴリ別分析" },
]

export default function QualitativeAnalysisPage() {
  const { companies, selectedFiscalYear } = useCompany()

  // フィルター状態
  const [selectedCompanies, setSelectedCompanies] = React.useState<string[]>([])
  const [selectedIndustry, setSelectedIndustry] = React.useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([])
  const [keywords, setKeywords] = React.useState("")
  const [analysisType, setAnalysisType] = React.useState<string>("executive")
  const [additionalContext, setAdditionalContext] = React.useState("")

  // データ状態
  const [categories, setCategories] = React.useState<AnalysisCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = React.useState(true)

  // 分析状態
  const [analyzing, setAnalyzing] = React.useState(false)
  const [analysisResult, setAnalysisResult] = React.useState<AnalysisResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // UI状態
  const [companySearchOpen, setCompanySearchOpen] = React.useState(false)

  // カテゴリ一覧を取得
  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        const response = await apiClient.getAnalysisCategories()
        // 優先度Aのみをデフォルトで表示
        setCategories(response.categories.filter(c => c.priority === "A"))
      } catch (err) {
        console.error("Failed to fetch categories:", err)
      } finally {
        setCategoriesLoading(false)
      }
    }
    fetchCategories()
  }, [])

  // 年度・業種で企業をフィルタ
  const filteredCompanies = React.useMemo(() => {
    let result = companies
    if (selectedFiscalYear) {
      result = result.filter(c => c.fiscal_year === selectedFiscalYear)
    }
    if (selectedIndustry) {
      result = result.filter(c => c.industry_code === selectedIndustry)
    }
    return result
  }, [companies, selectedFiscalYear, selectedIndustry])

  // 選択可能な企業（未選択のもの）
  const availableCompanies = React.useMemo(() => {
    return filteredCompanies.filter(c => !selectedCompanies.includes(c.doc_id))
  }, [filteredCompanies, selectedCompanies])

  // 選択された企業の情報を取得
  const selectedCompanyInfos = React.useMemo(() => {
    return selectedCompanies.map(docId => {
      const company = companies.find(c => c.doc_id === docId)
      return company ? { docId, name: company.company_name, secCode: company.sec_code } : null
    }).filter((c): c is { docId: string; name: string; secCode: string | null } => c !== null)
  }, [selectedCompanies, companies])

  // MDファイルダウンロード
  const downloadMarkdown = () => {
    if (!analysisResult) return
    const companyNames = analysisResult.company_names.join("_")
    const date = new Date().toISOString().split("T")[0]
    const filename = `AI分析_${companyNames}_${date}.md`
    const blob = new Blob([analysisResult.analysis], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // 企業を追加
  const addCompany = (docId: string) => {
    if (!selectedCompanies.includes(docId)) {
      setSelectedCompanies(prev => [...prev, docId])
    }
  }

  // 企業を削除
  const removeCompany = (docId: string) => {
    setSelectedCompanies(prev => prev.filter(id => id !== docId))
  }

  // カテゴリ選択のトグル
  const toggleCategory = (code: string) => {
    setSelectedCategories(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  // 分析実行
  const runAnalysis = async () => {
    if (selectedCompanies.length === 0) {
      setError("分析対象の企業を選択してください")
      return
    }

    try {
      setAnalyzing(true)
      setError(null)
      setAnalysisResult(null)

      const keywordList = keywords
        .split(/[,、\s]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0)

      const result = await apiClient.analyzeQualitative({
        doc_ids: selectedCompanies,
        category_codes: selectedCategories.length > 0 ? selectedCategories : undefined,
        keywords: keywordList.length > 0 ? keywordList : undefined,
        analysis_type: analysisType as "executive" | "fpna" | "risk",
        additional_context: additionalContext || undefined,
      })

      setAnalysisResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析に失敗しました")
      console.error("Analysis failed:", err)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "ホーム", href: "/" },
        { label: "AI分析" },
      ]}
    >
      <div className="space-y-6">
        {/* ページヘッダー */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Brain className="h-6 w-6" />
              定性情報AI分析
            </h1>
            <p className="text-muted-foreground">
              有価証券報告書の定性情報をClaudeで分析
            </p>
          </div>
          <FiscalYearSelector compact />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左カラム: フィルター */}
          <div className="lg:col-span-1 space-y-4">
            {/* 業種フィルター */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="h-4 w-4" />
                  業種で絞り込み
                </CardTitle>
              </CardHeader>
              <CardContent>
                <IndustrySelector
                  value={selectedIndustry}
                  onChange={(value) => {
                    setSelectedIndustry(value)
                    setSelectedCompanies([]) // 業種変更時に選択をクリア
                  }}
                />
                {selectedIndustry && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {filteredCompanies.length}社が該当
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 企業選択 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  企業選択
                </CardTitle>
                <CardDescription>
                  分析対象の企業を選択（複数選択可）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 企業追加Combobox */}
                <Popover open={companySearchOpen} onOpenChange={setCompanySearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={companySearchOpen}
                      className="w-full justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">企業を追加...</span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="企業名または証券コードで検索..." />
                      <CommandList>
                        <CommandEmpty>該当する企業がありません</CommandEmpty>
                        <CommandGroup>
                          {availableCompanies.slice(0, 50).map((company) => (
                            <CommandItem
                              key={company.doc_id}
                              value={`${company.sec_code || ""} ${company.company_name}`}
                              onSelect={() => {
                                addCompany(company.doc_id)
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

                {/* 選択済み企業一覧 */}
                {selectedCompanyInfos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">選択済み ({selectedCompanyInfos.length}社)</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCompanyInfos.map((company) => (
                        <Badge
                          key={company.docId}
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          <span className="text-xs font-mono mr-1">{company.secCode || "-"}</span>
                          <span className="truncate max-w-[120px]">{company.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => removeCompany(company.docId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCompanyInfos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    企業を選択してください
                  </p>
                )}
              </CardContent>
            </Card>

            {/* カテゴリ選択 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  カテゴリ選択
                </CardTitle>
                <CardDescription>
                  分析対象のカテゴリ（未選択時は全て）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoriesLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  categories.map((cat) => (
                    <div key={cat.category_code} className="flex items-center space-x-2">
                      <Checkbox
                        id={cat.category_code}
                        checked={selectedCategories.includes(cat.category_code)}
                        onCheckedChange={() => toggleCategory(cat.category_code)}
                      />
                      <label
                        htmlFor={cat.category_code}
                        className="text-sm cursor-pointer"
                      >
                        {cat.category_name_ja}
                      </label>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* キーワード */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  キーワード
                </CardTitle>
                <CardDescription>
                  関連テキストをフィルタ（カンマ区切り）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="例: リスク, 為替, 競合"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </CardContent>
            </Card>

            {/* 分析タイプ */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  分析タイプ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={analysisType} onValueChange={setAnalysisType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {analysisTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {analysisTypes.find(t => t.id === analysisType)?.description}
                </p>
              </CardContent>
            </Card>

            {/* 追加コンテキスト */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">追加指示（任意）</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="特に注目してほしいポイントなど"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* 分析実行ボタン */}
            <Button
              className="w-full"
              size="lg"
              onClick={runAnalysis}
              disabled={analyzing || selectedCompanies.length === 0}
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  AI分析を実行
                </>
              )}
            </Button>

            {selectedCompanies.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {selectedCompanies.length}社を分析
              </p>
            )}
          </div>

          {/* 右カラム: 結果 */}
          <div className="lg:col-span-2 space-y-4">
            {error && (
              <Card className="border-destructive">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">エラー</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {analyzing && (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">
                    定性情報を分析中です...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    テキスト量に応じて数十秒かかる場合があります
                  </p>
                </CardContent>
              </Card>
            )}

            {analysisResult && (
              <>
                {/* トークン使用量 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      トークン使用量
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">要約（Haiku）</p>
                        <p className="font-mono">
                          {analysisResult.token_usage.summarization.input.toLocaleString()} / {analysisResult.token_usage.summarization.output.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">分析（Sonnet）</p>
                        <p className="font-mono">
                          {analysisResult.token_usage.analysis.input.toLocaleString()} / {analysisResult.token_usage.analysis.output.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">合計</p>
                        <p className="font-mono font-semibold">
                          {analysisResult.token_usage.total.input.toLocaleString()} / {analysisResult.token_usage.total.output.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Badge variant="secondary">{analysisResult.source_count}件のソース</Badge>
                      <Badge variant="outline">{analysisResult.company_names.join(", ")}</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* 分析結果 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5" />
                          分析結果
                        </CardTitle>
                        <CardDescription>
                          {analysisTypes.find(t => t.id === analysisType)?.name}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadMarkdown}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        MDダウンロード
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                      <ReactMarkdown>{analysisResult.analysis}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {!analyzing && !analysisResult && !error && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">AI分析を開始</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    左側で企業とカテゴリを選択し、「AI分析を実行」ボタンを押すと
                    Claudeが有価証券報告書の定性情報を分析します。
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
