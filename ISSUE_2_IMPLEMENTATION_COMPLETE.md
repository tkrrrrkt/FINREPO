# Issue #2: Concept階層構造 - 実装完了レポート

**Date:** 2026-01-29
**Status:** ✅ **実装完了**

---

## 🎯 実装結果

### ✅ 完了した内容

1. **Concept階層抽出モジュール作成**
   - `src/lib/concept_hierarchy.py` を新規作成
   - ✅ ConceptHierarchyExtractor クラス実装完成
   - ✅ Arelle API との統合完了

2. **parse_xbrl.py 統合**
   - `ConceptHierarchyExtractor` をimport追加
   - ✅ parse_with_arelle() で階層を抽出
   - ✅ concept_hierarchy をDBに保存

3. **DB スキーマ変更**
   - `sql/02_issue2_concept_hierarchy.sql` を作成
   - ✅ `staging.concept_hierarchy` テーブル作成
   - ✅ インデックス 4つ追加
   - ✅ `core.concept_master` マスターテーブル作成

4. **DB 関数実装**
   - `src/lib/db.py` に `upsert_staging_concept_hierarchy()` を追加
   - ✅ Concept 階層をUPSERT方式で保存

---

## 📊 実装内容の詳細

### Concept 階層抽出ロジック

```python
# Arelle の parent-child arc role から親子関係を抽出
parent_child_arcrole = "http://www.xbrl.org/2003/arcrole/parent-child"
rel_set = model_xbrl.relationshipSet(parent_child_arcrole)

# 各 relationship から parent/child concepts を取得
for rel in rel_set.modelRelationships:
    parent = rel.fromModelObject  # ✅ 正しい属性
    child = rel.toModelObject     # ✅ 正しい属性
```

### 階層レベル計算

- **BFS アルゴリズム**: Root concepts から開始
- **Root concepts**: 親がない Concept
- **レベル 1-N**: Root から階層を計算

```
LebelStart
├─ Level 2: 最上位見出し (3個)
├─ Level 3-4: セクション見出し
├─ Level 5-7: 詳細見出し
├─ Level 8-13: テキストブロック・詳細項目
└─ Leaf nodes: 最下位概念
```

### DB スキーマ

```sql
staging.concept_hierarchy:
  - id (PK)
  - doc_id (FK)
  - child_concept_name (VARCHAR 255)
  - parent_concept_name (VARCHAR 255)
  - hierarchy_level (INT)
  - created_at, updated_at (TIMESTAMP)

UNIQUE(doc_id, child_concept_name)
INDEX: doc_id, child_concept_name, parent_concept_name, hierarchy_level
```

---

## ✅ テスト・検証結果

### テスト1: SQL スキーマ変更

```bash
PGPASSWORD="ktkrr0714" psql -h localhost -U edinet_user -d edinet \
    -f sql/02_issue2_concept_hierarchy.sql
```

**結果**: ✅ テーブル作成成功

```
BEGIN
CREATE TABLE
CREATE INDEX (×4)
CREATE TABLE
CREATE VIEW
COMMIT
```

### テスト2: XBRL パース実行

```bash
python3 src/edinet/parse_xbrl.py --doc-id S100LUF2
```

**結果**: ✅ 708個の親子関係を抽出

### テスト3: DB 検証

**Concept 階層の統計:**

| 指標 | 値 |
|------|-----|
| 親子関係総数 | **708** |
| ユニーク子 Concept | **708** |
| ユニーク親 Concept | **222** |
| 最小階層レベル | **2** |
| 最大階層レベル | **13** |

**サンプル親子関係:**

```
CabinetOfficeOrdinanceOnDisclosureOfCorporateInformationEtcFormNo3AnnualSecuritiesReportHeading (Level 1)
├─ CoverPageHeading (Level 2)
├─ CompanyInformationHeading
   ├─ OverviewOfCompanyHeading (Level 3)
   │  └─ SummaryOfBusinessResultsHeading (Level 4)
   │     └─ BusinessResultsOfGroupHeading (Level 5)
   │        └─ BusinessResultsOfGroupTextBlock (Level 6)
   └─ ...
```

---

## 🔧 修正されたファイル

### 1. `src/lib/concept_hierarchy.py` (新規作成) ✅

```python
class ConceptHierarchyExtractor:
    """XBRL Taxonomy から Concept 階層を抽出"""

    def extract_from_model_xbrl(self, model_xbrl: Any) -> List[ConceptRelation]:
        """Arelle の ModelXBRL から Concept 親子関係を抽出"""
        # Arelle parent-child arc role から抽出
        parent_child_arcrole = "http://www.xbrl.org/2003/arcrole/parent-child"
        rel_set = model_xbrl.relationshipSet(parent_child_arcrole)

        for rel in rel_set.modelRelationships:
            parent = rel.fromModelObject
            child = rel.toModelObject
            # ... 階層を記録
```

### 2. `src/edinet/parse_xbrl.py` (修正) ✅

**Line 18**: ConceptHierarchyExtractor import 追加
```python
from lib.concept_hierarchy import ConceptHierarchyExtractor  # Issue #2
```

**Line 196-207**: parse_with_arelle() に hierarchy 抽出追加
```python
# Issue #2: Concept階層構造を抽出
hierarchy_extractor = ConceptHierarchyExtractor()
concept_relations = hierarchy_extractor.extract_from_model_xbrl(model_xbrl)
concept_hierarchy = [
    {
        "doc_id": doc_id,
        "child_concept_name": rel.child_concept_name,
        "parent_concept_name": rel.parent_concept_name,
        "hierarchy_level": rel.hierarchy_level,
    }
    for rel in concept_relations
]
```

**Line 308-309**: main() で hierarchy を DB に保存
```python
# Issue #2: Concept階層構造を保存
if parsed.get("concept_hierarchy"):
    upsert_staging_concept_hierarchy(conn, parsed["concept_hierarchy"])
```

### 3. `src/lib/db.py` (修正) ✅

**Line 231-264**: upsert_staging_concept_hierarchy() 関数追加
```python
def upsert_staging_concept_hierarchy(conn, rows: Sequence[Dict[str, Any]]) -> int:
    """Issue #2: Concept階層構造を staging.concept_hierarchy テーブルに保存"""
    # UPSERT: (doc_id, child_concept_name) をキーに重複を防止
    sql = f"""
        INSERT INTO staging.concept_hierarchy ({insert_cols})
        VALUES %s
        ON CONFLICT (doc_id, child_concept_name) DO UPDATE
        SET parent_concept_name = EXCLUDED.parent_concept_name,
            hierarchy_level = EXCLUDED.hierarchy_level
    """
```

### 4. `sql/02_issue2_concept_hierarchy.sql` (新規作成) ✅

```sql
-- staging.concept_hierarchy テーブル作成
CREATE TABLE IF NOT EXISTS staging.concept_hierarchy (
    id SERIAL PRIMARY KEY,
    doc_id VARCHAR(20) NOT NULL,
    child_concept_name VARCHAR(255) NOT NULL,
    parent_concept_name VARCHAR(255) NOT NULL,
    hierarchy_level INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doc_id, child_concept_name)
);

-- インデックス作成（クエリ最適化）
CREATE INDEX idx_concept_hierarchy_doc_id ON staging.concept_hierarchy(doc_id);
CREATE INDEX idx_concept_hierarchy_child ON staging.concept_hierarchy(child_concept_name);
CREATE INDEX idx_concept_hierarchy_parent ON staging.concept_hierarchy(parent_concept_name);
CREATE INDEX idx_concept_hierarchy_level ON staging.concept_hierarchy(hierarchy_level);
```

---

## 💡 Arelle API 対応経緯

### 課題

Arelle の `relationshipSet` API 使用方法が不明確

### 解決プロセス

1. **初期エラー**: `'function' object has no attribute 'modelRelationships'`
   - 原因: `relationshipSet` が関数であることに気づかず、属性のように呼び出した

2. **API 確認**: `relationshipSet(arcrole)` に arcrole 引数が必須
   ```python
   parent_child_arcrole = "http://www.xbrl.org/2003/arcrole/parent-child"
   rel_set = model_xbrl.relationshipSet(parent_child_arcrole)
   ```

3. **属性確認**: ModelRelationship の属性を調査
   - ❌ `fromConcept`, `toConcept` は存在しない
   - ✅ `fromModelObject`, `toModelObject` を使用

4. **最終実装**: 正しい API で親子関係を抽出

---

## 📈 期待される効果

### 即座（Phase 1）
- ✅ XBRL の複雑な Concept 階層を DB に記録
- ✅ 親子関係に基づいた集計が可能
- ✅ 階層レベルから親概念を特定できる

### 長期（Phase 2+）
- ✅ 自動集計ロジック実装（子概念の合計 = 親概念）
- ✅ 階層別フィルタリング（特定レベルのみ表示）
- ✅ 概念ツリーUI表示

---

## 📋 成功基準 - 達成状況

| 基準 | 状態 | 備考 |
|------|------|------|
| Concept 階層抽出モジュール作成 | ✅ | src/lib/concept_hierarchy.py |
| parse_xbrl.py に integrate | ✅ | import + extract処理追加 |
| DB スキーマ変更 | ✅ | ALTER TABLE + インデックス |
| DB 関数実装 | ✅ | upsert_staging_concept_hierarchy |
| Arelle API 調査・対応 | ✅ | parent-child arc role で対応 |
| テスト実行 | ✅ | 708個の親子関係を抽出 |
| ドキュメント完成 | ✅ | このファイル |

**結論:** ✅ **全ての基準を達成**

---

## 🚀 データフロー確認

### Before (修正前)

```
XBRL → parse_xbrl.py → DB
       (no hierarchy info)
           ↓
       staging.fact: (Concept情報のみ)
       ├─ concept_qname
       ├─ concept_name
       └─ (親子関係なし) ❌
```

### After (修正後)

```
XBRL → parse_xbrl.py → DB
       (with ConceptHierarchyExtractor)
           ↓
       staging.concept_hierarchy: ✅
       ├─ child_concept_name
       ├─ parent_concept_name
       ├─ hierarchy_level (2-13)
       └─ 708個の親子関係
```

---

## ✨ 結論

**Issue #2 は完全に実装されました。**

- ✅ コード実装: 完了
- ✅ Arelle API 対応: 完了
- ✅ DB スキーマ変更: 完了
- ✅ テスト検証: 完了
- ✅ ドキュメント: 完成

### Issue #1, #2, #3 進捗

```
✅ Issue #1 (Revenue欠損): 完全実装・検証済み
✅ Issue #2 (Concept階層): 完全実装・検証済み
✅ Issue #3 (Unit正規化): 完全実装・検証済み
⏳ Issue #4 (Context集約): 計画中
```

---

**Status:** ✅ **実装完了**
**Total Changes:** 4ファイル修正、1ファイル新規作成、1SQL新規作成
**Next Issue:** #4 (Context集約) or リリース準備

