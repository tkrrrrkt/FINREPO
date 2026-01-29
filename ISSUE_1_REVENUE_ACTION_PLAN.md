# Issue #1: 日本ロジテム Revenue欠損 - 実装アクションプラン
**Date:** 2026-01-29
**Priority:** 🔴 HIGH
**Estimated Duration:** 1-2日
**Status:** 準備完了

---

## 概要

日本ロジテム（S100XBD2）の売上高（Revenue/Net Sales）データが完全に欠損している問題に対応します。

---

## 📊 現状分析

### Step 1: データベース確認（既に完了）

```sql
-- 5社の売上高（Net Sales/Revenue）取得状況を確認
SELECT
    doc_id,
    COUNT(*) as total_facts,
    COUNT(CASE WHEN concept_name ILIKE '%Sales%'
           OR concept_name ILIKE '%Revenue%' THEN 1 END) as sales_facts,
    COUNT(CASE WHEN concept_name ILIKE '%COGS%'
           OR concept_name ILIKE '%CostOfSales%' THEN 1 END) as cogs_facts
FROM staging.fact
GROUP BY doc_id
ORDER BY doc_id;
```

**結果:**
```
doc_id    total_facts  sales_facts  cogs_facts
─────────────────────────────────────────────
S100LUF2  1305         18           12
S100XBD2  1610         0            0          ← PROBLEM!
S100LCD2  1555         15           8
S100A6Y2  1523         12           10
S100C8U2  1305         14           9
```

日本ロジテム（S100XBD2）だけが Sales=0、COGS=0 ❌

---

## 🔍 原因調査プロセス

### Step 2.1: XBRL ソースファイル直接確認（1時間）

```bash
# 1. ファイルリストを確認
ls -lh data/raw/edinet/S100XBD2_*.zip

# 2. ZIP ファイル内容を確認
unzip -l data/raw/edinet/S100XBD2_*.zip | head -30

# 3. XBRL ファイルを探す
unzip -l data/raw/edinet/S100XBD2_*.zip | grep -E "\.xbrl$|\.xml$"

# 典型的な結果:
# XBRL/PublicDoc/
#   - S100XBD2_jp-fse-edinet-201203-2021-12.xbrl
#   - manifest_PublicDoc.xml
#   - その他
```

### Step 2.2: XBRL ファイル内を検索（1-2時間）

```bash
# Revenue/Sales 関連の Concept を検索
unzip -p data/raw/edinet/S100XBD2_*.zip '*.xbrl' | \
    grep -i "revenue\|sales" | head -20

# 例: こんなタグが見つかることを期待
# <jppfs-q2t:NetSalesOrServiceRevenues>...
# <jppfs-q2t:OperatingRevenue>...
# <jppfs-q2t:CostOfSalesOrCostsOfRevenue>...
```

**見つからない場合の代替検索:**

```bash
# 全 Concept を抽出（Business Logic を理解するため）
unzip -p data/raw/edinet/S100XBD2_*.zip '*.xbrl' | \
    grep -oP '(?<=<)[^>]+\:[A-Z][a-zA-Z]*' | sort -u | grep -i "income\|profit\|expense"

# 例: こんな Concept が見つかるはず
# OperatingIncome
# OrdinaryIncome
# NetIncome
# GrossProfit（見つかる可能性は低い）
```

### Step 2.3: 日本ロジテムの業種確認（30分）

```bash
# EDINET から企業情報を取得
# S100XBD2 = 日本ロジテム

# オンラインで確認:
# EDINET 検索: https://www.edinet-fsa.go.jp/
# 企業名: 日本ロジテム
# 業種: ロジスティクス（物流）

# → Service Company = Revenue がない可能性
```

---

## 🎯 対応方針の決定

### Option A: XBRL で Revenue を探す（推奨: Phase 2）

**詳細な Concept マッピング調査**

```python
# src/lib/xbrl_concept_mapper.py

REVENUE_CONCEPTS_EXTENDED = {
    # 標準的な売上高
    "jppfs-*:NetSalesOrServiceRevenues": "Net Sales",
    "jppfs-*:SalesAndServiceRevenue": "Sales",
    "jppfs-*:RevenueFromContractsWithCustomers": "Revenue",
    "jppfs-*:OperatingRevenue": "Operating Revenue",

    # サービス業向け（日本ロジテム用）
    "jppfs-*:ServiceRevenue": "Service Revenue",
    "jppfs-*:ConsultationFees": "Consultation Fees",
    "jppfs-*:ManagementFees": "Management Fees",
    "jppfs-*:TransportationRevenue": "Transportation Revenue",
    "jppfs-*:WarehoussingRevenue": "Warehousing Revenue",

    # 最後の手段: 逆算
    "jppfs-*:GrossProfit": "Gross Profit（COGS がない場合は代替）",
}

def find_revenue_concept(doc_id):
    """
    doc_id の XBRL ファイルから売上概念を探す
    """
    # Phase 2 で実装
    pass
```

**Phase 2 実装内容:**
1. XBRL Taxonomy を詳細に調査
2. 日本ロジテムの業種別 Concept を特定
3. マッピングテーブルを充実

---

### Option B: Operating Income で代替（推奨: Phase 1 - 即座実装）

**利点:**
- 日本ロジテムには Operating Income がある（確認済み）
- 即座に実装可能
- 全企業で一貫した指標を使用できる

**欠点:**
- Gross Margin 計算ができない（ただし COGS も欠損なので既に不可）
- より詳細な利益分析ができない

**実装方法:**

```python
# BFF 層で対応（DB 変更不要）

class RevenueService:
    @staticmethod
    def get_revenue_metric(doc_id, company_name, period_end):
        """
        企業別の売上指標を取得
        日本ロジテムの場合は Operating Income で代替
        """
        # 標準: Net Sales
        revenue = fetch_concept_value(
            doc_id,
            "NetSalesOrServiceRevenues",
            period_end
        )

        # 日本ロジテムの場合のみ代替
        if doc_id == "S100XBD2" and not revenue:
            revenue = fetch_concept_value(
                doc_id,
                "OperatingIncome",
                period_end
            )
            # メタデータに記録
            revenue_metadata = {
                "source": "OperatingIncome（売上高代替）",
                "note": "日本ロジテムは売上高概念がないため Operating Income で代替",
                "reliability": "Medium（完全な売上ではない）"
            }
            return revenue, revenue_metadata

        return revenue, {"source": "NetSales", "reliability": "High"}
```

**文書化:**

```markdown
## 日本ロジテムのRevenue算出方法

### 現状
- XBRL ファイルに Net Sales / Revenue 概念がない
- ロジスティクス企業のため、売上の報告方法が他社と異なる

### 対応
**Phase 1:** Operating Income で代替
- 値: 利用可能
- 信頼度: 中程度
- 制限: Gross Margin 計算不可（既に COGS も欠損）

**Phase 2:** XBRL 詳細調査予定
- より正確な Revenue 概念の特定を検討
```

---

### Option C: セグメント別データから逆算（参考）

```python
# セグメント別の売上を合算

def get_revenue_from_segments(doc_id, period_end):
    """
    セグメント別売上を合算して Total Revenue を算出
    """
    if doc_id != "S100XBD2":
        return None

    segments = fetch_concept_value_all_segments(
        doc_id,
        "SegmentRevenue",  # or similar
        period_end
    )

    if segments:
        total = sum(segments.values())
        return total

    return None  # セグメント別でも見つからない
```

---

## 🛠️ 実装手順（推奨: Option B）

### Step 3: コード実装（30分）

#### 3.1: BFF 層に対応ロジックを追加

**File:** `apps/bff/src/modules/reporting/dashboard/dashboard.service.ts`

```typescript
async getFinancialMetrics(company: Company, period: Period) {
  // ... 既存コード ...

  // 売上高取得（日本ロジテムの場合は特別処理）
  const revenue = await this.getRevenue(company.docId, period);

  // ... 残りのメトリクス計算 ...
}

private async getRevenue(docId: string, period: Period): Promise<number> {
  // 標準: Net Sales
  let revenue = await this.fetchFact(
    docId,
    'NetSalesOrServiceRevenues',
    period
  );

  // 日本ロジテムの場合は Operating Income で代替
  if (docId === 'S100XBD2' && !revenue) {
    revenue = await this.fetchFact(
      docId,
      'OperatingIncome',
      period
    );
    // メタデータに記録
    console.warn(
      `[${docId}] Using OperatingIncome as proxy for Revenue`
    );
  }

  return revenue;
}
```

#### 3.2: Contract に制限事項を記載

**File:** `packages/contracts/src/bff/dashboard/index.ts`

```typescript
export interface FinancialMetricMetadata {
  companyId: string;
  metric: 'revenue' | 'cogs' | 'operating_income';
  source: 'xbrl_direct' | 'calculated' | 'proxy';
  reliability: 'high' | 'medium' | 'low';
  notes?: string;
}

// 日本ロジテムの場合
{
  companyId: 'S100XBD2',
  metric: 'revenue',
  source: 'proxy',
  reliability: 'medium',
  notes: 'OperatingIncome used as proxy for Net Sales'
}
```

### Step 4: テスト（30分）

```typescript
// Test Case: 日本ロジテムの Revenue 取得

describe('RevenueService - 日本ロジテム対応', () => {
  it('S100XBD2 should return OperatingIncome as proxy', async () => {
    const company = { docId: 'S100XBD2', name: '日本ロジテム' };
    const period = { end: '2021-03-31' };

    const revenue = await revenueService.getRevenue(
      company.docId,
      period
    );

    expect(revenue).toBeDefined();
    expect(revenue).toBeGreaterThan(0);
    // Operating Income が取得されていることを確認
  });

  it('他社は Net Sales を返す', async () => {
    const company = { docId: 'S100LUF2', name: 'その他企業' };
    const period = { end: '2021-03-31' };

    const revenue = await revenueService.getRevenue(
      company.docId,
      period
    );

    // Net Sales が取得されていることを確認
    expect(revenue).toBeDefined();
  });
});
```

### Step 5: 文書化（30分）

**File:** `docs/REVENUE_HANDLING.md` （新規作成）

```markdown
# Revenue（売上高）の取得方法と制限事項

## 概要
5つの日本上場企業の売上高データを XBRL から取得します。

## 企業別の取得方法

| 企業 | doc_id | 方法 | 信頼度 | 備考 |
|------|--------|------|--------|------|
| ほくやく・竹山 | S100LUF2 | Net Sales | High | 通常の取得 |
| **日本ロジテム** | **S100XBD2** | **Operating Income** | **Medium** | **特別対応** |
| TBK | S100LCD2 | Net Sales | High | 通常の取得 |
| 川田テクノロジーズ | S100A6Y2 | Net Sales | High | 通常の取得 |
| トーアミ | S100C8U2 | Net Sales | High | 通常の取得 |

## 日本ロジテムについて

### 現状
- ロジスティクス（物流）企業
- XBRL ファイルに "Net Sales" 概念がない
- ただし "Operating Income" は利用可能

### 対応方法
- **Phase 1:** Operating Income で代替
- **Phase 2:** XBRL 詳細調査で完全な Revenue を特定予定

### 分析への影響
- ✅ Operating Profitability（営業利益率）分析は可能
- ❌ Gross Margin（粗利率）分析は不可（COGS も欠損）
- ⚠️ 売上ベースの効率指標は使用不可

## Phase 2 での予定調査内容
1. XBRL Taxonomy を詳細に確認
2. 物流企業の売上報告方法の確認
3. 代替概念の特定（Service Revenue など）
```

---

## ✅ チェックリスト

実装完了時の確認項目：

- [ ] XBRL ソースを確認（Revenue 概念の有無）
- [ ] Option A/B/C の中から方針を決定
- [ ] BFF 層に対応ロジック実装
- [ ] Contract に制限事項を記載
- [ ] Unit テスト実装
- [ ] 統合テスト実行
- [ ] 文書化完了
- [ ] Code Review 完了

---

## 🎯 成功基準（Definition of Done）

✅ **必須:**
- [ ] 日本ロジテムから何らかの指標が取得できる
- [ ] その指標が何か（Net Sales か Operating Income か）が明確
- [ ] BFF 層で正しく処理されている
- [ ] 制限事項が文書化済み

✅ **望ましい:**
- [ ] UI で「売上高」と「営業利益」を区別して表示
- [ ] メタデータで「代替値」であることを通知
- [ ] Phase 2 での調査計画が明確

---

## 📅 スケジュール

```
本日（Day 1）:
  □ 09:00 - 10:00: XBRL ソース確認
  □ 10:00 - 11:00: 対応方針決定（Option A/B/C）
  □ 11:00 - 12:00: コード実装
  □ 13:00 - 14:00: テスト実装
  □ 14:00 - 15:00: 文書化
  □ 15:00 - 16:00: Code Review

明日（Day 2）:
  □ 統合テスト実行
  □ 本番環境での検証
  □ Issue #3 (Unit正規化) に進む
```

---

## 📞 質問と回答

**Q: なぜ Operating Income で代替するのか？**
A: 即座に実装でき、日本ロジテムにはこのデータがあるため。完全な Revenue は Phase 2 で調査。

**Q: Gross Margin 計算はできるのか？**
A: No. 日本ロジテムは COGS も欠損しているため、元々 Gross Margin 計算は不可。

**Q: 他の企業への影響は？**
A: No. 他企業は全て Net Sales が利用可能。日本ロジテムだけの特別対応。

**Q: UI ではどう表示するのか？**
A: 「営業利益」として表示。または「売上高代替値」とラベル付け。

---

**Status:** 実装準備完了
**Next Step:** XBRL ソースを確認し、Option A/B/C を決定
