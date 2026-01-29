-- Issue #2: Concept階層構造 - DB スキーマ変更
-- Date: 2026-01-29
-- Description: staging.concept_hierarchy テーブルを作成して Concept 親子関係を保存

BEGIN;

-- 1. staging.concept_hierarchy テーブル作成
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

-- 2. インデックス作成（クエリ最適化用）
CREATE INDEX IF NOT EXISTS idx_concept_hierarchy_doc_id
ON staging.concept_hierarchy(doc_id);

CREATE INDEX IF NOT EXISTS idx_concept_hierarchy_child
ON staging.concept_hierarchy(child_concept_name);

CREATE INDEX IF NOT EXISTS idx_concept_hierarchy_parent
ON staging.concept_hierarchy(parent_concept_name);

CREATE INDEX IF NOT EXISTS idx_concept_hierarchy_level
ON staging.concept_hierarchy(hierarchy_level);

-- 3. Concept マスターテーブル作成（参考用・メタデータ）
CREATE TABLE IF NOT EXISTS core.concept_master (
    concept_name VARCHAR(255) PRIMARY KEY,
    concept_type VARCHAR(50),
    hierarchy_level INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- 4. 階層検証用ビュー
CREATE OR REPLACE VIEW staging.concept_hierarchy_with_path AS
SELECT
    ch.id,
    ch.doc_id,
    ch.child_concept_name,
    ch.parent_concept_name,
    ch.hierarchy_level,
    ch.created_at,
    ch.updated_at
FROM staging.concept_hierarchy ch
ORDER BY ch.hierarchy_level ASC, ch.child_concept_name ASC;

COMMIT;

-- 検証クエリ:
-- 1. Concept 階層の確認
-- SELECT
--     hierarchy_level,
--     COUNT(DISTINCT child_concept_name) as concept_count,
--     COUNT(DISTINCT doc_id) as doc_count
-- FROM staging.concept_hierarchy
-- GROUP BY hierarchy_level
-- ORDER BY hierarchy_level ASC;
--
-- 2. 特定文書の階層構造
-- SELECT
--     hierarchy_level,
--     child_concept_name,
--     parent_concept_name
-- FROM staging.concept_hierarchy
-- WHERE doc_id = 'S100LUF2'
-- ORDER BY hierarchy_level ASC, child_concept_name ASC;
--
-- 3. 循環参照チェック（デバッグ用）
-- SELECT
--     ch1.child_concept_name,
--     ch2.parent_concept_name,
--     'CYCLE DETECTED' as alert
-- FROM staging.concept_hierarchy ch1
-- JOIN staging.concept_hierarchy ch2
--   ON ch1.parent_concept_name = ch2.child_concept_name
--   AND ch1.child_concept_name = ch2.parent_concept_name
-- WHERE ch1.doc_id = ch2.doc_id;
