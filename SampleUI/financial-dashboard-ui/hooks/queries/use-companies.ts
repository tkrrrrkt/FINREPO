"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type { Company, CompaniesResponse, IndustriesResponse } from "@/lib/types"

/**
 * 企業一覧を取得するフック
 */
export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies.list(),
    queryFn: () => apiClient.getCompanies(),
    staleTime: 5 * 60 * 1000, // 5分間はstaleとみなさない
    gcTime: 30 * 60 * 1000, // 30分間キャッシュを保持
  })
}

/**
 * 企業詳細を取得するフック
 */
export function useCompany(docId: string | null) {
  return useQuery({
    queryKey: queryKeys.companies.detail(docId || ""),
    queryFn: () => apiClient.getCompany(docId!),
    enabled: !!docId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 企業の期間情報を取得するフック
 */
export function useCompanyPeriods(docId: string | null) {
  return useQuery({
    queryKey: queryKeys.companies.periods(docId || ""),
    queryFn: async () => {
      const response = await fetch(`/api/v1/companies/${docId}/periods`)
      if (!response.ok) throw new Error("Failed to fetch periods")
      return response.json()
    },
    enabled: !!docId,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * 業種一覧を取得するフック
 */
export function useIndustries() {
  return useQuery({
    queryKey: queryKeys.industries.list(),
    queryFn: () => apiClient.getIndustries(),
    staleTime: 60 * 60 * 1000, // 1時間（ほぼ変わらないデータ）
    gcTime: 24 * 60 * 60 * 1000, // 24時間
  })
}

/**
 * 企業リストをプリフェッチ
 */
export function usePrefetchCompanies() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.companies.list(),
      queryFn: () => apiClient.getCompanies(),
      staleTime: 5 * 60 * 1000,
    })
  }
}

/**
 * 企業詳細をプリフェッチ
 */
export function usePrefetchCompany() {
  const queryClient = useQueryClient()

  return (docId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.companies.detail(docId),
      queryFn: () => apiClient.getCompany(docId),
      staleTime: 5 * 60 * 1000,
    })
  }
}

/**
 * 年度でフィルタされた企業リストを取得するセレクター
 */
export function useCompaniesByFiscalYear(fiscalYear: number | null) {
  const { data, ...rest } = useCompanies()

  const filteredCompanies = data?.companies.filter(
    (c) => fiscalYear === null || c.fiscal_year === fiscalYear
  )

  const fiscalYears = data?.companies
    ? [...new Set(data.companies.map((c) => c.fiscal_year))]
        .filter((y): y is number => y !== null)
        .sort((a, b) => b - a)
    : []

  return {
    ...rest,
    data: filteredCompanies,
    fiscalYears,
    total: filteredCompanies?.length ?? 0,
  }
}

/**
 * 業種でフィルタされた企業リストを取得するセレクター
 */
export function useCompaniesByIndustry(industryCode: string | null) {
  const { data, ...rest } = useCompanies()

  const filteredCompanies = data?.companies.filter(
    (c) => industryCode === null || c.industry_code === industryCode
  )

  return {
    ...rest,
    data: filteredCompanies,
    total: filteredCompanies?.length ?? 0,
  }
}

/**
 * 企業検索フック
 */
export function useSearchCompanies(query: string) {
  const { data, ...rest } = useCompanies()

  const searchResults = data?.companies.filter((c) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      c.company_name.toLowerCase().includes(q) ||
      c.sec_code?.includes(q) ||
      c.edinet_code?.toLowerCase().includes(q)
    )
  })

  return {
    ...rest,
    data: searchResults,
    total: searchResults?.length ?? 0,
  }
}
