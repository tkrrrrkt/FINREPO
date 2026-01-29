-- Seed data for core.concept_mapping (auto mapping from known tags)
-- Run after core.concept and core.standard_code are populated.

WITH mapping_pairs(namespace, element_name, standard_code, confidence) AS (
    VALUES
        -- J-GAAP (jppfs_cor)
        ('jppfs_cor', 'Assets', 'STD_ASSETS', 0.95),
        ('jppfs_cor', 'CurrentAssets', 'STD_CUR_ASSETS', 0.95),
        ('jppfs_cor', 'NoncurrentAssets', 'STD_NCA', 0.95),
        ('jppfs_cor', 'Liabilities', 'STD_LIAB', 0.95),
        ('jppfs_cor', 'CurrentLiabilities', 'STD_CUR_LIAB', 0.95),
        ('jppfs_cor', 'NoncurrentLiabilities', 'STD_NCL', 0.95),
        ('jppfs_cor', 'NetAssets', 'STD_NET_ASSETS', 0.95),
        ('jppfs_cor', 'ShareholdersEquity', 'STD_SH_EQUITY', 0.95),
        ('jppfs_cor', 'NetSales', 'STD_REVENUE', 0.95),
        ('jppfs_cor', 'CostOfSales', 'STD_COGS', 0.95),
        ('jppfs_cor', 'GrossProfit', 'STD_GROSS_PROFIT', 0.95),
        ('jppfs_cor', 'SellingGeneralAndAdministrativeExpenses', 'STD_SGA', 0.95),
        ('jppfs_cor', 'OperatingIncome', 'STD_OP_INCOME', 0.95),
        ('jppfs_cor', 'OrdinaryIncome', 'STD_ORD_INCOME', 0.95),
        ('jppfs_cor', 'ProfitLoss', 'STD_NET_INCOME', 0.95),
        ('jppfs_cor', 'NetCashProvidedByUsedInOperatingActivities', 'STD_CFO', 0.95),
        ('jppfs_cor', 'NetCashProvidedByUsedInInvestingActivities', 'STD_CFI', 0.95),
        ('jppfs_cor', 'NetCashProvidedByUsedInFinancingActivities', 'STD_CFF', 0.95),
        ('jppfs_cor', 'CashAndCashEquivalents', 'STD_CASH_EQ', 0.95),

        -- IFRS (ifrs-full)
        ('ifrs-full', 'Assets', 'STD_ASSETS', 0.90),
        ('ifrs-full', 'CurrentAssets', 'STD_CUR_ASSETS', 0.90),
        ('ifrs-full', 'NoncurrentAssets', 'STD_NCA', 0.90),
        ('ifrs-full', 'Liabilities', 'STD_LIAB', 0.90),
        ('ifrs-full', 'CurrentLiabilities', 'STD_CUR_LIAB', 0.90),
        ('ifrs-full', 'NoncurrentLiabilities', 'STD_NCL', 0.90),
        ('ifrs-full', 'Equity', 'STD_NET_ASSETS', 0.85),
        ('ifrs-full', 'EquityAttributableToOwnersOfParent', 'STD_SH_EQUITY', 0.85),
        ('ifrs-full', 'Revenue', 'STD_REVENUE', 0.90),
        ('ifrs-full', 'CostOfSales', 'STD_COGS', 0.90),
        ('ifrs-full', 'GrossProfit', 'STD_GROSS_PROFIT', 0.90),
        ('ifrs-full', 'AdministrativeExpense', 'STD_SGA', 0.70),
        ('ifrs-full', 'OperatingProfitLoss', 'STD_OP_INCOME', 0.80),
        ('ifrs-full', 'ProfitLossBeforeTax', 'STD_ORD_INCOME', 0.60),
        ('ifrs-full', 'ProfitLoss', 'STD_NET_INCOME', 0.90),
        ('ifrs-full', 'NetCashFlowsFromUsedInOperatingActivities', 'STD_CFO', 0.90),
        ('ifrs-full', 'NetCashFlowsFromUsedInInvestingActivities', 'STD_CFI', 0.90),
        ('ifrs-full', 'NetCashFlowsFromUsedInFinancingActivities', 'STD_CFF', 0.90),
        ('ifrs-full', 'CashAndCashEquivalents', 'STD_CASH_EQ', 0.90)
)
INSERT INTO core.concept_mapping
    (concept_id, standard_code, mapping_method, confidence, notes)
SELECT
    c.concept_id,
    m.standard_code,
    'auto' AS mapping_method,
    m.confidence,
    'initial auto mapping by namespace/element_name' AS notes
FROM mapping_pairs m
JOIN core.concept c
  ON c.namespace = m.namespace
 AND c.element_name = m.element_name
ON CONFLICT DO NOTHING;
