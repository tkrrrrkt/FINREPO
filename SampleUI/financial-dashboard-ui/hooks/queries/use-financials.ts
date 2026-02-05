"use client"

import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type {
  FinancialSummary,
  FinancialStatementResponse,
} from "@/lib/types"

type Period = "current" | "previous"

/**
 * 財務サマリーを取得するフック
 */
export function useFinancialSummary(docId: string | null) {
  return useQuery({
    queryKey: queryKeys.financials.summary(docId || ""),
    queryFn: () => apiClient.getFinancialSummary(docId!),
    enabled: !!docId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 貸借対照表を取得するフック
 */
export function useBalanceSheet(
  docId: string | null,
  period: Period = "current",
  consolidated = true
) {
  return useQuery({
    queryKey: queryKeys.financials.bs(docId || "", period, consolidated),
    queryFn: () => apiClient.getBalanceSheet(docId!, period, consolidated),
    enabled: !!docId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 損益計算書を取得するフック
 */
export function useIncomeStatement(
  docId: string | null,
  period: Period = "current",
  consolidated = true
) {
  return useQuery({
    queryKey: queryKeys.financials.pl(docId || "", period, consolidated),
    queryFn: () => apiClient.getIncomeStatement(docId!, period, consolidated),
    enabled: !!docId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * キャッシュフロー計算書を取得するフック
 */
export function useCashFlow(
  docId: string | null,
  period: Period = "current",
  consolidated = true
) {
  return useQuery({
    queryKey: queryKeys.financials.cf(docId || "", period, consolidated),
    queryFn: () => apiClient.getCashFlow(docId!, period, consolidated),
    enabled: !!docId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 全財務諸表を並列取得するフック
 */
export function useAllFinancialStatements(
  docId: string | null,
  period: Period = "current",
  consolidated = true
) {
  return useQueries({
    queries: [
      {
        queryKey: queryKeys.financials.bs(docId || "", period, consolidated),
        queryFn: () => apiClient.getBalanceSheet(docId!, period, consolidated),
        enabled: !!docId,
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: queryKeys.financials.pl(docId || "", period, consolidated),
        queryFn: () => apiClient.getIncomeStatement(docId!, period, consolidated),
        enabled: !!docId,
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: queryKeys.financials.cf(docId || "", period, consolidated),
        queryFn: () => apiClient.getCashFlow(docId!, period, consolidated),
        enabled: !!docId,
        staleTime: 5 * 60 * 1000,
      },
    ],
    combine: (results) => {
      return {
        balanceSheet: results[0].data,
        incomeStatement: results[1].data,
        cashFlow: results[2].data,
        isLoading: results.some((r) => r.isLoading),
        isError: results.some((r) => r.isError),
        errors: results.map((r) => r.error).filter(Boolean),
      }
    },
  })
}

/**
 * 財務サマリーをプリフェッチ
 */
export function usePrefetchFinancials() {
  const queryClient = useQueryClient()

  return (docId: string) => {
    // サマリーをプリフェッチ
    queryClient.prefetchQuery({
      queryKey: queryKeys.financials.summary(docId),
      queryFn: () => apiClient.getFinancialSummary(docId),
      staleTime: 5 * 60 * 1000,
    })

    // 各財務諸表もプリフェッチ
    queryClient.prefetchQuery({
      queryKey: queryKeys.financials.bs(docId, "current", true),
      queryFn: () => apiClient.getBalanceSheet(docId, "current", true),
      staleTime: 5 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: queryKeys.financials.pl(docId, "current", true),
      queryFn: () => apiClient.getIncomeStatement(docId, "current", true),
      staleTime: 5 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: queryKeys.financials.cf(docId, "current", true),
      queryFn: () => apiClient.getCashFlow(docId, "current", true),
      staleTime: 5 * 60 * 1000,
    })
  }
}

/**
 * 企業比較データを取得するフック
 */
export function useCompareCompanies(docIds: string[]) {
  return useQuery({
    queryKey: queryKeys.compare.companies(docIds),
    queryFn: () => apiClient.compareCompanies(docIds),
    enabled: docIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * ランキングデータを取得するフック
 */
export function useRanking(
  metric: string,
  options: {
    limit?: number
    ascending?: boolean
    fiscalYear?: number
    industryCode?: string
  } = {}
) {
  const { limit = 20, ascending = false, fiscalYear, industryCode } = options

  return useQuery({
    queryKey: queryKeys.compare.ranking(metric, {
      limit,
      order: ascending ? "asc" : "desc",
      fiscalYear,
      industryCode,
    }),
    queryFn: () =>
      apiClient.getRanking(metric, limit, ascending, fiscalYear, industryCode),
    staleTime: 5 * 60 * 1000,
  })
}
