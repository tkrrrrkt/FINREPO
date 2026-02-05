"use client"

import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { CompanySelector } from "@/components/company-selector"
import { FiscalYearSelector } from "@/components/fiscal-year-selector"
import { SummaryTab } from "@/components/financial-analysis/summary-tab"
import { BSTab } from "@/components/financial-analysis/bs-tab"
import { PLTab } from "@/components/financial-analysis/pl-tab"
import { CFTab } from "@/components/financial-analysis/cf-tab"
import { QualitativeTab } from "@/components/financial-analysis/qualitative-tab"
import {
  LayoutDashboard,
  Scale,
  Receipt,
  Banknote,
  FileText,
} from "lucide-react"
import { useCompany } from "@/contexts/company-context"

// 最近見た企業を保存
function saveRecentlyViewed(docId: string, companyName: string) {
  if (typeof window === "undefined") return
  try {
    const stored = localStorage.getItem("finrepo_recently_viewed")
    const items: { docId: string; companyName: string; viewedAt: string }[] = stored ? JSON.parse(stored) : []

    // 同じdocIdがあれば削除
    const filtered = items.filter((item) => item.docId !== docId)

    // 先頭に追加
    filtered.unshift({
      docId,
      companyName,
      viewedAt: new Date().toISOString(),
    })

    // 最大20件まで保持
    const limited = filtered.slice(0, 20)
    localStorage.setItem("finrepo_recently_viewed", JSON.stringify(limited))
  } catch (e) {
    console.error("Failed to save recently viewed:", e)
  }
}

export default function FinancialAnalysisPage() {
  const { selectedDocId, selectedCompany, selectedFiscalYear } = useCompany()

  // 閲覧履歴を保存
  React.useEffect(() => {
    if (selectedDocId && selectedCompany?.company_name) {
      saveRecentlyViewed(selectedDocId, selectedCompany.company_name)
    }
  }, [selectedDocId, selectedCompany?.company_name])

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "ホーム", href: "/" },
        { label: "財務諸表分析" },
      ]}
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">財務諸表分析</h1>
            <p className="text-muted-foreground mt-1">
              {selectedCompany
                ? `${selectedCompany.company_name}（${selectedCompany.sec_code || selectedCompany.edinet_code || selectedDocId}）の財務諸表を分析`
                : "企業を選択してください"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FiscalYearSelector compact />
            <CompanySelector className="w-[280px]" />
            {selectedFiscalYear && (
              <Badge variant="outline" className="w-fit tabular-nums">
                {selectedFiscalYear}年度
              </Badge>
            )}
            <Badge variant="secondary" className="w-fit">
              連結
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="summary" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">サマリー</span>
            </TabsTrigger>
            <TabsTrigger value="bs" className="gap-2">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">BS（貸借対照表）</span>
              <span className="sm:hidden">BS</span>
            </TabsTrigger>
            <TabsTrigger value="pl" className="gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">PL（損益計算書）</span>
              <span className="sm:hidden">PL</span>
            </TabsTrigger>
            <TabsTrigger value="cf" className="gap-2">
              <Banknote className="h-4 w-4" />
              <span className="hidden sm:inline">CF（キャッシュフロー）</span>
              <span className="sm:hidden">CF</span>
            </TabsTrigger>
            <TabsTrigger value="qualitative" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">定性情報</span>
              <span className="sm:hidden">定性</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <SummaryTab docId={selectedDocId} />
          </TabsContent>

          <TabsContent value="bs">
            <BSTab docId={selectedDocId} />
          </TabsContent>

          <TabsContent value="pl">
            <PLTab docId={selectedDocId} />
          </TabsContent>

          <TabsContent value="cf">
            <CFTab docId={selectedDocId} />
          </TabsContent>

          <TabsContent value="qualitative">
            <QualitativeTab docId={selectedDocId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
