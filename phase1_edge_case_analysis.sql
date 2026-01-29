-- Edge Cases and Risk Detection Analysis
\echo '=========================================='
\echo '=== SECTION 5: EDGE CASES & RISK ANALYSIS ==='
\echo '=========================================='

\echo ''
\echo '5.1 NULL Value Analysis'
SELECT 
    COUNT(CASE WHEN value_numeric IS NULL AND value_text IS NULL THEN 1 END) as facts_with_no_value,
    COUNT(CASE WHEN value_text IS NOT NULL AND is_nil = false THEN 1 END) as text_values,
    COUNT(CASE WHEN is_nil = true THEN 1 END) as nil_flags,
    COUNT(CASE WHEN decimals IS NULL THEN 1 END) as missing_decimals,
    COUNT(CASE WHEN unit_id IS NULL THEN 1 END) as missing_unit,
    COUNT(CASE WHEN context_id IS NULL THEN 1 END) as missing_context,
    COUNT(*) as total_facts
FROM staging.fact;

\echo ''
\echo '5.2 Unit Normalization Anomalies'
SELECT 
    COUNT(*) as total_numeric_values,
    COUNT(CASE WHEN unit_ref_normalized NOT IN ('JPY', 'pure', 'shares') THEN 1 END) as unmapped_units,
    COUNT(CASE WHEN unit_ref_normalized = 'JPY' AND ABS(value_normalized) > 1000000000000 THEN 1 END) as extreme_large_jpy,
    COUNT(CASE WHEN unit_ref_normalized = 'JPY' AND value_normalized < 0 THEN 1 END) as negative_jpy,
    COUNT(CASE WHEN value_numeric IS NOT NULL AND value_normalized IS NULL THEN 1 END) as conversion_failures
FROM staging.fact
WHERE value_numeric IS NOT NULL;

\echo ''
\echo '5.3 Concept-Context Mismatch Detection'
SELECT 
    COUNT(*) as total_facts,
    COUNT(DISTINCT doc_id) as affected_companies,
    COUNT(CASE WHEN concept_name IS NULL THEN 1 END) as null_concepts,
    COUNT(CASE WHEN context_id IS NULL THEN 1 END) as null_contexts,
    COUNT(CASE WHEN unit_id IS NULL AND unit_ref_normalized IS NOT NULL THEN 1 END) as unit_normalization_orphans
FROM staging.fact;

\echo ''
\echo '5.4 Concept Hierarchy Validation'
SELECT 
    COUNT(DISTINCT child_concept_name) as total_hierarchy_children,
    COUNT(DISTINCT child_concept_name) FILTER (WHERE child_concept_name IN (
        SELECT DISTINCT concept_name FROM staging.fact
    )) as children_in_facts,
    COUNT(DISTINCT parent_concept_name) FILTER (WHERE parent_concept_name IN (
        SELECT DISTINCT concept_name FROM staging.fact
    )) as parents_in_facts,
    COUNT(*) as total_relationships
FROM staging.concept_hierarchy;

\echo ''
\echo '5.5 Top Concepts WITHOUT Hierarchy Mapping'
SELECT 
    f.concept_name,
    COUNT(DISTINCT f.doc_id) as company_count,
    COUNT(*) as fact_count,
    CASE WHEN ch.child_concept_name IS NULL THEN 'NO_HIERARCHY' ELSE 'HAS_HIERARCHY' END as hierarchy_status
FROM staging.fact f
LEFT JOIN staging.concept_hierarchy ch ON f.concept_name = ch.child_concept_name
WHERE f.concept_name IS NOT NULL
GROUP BY f.concept_name, ch.child_concept_name
HAVING COUNT(*) > 10 AND ch.child_concept_name IS NULL
ORDER BY COUNT(*) DESC
LIMIT 15;

\echo ''
\echo '5.6 Duplicate Context Detection (Same Fact, Multiple Contexts)'
SELECT 
    doc_id,
    concept_name,
    COUNT(DISTINCT context_id) as context_count,
    COUNT(*) as fact_count,
    COUNT(DISTINCT COALESCE(value_numeric, 0)) as distinct_values
FROM staging.fact
WHERE concept_name IS NOT NULL
GROUP BY doc_id, concept_name
HAVING COUNT(DISTINCT context_id) > 1 AND COUNT(DISTINCT COALESCE(value_numeric, 0)) > 1
ORDER BY fact_count DESC
LIMIT 20;

\echo ''
\echo '5.7 Performance Index Analysis'
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'staging'
ORDER BY idx_scan DESC;

