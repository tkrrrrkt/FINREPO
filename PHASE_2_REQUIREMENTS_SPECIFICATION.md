# Phase 2 要件定義書

**Date:** 2026-01-30
**Status:** ✅ 要件定義フェーズ
**Previous Phase:** Phase 1 MVP 完成
**Next Milestone:** Phase 2 実装開始

---

## 📋 目次

1. [概要](#概要)
2. [Issue #4: Context 集約（優先度：高）](#issue-4-context-集約優先度高)
3. [為替レート動的化（優先度：中）](#為替レート動的化優先度中)
4. [複数期間データ対応（優先度：中）](#複数期間データ対応優先度中)
5. [BFF REST API 実装（優先度：中）](#bff-rest-api-実装優先度中)
6. [実装スケジュール](#実装スケジュール)
7. [依存関係と前提条件](#依存関係と前提条件)
8. [リスク管理](#リスク管理)

---

## 概要

### Phase 2 の目的

Phase 1 で実装された以下の機能を拡張し、本番運用に向けた基盤を整備する：

```
Phase 1: ✅ 単位正規化 + 概念階層抽出 + Revenue マッピング
Phase 2: ➜ Context 集約 + 為替動的化 + 複数期間 + BFF API
```

### 主要イニシアティブ（優先度順）

| # | イニシアティブ | 優先度 | 難度 | 工数(時間) | 前提 |
|---|---|---|---|---|---|
| 4 | Context 集約 | 🔴 高 | 高 | 12-16 | Unit✅, Hierarchy✅ |
| 5 | 為替レート動的化 | 🟡 中 | 低 | 4-6 | Unit✅ |
| 6 | 複数期間データ | 🟡 中 | 低 | 3-4 | Context✅ |
| 7 | BFF REST API | 🟡 中 | 中 | 10-15 | 全て✅ |

---

## Issue #4: Context 集約（優先度：高）

### 🎯 問題説明

**現状:**
```
各ファクト（fact）に関連付けられたContextが、複数の次元で複雑に組み合わさっている
- Context: 報告単位（企業全体、セグメント、子会社など）
- Context値: 同一指標が複数のContextで報告される
```

**具体例:**
```
売上高（Revenue）が以下のContextで報告される可能性
1. jppfs_cor:NonConsolidatedMember  （単体ベース）
2. jppfs_cor:ConsolidatedMember      （連結ベース）
3. jppfs_cor:DomesticSegment         （国内セグメント）
4. jppfs_cor:OverseaSegment          （海外セグメント）
5. 複合的な次元の組み合わせ
```

**影響:**
- BS/PL 比較分析時に、どのContextを使うべきか不明確
- 連結 vs 単体の明確な区別がない
- 複数Context で同じ指標が報告されると、集計時に重複カウントリスク

### 📊 要件定義

#### 1. Context マスター作成

**目的:** XBRL Context の多次元性を整理し、統一ルールで集約

**構成:**
```
Context Master テーブル
├─ context_id (PK)
├─ context_label (XBRL定義の名前)
├─ context_type  ('consolidated', 'standalone', 'segment', etc.)
├─ consolidation_status ('consolidated', 'unconsolidated', 'unknown')
├─ segment_type ('domestic', 'overseas', 'business_line', 'none')
├─ reporting_period_start
├─ reporting_period_end
├─ priority (集約時の優先度)
└─ created_at, updated_at
```

**例:**
```sql
INSERT INTO core.context_master VALUES (
  'jppfs_cor:ConsolidatedMember_DomesticSegment',
  'ConsolidatedMember_DomesticSegment',
  'segment',
  'consolidated',
  'domestic',
  '2021-01-01',
  '2021-03-31',
  100
);
```

#### 2. Fact → Context マッピング

**目的:** 各ファクトに対して、優先度付きの複数Contextを記録

**実装:**
```sql
CREATE TABLE staging.fact_context_map (
  fact_id INT,
  context_id VARCHAR(255),
  primary_context BOOLEAN DEFAULT false,  -- 主要Context
  priority INT,
  created_at TIMESTAMP
);
```

**ロジック:**
1. ファクトごとに関連するすべてのContextを抽出
2. 優先度ルールを適用：
   - `consolidated > unconsolidated`
   - `no_segment > segment`
   - `parent_company > subsidiary`
3. 各ファクトに対して `primary_context = true` のContextを1つ選定

#### 3. Context 集約ルール

**優先度テーブル:**
```
レベル 1（最優先）: 連結+全社  (consolidated, no segment)
レベル 2: 連結+セグメント      (consolidated + segment)
レベル 3: 単体+全社            (standalone, no segment)
レベル 4（最低）: その他
```

**実装コード（イメージ）:**
```python
class ContextAggregator:
    PRIORITY_RULES = [
        {
            'consolidation': 'consolidated',
            'segment': 'none',
            'priority': 100
        },
        {
            'consolidation': 'consolidated',
            'segment': 'any',
            'priority': 80
        },
        # ...
    ]

    def select_primary_context(self, fact_contexts):
        """ファクトに対する最適なContextを選択"""
        for rule in self.PRIORITY_RULES:
            matches = self.match_rule(fact_contexts, rule)
            if matches:
                return matches[0]
        return fact_contexts[0]
```

### 🛠️ 実装手順

#### Step 1: Context データ分析（1-2時間）
```bash
# 既存Context の統計情報を取得
SELECT context_label, COUNT(*) as fact_count
FROM staging.context
GROUP BY context_label
ORDER BY fact_count DESC
LIMIT 50;
```

**出力例:**
```
context_label                                    fact_count
CurrentContextDuration=P1Y/ConsolidatedMember    1,240
CurrentContextDuration=P1Y/NonConsolidatedMember  890
[DomesticSegment]                                 234
```

#### Step 2: Context マスター設計（2-3時間）
- Consolidation status の判定ロジック確定
- Segment type の分類ルール確定
- Priority 値の決定

#### Step 3: SQL テーブル作成（1時間）
```sql
-- core.context_master テーブル作成
-- インデックス作成
-- サンプルデータ投入
```

#### Step 4: マッピング実装（3-4時間）
```python
# src/lib/context_aggregator.py 新規作成
class ContextAggregator:
    def __init__(self, model_xbrl):
        self.contexts = model_xbrl.contexts
        self.rules = self.load_rules()

    def aggregate_facts(self, facts):
        """全ファクトのContextを集約"""
        pass
```

#### Step 5: テスト作成（2-3時間）
```python
# test/unit/test_context_aggregator.py
# - Context 分析
# - Priority ルール検証
# - マッピング精度テスト
```

### 📋 受け入れ条件

```
✅ Context Master に 500+ のユニーク Context を登録
✅ すべてのファクト（7,677件）に primary_context を割り当て
✅ Consolidation status の判定精度 > 95%
✅ テスト: 30個以上、100% PASS
✅ ドキュメント完備
```

---

## 為替レート動的化（優先度：中）

### 🎯 問題説明

**現状:**
```
USD = 145倍（固定）
EUR = 155倍（固定）
```

**問題:**
- 2024年度と現在の為替レート変動を反映できない
- 過去データの正確性が低い
- 複数年データ取得時に困難

### 📊 要件定義

#### 1. 為替レート API 統合

**候補 API:**
1. **Fixer.io** (推奨)
   - 長期履歴データ対応
   - 日本企業向けJPY対応
   - 無料枠: 100/month

2. **OpenExchangeRates**
   - 信頼性高い
   - 複数通貨対応

3. **ECB (European Central Bank)**
   - 公式データ
   - 無料で利用可能

**選定:** Fixer.io（JGAAP企業向け）

#### 2. DB スキーマ設計

```sql
CREATE TABLE core.exchange_rate_history (
  rate_id SERIAL PRIMARY KEY,
  base_currency VARCHAR(3),           -- JPY
  target_currency VARCHAR(3),         -- USD, EUR
  rate DECIMAL(10, 6),                -- 145.50
  effective_date DATE,                -- 2021-03-31
  source VARCHAR(50),                 -- 'fixer.io', 'manual'
  confidence_level VARCHAR(20),       -- 'high', 'medium', 'low'
  created_at TIMESTAMP
);

CREATE INDEX idx_exchange_rate_date
ON core.exchange_rate_history(effective_date, base_currency, target_currency);
```

#### 3. 更新メカニズム

**毎日自動更新:**
```python
class ExchangeRateUpdater:
    def fetch_daily_rates(self, api_key: str):
        """Fixer.io から本日の為替レートを取得"""
        response = requests.get(
            'https://api.fixer.io/latest',
            params={
                'access_key': api_key,
                'base': 'JPY',
                'symbols': 'USD,EUR'
            }
        )
        return response.json()

    def insert_rates(self, rates_data):
        """DBに挿入"""
        pass
```

#### 4. Unit 正規化の更新

```python
# src/lib/unit_normalizer.py を拡張
class DynamicUnitNormalizer(UnitNormalizer):
    def __init__(self, db_connection):
        super().__init__()
        self.db = db_connection

    def normalize_with_date(
        self,
        unit_ref: str,
        value: Decimal,
        effective_date: date
    ) -> Tuple[str, Decimal]:
        """指定日付の為替レートを使用して正規化"""
        if unit_ref == 'USD':
            rate = self.db.get_rate('USD', effective_date)
            return 'JPY', value * Decimal(str(rate))
        # ...
```

### 📋 受け入れ条件

```
✅ Fixer.io API キー設定完了
✅ exchange_rate_history テーブル作成
✅ 過去3年分のレート履歴を取得・登録
✅ DynamicUnitNormalizer 実装＆テスト
✅ API 呼び出し失敗時の fallback ロジック実装
```

---

## 複数期間データ対応（優先度：中）

### 🎯 問題説明

**現状:** FY 2021 のみ（2021-03-31）

**目標:** FY 2020, 2022 を追加（トレンド分析可能に）

### 📊 要件定義

#### 1. データ収集計画

```
対象会計期間:
├─ FY 2020 (2020-03-31)
├─ FY 2021 (2021-03-31)  ✅ 既存
└─ FY 2022 (2022-03-31)

データ取得方法:
├─ EDINET API で document list 取得
├─ 対象会社別に SEC ID で検索
└─ Zip ファイル一括ダウンロード
```

#### 2. DB スキーマ拡張

```sql
-- staging.fact に fiscal_year カラムを追加（必要に応じて）
ALTER TABLE staging.fact
ADD COLUMN fiscal_year_end DATE;

-- Period Master テーブル作成
CREATE TABLE core.fiscal_period_master (
  period_id SERIAL PRIMARY KEY,
  fiscal_year INT,                    -- 2020, 2021, 2022
  period_start_date DATE,             -- 2020-04-01
  period_end_date DATE,               -- 2021-03-31
  company_id INT,
  created_at TIMESTAMP
);
```

#### 3. データローダー拡張

```python
# src/edinet/load_core.py を拡張
class MultiYearDataLoader:
    FISCAL_YEARS = [2020, 2021, 2022]

    def fetch_all_years(self, company_sec_ids):
        """全会計年度のデータを取得"""
        for year in self.FISCAL_YEARS:
            for sec_id in company_sec_ids:
                self.fetch_and_load(sec_id, year)
```

### 📋 受け入れ条件

```
✅ FY 2020 のデータ: 5社すべて取得
✅ FY 2022 のデータ: 5社すべて取得
✅ staging.fact に 21,000+ 件のファクト（3年×7,677）
✅ Fiscal period master に 15 レコード
```

---

## BFF REST API 実装（優先度：中）

### 🎯 目的

Python バックエンド単体の実装を REST API 化し、フロントエンドから利用可能にする

### 📊 要件定義

#### 1. API エンドポイント設計

```
GET /api/v1/companies
  → 対象5社の一覧を返す
  Response: {
    companies: [
      {id: 1, sec_id: '30550', name: 'ほくやく・竹山HD'},
      ...
    ]
  }

GET /api/v1/companies/:id/balance-sheet
  → 指定企業のBS（バランスシート）を返す
  Query params: ?period=2021-03-31
  Response: {
    company: {...},
    balance_sheet: {
      assets: [...],
      liabilities: [...],
      equity: [...]
    }
  }

GET /api/v1/companies/:id/income-statement
  → 指定企業のPL（損益計算書）を返す

GET /api/v1/comparison
  → 複数企業の比較ビューを返す
  Query params: ?metrics=revenue,operating_income,net_income&period=2021-03-31

GET /api/v1/hierarchy/:concept
  → Concept の階層情報を返す
```

#### 2. 技術スタック

```
Framework: FastAPI (Python)  または  Express (Node.js)
Database: PostgreSQL (既存）
Cache: Redis (複雑クエリのキャッシング）
Auth: JWT Token (将来マルチテナント対応時）
```

#### 3. ファイル構成

```
src/
├─ bff/
│  ├─ __init__.py
│  ├─ main.py              # FastAPI アプリケーション
│  ├─ config.py
│  ├─ middleware/
│  │  ├─ auth.py
│  │  └─ cors.py
│  ├─ routes/
│  │  ├─ companies.py
│  │  ├─ financials.py
│  │  ├─ comparison.py
│  │  └─ hierarchy.py
│  ├─ services/
│  │  ├─ company_service.py
│  │  ├─ financial_service.py
│  │  └─ hierarchy_service.py
│  └─ schemas/
│     ├─ company.py
│     ├─ financial.py
│     └─ response.py
```

#### 4. 実装例

```python
# src/bff/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FINREPO BFF API", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/companies")
async def list_companies():
    """5社の一覧を取得"""
    service = CompanyService()
    return service.get_all_companies()

@app.get("/api/v1/companies/{company_id}/balance-sheet")
async def get_balance_sheet(company_id: int, period: str):
    """バランスシートを取得"""
    service = FinancialService()
    return service.get_balance_sheet(company_id, period)
```

### 📋 受け入れ条件

```
✅ 5つの REST エンドポイント実装完了
✅ 全エンドポイントにテスト実装（pytest + httpx）
✅ Swagger ドキュメント自動生成
✅ パフォーマンス: レスポンス < 500ms
✅ エラーハンドリング実装
```

---

## 実装スケジュール

### Week 1-2: Issue #4 (Context 集約)

```
Day 1-2: Context 分析 & マスター設計
Day 3-4: SQL テーブル実装 & Python モジュール実装
Day 5: テスト作成 & 検証
Deliverable: context_aggregator.py, 30+ tests, 完了報告書
```

### Week 3: 為替レート動的化

```
Day 1-2: API 統合 & DB スキーマ
Day 3-4: DynamicUnitNormalizer 実装
Day 5: テスト & ドキュメント
Deliverable: exchange_rate_history table, API統合完了
```

### Week 4: 複数期間データ + BFF API

```
Day 1-2: 複数期間データ取得・ロード
Day 3-5: BFF REST API 実装
Deliverable: 21,000+ facts, 5 API endpoints, tests
```

---

## 依存関係と前提条件

### 前提条件（Phase 1）

```
✅ Unit 正規化完了
✅ Concept 階層抽出完了
✅ Revenue マッピング完了
✅ DB スキーマ設計完了
✅ テストフレームワーク構築完了
```

### 外部依存

```
- Fixer.io API キー（為替レート取得用）
- PostgreSQL >= 12
- Python >= 3.9
- FastAPI >= 0.95
```

---

## リスク管理

### 🔴 高リスク

| リスク | 影響 | 対策 |
|------|------|------|
| Context 複雑性が予想超過 | Issue #4の工数超過 | 早期のデータ分析+仕様確定 |
| XBRL Taxonomy の多様性 | マッピングルール失敗 | テストケース充実化 |

### 🟡 中リスク

| リスク | 影響 | 対策 |
|------|------|------|
| 為替レート API 仕様変更 | BFF API に影響 | Wrapper パターンで対応 |
| パフォーマンス低下 | User Experience 悪化 | キャッシング戦略導入 |

### 🟢 低リスク

| リスク | 影響 | 対策 |
|------|------|------|
| マイナーな API 破壊 | 再テスト必要 | バージョニング戦略 |

---

## 成功指標

```
✅ Issue #4: Context 集約が 95%+ の精度で実装される
✅ 為替レート: 過去3年分のレート履歴が取得・保存される
✅ 複数期間: 21,000+ のファクトが正常に DB に格納される
✅ BFF API: 5つのエンドポイントが全テスト PASS
✅ パフォーマンス: REST API の平均レスポンス < 500ms
```

---

**Status:** ✅ 要件定義完了
**Next Step:** Issue #4 実装開始
**Last Updated:** 2026-01-30
