"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type {
  QualitativeSummaryResponse,
  QualitativeDetailResponse,
  SearchResponse,
  AnalysisCategoriesResponse,
  DashboardResponse,
} from "@/lib/types"

/**
 * ダッシュボード統計を取得するフック
 */
export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => apiClient.getDashboard(),
    staleTime: 2 * 60 * 1000, // 2分間はstaleとみなさない
    refetchInterval: 5 * 60 * 1000, // 5分ごとに自動更新
  })
}

/**
 * 定性情報サマリーを取得するフック
 */
export function useQualitativeSummary(docId: string | null, priority = "A") {
  return useQuery({
    queryKey: queryKeys.qualitative.summary(docId || "", priority),
    queryFn: () => apiClient.getQualitativeSummary(docId!, priority),
    enabled: !!docId,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * 定性情報詳細を取得するフック
 */
export function useQualitativeDetail(
  docId: string | null,
  categoryCode: string | null
) {
  return useQuery({
    queryKey: queryKeys.qualitative.detail(docId || "", categoryCode || ""),
    queryFn: () => apiClient.getQualitativeDetail(docId!, categoryCode!),
    enabled: !!docId && !!categoryCode,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * 定性情報検索フック
 */
export function useQualitativeSearch(
  query: string,
  options: {
    docIds?: string[]
    categoryCodes?: string[]
    limit?: number
    enabled?: boolean
  } = {}
) {
  const { docIds, categoryCodes, limit = 50, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.analysis.search(query, { docIds, categoryCodes, limit }),
    queryFn: () =>
      apiClient.searchQualitative(query, docIds, categoryCodes, limit),
    enabled: enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 分析カテゴリ一覧を取得するフック
 */
export function useAnalysisCategories() {
  return useQuery({
    queryKey: queryKeys.analysis.categories(),
    queryFn: () => apiClient.getAnalysisCategories(),
    staleTime: 60 * 60 * 1000, // 1時間
    gcTime: 24 * 60 * 60 * 1000, // 24時間
  })
}

/**
 * 定性情報をプリフェッチ
 */
export function usePrefetchQualitative() {
  const queryClient = useQueryClient()

  return (docId: string, priority = "A") => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.qualitative.summary(docId, priority),
      queryFn: () => apiClient.getQualitativeSummary(docId, priority),
      staleTime: 10 * 60 * 1000,
    })
  }
}

/**
 * ダッシュボードをプリフェッチ
 */
export function usePrefetchDashboard() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.stats(),
      queryFn: () => apiClient.getDashboard(),
      staleTime: 2 * 60 * 1000,
    })
  }
}
