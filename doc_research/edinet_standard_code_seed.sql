-- Seed data for core.standard_code (minimum set)

INSERT INTO core.standard_code
    (standard_code, name_ja, name_en, category, period_type, description)
VALUES
    ('STD_ASSETS', '総資産', 'Total Assets', 'BS', 'instant', '貸借対照表・総資産'),
    ('STD_CUR_ASSETS', '流動資産', 'Current Assets', 'BS', 'instant', '貸借対照表・流動資産'),
    ('STD_NCA', '固定資産', 'Noncurrent Assets', 'BS', 'instant', '貸借対照表・固定資産'),
    ('STD_LIAB', '負債合計', 'Total Liabilities', 'BS', 'instant', '貸借対照表・負債合計'),
    ('STD_CUR_LIAB', '流動負債', 'Current Liabilities', 'BS', 'instant', '貸借対照表・流動負債'),
    ('STD_NCL', '固定負債', 'Noncurrent Liabilities', 'BS', 'instant', '貸借対照表・固定負債'),
    ('STD_NET_ASSETS', '純資産合計', 'Net Assets', 'BS', 'instant', '貸借対照表・純資産合計'),
    ('STD_SH_EQUITY', '株主資本', 'Shareholders Equity', 'BS', 'instant', '貸借対照表・株主資本'),
    ('STD_REVENUE', '売上高', 'Revenue', 'PL', 'duration', '損益計算書・売上高'),
    ('STD_COGS', '売上原価', 'Cost of Sales', 'PL', 'duration', '損益計算書・売上原価'),
    ('STD_GROSS_PROFIT', '売上総利益', 'Gross Profit', 'PL', 'duration', '損益計算書・売上総利益'),
    ('STD_SGA', '販売費及び一般管理費', 'Selling General and Administrative Expenses', 'PL', 'duration', '損益計算書・販管費'),
    ('STD_OP_INCOME', '営業利益', 'Operating Income', 'PL', 'duration', '損益計算書・営業利益'),
    ('STD_ORD_INCOME', '経常利益', 'Ordinary Income', 'PL', 'duration', '損益計算書・経常利益'),
    ('STD_NET_INCOME', '当期純利益', 'Net Income', 'PL', 'duration', '損益計算書・当期純利益'),
    ('STD_CFO', '営業キャッシュ・フロー', 'Net Cash from Operating Activities', 'CF', 'duration', 'キャッシュフロー計算書・営業CF'),
    ('STD_CFI', '投資キャッシュ・フロー', 'Net Cash from Investing Activities', 'CF', 'duration', 'キャッシュフロー計算書・投資CF'),
    ('STD_CFF', '財務キャッシュ・フロー', 'Net Cash from Financing Activities', 'CF', 'duration', 'キャッシュフロー計算書・財務CF'),
    ('STD_CASH_EQ', '現金及び現金同等物期末残高', 'Cash and Cash Equivalents', 'CF', 'instant', 'キャッシュフロー計算書・期末残高');
