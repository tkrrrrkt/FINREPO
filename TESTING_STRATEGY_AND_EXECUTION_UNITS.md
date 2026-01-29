# テスト実行戦略 - 実行単位の定義

**Date:** 2026-01-30
**Purpose:** Phase 2 実装時のテスト・品質確認の実行単位を明確化
**Status:** ✅ 戦略確定

---

## 📋 目次

1. [テスト実行の階層構造](#テスト実行の階層構造)
2. [各イニシアティブの実行単位](#各イニシアティブの実行単位)
3. [実行可能な単位と実行方法](#実行可能な単位と実行方法)
4. [チェックポイント別実行タイミング](#チェックポイント別実行タイミング)
5. [一気実行スクリプト](#一気実行スクリプト)

---

## テスト実行の階層構造

### ピラミッド構造

```
            統合テスト (Integration Tests)
                ↑
        ↓←──────────────→↑
    複数コンポーネント (Multi-component Tests)
        ↑
        ↓←──────────────→↑
    単一コンポーネント (Component Tests)
        ↑
        ↓←──────────────→↑
    単一関数・クラス (Unit Tests)
        ↑
        └─────────────────┘

各レイヤーで実行時間と信頼性が異なる
```

### テスト実行の3つのレベル

| レベル | 単位 | 実行時間 | 信頼性 | 頻度 |
|---|---|---|---|---|
| **L1: Unit** | 単一関数/クラス | < 1秒 | 低 | 毎回 |
| **L2: Component** | 機能モジュール | 1-5秒 | 中 | 各機能完成時 |
| **L3: Integration** | システム全体 | 5-30秒 | 高 | リリース前 |

---

## 各イニシアティブの実行単位

### **Issue #4: Context 集約（12-16時間）**

#### 実装フェーズの分割

```
🎯 目標: Context マスターを作成し、全ファクトに primary context を割り当て

分割方法: 3つの独立したコンポーネントに分割
```

#### **コンポーネント 1: Context 分析・分類** (~2-3時間)

```python
# src/lib/context_analyzer.py
class ContextAnalyzer:
    def analyze_consolidation() → str  # 連結/単体判定
    def analyze_segment() → (str, str)  # セグメント抽出
    def calculate_priority() → int       # 優先度計算
```

**このコンポーネントだけのテスト実行:**
```bash
# L1: Unit テスト
pytest test/unit/test_context_analyzer.py -v

# 期待: 15+ テスト, 100% PASS
# 実行時間: < 2秒
```

**テストケース例:**
```python
def test_analyze_consolidation_consolidated():
    """ConsolidatedMember を正しく検出"""

def test_analyze_consolidation_unconsolidated():
    """NonConsolidatedMember を正しく検出"""

def test_analyze_segment_domestic():
    """国内セグメントを正しく抽出"""

def test_calculate_priority_level_1():
    """Priority 100（連結全社）を計算"""
```

**受け入れ条件（コンポーネント単位）:**
```
✅ 15+ テスト
✅ 100% PASS
✅ 実行時間 < 5秒
✅ コードカバレッジ > 90%
```

---

#### **コンポーネント 2: Context マスター実装** (~2-3時間)

```sql
-- core.context_master テーブル作成
-- インデックス設定
-- サンプルデータ投入
```

**このコンポーネントだけのテスト実行:**
```bash
# L1: Unit テスト（モック DB使用）
pytest test/unit/test_context_master.py -v

# L2: Integration テスト（実 DB使用）
pytest test/regression/test_context_master_db.py -v

# 期待: Unit 10+テスト PASS, Integration 5+テスト PASS
# 実行時間: < 5秒（Unit） + < 3秒（Integration）
```

**テストケース例:**
```python
# Unit: SQL構文確認
def test_context_master_schema_valid():
    """テーブルスキーマが正しい"""

def test_context_master_indexes_exist():
    """必要なインデックスが存在"""

# Integration: DB操作確認
def test_context_master_insert_and_retrieve():
    """Context の挿入・取得が正常"""

def test_context_master_primary_key_unique():
    """context_id が UNIQUE制約で保護"""
```

**受け入れ条件:**
```
✅ 15+ テスト
✅ 100% PASS
✅ DB 操作が atomic（トランザクション整合性）
✅ インデックス性能が確認される
```

---

#### **コンポーネント 3: ContextAggregator実装** (~3-4時間)

```python
# src/lib/context_aggregator.py
class ContextAggregator:
    def extract_contexts_from_xbrl(model_xbrl) → List[ContextInfo]
    def select_primary_context(fact_id, contexts) → (str, int)
    def export_to_db_format() → List[Dict]
```

**このコンポーネントだけのテスト実行:**
```bash
# L1: Unit テスト（モック XBRL使用）
pytest test/unit/test_context_aggregator.py -v

# L2: Integration テスト（実 XBRL ファイル使用）
pytest test/integration/test_context_aggregator_with_xbrl.py -v

# 期待: Unit 20+テスト PASS, Integration 5+テスト PASS
# 実行時間: < 5秒（Unit） + < 10秒（Integration, XBRL読み込み）
```

**テストケース例:**
```python
# Unit: ロジック確認
def test_select_primary_context_prefers_consolidated():
    """連結が単体より優先される"""

def test_select_primary_context_fallback():
    """候補がない場合のフォールバック"""

# Integration: 実データ確認
def test_aggregate_all_facts_from_real_xbrl():
    """実 XBRL ファイルから全ファクトを集約"""

def test_export_format_matches_db_schema():
    """エクスポートフォーマットが DB スキーマと一致"""
```

**受け入れ条件:**
```
✅ 25+ テスト
✅ 100% PASS
✅ 実 XBRL での動作確認
✅ 7,677 ファクトの処理成功
```

---

#### **Issue #4 全体の一気実行**

```bash
# 🎯 Issue #4 全テストを一気実行
./run_tests.sh issue-4-all

# または
pytest test/unit/test_context_*.py \
        test/integration/test_context_*.py \
        test/regression/test_context_master_db.py -v

# 期待: 50+ テスト, 100% PASS
# 実行時間: 15-20秒
```

**チェックリスト:**
```
✅ Component 1 (Analyzer): 100% PASS
✅ Component 2 (Master): 100% PASS
✅ Component 3 (Aggregator): 100% PASS
✅ 統合テスト: データベース状態確認
  ├─ context_master に 500+ レコード
  ├─ fact_context_assignment に 7,677 レコード
  └─ 外部キー制約が満たされている
```

---

### **為替レート動的化（4-6時間）**

#### 実装フェーズの分割

```
🎯 目標: exchange_rate_history テーブル作成＆ API 統合
```

#### **コンポーネント 1: DB スキーマ** (~30分)

```bash
pytest test/unit/test_exchange_rate_schema.py -v
# 期待: 8+ テスト, < 2秒
```

#### **コンポーネント 2: API 統合（Fixer.io）** (~2時間)

```bash
pytest test/unit/test_exchange_rate_fetcher.py -v
pytest test/integration/test_fixer_io_api.py -v
# 期待: 20+ テスト, < 10秒
```

#### **コンポーネント 3: DynamicUnitNormalizer** (~1-2時間)

```bash
pytest test/unit/test_dynamic_unit_normalizer.py -v
# 期待: 15+ テスト, < 2秒
```

#### **為替レート全体の一気実行**

```bash
./run_tests.sh exchange-rate-all

# 期待: 40+ テスト, 100% PASS, < 15秒
```

---

### **複数期間データ対応（3-4時間）**

#### **コンポーネント 1: MultiYearDataLoader** (~2時間)

```bash
pytest test/unit/test_multi_year_loader.py -v
# 期待: 15+ テスト, < 5秒
```

#### **コンポーネント 2: DB マイグレーション** (~1時間)

```bash
pytest test/regression/test_multi_period_schema.py -v
# 期待: 10+ テスト, < 5秒
```

#### **複数期間全体の一気実行**

```bash
./run_tests.sh multi-period-all

# 期待: 25+ テスト, 100% PASS, < 10秒
```

---

### **BFF REST API（10-15時間）**

#### **コンポーネント 1: API エンドポイント** (~5時間)

```bash
# 各エンドポイントごと
pytest test/unit/test_api_companies.py -v
pytest test/unit/test_api_financials.py -v
pytest test/unit/test_api_comparison.py -v
pytest test/unit/test_api_hierarchy.py -v

# 期待: 各 5-10テスト PASS
# 実行時間: 各 < 2秒
```

#### **コンポーネント 2: スキーマ検証** (~2時間)

```bash
pytest test/unit/test_api_schemas.py -v
# 期待: 20+ テスト, < 3秒
```

#### **コンポーネント 3: 統合テスト** (~3時間)

```bash
pytest test/integration/test_api_end_to_end.py -v
# 期待: 10+ テスト, < 10秒
```

#### **BFF API 全体の一気実行**

```bash
./run_tests.sh bff-api-all

# 期待: 50+ テスト, 100% PASS, < 20秒
```

---

## 実行可能な単位と実行方法

### **推奨される実行単位**

```
┌─────────────────────────────────────────────────┐
│ 実行単位（階層的）                              │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📌 Level A: 関数単位（最小）                   │
│    └─ pytest test/unit/test_xxx.py::TestClass::test_func
│    └─ 実行時間: < 1秒                          │
│    └─ 用途: 開発中の高速フィードバック          │
│                                                 │
│ 📌 Level B: クラス/モジュール単位              │
│    └─ pytest test/unit/test_context_analyzer.py
│    └─ 実行時間: 1-5秒                          │
│    └─ 用途: 機能完成時の確認                    │
│                                                 │
│ 📌 Level C: コンポーネント単位                 │
│    └─ ./run_tests.sh issue-4-component-1      │
│    └─ 実行時間: 5-15秒                         │
│    └─ 用途: コンポーネント完成時の品質確認      │
│                                                 │
│ 📌 Level D: イニシアティブ全体                │
│    └─ ./run_tests.sh issue-4-all              │
│    └─ 実行時間: 15-30秒                        │
│    └─ 用途: イニシアティブ完成時の総合確認      │
│                                                 │
│ 📌 Level E: Phase 2 全体                      │
│    └─ ./run_tests.sh phase2-all               │
│    └─ 実行時間: 30-60秒                        │
│    └─ 用途: Phase 2 完成時のリリース前検証      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## チェックポイント別実行タイミング

### **開発フロー**

```
Day 1-2: Issue #4 Component 1 (Context Analyzer)
├─ コーディング
├─ テスト作成
├─ pytest test/unit/test_context_analyzer.py -v
│  期待: 100% PASS（カバレッジ > 90%）
└─ ✅ Component 1 完成

Day 3-4: Issue #4 Component 2 (Context Master)
├─ SQL スキーマ作成
├─ テスト作成
├─ pytest test/unit/test_context_master.py -v
├─ pytest test/regression/test_context_master_db.py -v
│  期待: 100% PASS
└─ ✅ Component 2 完成

Day 5-6: Issue #4 Component 3 (ContextAggregator)
├─ 実装
├─ テスト作成
├─ pytest test/unit/test_context_aggregator.py -v
├─ pytest test/integration/test_context_aggregator_with_xbrl.py -v
│  期待: 100% PASS
└─ ✅ Component 3 完成

Day 7: Issue #4 統合確認
├─ ./run_tests.sh issue-4-all
│  期待: 50+ テスト, 100% PASS
├─ DB 状態確認クエリ実行
├─ データ品質検証
└─ ✅ Issue #4 完全完成
```

---

## 一気実行スクリプト

### **実装予定のスクリプト**

```bash
#!/bin/bash
# run_tests.sh の拡張 - Phase 2 テスト実行

case "$1" in
  # Issue #4: Context 集約
  issue-4-component-1)
    pytest test/unit/test_context_analyzer.py -v ;;
  issue-4-component-2)
    pytest test/unit/test_context_master.py \
            test/regression/test_context_master_db.py -v ;;
  issue-4-component-3)
    pytest test/unit/test_context_aggregator.py \
            test/integration/test_context_aggregator_with_xbrl.py -v ;;
  issue-4-all)
    pytest test/unit/test_context_*.py \
            test/integration/test_context_*.py \
            test/regression/test_context_*.py -v ;;

  # 為替レート動的化
  exchange-rate-all)
    pytest test/unit/test_exchange_rate_*.py \
            test/integration/test_fixer_io_*.py -v ;;

  # 複数期間データ
  multi-period-all)
    pytest test/unit/test_multi_year_*.py \
            test/regression/test_multi_period_*.py -v ;;

  # BFF REST API
  bff-api-all)
    pytest test/unit/test_api_*.py \
            test/integration/test_api_*.py -v ;;

  # Phase 2 全体
  phase2-all)
    pytest test/ -v --tb=short ;;

  # データベース検証クエリ
  verify-issue-4)
    psql -U edinet_user -d edinet -f sql/verify_context_aggregation.sql ;;

  *)
    echo "Unknown option: $1" ;;
esac
```

### **実際の実行コマンド例**

```bash
# ✅ 開発中（高速フィードバック）
pytest test/unit/test_context_analyzer.py::TestConsolidationDetection::test_consolidated_member -v

# ✅ Component 完成確認
pytest test/unit/test_context_analyzer.py -v --cov=src/lib/context_analyzer

# ✅ コンポーネント統合確認
./run_tests.sh issue-4-component-1
./run_tests.sh issue-4-component-2
./run_tests.sh issue-4-component-3

# ✅ Issue #4 全体確認
./run_tests.sh issue-4-all

# ✅ Phase 2 全体確認
./run_tests.sh phase2-all

# ✅ リリース前最終確認
./run_tests.sh phase2-all && ./run_tests.sh verify-issue-4
```

---

## テスト実行チェックリスト

### **各チェックポイントで実行すべき項目**

#### **Component 完成時**

```
□ Unit テスト 100% PASS
□ コードカバレッジ > 90%
□ 実行時間 < 10秒
□ エラーハンドリング確認
□ エッジケース テスト完了
```

#### **イニシアティブ完成時**

```
□ すべての Component テスト PASS
□ 統合テスト PASS
□ DB 状態確認
  ├─ テーブル存在確認
  ├─ インデックス確認
  ├─ 制約条件確認
  └─ データ整合性確認
□ ドキュメント更新
□ コード品質チェック（Lint）
```

#### **Phase 2 完成時**

```
□ 4つすべてのイニシアティブが完成
□ 全テスト 100% PASS
□ パフォーマンステスト OK
  ├─ API レスポンス < 500ms
  ├─ DB クエリ < 100ms
  └─ 並行処理テスト OK
□ セキュリティテスト
□ ドキュメント完備
□ リリース前 QA 完了
```

---

## 答え: 実行単位と実行方法

### **推奨される実行単位**

```
┌──────────────────────────────────────────────┐
│ 推奨実行単位: コンポーネント単位            │
├──────────────────────────────────────────────┤
│                                              │
│ 🎯 Issue #4 の場合:                        │
│    Component 1: Context Analyzer (2-3h)    │
│    Component 2: Context Master (2-3h)      │
│    Component 3: ContextAggregator (3-4h)   │
│                                              │
│ ✅ 実行可能：YES                           │
│    各 Component ごと一気実行可能            │
│                                              │
│ 実行時間:                                   │
│    Component 単位: 5-15秒                   │
│    イニシアティブ単位: 15-30秒              │
│    Phase 2 全体: 30-60秒                    │
│                                              │
│ 頻度:                                       │
│    開発中: Component テスト (毎回)          │
│    完成時: イニシアティブテスト (1回)       │
│    リリース前: Phase 2 全体 (1回)           │
│                                              │
└──────────────────────────────────────────────┘
```

### **実行方法**

```bash
# 最小単位（関数）
pytest test/unit/test_context_analyzer.py::TestConsolidationDetection::test_consolidated_member -v

# Component 単位（実行可能 ✅）
./run_tests.sh issue-4-component-1

# イニシアティブ単位（実行可能 ✅）
./run_tests.sh issue-4-all

# Phase 2 全体（実行可能 ✅）
./run_tests.sh phase2-all
```

---

**Status:** ✅ テスト実行単位確定
**Next:** Component ごとの実装と即座のテスト実行
**Last Updated:** 2026-01-30
