/**
 * FINREPO APIクライアント
 * FastAPI バックエンドとの通信を担当
 */

import type {
  Company,
  CompaniesResponse,
  FinancialSummary,
  FinancialStatementResponse,
  RankingResponse,
  CompareResponse,
  QualitativeSummaryResponse,
  QualitativeDetailResponse,
  IndustriesResponse,
  SearchResponse,
  AnalysisRequest,
  AnalysisResponse,
  AnalysisCategoriesResponse,
  DashboardResponse,
} from './types';
import { APIError, ErrorCode, getErrorCodeFromStatus } from './error-handler';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * 汎用fetchメソッド
   */
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });
    } catch (err) {
      // ネットワークエラー
      if (err instanceof TypeError) {
        throw new APIError(ErrorCode.CONNECTION_REFUSED, undefined, { cause: err });
      }
      throw new APIError(ErrorCode.NETWORK_ERROR, undefined, { cause: err });
    }

    if (!response.ok) {
      // FastAPIのエラーレスポンスからdetailを取得
      let detail: string | undefined;
      try {
        const errorBody = await response.json();
        if (errorBody.detail) {
          detail = typeof errorBody.detail === 'string'
            ? errorBody.detail
            : JSON.stringify(errorBody.detail);
        }
      } catch {
        // JSONパース失敗時はdetailなし
      }

      const errorCode = getErrorCodeFromStatus(response.status);
      throw new APIError(errorCode, detail, {
        statusCode: response.status,
        detail,
      });
    }

    try {
      return await response.json();
    } catch (err) {
      throw new APIError(ErrorCode.PARSE_ERROR, undefined, { cause: err });
    }
  }

  // ==================== 企業関連 ====================

  /**
   * 企業一覧を取得
   */
  async getCompanies(): Promise<CompaniesResponse> {
    return this.fetch<CompaniesResponse>('/api/v1/companies');
  }

  /**
   * 企業詳細を取得
   */
  async getCompany(docId: string): Promise<Company> {
    return this.fetch<Company>(`/api/v1/companies/${docId}`);
  }

  /**
   * 業種一覧を取得
   */
  async getIndustries(): Promise<IndustriesResponse> {
    return this.fetch<IndustriesResponse>('/api/v1/companies/industries');
  }

  // ==================== 財務諸表関連 ====================

  /**
   * 財務サマリーを取得
   */
  async getFinancialSummary(docId: string): Promise<FinancialSummary> {
    return this.fetch<FinancialSummary>(`/api/v1/companies/${docId}/financials/summary`);
  }

  /**
   * 貸借対照表を取得
   */
  async getBalanceSheet(
    docId: string,
    period: 'current' | 'previous' = 'current',
    consolidated: boolean = true
  ): Promise<FinancialStatementResponse> {
    return this.fetch<FinancialStatementResponse>(
      `/api/v1/companies/${docId}/financials/bs?period=${period}&consolidated=${consolidated}`
    );
  }

  /**
   * 損益計算書を取得
   */
  async getIncomeStatement(
    docId: string,
    period: 'current' | 'previous' = 'current',
    consolidated: boolean = true
  ): Promise<FinancialStatementResponse> {
    return this.fetch<FinancialStatementResponse>(
      `/api/v1/companies/${docId}/financials/pl?period=${period}&consolidated=${consolidated}`
    );
  }

  /**
   * キャッシュフロー計算書を取得
   */
  async getCashFlow(
    docId: string,
    period: 'current' | 'previous' = 'current',
    consolidated: boolean = true
  ): Promise<FinancialStatementResponse> {
    return this.fetch<FinancialStatementResponse>(
      `/api/v1/companies/${docId}/financials/cf?period=${period}&consolidated=${consolidated}`
    );
  }

  /**
   * 企業比較データを取得
   */
  async compareCompanies(docIds: string[]): Promise<CompareResponse> {
    const docIdsParam = docIds.map(id => encodeURIComponent(id)).join(',');
    return this.fetch<CompareResponse>(`/api/v1/compare?doc_ids=${docIdsParam}`);
  }

  /**
   * ランキングデータを取得
   */
  async getRanking(
    metric: string,
    limit: number = 20,
    ascending: boolean = false,
    fiscalYear?: number,
    industryCode?: string
  ): Promise<RankingResponse> {
    const order = ascending ? 'asc' : 'desc';
    let url = `/api/v1/compare/ranking?metric=${metric}&limit=${limit}&order=${order}`;
    if (fiscalYear !== undefined) {
      url += `&fiscal_year=${fiscalYear}`;
    }
    if (industryCode !== undefined) {
      url += `&industry_code=${industryCode}`;
    }
    return this.fetch<RankingResponse>(url);
  }

  // ==================== 定性情報関連 ====================

  /**
   * 定性情報サマリーを取得
   */
  async getQualitativeSummary(
    docId: string,
    priority: string = 'A'
  ): Promise<QualitativeSummaryResponse> {
    return this.fetch<QualitativeSummaryResponse>(
      `/api/v1/companies/${docId}/qualitative/?priority=${priority}`
    );
  }

  /**
   * 定性情報詳細を取得
   */
  async getQualitativeDetail(
    docId: string,
    categoryCode: string
  ): Promise<QualitativeDetailResponse> {
    return this.fetch<QualitativeDetailResponse>(
      `/api/v1/companies/${docId}/qualitative/${categoryCode}`
    );
  }

  // ==================== AI分析関連 ====================

  /**
   * 定性情報を検索
   */
  async searchQualitative(
    query: string,
    docIds?: string[],
    categoryCodes?: string[],
    limit: number = 50
  ): Promise<SearchResponse> {
    let url = `/api/v1/analysis/search?query=${encodeURIComponent(query)}&limit=${limit}`;
    if (docIds && docIds.length > 0) {
      url += `&doc_ids=${docIds.join(',')}`;
    }
    if (categoryCodes && categoryCodes.length > 0) {
      url += `&category_codes=${categoryCodes.join(',')}`;
    }
    return this.fetch<SearchResponse>(url);
  }

  /**
   * 定性情報をAIで分析
   */
  async analyzeQualitative(request: AnalysisRequest): Promise<AnalysisResponse> {
    return this.fetch<AnalysisResponse>('/api/v1/analysis/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * 分析カテゴリ一覧を取得
   */
  async getAnalysisCategories(): Promise<AnalysisCategoriesResponse> {
    return this.fetch<AnalysisCategoriesResponse>('/api/v1/analysis/categories');
  }

  // ==================== ダッシュボード関連 ====================

  /**
   * ダッシュボード統計を取得
   */
  async getDashboard(): Promise<DashboardResponse> {
    return this.fetch<DashboardResponse>('/api/v1/dashboard');
  }
}

// シングルトンインスタンスをエクスポート
export const apiClient = new APIClient();

// クラスもエクスポート（カスタムインスタンス作成用）
export default APIClient;
