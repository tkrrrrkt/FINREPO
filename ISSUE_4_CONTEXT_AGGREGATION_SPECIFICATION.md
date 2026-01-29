# Issue #4: Context 集約 - 詳細仕様書

**Date:** 2026-01-30
**Issue Number:** #4
**Priority:** 🔴 HIGH
**Difficulty:** 🟠 MEDIUM-HIGH
**Estimated Effort:** 12-16 hours
**Status:** ✅ 仕様策定完了

---

## 📋 目次

1. [問題の定義](#問題の定義)
2. [XBRL Context の理解](#xbrl-context-の理解)
3. [ソリューション設計](#ソリューション設計)
4. [実装仕様](#実装仕様)
5. [テスト戦略](#テスト戦略)
6. [ロールアウト計画](#ロールアウト計画)

---

## 問題の定義

### 現在のデータ構造

```
XBRL Fact（ファクト）
├─ context (参照ID)  → Context オブジェクト
├─ concept (参照)     → 概念（売上、利益など）
├─ value            → 数値
└─ unit              → 単位

Context オブジェクト
├─ scenario          → 財務シナリオ
├─ segment_members   → セグメント選別情報
├─ period            → 報告期間
└─ [複雑な次元の組み合わせ]
```

### 具体的な問題シナリオ

#### シナリオ 1: 売上高の複数Context報告

**例: 日本ロジテム（SEC: 90600）**

```
同じ「売上高」(Revenue)が以下の複数Contextで報告される:

Context 1: [ConsolidatedMember, DomesticSegment]
Value: 53,000,000,000 JPY

Context 2: [NonConsolidatedMember]
Value: 48,000,000,000 JPY

Context 3: [ConsolidatedMember, OverseaSegment]
Value: 2,000,000,000 JPY

→ 問題: どのContextを「正式な売上高」とするか？
→ リスク: 複数Context合計すると二重計上の危険性
```

#### シナリオ 2: バランスシート項目の曖昧性

```
資産合計（Total Assets）が以下で報告:

Context A: [ConsolidatedMember, Parent]
Value: 500,000,000,000 JPY

Context B: [ConsolidatedMember, AllSubsidiaries]
Value: 600,000,000,000 JPY

→ 問題: 親会社のみか、全体か不明確
→ 実務: 通常は「親会社単体」を使用
```

### 影響範囲

| 機能 | 影響 |
|------|------|
| BS/PL 比較分析 | Context により値が変動 |
| 比率計算 | 分母と分子のContext不一致リスク |
| データ品質 | 重複カウント、欠損の可能性 |

---

## XBRL Context の理解

### Context の構成要素

```xml
<!-- 例: XBRL Instance Document より抜粋 -->
<context id="jppfs_cor:ConsolidatedMemberDomesticSegmentDuration2021">
  <entity>
    <identifier scheme="http://...">90600</identifier>
    <segment>
      <xbrldi:explicitMember
        dimension="jppfs_cor:ConsolidationAxisMember">
        jppfs_cor:ConsolidatedMember
      </xbrldi:explicitMember>
      <xbrldi:explicitMember
        dimension="jppfs_cor:BusinessSegmentAxisMember">
        jppfs_cor:DomesticSegment
      </xbrldi:explicitMember>
    </segment>
  </entity>
  <period>
    <startDate>2020-04-01</startDate>
    <endDate>2021-03-31</endDate>
  </period>
</context>
```

### Context の次元（Dimension）

**主要次元:**

1. **Consolidation Axis** (必須)
   - `jppfs_cor:ConsolidatedMember` → 連結
   - `jppfs_cor:NonConsolidatedMember` → 単体
   - None → デフォルト（通常は連結）

2. **Business Segment Axis** (オプション)
   - `jppfs_cor:DomesticSegment` → 国内
   - `jppfs_cor:OverseaSegment` → 海外
   - `jppfs_cor:[CustomSegment]` → カスタムセグメント

3. **その他の次元**
   - 営業部門別（BU）
   - 製品カテゴリ別
   - 子会社別
   - etc.

### Context の統計情報（Phase 1のデータ）

```sql
SELECT
  COUNT(DISTINCT context_id) as unique_contexts,
  COUNT(*) as total_facts,
  COUNT(DISTINCT concept_name) as unique_concepts
FROM staging.context;

Results:
unique_contexts: ~300-400
total_facts: 7,677
unique_concepts: 762
```

---

## ソリューション設計

### 戦略: Priority ベースの Context 選択

**基本原則:**
```
各ファクトに対して、複数のContext候補から「最も標準的な」Context を選択
└─ Priority ルールに基づいて自動選定
└─ 手動補正も可能（低優先度ファクト向け）
```

### Priority ルール（優先度 = 優先順位）

#### Level 1 (Priority: 100) - 最優先
```
Consolidation: ConsolidatedMember
Segment: None (全社)
特性: 最も標準的、全社ベース、連結財務
用途: BS/PL の主要指標、企業比較
例: 総資産、純利益
```

#### Level 2 (Priority: 80)
```
Consolidation: ConsolidatedMember
Segment: Any (セグメント別)
特性: セグメント詳細情報
用途: セグメント分析
例: セグメント別売上
```

#### Level 3 (Priority: 60)
```
Consolidation: NonConsolidatedMember
Segment: None
特性: 親会社単体
用途: 単体ベース分析（必要時）
例: 親会社純利益
```

#### Level 4 (Priority: 40)
```
Consolidation: NonConsolidatedMember
Segment: Any
特性: 子会社別、その他
用途: 例外処理、詳細分析
```

#### Level 5 (Priority: 1)
```
その他のContext
特性: 不定の報告単位
用途: エラー処理
```

### Context 分類ロジック

```python
class ContextClassifier:
    """Contextの次元を分析・分類"""

    def classify_consolidation(self, context) -> str:
        """連結/単体を判定"""
        if 'ConsolidatedMember' in context.dimensions:
            return 'consolidated'
        elif 'NonConsolidatedMember' in context.dimensions:
            return 'unconsolidated'
        else:
            return 'unknown'

    def classify_segment(self, context) -> str:
        """セグメント情報を抽出"""
        for dim, member in context.dimensions.items():
            if 'SegmentAxis' in dim or 'Segment' in member:
                return member
        return 'none'

    def get_priority(self, consolidation: str, segment: str) -> int:
        """優先度を計算"""
        rules = {
            ('consolidated', 'none'): 100,
            ('consolidated', 'any'): 80,
            ('unconsolidated', 'none'): 60,
            ('unconsolidated', 'any'): 40,
            ('unknown', 'any'): 1,
        }
        key = ('consolidated' if consolidation == 'consolidated' else
               'unconsolidated' if consolidation == 'unconsolidated' else
               'unknown',
               'none' if segment == 'none' else 'any')
        return rules.get(key, 1)
```

---

## 実装仕様

### Step 1: Context マスター作成

#### 1.1 DB テーブル定義

```sql
CREATE TABLE core.context_master (
  context_id VARCHAR(500) PRIMARY KEY,
  company_id INT NOT NULL,
  fiscal_year_end DATE NOT NULL,
  context_label VARCHAR(500) NOT NULL,

  -- 分類情報
  consolidation_status VARCHAR(20) NOT NULL,  -- 'consolidated', 'unconsolidated', 'unknown'
  segment_type VARCHAR(100),                  -- 'domestic', 'overseas', 'business_division', 'none'
  segment_value VARCHAR(255),                 -- セグメント値（例: 'DomesticSegment'）

  -- Priority と優先度
  priority_level INT NOT NULL,                -- 100, 80, 60, 40, 1
  primary_context BOOLEAN DEFAULT false,      -- 主要Context フラグ

  -- メタデータ
  dimension_count INT,                        -- 次元数
  dimensions_json JSON,                       -- 全次元の詳細情報

  -- 統計情報
  fact_count INT DEFAULT 0,                   -- このContextを使用するファクト数
  unique_concepts INT DEFAULT 0,              -- 異なる概念の数

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_company_year (company_id, fiscal_year_end),
  INDEX idx_consolidation (consolidation_status),
  INDEX idx_priority (priority_level DESC),
  INDEX idx_segment (segment_type, segment_value)
);
```

#### 1.2 Fact-Context マッピング

```sql
CREATE TABLE staging.fact_context_assignment (
  fact_id INT PRIMARY KEY,
  assigned_context_id VARCHAR(500) NOT NULL,
  consolidation_status VARCHAR(20),
  segment_type VARCHAR(100),
  priority_level INT,
  selection_method VARCHAR(50),  -- 'auto', 'manual_override'
  confidence_score DECIMAL(3, 2),  -- 0.0-1.0（自信度）
  notes TEXT,
  assigned_at TIMESTAMP,

  FOREIGN KEY (assigned_context_id) REFERENCES core.context_master(context_id),
  FOREIGN KEY (fact_id) REFERENCES staging.fact(id),
  INDEX idx_assigned_context (assigned_context_id)
);
```

### Step 2: Python 実装

#### 2.1 Context Aggregator クラス

```python
# src/lib/context_aggregator.py

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum
import json

class ConsolidationStatus(str, Enum):
    CONSOLIDATED = "consolidated"
    UNCONSOLIDATED = "unconsolidated"
    UNKNOWN = "unknown"

class SegmentType(str, Enum):
    NONE = "none"
    DOMESTIC = "domestic"
    OVERSEAS = "overseas"
    BUSINESS_DIVISION = "business_division"
    OTHER = "other"

@dataclass
class ContextInfo:
    """Context の解析結果"""
    context_id: str
    consolidation_status: ConsolidationStatus
    segment_type: SegmentType
    segment_value: Optional[str]
    priority_level: int
    dimension_count: int
    dimensions_detail: Dict

class ContextAggregator:
    """XBRL Context を集約・正規化"""

    # Priority ルール
    PRIORITY_RULES = [
        {
            'consolidation': ConsolidationStatus.CONSOLIDATED,
            'segment': SegmentType.NONE,
            'priority': 100,
            'description': '連結 + 全社（最優先）'
        },
        {
            'consolidation': ConsolidationStatus.CONSOLIDATED,
            'segment': SegmentType.DOMESTIC,
            'priority': 80,
            'description': '連結 + 国内セグメント'
        },
        {
            'consolidation': ConsolidationStatus.CONSOLIDATED,
            'segment': SegmentType.OVERSEAS,
            'priority': 80,
            'description': '連結 + 海外セグメント'
        },
        {
            'consolidation': ConsolidationStatus.CONSOLIDATED,
            'segment': SegmentType.BUSINESS_DIVISION,
            'priority': 75,
            'description': '連結 + 事業部門別'
        },
        {
            'consolidation': ConsolidationStatus.UNCONSOLIDATED,
            'segment': SegmentType.NONE,
            'priority': 60,
            'description': '単体 + 全社'
        },
        # ... その他のルール
    ]

    def __init__(self):
        self.contexts: Dict[str, ContextInfo] = {}

    def extract_contexts_from_xbrl(self, model_xbrl) -> List[ContextInfo]:
        """XBRL Instance から Context 情報を抽出"""
        extracted = []

        for context_id, context in model_xbrl.contexts.items():
            info = self._analyze_single_context(context_id, context)
            self.contexts[context_id] = info
            extracted.append(info)

        return extracted

    def _analyze_single_context(
        self,
        context_id: str,
        context_obj
    ) -> ContextInfo:
        """単一 Context を分析"""

        # 次元情報を抽出
        consolidation = self._extract_consolidation(context_obj)
        segment_type, segment_value = self._extract_segment(context_obj)
        dimension_count = len(context_obj.segDimValues if hasattr(context_obj, 'segDimValues') else {})

        # Priority を計算
        priority = self._calculate_priority(consolidation, segment_type)

        # 詳細情報を保存
        dimensions_detail = {}
        if hasattr(context_obj, 'segDimValues'):
            for dim_key, member in context_obj.segDimValues.items():
                dimensions_detail[str(dim_key)] = str(member)

        return ContextInfo(
            context_id=context_id,
            consolidation_status=consolidation,
            segment_type=segment_type,
            segment_value=segment_value,
            priority_level=priority,
            dimension_count=dimension_count,
            dimensions_detail=dimensions_detail
        )

    def _extract_consolidation(self, context_obj) -> ConsolidationStatus:
        """連結/単体ステータスを判定"""
        dimensions = getattr(context_obj, 'segDimValues', {})

        if not dimensions:
            return ConsolidationStatus.UNKNOWN

        # ConsolidationAxisMember を探す
        for dim_key, member_obj in dimensions.items():
            member_name = member_obj.localName if hasattr(member_obj, 'localName') else str(member_obj)

            if member_name == 'ConsolidatedMember':
                return ConsolidationStatus.CONSOLIDATED
            elif member_name == 'NonConsolidatedMember':
                return ConsolidationStatus.UNCONSOLIDATED

        return ConsolidationStatus.UNKNOWN

    def _extract_segment(self, context_obj) -> Tuple[SegmentType, Optional[str]]:
        """セグメント情報を抽出"""
        dimensions = getattr(context_obj, 'segDimValues', {})

        if not dimensions:
            return SegmentType.NONE, None

        for dim_key, member_obj in dimensions.items():
            dim_name = dim_key.localName if hasattr(dim_key, 'localName') else str(dim_key)
            member_name = member_obj.localName if hasattr(member_obj, 'localName') else str(member_obj)

            # セグメント次元を判定
            if 'SegmentAxis' in dim_name or 'Segment' in dim_name:
                if 'Domestic' in member_name:
                    return SegmentType.DOMESTIC, member_name
                elif 'Oversea' in member_name or 'International' in member_name:
                    return SegmentType.OVERSEAS, member_name
                elif 'Business' in member_name or 'Division' in member_name:
                    return SegmentType.BUSINESS_DIVISION, member_name
                else:
                    return SegmentType.OTHER, member_name

        return SegmentType.NONE, None

    def _calculate_priority(
        self,
        consolidation: ConsolidationStatus,
        segment: SegmentType
    ) -> int:
        """Priority ルールに基づいて優先度を計算"""

        for rule in self.PRIORITY_RULES:
            if (rule['consolidation'] == consolidation and
                rule['segment'] == segment):
                return rule['priority']

        return 1  # デフォルト（最低優先度）

    def select_primary_context(
        self,
        fact_id: int,
        available_contexts: List[str]
    ) -> Tuple[str, int]:
        """ファクトに対して最適な Context を選択

        Returns:
            (selected_context_id, priority_level)
        """

        # 利用可能な Context の情報を取得
        candidates = [
            (ctx_id, self.contexts[ctx_id])
            for ctx_id in available_contexts
            if ctx_id in self.contexts
        ]

        # Priority でソート（降順）
        candidates.sort(
            key=lambda x: x[1].priority_level,
            reverse=True
        )

        if candidates:
            selected_id, selected_info = candidates[0]
            return selected_id, selected_info.priority_level

        # フォールバック
        return available_contexts[0] if available_contexts else None, 0

    def export_to_db_format(self) -> List[Dict]:
        """DB への INSERT 用にデータを変換"""

        records = []
        for context_id, info in self.contexts.items():
            records.append({
                'context_id': context_id,
                'context_label': context_id,  # または更に読みやすい名前に変換可能
                'consolidation_status': info.consolidation_status.value,
                'segment_type': info.segment_type.value,
                'segment_value': info.segment_value,
                'priority_level': info.priority_level,
                'dimension_count': info.dimension_count,
                'dimensions_json': json.dumps(info.dimensions_detail),
            })

        return records
```

#### 2.2 既存の parse_xbrl.py への統合

```python
# src/edinet/parse_xbrl.py への追加

from lib.context_aggregator import ContextAggregator

def process_xbrl_document(zip_path: Path, model_xbrl):
    """XBRL ドキュメントを処理"""

    # ... 既存処理 ...

    # Context 集約を実行（新規）
    context_aggregator = ContextAggregator()
    context_infos = context_aggregator.extract_contexts_from_xbrl(model_xbrl)

    # Context Master に登録
    context_records = context_aggregator.export_to_db_format()
    for record in context_records:
        upsert_context_master(conn, record)

    # 各ファクトに対して primary context を決定
    for fact in model_xbrl.facts:
        primary_ctx, priority = context_aggregator.select_primary_context(
            fact.id,
            [fact.context.id]  # 実際にはファクト内のContext参照から取得
        )

        # fact_context_assignment に記録
        upsert_fact_context_assignment(conn, {
            'fact_id': fact.id,
            'assigned_context_id': primary_ctx,
            'priority_level': priority,
            'selection_method': 'auto'
        })
```

### Step 3: DB 関連関数（src/lib/db.py）

```python
def upsert_context_master(conn, context_record: Dict):
    """Context Master テーブルに Upsert"""
    query = """
    INSERT INTO core.context_master (
        context_id, consolidation_status, segment_type, segment_value,
        priority_level, dimension_count, dimensions_json, created_at
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
    ON CONFLICT (context_id) DO UPDATE SET
        consolidation_status = EXCLUDED.consolidation_status,
        segment_type = EXCLUDED.segment_type,
        segment_value = EXCLUDED.segment_value,
        priority_level = EXCLUDED.priority_level,
        updated_at = CURRENT_TIMESTAMP;
    """
    # ... 実装
```

---

## テスト戦略

### Unit Tests (test/unit/test_context_aggregator.py)

```python
class TestContextClassification:
    """Context 分類のテスト"""

    def test_consolidated_member_detection(self):
        """ConsolidatedMember を正しく検出"""
        # mock context で テスト
        pass

    def test_segment_extraction_domestic(self):
        """国内セグメントを抽出"""
        pass

    def test_priority_calculation(self):
        """優先度計算が正確"""
        pass

class TestContextSelection:
    """Context 選択ロジックのテスト"""

    def test_select_highest_priority_context(self):
        """最優先 Context を選択"""
        pass

    def test_fallback_when_no_candidates(self):
        """候補なし時の fallback"""
        pass

class TestContextAggregation:
    """Context 集約全体のテスト"""

    def test_extract_all_contexts_from_xbrl(self):
        """XBRL から全 Context を抽出"""
        pass

    def test_export_to_db_format(self):
        """DB フォーマットへの変換"""
        pass
```

### Regression Tests (test/regression/)

```python
class TestContextMasterData:
    """DB に保存されたデータの検証"""

    def test_context_master_populated(self):
        """core.context_master に データが入っているか"""
        result = conn.execute(
            "SELECT COUNT(*) FROM core.context_master"
        )
        assert result[0] >= 100

    def test_all_facts_have_assignment(self):
        """全ファクトに context assignment がある"""
        result = conn.execute("""
            SELECT COUNT(*) FROM staging.fact f
            WHERE NOT EXISTS (
              SELECT 1 FROM staging.fact_context_assignment a
              WHERE a.fact_id = f.id
            )
        """)
        assert result[0] == 0  # 未割り当てなし

    def test_priority_distribution(self):
        """優先度の分布が妥当"""
        results = conn.execute("""
            SELECT priority_level, COUNT(*) as count
            FROM staging.fact_context_assignment
            GROUP BY priority_level
        """)
        # 100番台が大多数、低優先度は少数という傾向を確認
```

---

## ロールアウト計画

### Phase 1: 実装（1-2 週間）

```
Day 1-2: Context 分析
  └─ XBRL ファイルの Context 構造を詳細分析
  └─ 既存Context の統計情報を取得
  └─ Priority ルールの確定

Day 3-4: Python 実装
  └─ ContextAggregator クラス実装
  └─ Context 分析ロジック実装
  └─ Priority 計算ロジック実装

Day 5-6: DB 実装
  └─ context_master テーブル作成
  └─ fact_context_assignment テーブル作成
  └─ Upsert 関数実装

Day 7-8: テスト
  └─ Unit テスト作成・実行
  └─ Regression テスト作成
  └─ エッジケーステスト
```

### Phase 2: 検証（1-2 週間）

```
- 既存データに対して Context aggregation を実行
- 結果を手動確認（サンプル5社分）
- Precision/Recall を測定
- 閾値調整（必要に応じて）
```

### Phase 3: ロールアウト（1 週間）

```
- 本番 DB に適用
- モニタリング
- ドキュメント更新
```

---

## 成功基準

```
✅ Context Master に 500+ のユニーク Context を登録
✅ 全ファクト（7,677 件）に primary context を割り当て
✅ Consolidation status の判定精度 > 95%
✅ Segment 分類の精度 > 90%
✅ Priority ルールが manual audit で妥当性確認 > 95%
✅ テスト: 40+ tests, 100% PASS
✅ ドキュメント: API仕様, SQL スキーマ, 実装ガイド完備
```

---

## 参考資料

### XBRL 標準仕様
- XBRL 2.1 Specification
- XBRL GL (General Ledger) for Dimensions
- JP GAAP XBRL Taxonomy

### 関連モジュール
- `src/lib/concept_hierarchy.py` (Concept の階層管理)
- `src/lib/unit_normalizer.py` (Unit の正規化)
- `src/edinet/parse_xbrl.py` (XBRL 解析メイン)

---

**Status:** ✅ 詳細仕様完成
**Next Step:** 実装開始
**Last Updated:** 2026-01-30
