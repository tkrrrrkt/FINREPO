/**
 * React Query Keys - クエリキー一元管理
 *
 * 一貫したキャッシュキー管理のためのファクトリー関数
 */

export const queryKeys = {
  // 企業関連
  companies: {
    all: ['companies'] as const,
    list: () => [...queryKeys.companies.all, 'list'] as const,
    detail: (docId: string) => [...queryKeys.companies.all, 'detail', docId] as const,
    periods: (docId: string) => [...queryKeys.companies.all, 'periods', docId] as const,
  },

  // 業種関連
  industries: {
    all: ['industries'] as const,
    list: () => [...queryKeys.industries.all, 'list'] as const,
  },

  // 財務諸表関連
  financials: {
    all: ['financials'] as const,
    summary: (docId: string) => [...queryKeys.financials.all, 'summary', docId] as const,
    bs: (docId: string, period?: string, consolidated?: boolean) =>
      [...queryKeys.financials.all, 'bs', docId, { period, consolidated }] as const,
    pl: (docId: string, period?: string, consolidated?: boolean) =>
      [...queryKeys.financials.all, 'pl', docId, { period, consolidated }] as const,
    cf: (docId: string, period?: string, consolidated?: boolean) =>
      [...queryKeys.financials.all, 'cf', docId, { period, consolidated }] as const,
    metrics: (docId: string) => [...queryKeys.financials.all, 'metrics', docId] as const,
    timeseries: (docId: string, consolidated?: string) =>
      [...queryKeys.financials.all, 'timeseries', docId, { consolidated }] as const,
  },

  // 比較・ランキング関連
  compare: {
    all: ['compare'] as const,
    companies: (docIds: string[]) => [...queryKeys.compare.all, 'companies', docIds.sort().join(',')] as const,
    ranking: (metric: string, options?: { limit?: number; order?: string; fiscalYear?: number; industryCode?: string }) =>
      [...queryKeys.compare.all, 'ranking', metric, options] as const,
  },

  // 定性情報関連
  qualitative: {
    all: ['qualitative'] as const,
    summary: (docId: string, priority?: string) =>
      [...queryKeys.qualitative.all, 'summary', docId, { priority }] as const,
    detail: (docId: string, categoryCode: string) =>
      [...queryKeys.qualitative.all, 'detail', docId, categoryCode] as const,
  },

  // 分析関連
  analysis: {
    all: ['analysis'] as const,
    search: (query: string, options?: { docIds?: string[]; categoryCodes?: string[]; limit?: number }) =>
      [...queryKeys.analysis.all, 'search', query, options] as const,
    categories: () => [...queryKeys.analysis.all, 'categories'] as const,
  },

  // ダッシュボード関連
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
  },
} as const

// 型エクスポート
export type QueryKeys = typeof queryKeys
