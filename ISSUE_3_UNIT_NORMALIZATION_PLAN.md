# Issue #3: Unit正規化 - 実装プラン
**Date:** 2026-01-29
**Priority:** 🟡 MEDIUM
**Estimated Duration:** 1-2日
**Status:** 実装準備完了

---

## 📊 現状分析

### Unit の分布（予想）

```
JPY:     7,500+ (99.9%)  ← ほぼ全て
USD:     10     (0.1%)
EUR:     3      (<0.1%)
pure:    5      (<0.1%)  ← 単位なし（比率など）
shares:  2      (<0.1%)  ← 株式数
```

**現状:** 複数の通貨が混在しているが、実質的にはほぼJPYのみ

**問題:**
- ❌ 統一されていない
- ❌ 比較分析に不便
- ❌ 計算エラーのリスク

**解決:**
- ✅ 全て JPY に統一（USD/EUR は JPY に換算）
- ✅ DB スキーマに `unit_normalized` カラムを追加

---

## 🛠️ 実装手順

### Step 1: Unit マッピングテーブルを作成

**File:** `src/lib/unit_normalizer.py`

```python
"""
Unit Normalizer: 複数通貨を標準通貨（JPY）に正規化

このモジュールは、XBRL の Unit（単位）を標準化して、
企業間・指標間の比較分析を容易にします。
"""

from typing import Optional
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class UnitInfo:
    """Unit 情報"""
    original_unit: str          # 元の Unit (JPY, USD, etc.)
    normalized_unit: str        # 正規化後の Unit (JPY に統一)
    unit_type: str             # "currency", "pure", "count"
    conversion_factor: Decimal # 変換係数
    symbol: str                # 表示用記号


# Unit マッピング定義
UNIT_MAPPING = {
    # 金銭単位
    "JPY": UnitInfo(
        original_unit="JPY",
        normalized_unit="JPY",
        unit_type="currency",
        conversion_factor=Decimal("1"),
        symbol="¥"
    ),

    # 国際通貨（2024-01現在のレート）
    # 注: 実際の運用では、歴史的レートを使用すべき
    "USD": UnitInfo(
        original_unit="USD",
        normalized_unit="JPY",
        unit_type="currency",
        conversion_factor=Decimal("145"),  # 1 USD = 145 JPY (参考レート)
        symbol="$"
    ),
    "EUR": UnitInfo(
        original_unit="EUR",
        normalized_unit="JPY",
        unit_type="currency",
        conversion_factor=Decimal("155"),  # 1 EUR = 155 JPY (参考レート)
        symbol="€"
    ),

    # 純粋な数
    "pure": UnitInfo(
        original_unit="pure",
        normalized_unit="pure",
        unit_type="pure",
        conversion_factor=Decimal("1"),
        symbol=""
    ),

    # 株式数
    "shares": UnitInfo(
        original_unit="shares",
        normalized_unit="shares",
        unit_type="count",
        conversion_factor=Decimal("1"),
        symbol="株"
    ),

    # NULL の場合
    None: UnitInfo(
        original_unit="unknown",
        normalized_unit="JPY",
        unit_type="currency",
        conversion_factor=Decimal("1"),
        symbol="¥"
    ),
}


class UnitNormalizer:
    """Unit を正規化するユーティリティ"""

    def __init__(self, unit_mapping: dict = UNIT_MAPPING):
        self.mapping = unit_mapping

    def normalize(
        self,
        unit_ref: Optional[str],
        value: Optional[Decimal]
    ) -> tuple[str, Optional[Decimal]]:
        """
        Unit と値を正規化

        Args:
            unit_ref: 元の Unit (JPY, USD, etc.)
            value: 元の値

        Returns:
            (正規化後の Unit, 正規化後の値)

        例:
            normalize("USD", Decimal("1000"))
            → ("JPY", Decimal("145000"))

            normalize("JPY", Decimal("1000000"))
            → ("JPY", Decimal("1000000"))
        """
        if value is None:
            return "JPY", None

        unit_info = self.mapping.get(unit_ref)
        if not unit_info:
            # 未知の Unit は JPY として扱う
            unit_info = self.mapping.get(None)

        # 値を換算
        normalized_value = value * unit_info.conversion_factor

        return unit_info.normalized_unit, normalized_value

    def get_conversion_factor(self, unit_ref: Optional[str]) -> Decimal:
        """Unit の換算係数を取得"""
        unit_info = self.mapping.get(unit_ref, self.mapping[None])
        return unit_info.conversion_factor

    def is_currency(self, unit_ref: Optional[str]) -> bool:
        """Unit が金銭単位か確認"""
        unit_info = self.mapping.get(unit_ref, self.mapping[None])
        return unit_info.unit_type == "currency"


# グローバルインスタンス
normalizer = UnitNormalizer()
```

### Step 2: DB スキーマ変更

```sql
-- staging.fact テーブルに正規化後のカラムを追加
ALTER TABLE staging.fact
ADD COLUMN unit_ref_normalized VARCHAR(20) DEFAULT 'JPY',
ADD COLUMN value_normalized DECIMAL(20, 6);

-- インデックス
CREATE INDEX idx_unit_normalized ON staging.fact(unit_ref_normalized);

-- Unit マスターテーブル（参考用）
CREATE TABLE core.unit_master (
    original_unit_ref VARCHAR(50) PRIMARY KEY,
    normalized_unit VARCHAR(20) NOT NULL,
    unit_type VARCHAR(20) NOT NULL,
    conversion_factor DECIMAL(20, 6) NOT NULL,
    display_symbol VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- データ投入
INSERT INTO core.unit_master VALUES
    ('JPY', 'JPY', 'currency', 1, '¥', NOW(), 'Japanese Yen'),
    ('USD', 'JPY', 'currency', 145, '$', NOW(), '1 USD = 145 JPY (2024-01 rate)'),
    ('EUR', 'JPY', 'currency', 155, '€', NOW(), '1 EUR = 155 JPY (2024-01 rate)'),
    ('pure', 'pure', 'pure', 1, '', NOW(), 'Pure number (ratio, percentage)'),
    ('shares', 'shares', 'count', 1, '株', NOW(), 'Number of shares');
```

### Step 3: parse_xbrl.py に integration

```python
# src/edinet/parse_xbrl.py

from lib.unit_normalizer import normalizer as unit_normalizer

# Fact 処理ループ内に追加
def normalize_facts(facts, unit_normalizer):
    """Facts の Unit と値を正規化"""
    normalized_facts = []

    for fact in facts:
        unit_normalized, value_normalized = unit_normalizer.normalize(
            fact.get("unit_ref"),
            fact.get("value_numeric")
        )

        fact["unit_ref_normalized"] = unit_normalized
        fact["value_normalized"] = value_normalized
        normalized_facts.append(fact)

    return normalized_facts
```

### Step 4: データベースに値を入力

```python
# load_staging_facts() 関数を修正

def load_staging_facts(conn, doc_id, facts):
    """Staging にファクトを投入（Unit 正規化済み）"""
    with conn.cursor() as cur:
        for fact in facts:
            # Unit 正規化
            unit_normalized, value_normalized = unit_normalizer.normalize(
                fact.get("unit_ref"),
                fact.get("value_numeric")
            )

            cur.execute("""
                INSERT INTO staging.fact (
                    doc_id,
                    concept_qname,
                    context_id,
                    unit_ref,
                    unit_ref_normalized,
                    value_numeric,
                    value_normalized,
                    value_text,
                    ...
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, ...)
                ON CONFLICT (doc_id, concept_qname, context_id, unit_ref)
                DO UPDATE SET
                    unit_ref_normalized = EXCLUDED.unit_ref_normalized,
                    value_normalized = EXCLUDED.value_normalized
            """, (
                fact["doc_id"],
                fact["concept_qname"],
                fact["context_id"],
                fact.get("unit_ref"),
                unit_normalized,        # ← 追加
                fact.get("value_numeric"),
                value_normalized,       # ← 追加
                fact.get("value_text"),
                ...
            ))
```

---

## ✅ テスト方法

### テスト 1: Unit 正規化機能

```python
from src.lib.unit_normalizer import normalizer

# テスト1: JPY は変わらない
unit, value = normalizer.normalize("JPY", Decimal("1000000"))
assert unit == "JPY"
assert value == Decimal("1000000")  # ✅ PASS

# テスト2: USD は JPY に換算
unit, value = normalizer.normalize("USD", Decimal("10000"))
assert unit == "JPY"
assert value == Decimal("1450000")  # 10,000 USD * 145 = 1,450,000 JPY  ✅ PASS

# テスト3: pure は変わらない
unit, value = normalizer.normalize("pure", Decimal("0.95"))
assert unit == "pure"
assert value == Decimal("0.95")  # ✅ PASS
```

### テスト 2: データベース検証

```sql
-- 正規化後のデータを確認
SELECT
    unit_ref,
    unit_ref_normalized,
    COUNT(*) as count,
    MIN(value_numeric) as min_original,
    MAX(value_numeric) as max_original,
    MIN(value_normalized) as min_normalized,
    MAX(value_normalized) as max_normalized
FROM staging.fact
WHERE value_numeric IS NOT NULL
GROUP BY unit_ref, unit_ref_normalized
ORDER BY count DESC;

期待される結果:
unit_ref | unit_ref_normalized | count | min_original   | max_original    | min_normalized | max_normalized
────────────────────────────────────────────────────────────────────────────────────────────────────────────
JPY      | JPY                 | 7500  | 1              | 999999999999    | 1              | 999999999999 ✅
USD      | JPY                 | 10    | 100            | 10000           | 14500          | 1450000 ✅
pure     | pure                | 5     | 0.5            | 1.0             | 0.5            | 1.0 ✅
```

---

## 📋 実装チェックリスト

- [ ] `src/lib/unit_normalizer.py` を作成
- [ ] Unit マッピングテーブルを定義
- [ ] `parse_xbrl.py` に import を追加
- [ ] DB スキーマ変更（ALTER TABLE）
- [ ] Unit マスターテーブル作成
- [ ] 値の正規化ロジック実装
- [ ] Unit テスト実行
- [ ] DB にデータ投入
- [ ] 統合テスト実行
- [ ] ドキュメント作成

---

## ⚠️ 注意事項

### 1. 為替レートについて

```python
# 現在: 静的レート
"USD": UnitInfo(
    conversion_factor=Decimal("145"),  # 2024-01-29 の参考レート
)

# Phase 2 での改善案:
# 期間別レートテーブルを作成
SELECT
    period_date,
    usd_jpy_rate
FROM core.exchange_rates
WHERE period_date >= ? AND period_date <= ?

value_normalized = value * exchange_rates[period_date]['usd_jpy']
```

### 2. 歴史的レート

現在の実装は固定レートですが、本来的には：
- 決算時点の為替レート を使用すべき
- ただし、データが古い（FY2021）ので、簡略化

### 3. 他の通貨への対応

```python
# 将来の拡張用
UNIT_MAPPING.update({
    "GBP": UnitInfo(...),
    "CNY": UnitInfo(...),
    "KRW": UnitInfo(...),
})
```

---

## 🎯 成功基準

✅ **必須:**
- [ ] 全ファクトが `unit_ref_normalized` を持つ
- [ ] `unit_ref_normalized` は常に "JPY", "pure", "shares" のいずれか
- [ ] 金銭値の正規化が正しく実行されている
- [ ] USD/EUR が JPY に換算されている

✅ **望ましい:**
- [ ] Unit マスターテーブルが完成
- [ ] 為替レート出典が明確
- [ ] Phase 2 での改善計画が明確

---

## 📅 スケジュール（推奨）

```
Day 3 (本日):
  □ 09:00 - 10:00: unit_normalizer.py 作成
  □ 10:00 - 11:00: parse_xbrl.py に integration
  □ 11:00 - 12:00: DB スキーマ変更
  □ 13:00 - 14:00: テスト実装・実行
  □ 14:00 - 15:00: ドキュメント作成

Day 4:
  □ 統合テスト実行
  □ Issue #2 (Concept 階層) に進む
```

---

## 📞 参考: Unit マッピング拡張の例

```python
# 複数の単位修飾子に対応する場合
UNIT_MAPPING = {
    "JPY": {...},
    "JPY_Million": UnitInfo(  # 100万円単位
        original_unit="JPY_Million",
        normalized_unit="JPY",
        conversion_factor=Decimal("1000000"),
        ...
    ),
    "JPY_Thousand": UnitInfo(  # 1千円単位
        original_unit="JPY_Thousand",
        normalized_unit="JPY",
        conversion_factor=Decimal("1000"),
        ...
    ),
}
```

---

**Status:** 実装準備完了
**Next:** Step 1 から実装開始
