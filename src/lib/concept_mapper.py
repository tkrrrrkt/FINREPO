"""
Concept Mapper: XBRL Concept を標準指標に正規化

このモジュールは、複数の XBRL Concept を標準的な財務指標にマッピングします。
企業や会計基準によって同じ指標が異なる Concept 名で報告される問題に対応します。

例:
  - 売上高: NetSalesOrServiceRevenues, OperatingRevenue1, RevenuesFromExternalCustomers
  - 営業利益: OperatingIncome
  - 純利益: NetIncome, ProfitLoss
"""

from typing import Optional, Dict, List
from enum import Enum


class FinancialMetric(str, Enum):
    """標準的な財務指標"""
    # 収益
    REVENUE = "revenue"
    OPERATING_REVENUE = "operating_revenue"

    # 利益
    GROSS_PROFIT = "gross_profit"
    OPERATING_INCOME = "operating_income"
    ORDINARY_INCOME = "ordinary_income"
    NET_INCOME = "net_income"

    # コスト
    COST_OF_SALES = "cost_of_sales"
    OPERATING_EXPENSES = "operating_expenses"

    # バランスシート
    TOTAL_ASSETS = "total_assets"
    CURRENT_ASSETS = "current_assets"
    TOTAL_LIABILITIES = "total_liabilities"
    NET_ASSETS = "net_assets"


class ConceptMappingRule:
    """Concept マッピングルール"""
    def __init__(
        self,
        metric: FinancialMetric,
        concept_qnames: List[str],
        priority: int = 100,
        notes: Optional[str] = None,
    ):
        self.metric = metric
        self.concept_qnames = concept_qnames
        self.priority = priority
        self.notes = notes


# 売上高のマッピング（最優先）
REVENUE_MAPPING = [
    ConceptMappingRule(
        FinancialMetric.REVENUE,
        [
            "jppfs_cor:NetSalesOrServiceRevenues",
            "jppfs_cor:SalesAndServiceRevenue",
            "jppfs_cor:RevenueFromContractsWithCustomers",
        ],
        priority=100,
        notes="標準的な売上高概念（JGAAP/IFRS）"
    ),
    ConceptMappingRule(
        FinancialMetric.OPERATING_REVENUE,
        [
            "jppfs_cor:OperatingRevenue1",  # 日本ロジテム用 - Issue #1 対応
            "jppfs_cor:OperatingRevenue",
            "jpcrp_cor:RevenuesFromExternalCustomers",
        ],
        priority=90,
        notes="営業収益または外部顧客からの収益（Issue #1: 日本ロジテムの特別対応）"
    ),
]

# 営業利益のマッピング
OPERATING_INCOME_MAPPING = [
    ConceptMappingRule(
        FinancialMetric.OPERATING_INCOME,
        [
            "jppfs_cor:OperatingIncome",
            "jppfs_cor:ProfitFromOperations",
        ],
        priority=100,
        notes="営業利益"
    ),
]

# 純利益のマッピング
NET_INCOME_MAPPING = [
    ConceptMappingRule(
        FinancialMetric.NET_INCOME,
        [
            "jppfs_cor:NetIncome",
            "jppfs_cor:ProfitLoss",
            "jppfs_cor:NetIncomeAttributableToOwnersOfTheParent",
        ],
        priority=100,
        notes="当期純利益"
    ),
]

# 売上原価のマッピング
COGS_MAPPING = [
    ConceptMappingRule(
        FinancialMetric.COST_OF_SALES,
        [
            "jppfs_cor:CostOfSalesOrCostsOfRevenue",
            "jppfs_cor:CostOfSales",
        ],
        priority=100,
        notes="売上原価"
    ),
]


class ConceptMapper:
    """XBRL Concept を標準指標にマッピングするユーティリティ"""

    def __init__(self):
        """マッピングテーブルを初期化"""
        self.mapping_table: Dict[str, List[ConceptMappingRule]] = {
            FinancialMetric.REVENUE: REVENUE_MAPPING,
            FinancialMetric.OPERATING_REVENUE: REVENUE_MAPPING,
            FinancialMetric.OPERATING_INCOME: OPERATING_INCOME_MAPPING,
            FinancialMetric.NET_INCOME: NET_INCOME_MAPPING,
            FinancialMetric.COST_OF_SALES: COGS_MAPPING,
        }

        # 逆ルックアップテーブル: concept_qname → FinancialMetric
        self.concept_to_metric: Dict[str, List[tuple]] = {}
        self._build_concept_to_metric()

    def _build_concept_to_metric(self):
        """concept_qname → FinancialMetric の逆ルックアップテーブルを構築"""
        for metric_key, rules in self.mapping_table.items():
            for rule in rules:
                for concept_qname in rule.concept_qnames:
                    if concept_qname not in self.concept_to_metric:
                        self.concept_to_metric[concept_qname] = []
                    self.concept_to_metric[concept_qname].append((metric_key, rule.priority))

    def get_metric_for_concept(self, concept_qname: str) -> Optional[FinancialMetric]:
        """
        Concept QName から標準指標を取得

        Args:
            concept_qname: XBRL Concept QName (e.g., "jppfs_cor:NetSalesOrServiceRevenues")

        Returns:
            FinancialMetric または None
        """
        if concept_qname not in self.concept_to_metric:
            return None

        # 優先度が最も高いものを返す
        metrics = self.concept_to_metric[concept_qname]
        if metrics:
            return max(metrics, key=lambda x: x[1])[0]

        return None

    def find_concept_for_metric(
        self,
        metric: FinancialMetric,
        available_concepts: List[str]
    ) -> Optional[str]:
        """
        利用可能な Concept リストから、指標に最も適合するものを選択

        Args:
            metric: 探す FinancialMetric
            available_concepts: 利用可能な Concept QName リスト

        Returns:
            最適な Concept QName または None
        """
        if metric not in self.mapping_table:
            return None

        rules = self.mapping_table[metric]

        # 優先度順に確認
        for rule in sorted(rules, key=lambda r: r.priority, reverse=True):
            for concept_qname in rule.concept_qnames:
                if concept_qname in available_concepts:
                    return concept_qname

        return None

    def get_revenue_concepts(self) -> List[str]:
        """
        売上高の全 Concept を取得

        Returns:
            売上高として認識すべき全 Concept QName リスト
        """
        concepts = set()
        for rule in REVENUE_MAPPING:
            concepts.update(rule.concept_qnames)
        return list(concepts)

    def is_revenue_concept(self, concept_qname: str) -> bool:
        """
        Concept が売上高に関連しているかチェック

        Args:
            concept_qname: XBRL Concept QName

        Returns:
            売上高関連なら True
        """
        return concept_qname in self.get_revenue_concepts()


# グローバルインスタンス
mapper = ConceptMapper()


# 使用例：
# from src.lib.concept_mapper import mapper, FinancialMetric
#
# # 例1: Concept から指標を取得
# metric = mapper.get_metric_for_concept("jppfs_cor:OperatingRevenue1")
# # → FinancialMetric.OPERATING_REVENUE
#
# # 例2: 利用可能な Concept から売上を探す
# doc_id = "S100LUOZ"  # 日本ロジテム
# available = ["jppfs_cor:OperatingRevenue1", "jppfs_cor:OperatingIncome", ...]
# revenue_concept = mapper.find_concept_for_metric(FinancialMetric.REVENUE, available)
# # → "jppfs_cor:OperatingRevenue1"
#
# # 例3: 売上高に関連するすべての Concept を取得
# revenue_concepts = mapper.get_revenue_concepts()
# # → ["jppfs_cor:NetSalesOrServiceRevenues", "jppfs_cor:OperatingRevenue1", ...]
