-- Issue #3: Unit正規化 - DB スキーマ変更
-- Date: 2026-01-29
-- Description: staging.fact テーブルに Unit 正規化カラムを追加

BEGIN;

-- 1. staging.fact テーブルに正規化カラムを追加
ALTER TABLE staging.fact
ADD COLUMN unit_ref_normalized VARCHAR(20) DEFAULT 'JPY',
ADD COLUMN value_normalized DECIMAL(20, 6);

-- 2. インデックス作成（クエリ最適化用）
CREATE INDEX IF NOT EXISTS idx_unit_normalized
ON staging.fact(unit_ref_normalized);

CREATE INDEX IF NOT EXISTS idx_value_normalized
ON staging.fact(value_normalized)
WHERE value_normalized IS NOT NULL;

-- 3. Unit マスターテーブル作成（参考用・メタデータ）
CREATE TABLE IF NOT EXISTS core.unit_master (
    original_unit_ref VARCHAR(50) PRIMARY KEY,
    normalized_unit VARCHAR(20) NOT NULL,
    unit_type VARCHAR(20) NOT NULL,
    conversion_factor DECIMAL(20, 6) NOT NULL,
    display_symbol VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- 4. Unit マスターテーブルにデータを挿入
INSERT INTO core.unit_master
(original_unit_ref, normalized_unit, unit_type, conversion_factor, display_symbol, notes)
VALUES
    ('JPY', 'JPY', 'currency', 1, '¥', 'Japanese Yen'),
    ('USD', 'JPY', 'currency', 145, '$', '1 USD = 145 JPY (2024-01 reference rate)'),
    ('EUR', 'JPY', 'currency', 155, '€', '1 EUR = 155 JPY (2024-01 reference rate)'),
    ('pure', 'pure', 'pure', 1, '', 'Pure number (ratio, percentage, etc.)'),
    ('shares', 'shares', 'count', 1, '株', 'Number of shares')
ON CONFLICT (original_unit_ref) DO UPDATE SET
    normalized_unit = EXCLUDED.normalized_unit,
    unit_type = EXCLUDED.unit_type,
    conversion_factor = EXCLUDED.conversion_factor,
    display_symbol = EXCLUDED.display_symbol,
    updated_at = CURRENT_TIMESTAMP,
    notes = EXCLUDED.notes;

-- 5. 既存データの Unit 正規化値を計算（バッチ処理用クエリ）
-- Note: これは実行時に個別に実行される（parse_xbrl.py で自動実行）
-- UPDATE staging.fact
-- SET unit_ref_normalized = 'JPY', value_normalized = value_numeric
-- WHERE unit_ref = 'JPY' AND value_numeric IS NOT NULL;
--
-- UPDATE staging.fact
-- SET unit_ref_normalized = 'JPY', value_normalized = value_numeric * 145
-- WHERE unit_ref = 'USD' AND value_numeric IS NOT NULL;
--
-- UPDATE staging.fact
-- SET unit_ref_normalized = 'JPY', value_normalized = value_numeric * 155
-- WHERE unit_ref = 'EUR' AND value_numeric IS NOT NULL;
--
-- UPDATE staging.fact
-- SET unit_ref_normalized = unit_ref, value_normalized = value_numeric
-- WHERE unit_ref IN ('pure', 'shares') AND value_numeric IS NOT NULL;

COMMIT;

-- 検証クエリ:
-- SELECT
--     unit_ref,
--     unit_ref_normalized,
--     COUNT(*) as count,
--     ROUND(AVG(COALESCE(value_normalized, 0)), 2) as avg_normalized
-- FROM staging.fact
-- WHERE value_numeric IS NOT NULL
-- GROUP BY unit_ref, unit_ref_normalized
-- ORDER BY count DESC;
