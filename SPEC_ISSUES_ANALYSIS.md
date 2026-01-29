# 4つの仕様問題の詳細分析と対応方針
**Date:** 2026-01-29
**Status:** 分析開始

---

## 概要

バグ3つを修正した後に対応すべき4つの仕様問題（構造的課題）について、詳細な分析と対応方針を示します。

| # | 問題 | 対応難度 | 所要時間 | 優先度 |
|---|------|--------|--------|--------|
| 1 | 日本ロジテム Revenue欠損 | 低 | 1-2日 | 高 |
| 2 | Concept階層構造 | 中 | 3-5日 | 中 |
| 3 | Unit正規化 | 低 | 1-2日 | 中 |
| 4 | Context集約 | 高 | 5-7日 | 低 |

**合計所要時間:** 10-16日（2-3週間）

---

## 仕様問題 #1: 日本ロジテム Revenue欠損

### 問題の内容

**現状:**
- 5社中1社（日本ロジテム）のRevenue（売上高）が全くない
- COGS（売上原価）のカバレッジが80%→20%に低下
- Gross Margin計算ができない企業が80%→100%になる

```sql
SELECT
    doc_id,
    COUNT(*) as total_facts,
    COUNT(CASE WHEN concept_name ILIKE '%Sales%' THEN 1 END) as sales_facts
FROM staging.fact
GROUP BY doc_id
ORDER BY doc_id;

-- Current Result:
-- S100LUF2: 1305, Sales=18
-- S100XBD2: 1610, Sales=0  ← 日本ロジテム (Missing!)
-- S100LCD2: 1555, Sales=15
-- S100A6Y2: 1523, Sales=12
-- S100C8U2: 1305, Sales=14
```

### 根本原因の仮説

1. **XBRL内にRevenue概念がない**
   - 日本ロジテムの業種がサービス業
   - 売上を別の名称で報告している可能性

2. **概念マッピングの不完全性**
   - "Net Sales"、"Operating Revenue" など複数の表現
   - EDINET独自の命名規則がある

3. **会計基準の違い**
   - JGAAP vs IFRS
   - 日本ロジテムが異なる基準を採用

### 対応方針

#### Step 1: 原因調査（1時間）
```bash
# XBRL ソースファイルを直接確認
unzip -l data/raw/edinet/S100XBD2_*.zip | grep -i "revenue\|sales\|income"

# XML内で "Revenue" "Sales" "Income" を検索
unzip -p data/raw/edinet/S100XBD2_*.zip | grep -i "revenue"
```

#### Step 2: 利用可能な指標の確認（2時間）
```sql
-- 日本ロジテムで何が取得できているか確認
SELECT DISTINCT concept_name
FROM staging.fact
WHERE doc_id = 'S100XBD2'
  AND (concept_name ILIKE '%Sales%'
    OR concept_name ILIKE '%Revenue%'
    OR concept_name ILIKE '%Income%'
    OR concept_name ILIKE '%Operating%')
ORDER BY concept_name;

-- Operating Income があれば、それで代替可能
SELECT concept_name, COUNT(*)
FROM staging.fact
WHERE doc_id = 'S100XBD2'
  AND concept_name ILIKE '%Operating%Income%'
GROUP BY concept_name;
```

#### Step 3: 対応方法の決定（1時間）

**オプションA: 別のRevenue概念を使う**
- 利点：正確なRevenue
- 欠点：時間がかかる、見つからない可能性
- 所要時間：2-3日

**オプションB: Operating Incomeで代替**
- 利点：すぐ実装可能
- 欠点：Gross Margin計算不可（ただし既にCOGS欠損で不可）
- 所要時間：1時間

**オプションC: セグメント別データを使う**
- 利点：より詳細な情報
- 欠点：複雑度増加
- 所要時間：3-5日

#### Step 4: 実装

**推奨:** オプションB（即座に実装）
```python
# parse_xbrl.py の Concept マッピング部分に追加

REVENUE_CONCEPTS = [
    "jppfs-*:NetSalesOrServiceRevenues",
    "jppfs-*:RevenueFromContractsWithCustomers",
    "jppfs-*:OperatingRevenue",
    "jppfs-*:SalesAndServiceRevenue",
    # 日本ロジテム用の追加マッピング
    "jppfs-*:GrossProfit",  # If no Revenue, try backwards from GP
]
```

**長期対応:** Phase 2 でXBRL詳細調査

### 期待される効果

✅ **短期（Phase 1）:**
- 日本ロジテムの売上高を別方法で取得
- または Operating Income で代替できることを文書化

✅ **長期（Phase 2）:**
- XBRL ソース実確認
- 完全なRevenue概念マッピング完成

### 実装リスク

**Low Risk:**
- セグメント別データは既に取得済み
- 最悪の場合、企業を除外して分析可能
- BFF層で対応可能（database変更不要）

---

## 仕様問題 #2: Concept階層構造

### 問題の内容

**現状:**
XBRL Conceptは複雑な階層関係を持つが、現在のDB設計では単純な1次元リスト

```
例: Total Assets
├─ Current Assets
│  ├─ Cash
│  ├─ Receivables
│  └─ Inventory
└─ Non-Current Assets
   ├─ Property, Plant & Equipment
   └─ Intangible Assets
```

**現在のDB:**
```sql
SELECT * FROM staging.fact WHERE concept_name LIKE '%Assets%'

concept_name: "CurrentAssets"          -- 親
concept_name: "CashAndCashEquivalents"  -- 子
concept_name: "TradeReceivables"        -- 子 (何の子か不明)

-- 親子関係が DB に記録されていない!
```

### 根本原因

1. **XBRL Taxonomy 非対応**
   - XBRL は Concept ごとに parent-child 関係を定義
   - 現在は「Conceptが何か」のみ保存
   - 「Conceptが何の親か」を保存していない

2. **DB設計の簡潔性重視**
   - 早期段階では単純化が必要だった
   - しかし、集計・分析には階層が必須

3. **集計ロジックの曖昧性**
   - Total Assets = CA + NCA？
   - 自動で正しく集計できない

### 影響範囲

```
分析精度への影響:

✅ 可能（子概念で直接分析）:
   - 現金分析: Cash
   - 売掛金分析: TradeReceivables

❌ 不正確（親概念で自動集計）:
   - 流動資産合計（子の合計が親と一致しない可能性）
   - 資産合計（遺漏の可能性）
   - 比率計算（分母が間違う）

実際の例:
TotalAssets = 1,000 (XBRL に直接記載)
CA + NCA = 950 (子 Concept の合計)
差分 = 50 (未分類? 計算誤差?)
```

### 対応方針

#### Step 1: Concept階層の抽出（3-4時間）

```python
# Arelle から Concept 親子関係を抽出
def extract_concept_taxonomy(xbrl_path):
    from arelle import Cntlr
    cntlr = Cntlr.Cntlr()
    model_xbrl = cntlr.modelManager.load(str(xbrl_path))

    concept_parents = {}
    for rel in model_xbrl.relationshipSet.modelRelationships:
        parent = rel.fromConcept
        child = rel.toConcept
        concept_parents[child.name] = parent.name

    return concept_parents
```

#### Step 2: DB スキーマ追加（2時間）

```sql
-- staging テーブルに親概念カラムを追加
ALTER TABLE staging.fact
ADD COLUMN parent_concept_name VARCHAR(500);

-- 親子マッピングテーブルを作成
CREATE TABLE staging.concept_hierarchy (
    doc_id VARCHAR(50),
    child_concept_name VARCHAR(500),
    parent_concept_name VARCHAR(500),
    hierarchy_level INT,
    PRIMARY KEY (doc_id, child_concept_name)
);
```

#### Step 3: 階層情報の入力（1-2日）

```python
# parse_xbrl.py に追加

def load_concept_hierarchy(conn, doc_id, concept_parents):
    """
    XBRL Taxonomy から抽出した親子関係をDB に保存
    """
    with conn.cursor() as cur:
        for child, parent in concept_parents.items():
            cur.execute("""
                INSERT INTO staging.concept_hierarchy
                    (doc_id, child_concept_name, parent_concept_name, hierarchy_level)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT DO NOTHING
            """, (doc_id, child, parent, 1))
```

#### Step 4: 集計ロジックの実装（2-3日）

```python
# core 層で、階層を使って正確に集計

def calculate_total_assets(fact_values, concept_hierarchy):
    """
    概念階層を使って、Total Assets を正確に計算
    """
    total_assets_children = get_children(
        "TotalAssets",
        concept_hierarchy
    )

    return sum(
        fact_values.get(child)
        for child in total_assets_children
        if child in fact_values
    )
```

### DB スキーマ変更

```sql
-- 最小変更案
ALTER TABLE staging.fact
ADD COLUMN parent_concept_name VARCHAR(500) DEFAULT NULL,
ADD COLUMN hierarchy_level SMALLINT DEFAULT 1;

-- インデックス
CREATE INDEX idx_parent_concept ON staging.fact(parent_concept_name);
```

### 期待される効果

✅ **短期（Phase 1）:**
- 親子関係を BFF 層で利用可能
- 集計エラー削減

✅ **長期（Phase 2）:**
- 階層的な分析UI構築
- ドリルダウン機能実装
- 自動集計検証

### 実装リスク

**Medium Risk:**
- DB スキーマ変更が必要
- 既存 staging.fact への列追加（マイグレーション必要）
- Arelle の taxonomy API 依存性

**リスク軽減:**
- 新カラムは DEFAULT NULL （既存データ互換）
- 段階的な移行可能

---

## 仕様問題 #3: Unit正規化

### 問題の内容

**現状:**
Financial facts には Unit（単位）が付属

```xml
<fact contextRef="..." unitRef="JPY" decimals="0">
    1000000  <!-- 1,000,000 JPY -->
</fact>

<fact contextRef="..." unitRef="USD" decimals="2">
    9500.00  <!-- 9,500 USD -->
</fact>
```

**現在の問題:**
```sql
SELECT DISTINCT unit_ref FROM staging.fact LIMIT 10;

結果:
"JPY"
"USD"
"EUR"
"pure"  -- 純粋な数（比率など）
"shares"  -- 株式数

-- これらを統一して保存する必要がある!
```

### 根本原因

1. **複数通貨の混在**
   - 国際企業は複数通貨で報告
   - 比較分析には通貨統一が必須

2. **非金銭単位の存在**
   - 「万株」「百万円」などの単位修飾子
   - 正規化ロジックがない

3. **小数点処理の曖昧性**
   - 1,000,000 (decimals=-6) = 1百万
   - 1 (decimals=-3) = 0.001 (誤解の可能性)

### 対応方針

#### Step 1: Unit の整理（2時間）

```sql
-- 現在のUnit分布を調査
SELECT unit_ref, COUNT(*) as count
FROM staging.fact
GROUP BY unit_ref
ORDER BY count DESC;

-- 結果の例:
-- JPY: 5,000 (99.9%)
-- USD: 10 (0.1%)
-- pure: 3 (<0.1%)
```

#### Step 2: 正規化ルール の定義（2時間）

```python
# src/lib/unit_normalizer.py

UNIT_MAPPING = {
    # 金銭単位
    "JPY": {"type": "currency", "to_base": 1, "symbol": "¥"},
    "USD": {"type": "currency", "to_base": 130, "symbol": "$"},  # JPY換算レート
    "EUR": {"type": "currency", "to_base": 140, "symbol": "€"},

    # 純粋な数
    "pure": {"type": "pure", "to_base": 1, "symbol": ""},
    "shares": {"type": "count", "to_base": 1, "symbol": "株"},

    # 修飾子（decimals で処理）
    "Myen": {"type": "currency", "to_base": 1000000, "symbol": "百万¥"},
}

def normalize_unit(unit_ref, value, decimals):
    """
    Unit と value を標準化

    例:
    1234567 (JPY, decimals=-3)
    → 1,234,567,000 JPY に統一
    """
    if unit_ref not in UNIT_MAPPING:
        return None, unit_ref, value

    unit_info = UNIT_MAPPING[unit_ref]

    # Decimal処理済みの value を、さらに単位で正規化
    normalized_value = value * unit_info["to_base"]

    return "JPY", "JPY", normalized_value  # すべてJPYに統一
```

#### Step 3: DB スキーマ変更（1時間）

```sql
-- Unit 正規化テーブル
CREATE TABLE core.unit_master (
    original_unit_ref VARCHAR(50) PRIMARY KEY,
    normalized_unit VARCHAR(20),      -- "JPY" に統一
    unit_type VARCHAR(20),             -- "currency", "pure", "count"
    conversion_factor DECIMAL(20, 6),  -- 変換係数
    display_symbol VARCHAR(10),        -- 表示用記号
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO core.unit_master VALUES
    ('JPY', 'JPY', 'currency', 1, '¥', NOW()),
    ('USD', 'JPY', 'currency', 130, '$', NOW()),  -- 2024年レート参考
    ('pure', 'pure', 'pure', 1, '', NOW());

-- staging.fact に正規化後の単位カラムを追加
ALTER TABLE staging.fact
ADD COLUMN unit_ref_normalized VARCHAR(20),
ADD COLUMN value_normalized DECIMAL(20, 6);
```

#### Step 4: 値の再計算（2時間）

```python
# load_staging_facts() 内で実行

def normalize_fact_values(facts, unit_master):
    for fact in facts:
        unit_info = unit_master.get(fact["unit_ref"])
        if unit_info:
            fact["unit_ref_normalized"] = unit_info["normalized_unit"]
            fact["value_normalized"] = (
                fact["value_numeric"] * unit_info["conversion_factor"]
            ) if fact["value_numeric"] else None
    return facts
```

### 期待される効果

✅ **短期（Phase 1）:**
- 全事実が同一通貨（JPY）で表現可能
- 企業間比較が容易

✅ **長期（Phase 2）:**
- 多通貨対応の基盤整備
- 為替レート自動更新機能

### 実装リスク

**Low Risk:**
- Unit 正規化は比較的単純
- USD/EUR は量が少ない（99.9% JPY）
- 既存データ互換性は保持可能

**注意:**
- 為替レートは定期更新が必要
- 歴史的レートの使用を検討

---

## 仕様問題 #4: Context集約

### 問題の内容

**現状:**
同じ内容の Context が複数回記載される

```sql
SELECT context_ref, period_type, period_end, COUNT(*) as fact_count
FROM staging.fact
GROUP BY context_ref, period_type, period_end
HAVING COUNT(*) > 1
ORDER BY fact_count DESC

結果:
context_ref: "NonConsolidated_FY2021_End"
  期間: 2021-03-31
  事実数: 50個 (5つの同じContext IDで重複)

context_ref: "Consolidated_FY2021_End"
  期間: 2021-03-31
  事実数: 80個 (重複)
```

### 根本原因

1. **複数の報告形式**
   - 連結・単体で同じPeriodが複数
   - セグメント別で同じ値が繰り返す

2. **Contextの過度な詳細化**
   - XBRL は Scenario ごとに Context を分割
   - "Consolidated vs NonConsolidated" が別Context
   - "Segment A vs Segment B" が別Context
   - 結果として同じ時点で数十個のContext

3. **正規化フェーズの不完全性**
   - staging → core への集約ロジックがない

### 具体例

```
XBRL ファイル:
├─ Context 1: Consolidated, FY2021-03-31, Segment All
├─ Context 2: Consolidated, FY2021-03-31, Segment A
├─ Context 3: Consolidated, FY2021-03-31, Segment B
├─ Context 4: NonConsolidated, FY2021-03-31
└─ Context 5: NonConsolidated, FY2021-03-31, Segment All

全部で5つのContextで同じ時点の財務データが繰り返す

問題:
- Total Sales を計算: Context 1 の値を使う？
- または Context 2 + 3 を足す？（二重計算リスク）
- Context 4 との関係は？
```

### 対応方針

#### Step 1: Context重複パターンの分析（3時間）

```sql
-- Contextの重複パターンを特定
SELECT
    doc_id,
    period_type,
    period_end,
    is_consolidated,
    COUNT(DISTINCT context_ref) as unique_contexts,
    COUNT(*) as total_facts
FROM staging.context
GROUP BY doc_id, period_type, period_end, is_consolidated
HAVING COUNT(DISTINCT context_ref) > 1
ORDER BY total_facts DESC;

-- セグメント別Context の検出
SELECT context_ref, dimensions
FROM staging.context
WHERE dimensions::text ILIKE '%segment%'
LIMIT 10;
```

#### Step 2: Concept重複の検出（2時間）

```sql
-- 同じConceptが複数Contextで記載されているか確認
SELECT
    concept_qname,
    COUNT(DISTINCT context_id) as context_count,
    COUNT(*) as fact_count
FROM staging.fact
GROUP BY concept_qname
HAVING COUNT(DISTINCT context_id) > 1
ORDER BY fact_count DESC
LIMIT 20;
```

#### Step 3: 集約ルール の定義（4-5時間）

```python
# src/lib/context_aggregator.py

class ContextAggregator:
    """
    複数のContext を集約するルール
    """

    @staticmethod
    def aggregate_to_core(staging_facts, staging_contexts):
        """
        Staging から Core への変換時に、Context を集約

        Rules:
        1. is_consolidated = True を優先
        2. Segment = "All" または最上位を選択
        3. 複数候補がある場合、エラーログ & 最初のものを使用
        """
        core_facts = []
        grouped = defaultdict(list)

        # (doc_id, concept, period_end) でグループ化
        for fact in staging_facts:
            key = (
                fact["doc_id"],
                fact["concept_qname"],
                fact["context_id"]  # Context情報
            )
            grouped[key].append(fact)

        for (doc_id, concept, context_id), facts in grouped.items():
            # 複数のContext から 1つを選択
            selected = ContextAggregator.select_canonical_context(
                facts,
                staging_contexts
            )
            core_facts.append(selected)

        return core_facts

    @staticmethod
    def select_canonical_context(facts, contexts_map):
        """
        複数の事実から「正式な」ものを選択
        """
        # Priority:
        # 1. is_consolidated = True
        # 2. Segment = "All"
        # 3. 最初のもの

        # is_consolidated = True のものだけを抽出
        consolidated = [
            f for f in facts
            if contexts_map[f["context_id"]]["is_consolidated"] == True
        ]

        if consolidated:
            # さらに Segment = All を優先
            all_segment = [
                f for f in consolidated
                if "All" in str(contexts_map[f["context_id"]].get("dimensions", ""))
            ]
            return all_segment[0] if all_segment else consolidated[0]

        return facts[0]  # デフォルト
```

#### Step 4: Core層への移行（2-3日）

```sql
-- core.fact テーブルに、Context情報を最小限に保持
CREATE TABLE core.financial_fact (
    doc_id VARCHAR(50),
    concept_qname VARCHAR(500),
    context_id INT,              -- staging.context への外部キー
    period_end DATE,             -- denormalize for easy query
    is_consolidated BOOLEAN,     -- denormalize for easy query
    value_numeric DECIMAL(20, 6),
    value_text VARCHAR(1000),
    unit_ref_normalized VARCHAR(20),
    created_at TIMESTAMP,

    PRIMARY KEY (doc_id, concept_qname, context_id),
    FOREIGN KEY (context_id) REFERENCES staging.context(id)
);

-- 集約ロジック実行
INSERT INTO core.financial_fact
SELECT
    sf.doc_id,
    sf.concept_qname,
    sf.context_id,
    sc.period_end,
    sc.is_consolidated,
    sf.value_numeric,
    sf.value_text,
    sf.unit_ref_normalized,
    NOW()
FROM staging.fact sf
JOIN staging.context sc ON sf.context_id = sc.id
WHERE sf.doc_id = 'S100LUF2';  -- 1社ずつ処理
```

### データの重複排除プロセス

```
Staging (複数Context):
  Revenue (Consolidated, All Segment) = 100,000
  Revenue (Consolidated, Segment A) = 60,000
  Revenue (Consolidated, Segment B) = 40,000
        ↓
  集約ルール適用:
  - Consolidated = True を選択
  - Segment = All を選択
        ↓
Core (1つに集約):
  Revenue = 100,000 ✅
```

### 期待される効果

✅ **短期（Phase 1）:**
- 重複排除による品質向上
- Core 層でのクリーンなデータ

✅ **長期（Phase 2）:**
- セグメント別分析の基盤整備
- Drill-down 機能実装

### 実装リスク

**High Risk:**
- 複雑な集約ロジック
- データ損失の可能性（不適切な選択）
- Context の詳細情報が失われる

**リスク軽減:**
- staging 層は保持（いつでも詳細に戻れる）
- 集約ルールをテーブルに記録
- 監査ログで追跡可能

---

## 実装順序と依存関係

```
Issue #1: Revenue欠損
├─ 難度: 低
├─ 所要時間: 1-2日
├─ 依存: なし
└─ 優先度: 高 ✅ FIRST

Issue #3: Unit正規化
├─ 難度: 低
├─ 所要時間: 1-2日
├─ 依存: Issue #1 の後が推奨（データクリーン化）
└─ 優先度: 中 ✅ SECOND

Issue #2: Concept階層構造
├─ 難度: 中
├─ 所要時間: 3-5日
├─ 依存: Issue #3 の後（基本構造整備）
└─ 優先度: 中 ✅ THIRD

Issue #4: Context集約
├─ 難度: 高
├─ 所要時間: 5-7日
├─ 依存: Issue #1, #2, #3 の完了後
└─ 優先度: 低 ⏳ LAST
```

**推奨スケジュール:**
- Week 1: Issue #1, #3
- Week 2: Issue #2
- Week 3: Issue #4 (or defer to Phase 2)

---

## 各Issue の詳細ドキュメント

各Issue については、別途以下のドキュメントで詳細な実装手順を提供します：

- [SPEC_ISSUE_1_REVENUE.md](./SPEC_ISSUE_1_REVENUE.md)
- [SPEC_ISSUE_2_CONCEPTS.md](./SPEC_ISSUE_2_CONCEPTS.md)
- [SPEC_ISSUE_3_UNITS.md](./SPEC_ISSUE_3_UNITS.md)
- [SPEC_ISSUE_4_CONTEXTS.md](./SPEC_ISSUE_4_CONTEXTS.md)

---

**Status:** 分析完了、実装開始準備完了
