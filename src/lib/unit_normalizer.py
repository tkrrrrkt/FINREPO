"""
Unit Normalizer: 複数通貨を標準通貨（JPY）に正規化

このモジュールは、XBRL の Unit（単位）を標準化して、
企業間・指標間の比較分析を容易にします。

Issue #3 対応。
"""

from typing import Optional, Tuple
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class UnitInfo:
    """Unit 情報"""
    original_unit: str          # 元の Unit (JPY, USD, etc.)
    normalized_unit: str        # 正規化後の Unit (JPY に統一)
    unit_type: str              # "currency", "pure", "count"
    conversion_factor: Decimal  # 変換係数
    symbol: str                 # 表示用記号
    notes: Optional[str] = None # 備考


# Unit マッピング定義
UNIT_MAPPING = {
    # 金銭単位
    "JPY": UnitInfo(
        original_unit="JPY",
        normalized_unit="JPY",
        unit_type="currency",
        conversion_factor=Decimal("1"),
        symbol="¥",
        notes="Japanese Yen"
    ),

    # 国際通貨（2024-01-29現在のレート）
    # 注: 実運用では、決算時点の為替レートを使用すべき
    "USD": UnitInfo(
        original_unit="USD",
        normalized_unit="JPY",
        unit_type="currency",
        conversion_factor=Decimal("145"),  # 1 USD = 145 JPY (参考レート)
        symbol="$",
        notes="US Dollar (1 USD = 145 JPY, 2024-01)"
    ),

    "EUR": UnitInfo(
        original_unit="EUR",
        normalized_unit="JPY",
        unit_type="currency",
        conversion_factor=Decimal("155"),  # 1 EUR = 155 JPY (参考レート)
        symbol="€",
        notes="Euro (1 EUR = 155 JPY, 2024-01)"
    ),

    # 純粋な数（単位なし）
    "pure": UnitInfo(
        original_unit="pure",
        normalized_unit="pure",
        unit_type="pure",
        conversion_factor=Decimal("1"),
        symbol="",
        notes="Pure number (ratio, percentage, etc.)"
    ),

    # 株式数
    "shares": UnitInfo(
        original_unit="shares",
        normalized_unit="shares",
        unit_type="count",
        conversion_factor=Decimal("1"),
        symbol="株",
        notes="Number of shares"
    ),
}

# 未知の Unit のデフォルト
DEFAULT_UNIT_INFO = UnitInfo(
    original_unit="unknown",
    normalized_unit="JPY",
    unit_type="currency",
    conversion_factor=Decimal("1"),
    symbol="¥",
    notes="Default for unknown units"
)


class UnitNormalizer:
    """Unit を正規化するユーティリティ"""

    def __init__(self, unit_mapping: dict = UNIT_MAPPING):
        """
        初期化

        Args:
            unit_mapping: Unit マッピングテーブル
        """
        self.mapping = unit_mapping

    def normalize(
        self,
        unit_ref: Optional[str],
        value: Optional[Decimal]
    ) -> Tuple[str, Optional[Decimal]]:
        """
        Unit と値を正規化

        Args:
            unit_ref: 元の Unit (JPY, USD, etc.)
            value: 元の値

        Returns:
            (正規化後の Unit, 正規化後の値)

        例:
            normalize("USD", Decimal("1000"))
            → ("JPY", Decimal("145000"))

            normalize("JPY", Decimal("1000000"))
            → ("JPY", Decimal("1000000"))

            normalize(None, Decimal("100"))
            → ("JPY", Decimal("100"))

            normalize("USD", None)
            → ("JPY", None)
        """
        # 値がない場合は Unit のみ返す
        if value is None:
            unit_info = self.mapping.get(unit_ref, DEFAULT_UNIT_INFO)
            return unit_info.normalized_unit, None

        # Unit 情報を取得
        unit_info = self.mapping.get(unit_ref, DEFAULT_UNIT_INFO)

        # 値を換算
        normalized_value = value * unit_info.conversion_factor

        return unit_info.normalized_unit, normalized_value

    def get_conversion_factor(self, unit_ref: Optional[str]) -> Decimal:
        """
        Unit の換算係数を取得

        Args:
            unit_ref: Unit

        Returns:
            換算係数
        """
        unit_info = self.mapping.get(unit_ref, DEFAULT_UNIT_INFO)
        return unit_info.conversion_factor

    def is_currency(self, unit_ref: Optional[str]) -> bool:
        """
        Unit が金銭単位か確認

        Args:
            unit_ref: Unit

        Returns:
            金銭単位なら True
        """
        unit_info = self.mapping.get(unit_ref, DEFAULT_UNIT_INFO)
        return unit_info.unit_type == "currency"

    def is_pure_number(self, unit_ref: Optional[str]) -> bool:
        """
        Unit が純粋な数か確認

        Args:
            unit_ref: Unit

        Returns:
            純粋な数なら True
        """
        unit_info = self.mapping.get(unit_ref, DEFAULT_UNIT_INFO)
        return unit_info.unit_type == "pure"

    def get_unit_info(self, unit_ref: Optional[str]) -> UnitInfo:
        """
        Unit 情報を取得

        Args:
            unit_ref: Unit

        Returns:
            UnitInfo オブジェクト
        """
        return self.mapping.get(unit_ref, DEFAULT_UNIT_INFO)

    def get_symbol(self, unit_ref: Optional[str]) -> str:
        """
        Unit の表示記号を取得

        Args:
            unit_ref: Unit

        Returns:
            表示記号（例: "¥", "$", "€"）
        """
        unit_info = self.mapping.get(unit_ref, DEFAULT_UNIT_INFO)
        return unit_info.symbol

    def list_supported_units(self) -> list:
        """
        サポートされている Unit の一覧を取得

        Returns:
            Unit リスト
        """
        return list(self.mapping.keys())


# グローバルインスタンス
normalizer = UnitNormalizer()


# 使用例：
# from src.lib.unit_normalizer import normalizer
#
# # 例1: Unit と値を正規化
# unit_normalized, value_normalized = normalizer.normalize("USD", Decimal("10000"))
# # → ("JPY", Decimal("1450000"))
#
# # 例2: Unit の種類を確認
# is_currency = normalizer.is_currency("JPY")
# # → True
#
# # 例3: Unit 情報を取得
# unit_info = normalizer.get_unit_info("EUR")
# print(f"{unit_info.symbol} {unit_info.notes}")
# # → "€ Euro (1 EUR = 155 JPY, 2024-01)"
#
# # 例4: サポート Unit の確認
# supported = normalizer.list_supported_units()
# # → ["JPY", "USD", "EUR", "pure", "shares"]
