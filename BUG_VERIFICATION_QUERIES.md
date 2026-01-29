# Bug Fix Verification - SQL Query Guide
**Date:** 2026-01-29
**Database:** PostgreSQL EDINET

After applying the bug fixes to `parse_xbrl.py`, use these SQL queries to verify the fixes are working correctly.

---

## Setup: Connect to Database

```bash
psql -h localhost -U edinet_user -d edinet
```

Or if you prefer to run queries from Python:

```python
import psycopg2
from datetime import datetime

conn = psycopg2.connect(
    host="localhost",
    user="edinet_user",
    database="edinet",
    port=5432
)
cur = conn.cursor()
```

---

## Bug #1 Verification: 連結/単体フラグ

### Query 1.1: Check is_consolidated Distribution

```sql
-- Should NOT be all NULL after fix
SELECT
    is_consolidated,
    COUNT(*) as count
FROM staging.context
GROUP BY is_consolidated
ORDER BY is_consolidated;
```

**Expected Result After Fix:**
```
 is_consolidated | count
─────────────────┼────────
 f               | ~150   (False = standalone/nonconsolidated)
 t               | ~250   (True = consolidated)
 NULL            | ~50    (Unknown - no consolidation marker)
─────────────────┼────────
(3 rows)
```

**Expected Result Before Fix:**
```
 is_consolidated | count
─────────────────┼────────
 NULL            | ~450   (All NULL!)
─────────────────┼────────
(1 row)
```

### Query 1.2: Sample Consolidated vs Standalone Contexts

```sql
-- Show examples of consolidated contexts
SELECT
    context_ref,
    is_consolidated,
    dimensions,
    period_type,
    period_end
FROM staging.context
WHERE is_consolidated = true
LIMIT 3;

-- Show examples of standalone contexts
SELECT
    context_ref,
    is_consolidated,
    dimensions,
    period_type,
    period_end
FROM staging.context
WHERE is_consolidated = false
LIMIT 3;
```

### Query 1.3: Consolidation Status by Company

```sql
-- Which companies have both consolidated and standalone statements?
SELECT
    doc_id,
    is_consolidated,
    COUNT(*) as context_count
FROM staging.context
GROUP BY doc_id, is_consolidated
ORDER BY doc_id, is_consolidated;
```

**Interpretation:**
- If you see both True and False for a doc_id → Company files both types ✅
- If you see NULL mixed with True/False → Some contexts lack consolidation marker (expected)

---

## Bug #7 Verification: nil値処理

### Query 7.1: Check nil Facts Have NULL Values

```sql
-- Nil facts should have NULL values, not stored numbers
SELECT
    COUNT(*) as total_nil_facts,
    COUNT(CASE WHEN value_numeric IS NOT NULL THEN 1 END) as nil_with_numeric,
    COUNT(CASE WHEN value_text IS NOT NULL THEN 1 END) as nil_with_text
FROM staging.fact
WHERE is_nil = true;
```

**Expected Result After Fix:**
```
 total_nil_facts | nil_with_numeric | nil_with_text
─────────────────┼──────────────────┼───────────────
         ~200    |        0          |       0
─────────────────┼──────────────────┼───────────────
(1 row)
```

**Expected Result Before Fix:**
```
 total_nil_facts | nil_with_numeric | nil_with_text
─────────────────┼──────────────────┼───────────────
         ~200    |       ~80        |      ~120     ❌ WRONG!
─────────────────┼──────────────────┼───────────────
(1 row)
```

### Query 7.2: Sample Nil Facts

```sql
-- Show examples of nil facts (should all have NULL values)
SELECT
    concept_name,
    is_nil,
    value_numeric,
    value_text,
    decimals
FROM staging.fact
WHERE is_nil = true
LIMIT 10;
```

**Expected columns after fix:**
```
       concept_name        | is_nil | value_numeric | value_text | decimals
──────────────────────────┼────────┼───────────────┼────────────┼──────────
 CostOfSalesOrCostsOfRev  | t      | NULL          | NULL       | 0
 GeneralAndAdminExpense   | t      | NULL          | NULL       | 0
 ...
```

All `value_numeric` and `value_text` should be NULL.

### Query 7.3: Regular Facts (Non-nil) Should Still Have Values

```sql
-- Regular facts (is_nil=false) should have values populated
SELECT
    concept_name,
    is_nil,
    value_numeric,
    value_text,
    COUNT(*) as fact_count
FROM staging.fact
WHERE is_nil = false
GROUP BY concept_name, is_nil, value_numeric, value_text
LIMIT 10;
```

**Expected:** value_numeric or value_text should be populated (not NULL)

---

## Bug #4 Verification: Decimal正規化

### Query 4.1: Check Decimal Normalization Applied

```sql
-- Verify large numbers are properly scaled by decimals
-- Example: 1234567 with decimals=-3 should be stored as 1234567000
SELECT
    concept_name,
    value_numeric,
    decimals,
    value_numeric * POWER(10, -decimals) as scaled_value
FROM staging.fact
WHERE decimals < 0  -- These require upward scaling
    AND value_numeric IS NOT NULL
    AND is_nil = false
LIMIT 10;
```

**What This Shows:**
- If decimals = -3, the value should be multiplied by 1000
- Arelle pre-does this (xValue is already normalized)
- So displayed `value_numeric` is already the correct magnitude

### Query 4.2: Distribution of Decimal Values

```sql
-- Shows precision levels in the dataset
SELECT
    decimals,
    COUNT(*) as fact_count,
    MIN(value_numeric) as min_value,
    MAX(value_numeric) as max_value
FROM staging.fact
WHERE value_numeric IS NOT NULL
    AND is_nil = false
GROUP BY decimals
ORDER BY decimals DESC;
```

**Typical Result for Japanese financials:**
```
 decimals | fact_count | min_value | max_value
──────────┼────────────┼───────────┼────────────
    0     |   3000     |  -50000   | 250000000  (whole numbers, billions)
   -2     |   500      |    0.25   | 1000000    (hundredths)
   -3     |   800      |    1      | 500000000  (thousands)
  NULL    |   200      |   (various)
```

### Query 4.3: Spot-Check Specific Companies' Revenue (Should Be Large Numbers)

```sql
-- Revenue figures should be in billions (JPY)
-- After normalization, should be very large numbers like 100000000000
SELECT
    doc_id,
    concept_name,
    value_numeric,
    decimals,
    CASE
        WHEN concept_name ILIKE '%Sales%' OR concept_name ILIKE '%Revenue%'
        THEN 'Revenue'
    END as category
FROM staging.fact
WHERE (concept_name ILIKE '%Sales%' OR concept_name ILIKE '%Revenue%')
    AND value_numeric IS NOT NULL
    AND is_nil = false
LIMIT 10;
```

**Expected:** Revenue figures in millions/billions JPY, e.g., 100000000000 (100 billion JPY)

---

## Comprehensive Health Check Query

Run this after re-parsing to ensure all fixes are working:

```sql
-- Overall data quality check after bug fixes
WITH fact_stats AS (
    SELECT
        COUNT(*) as total_facts,
        COUNT(CASE WHEN is_nil = true THEN 1 END) as nil_facts,
        COUNT(CASE WHEN is_nil = false THEN 1 END) as non_nil_facts,
        COUNT(CASE WHEN value_numeric IS NOT NULL THEN 1 END) as numeric_facts,
        COUNT(CASE WHEN value_text IS NOT NULL THEN 1 END) as text_facts,
        COUNT(CASE WHEN is_nil = true AND value_numeric IS NOT NULL THEN 1 END) as bug7_violations
    FROM staging.fact
),
context_stats AS (
    SELECT
        COUNT(*) as total_contexts,
        COUNT(CASE WHEN is_consolidated = true THEN 1 END) as consolidated,
        COUNT(CASE WHEN is_consolidated = false THEN 1 END) as standalone,
        COUNT(CASE WHEN is_consolidated IS NULL THEN 1 END) as unknown_cons
    FROM staging.context
)
SELECT
    -- Fact statistics
    f.total_facts,
    f.nil_facts,
    f.non_nil_facts,
    f.numeric_facts,
    f.text_facts,
    ROUND(100.0 * f.numeric_facts / f.total_facts, 1) as numeric_percent,
    f.bug7_violations as "⚠️ Bug#7 Issues",

    -- Context statistics
    c.total_contexts,
    c.consolidated as cons_contexts,
    c.standalone as standalone_contexts,
    c.unknown_cons as unknown_cons,
    ROUND(100.0 * (c.consolidated + c.standalone) / c.total_contexts, 1) as cons_coverage

FROM fact_stats f, context_stats c;
```

**Expected Output After All Fixes:**
```
 total_facts | nil_facts | numeric_facts | numeric_percent | ⚠️ Bug#7 Issues | cons_coverage
─────────────┼───────────┼───────────────┼─────────────────┼─────────────────┼──────────────
     7677    |    200    |      5422     |      70.6%      |        0        |      86.7%
```

The key metric is **⚠️ Bug#7 Issues = 0** (no nil facts with values)

---

## Before/After Comparison Query

To compare results before and after bug fixes:

```sql
-- Create comparison table if fixes were applied to subset
SELECT
    '🔴 Before Fix' as status,
    COUNT(*) as nil_facts,
    COUNT(CASE WHEN value_numeric IS NOT NULL THEN 1 END) as nil_with_values,
    ROUND(100.0 * COUNT(CASE WHEN value_numeric IS NOT NULL THEN 1 END)
          / COUNT(*), 1) as percent_with_values
FROM staging.fact
WHERE is_nil = true
    AND doc_id IN ('S100LUF2')  -- Subset you re-parsed

UNION ALL

SELECT
    '✅ After Fix' as status,
    COUNT(*) as nil_facts,
    COUNT(CASE WHEN value_numeric IS NOT NULL THEN 1 END) as nil_with_values,
    ROUND(100.0 * COUNT(CASE WHEN value_numeric IS NOT NULL THEN 1 END)
          / COUNT(*), 1) as percent_with_values
FROM staging.fact
WHERE is_nil = true
    AND doc_id NOT IN ('S100LUF2');  -- Existing old data
```

---

## Step-by-Step Testing Procedure

### Step 1: Run parse_xbrl.py with Fixed Code

```bash
cd /Users/ktkrr/root/10_dev/FINREPO

# Re-parse one company to test
python3 src/edinet/parse_xbrl.py --doc-id S100LUF2

# Check for errors in logs
tail -50 data/logs/edinet/2026/01/29/doc_*.jsonl
```

### Step 2: Run Bug #1 Verification

```bash
psql -h localhost -U edinet_user -d edinet <<EOF
SELECT
    is_consolidated,
    COUNT(*)
FROM staging.context
WHERE doc_id = 'S100LUF2'
GROUP BY is_consolidated;
EOF
```

**Expected:** Should show values like `t | 10`, `f | 5`, not all NULL

### Step 3: Run Bug #7 Verification

```bash
psql -h localhost -U edinet_user -d edinet <<EOF
SELECT
    COUNT(*) as nil_facts,
    COUNT(CASE WHEN value_numeric IS NOT NULL THEN 1 END) as with_numeric,
    COUNT(CASE WHEN value_text IS NOT NULL THEN 1 END) as with_text
FROM staging.fact
WHERE doc_id = 'S100LUF2'
    AND is_nil = true;
EOF
```

**Expected:** with_numeric = 0, with_text = 0

### Step 4: Run Bug #4 Verification

```bash
psql -h localhost -U edinet_user -d edinet <<EOF
SELECT
    concept_name,
    value_numeric,
    decimals,
    LENGTH(value_numeric::text) as magnitude
FROM staging.fact
WHERE doc_id = 'S100LUF2'
    AND concept_name ILIKE '%Sales%'
    AND value_numeric IS NOT NULL
LIMIT 5;
EOF
```

**Expected:** Large numbers (billions), appropriate to Japanese company financials

### Step 5: Run Comprehensive Health Check

```bash
psql -h localhost -U edinet_user -d edinet \
    -f /Users/ktkrr/root/10_dev/FINREPO/BUG_VERIFICATION_QUERIES.md
```

Or paste the comprehensive health check query above.

---

## Interpretation Guide

### Bug #1 (連結/単体フラグ) ✅ Verification

| Result | Status | Action |
|--------|--------|--------|
| `is_consolidated` has True/False/NULL | ✅ PASS | Proceed |
| `is_consolidated` all NULL | ❌ FAIL | Check dimension parsing |
| Only consolidated, no standalone | ⚠️ WARN | Check source XBRL |

### Bug #7 (nil処理) ✅ Verification

| Result | Status | Action |
|--------|--------|--------|
| nil_with_numeric = 0 | ✅ PASS | Proceed |
| nil_with_numeric > 0 | ❌ FAIL | Recheck fix implementation |
| nil_facts = 0 | ⚠️ NOTE | No nil facts in dataset |

### Bug #4 (Decimal正規化) ✅ Verification

| Result | Status | Action |
|--------|--------|--------|
| Revenue in billions (10^9) | ✅ PASS | Proceed |
| Revenue in millions (10^6) | ❌ FAIL | Decimal scaling broken |
| Consistent magnitude per decimals | ✅ PASS | Normalization working |

---

## Troubleshooting

### Problem: is_consolidated Still All NULL

**Possible Causes:**
1. XBRL source files don't contain consolidation dimensions
2. Dimension member names don't match "Consolidated"/"NonConsolidated" patterns
3. Bug #1 fix wasn't applied correctly

**Debug Steps:**
```sql
-- Check what dimension values actually look like
SELECT DISTINCT dimensions
FROM staging.context
LIMIT 5;

-- Check if any contain "Consolidated"
SELECT COUNT(*) as has_consolidated
FROM staging.context
WHERE dimensions::text ILIKE '%consolidated%';
```

### Problem: Nil Facts Still Have Values

**Possible Causes:**
1. Bug #7 fix wasn't applied correctly
2. parse_xbrl.py being run from wrong directory
3. Database not updated (cached connection)

**Debug Steps:**
```bash
# Verify the fix is in the file
grep -A 5 "Bug #7 Fix" src/edinet/parse_xbrl.py

# Clear any python cache
find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null

# Rerun with explicit path
python3 /Users/ktkrr/root/10_dev/FINREPO/src/edinet/parse_xbrl.py --doc-id S100LUF2
```

### Problem: Decimal Values Still Wrong

**Possible Causes:**
1. Using old `value` instead of `xValue` from Arelle
2. Additional decimal scaling in downstream code

**Debug Steps:**
```sql
-- Compare with raw Arelle values
SELECT
    concept_name,
    value_numeric,
    decimals,
    value_numeric / POWER(10, ABS(decimals)) as back_calculated
FROM staging.fact
WHERE decimals < -2
    AND value_numeric > 1000000;
```

---

## Success Criteria

You've successfully fixed all three bugs when:

✅ **Bug #1:** `SELECT COUNT(DISTINCT is_consolidated) FROM staging.context` returns 3 (true, false, null)

✅ **Bug #7:** `SELECT COUNT(*) FROM staging.fact WHERE is_nil=true AND value_numeric IS NOT NULL` returns 0

✅ **Bug #4:** Revenue figures are stored as billions (e.g., 100000000000) not millions

✅ **Overall:** Total facts = 7,677, numeric facts = 5,422+ (70.6%+)

---

**Testing Status:** Ready to execute
**Next Steps:** Run parse_xbrl.py → Execute verification queries → Review results
