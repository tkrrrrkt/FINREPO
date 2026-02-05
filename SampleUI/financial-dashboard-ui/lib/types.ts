/**
 * FINREPO TypeScript型定義
 * FastAPI バックエンドのレスポンス型
 */

// 企業情報
export interface Company {
  doc_id: string;
  company_name: string;
  sec_code: string | null;
  edinet_code: string | null;
  submission_date: string | null;
  period_end: string | null;
  fiscal_year: number | null;
  accounting_standard: string | null;
  industry_code?: string | null;
  industry_name?: string | null;
}

// 企業一覧レスポンス
export interface CompaniesResponse {
  companies: Company[];
  total: number;
}

// 業種情報
export interface Industry {
  code: string;
  name: string;
}

// 業種一覧レスポンス
export interface IndustriesResponse {
  industries: Industry[];
  total: number;
}

// 財務諸表項目（階層対応）
export interface FinancialItem {
  label: string;
  value: number | null;
  indent_level: number;
  is_total: boolean;
  is_subtotal: boolean;
  section?: string;
}

// 財務サマリー
export interface FinancialSummary {
  doc_id: string;
  company_name: string;
  total_assets: number | null;
  total_liabilities: number | null;
  net_assets: number | null;
  revenue: number | null;
  operating_income: number | null;
  net_income: number | null;
  roe: number | null;
  roa?: number | null;
  operating_margin: number | null;
  equity_ratio: number | null;
}

// 財務諸表レスポンス
export interface FinancialStatementResponse {
  doc_id: string;
  statement_type: string;
  period: string;
  consolidated: boolean;
  items: FinancialItem[];
}

// ランキング項目
export interface RankingItem {
  company_name: string;
  sec_code: string | null;
  doc_id: string;
  value: number;
}

// ランキングレスポンス
export interface RankingResponse {
  ranking: RankingItem[];
  metric: string;
  limit: number;
  ascending: boolean;
}

// 企業比較レスポンス
export interface CompareResponse {
  companies: FinancialSummary[];
}

// 定性情報カテゴリ
export interface QualitativeCategory {
  category_code: string;
  category_name_ja: string;
  item_count: number;
  total_chars: number;
}

// 定性情報サマリーレスポンス
export interface QualitativeSummaryResponse {
  doc_id: string;
  company_name: string;
  categories: QualitativeCategory[];
}

// 定性情報詳細項目
export interface QualitativeItem {
  concept_name: string;
  text_content: string;
  text_length: number;
  consolidation_type?: string;
  period_category?: string;
}

// 定性情報詳細レスポンス
export interface QualitativeDetailResponse {
  doc_id: string;
  category_code: string;
  category_name_ja: string;
  total_items: number;
  items: QualitativeItem[];
}

// 指標キー
export type MetricKey =
  | 'total_assets'
  | 'total_equity'
  | 'revenue'
  | 'operating_income'
  | 'net_income'
  | 'roe'
  | 'roa'
  | 'equity_ratio';

// 指標ラベルマッピング
export const METRIC_LABELS: Record<MetricKey, string> = {
  total_assets: '総資産',
  total_equity: '純資産',
  revenue: '売上高',
  operating_income: '営業利益',
  net_income: '当期純利益',
  roe: 'ROE',
  roa: 'ROA',
  equity_ratio: '自己資本比率',
};

// 定性情報カテゴリコード
export type QualitativeCategoryCode =
  | 'BIZ_DESC'
  | 'MGMT_POLICY'
  | 'BIZ_RISK'
  | 'MDA'
  | 'RND'
  | 'CONTRACTS';

// カテゴリラベルマッピング
export const CATEGORY_LABELS: Record<QualitativeCategoryCode, string> = {
  BIZ_DESC: '事業の内容',
  MGMT_POLICY: '経営方針・戦略',
  BIZ_RISK: '事業等のリスク',
  MDA: '経営者による分析（MD&A）',
  RND: '研究開発活動',
  CONTRACTS: '重要な契約',
};

// ==================== AI分析関連 ====================

// 検索結果
export interface SearchResult {
  doc_id: string;
  company_name: string;
  category_code: string;
  category_name_ja: string;
  concept_name: string;
  text_content: string;
  text_length: number;
}

// 検索レスポンス
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

// 分析リクエスト
export interface AnalysisRequest {
  doc_ids: string[];
  category_codes?: string[];
  keywords?: string[];
  analysis_type: 'executive' | 'fpna' | 'risk';
  additional_context?: string;
}

// トークン使用量
export interface TokenUsage {
  input: number;
  output: number;
  model?: string;
}

// 分析トークン使用量
export interface AnalysisTokenUsage {
  summarization: TokenUsage;
  analysis: TokenUsage;
  total: TokenUsage;
}

// 分析レスポンス
export interface AnalysisResponse {
  analysis: string;
  model: string;
  token_usage: AnalysisTokenUsage;
  source_count: number;
  company_names: string[];
}

// 分析カテゴリ
export interface AnalysisCategory {
  category_code: string;
  category_name_ja: string;
  category_name_en: string;
  priority: string;
}

// 分析カテゴリレスポンス
export interface AnalysisCategoriesResponse {
  categories: AnalysisCategory[];
  total: number;
}

// ==================== ダッシュボード関連 ====================

// 最新の有価証券報告書
export interface RecentReport {
  doc_id: string;
  company_name: string;
  sec_code: string | null;
  submission_date: string | null;
  fiscal_year: number | null;
}

// 注目の変動企業
export interface NotableChange {
  company_name: string;
  sec_code: string | null;
  doc_id: string;
  current_value: number | null;
  previous_value: number | null;
  change: number | null;
  change_percent?: number | null;
}

// 業種別統計
export interface IndustryStats {
  industry_code: string;
  industry_name: string;
  company_count: number;
  avg_roe: number | null;
  avg_operating_margin: number | null;
}

// ダッシュボード統計
export interface DashboardStats {
  total_companies: number;
  total_documents: number;
  industry_count: number;
  fiscal_year_range: string;
  latest_submission_date: string | null;
}

// ダッシュボードレスポンス
export interface DashboardResponse {
  stats: DashboardStats;
  recent_reports: RecentReport[];
  roe_improvers: NotableChange[];
  roe_decliners: NotableChange[];
  industry_stats: IndustryStats[];
}
