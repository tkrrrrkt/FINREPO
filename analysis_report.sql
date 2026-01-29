-- ===== PHASE 1 DETAILED ANALYSIS REPORT =====
-- 5企業 7,677件データ全体分析

\echo '=========================================='
\echo 'DETAILED ANALYSIS REPORT - PHASE 1 VALIDATION'
\echo '=========================================='
\echo 'Database: EDINET (5 companies, 7,677 facts)'
\echo 'Date: 2026-01-29'
\echo ''

-- ===== SECTION 1: CONTEXT PATTERN ANALYSIS =====
\echo '=== SECTION 1: CONTEXT PATTERN ANALYSIS ==='
\echo ''
\echo '1.1 Context Diversity by Company'
SELECT 
    doc_id,
    COUNT(DISTINCT context_ref) as unique_contexts,
    COUNT(DISTINCT period_end) as unique_periods,
    COUNT(DISTINCT is_consolidated) as consolidation_types,
    COUNT(*) as total_contexts
FROM staging.context
GROUP BY doc_id
ORDER BY doc_id;

\echo ''
\echo '1.2 Consolidation Type Distribution'
SELECT 
    COALESCE(is_consolidated::text, 'NULL') as consolidation_type,
    COUNT(DISTINCT doc_id) as company_count,
    COUNT(DISTINCT context_ref) as unique_contexts,
    COUNT(*) as total_records
FROM staging.context
GROUP BY is_consolidated
ORDER BY is_consolidated DESC;

\echo ''
\echo '1.3 Period Type Distribution'
SELECT 
    period_type,
    COUNT(DISTINCT doc_id) as companies,
    COUNT(DISTINCT context_ref) as unique_contexts,
    COUNT(*) as count
FROM staging.context
WHERE period_type IS NOT NULL
GROUP BY period_type
ORDER BY count DESC;

\echo ''
-- ===== SECTION 2: CONCEPT MAPPING =====
\echo '=== SECTION 2: CONCEPT MAPPING COMPLETENESS ==='
\echo ''
\echo '2.1 Concept Usage Summary'
SELECT 
    COUNT(DISTINCT concept_name) as total_concepts,
    COUNT(DISTINCT concept_qname) as total_qnames,
    COUNT(*) as total_facts,
    ROUND(COUNT(DISTINCT concept_name)::numeric / COUNT(*) * 100, 2) as concept_density_pct
FROM staging.fact
WHERE concept_name IS NOT NULL;

\echo ''
\echo '2.2 Top 25 Most Frequent Concepts'
SELECT 
    concept_name,
    COUNT(DISTINCT doc_id) as company_coverage,
    COUNT(*) as fact_count,
    COUNT(DISTINCT context_id) as context_count,
    ROUND(COUNT(DISTINCT doc_id)::numeric / 5 * 100)::int as coverage_pct
FROM staging.fact
WHERE concept_name IS NOT NULL
GROUP BY concept_name
ORDER BY COUNT(*) DESC
LIMIT 25;

\echo ''
\echo '2.3 Concept Coverage Analysis'
WITH concept_stats AS (
    SELECT 
        COUNT(DISTINCT concept_name) FILTER (WHERE COUNT(DISTINCT doc_id) = 5) as all_5_cos,
        COUNT(DISTINCT concept_name) FILTER (WHERE COUNT(DISTINCT doc_id) >= 3) as all_3plus_cos,
        COUNT(DISTINCT concept_name) as total_concepts
    FROM (
        SELECT concept_name, doc_id FROM staging.fact WHERE concept_name IS NOT NULL GROUP BY concept_name, doc_id
    ) sub
    GROUP BY concept_name
)
SELECT 
    SUM(all_5_cos) as concepts_in_all_5_companies,
    SUM(all_3plus_cos) as concepts_in_3plus_companies,
    SUM(total_concepts) as total_concepts,
    ROUND(SUM(all_5_cos)::numeric / SUM(total_concepts) * 100, 1) as coverage_all_5_pct,
    ROUND(SUM(all_3plus_cos)::numeric / SUM(total_concepts) * 100, 1) as coverage_3plus_pct
FROM concept_stats;

\echo ''
\echo '2.4 Company-wise Concept Counts'
SELECT 
    doc_id,
    COUNT(DISTINCT concept_name) as distinct_concepts,
    COUNT(*) as total_facts,
    ROUND(COUNT(*)::numeric / COUNT(DISTINCT concept_name), 1) as avg_facts_per_concept
FROM staging.fact
WHERE concept_name IS NOT NULL
GROUP BY doc_id
ORDER BY COUNT(DISTINCT concept_name) DESC;

\echo ''
-- ===== SECTION 3: UNIT NORMALIZATION =====
\echo '=== SECTION 3: UNIT NORMALIZATION VALIDATION ==='
\echo ''
\echo '3.1 Unit Normalization Summary'
SELECT 
    unit_ref_normalized,
    COUNT(DISTINCT doc_id) as company_count,
    COUNT(*) as fact_count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM staging.fact) * 100, 1) as pct_of_total
FROM staging.fact
WHERE unit_ref_normalized IS NOT NULL
GROUP BY unit_ref_normalized
ORDER BY COUNT(*) DESC;

\echo ''
\echo '3.2 Value Normalization Quality'
SELECT 
    COUNT(*) as total_with_normalized,
    COUNT(CASE WHEN value_normalized IS NOT NULL THEN 1 END) as has_value,
    COUNT(CASE WHEN value_numeric IS NOT NULL AND value_normalized IS NOT NULL THEN 1 END) as has_both,
    COUNT(CASE WHEN value_numeric IS NULL AND value_normalized IS NOT NULL THEN 1 END) as normalized_only,
    ROUND(COUNT(CASE WHEN value_numeric IS NOT NULL AND value_normalized IS NOT NULL THEN 1 END)::numeric / 
          COUNT(CASE WHEN value_normalized IS NOT NULL THEN 1 END) * 100, 1) as conversion_quality_pct
FROM staging.fact
WHERE unit_ref_normalized IS NOT NULL AND unit_ref_normalized IN ('JPY', 'pure', 'shares');

\echo ''
-- ===== SECTION 4: CONCEPT HIERARCHY =====
\echo '=== SECTION 4: CONCEPT HIERARCHY EXTRACTION ==='
\echo ''
\echo '4.1 Hierarchy Statistics'
SELECT 
    COUNT(DISTINCT child_concept_name) as unique_child_concepts,
    COUNT(DISTINCT parent_concept_name) as unique_parent_concepts,
    COUNT(*) as total_relationships,
    MAX(hierarchy_level) as max_hierarchy_level,
    MIN(hierarchy_level) as min_hierarchy_level,
    COUNT(DISTINCT doc_id) as documents_with_hierarchy
FROM staging.concept_hierarchy;

\echo ''
\echo '4.2 Hierarchy Level Distribution'
SELECT 
    hierarchy_level,
    COUNT(DISTINCT child_concept_name) as concept_count,
    COUNT(*) as relationship_count
FROM staging.concept_hierarchy
GROUP BY hierarchy_level
ORDER BY hierarchy_level ASC;

