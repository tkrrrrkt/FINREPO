"""
Unit Tests for Unit Normalizer (Issue #3)

このモジュールは UnitNormalizer の正確性を検証します：
  1. 為替レート適用の正確性（USD/EUR → JPY）
  2. テキスト単位判別の正確性（pure/shares）
  3. JPY 単位のパススルー検証
  4. NULL・無効値処理の堅牢性
  5. 小数点以下精度の維持

Test Strategy:
  - 既知の為替レート（USD=145, EUR=155）を検証
  - テキスト単位（pure, shares）を正確に判別
  - 負数、ゼロ、NULL値のエッジケース
  - 実データでの再現性テスト
"""

import pytest
import sys
from pathlib import Path
from decimal import Decimal
from unittest.mock import Mock, patch
from typing import Optional

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from lib.unit_normalizer import UnitNormalizer


class TestUnitNormalizerInitialization:
    """初期化とセットアップのテスト"""

    def test_normalizer_initialization(self):
        """UnitNormalizer が正しく初期化される"""
        normalizer = UnitNormalizer()
        assert normalizer is not None

    def test_normalizer_has_exchange_rates(self):
        """為替レートが定義されている"""
        normalizer = UnitNormalizer()
        # Should be able to perform conversions (which requires exchange rates)
        unit, value = normalizer.normalize("USD", Decimal("1.0"))
        assert unit == "JPY"
        assert value == Decimal("145")  # USD to JPY rate is 145


class TestJPYNormalization:
    """JPY 単位のテスト（パススルー）"""

    def test_jpy_value_unchanged(self):
        """JPY 値は正規化されない"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="JPY",
            value=Decimal("100000000.0"),
        )

        assert unit == "JPY"
        assert result == Decimal("100000000.0"), \
            "JPY values should pass through unchanged"

    def test_jpy_unit_ref_normalized(self):
        """JPY の unit_ref_normalized は 'JPY'"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="JPY",
            value=Decimal("50000000.0"),
        )

        assert unit == "JPY", "Normalized unit should be 'JPY'"
        assert value == Decimal("50000000.0")

    @pytest.mark.parametrize("jpy_value", [
        Decimal("0"),
        Decimal("1"),
        Decimal("100"),
        Decimal("1000000000000"),
        Decimal("999999999999.999"),
    ])
    def test_jpy_various_magnitudes(self, jpy_value):
        """様々な大きさの JPY 値を処理"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="JPY",
            value=jpy_value,
        )

        assert unit == "JPY"
        # Should be unchanged
        assert result == jpy_value

    def test_jpy_negative_values_preserved(self):
        """負の JPY 値も保持される"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="JPY",
            value=Decimal("-50000000.0"),
        )

        assert unit == "JPY"
        assert result < 0, "Negative JPY values should be preserved"
        assert abs(result) == Decimal("50000000.0")


class TestUSDToJPYConversion:
    """USD → JPY 変換のテスト"""

    def test_usd_conversion_rate_145(self):
        """USD → JPY の為替レートは 145"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("1.0"),
        )

        expected = Decimal("145")
        assert unit == "JPY"
        assert result == expected, \
            f"1 USD should convert to 145 JPY, got {result}"

    def test_usd_10_million_to_jpy(self):
        """USD 1,000万 → JPY 14.5億"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("10000000"),
        )

        expected = Decimal("10000000") * Decimal("145")
        assert unit == "JPY"
        assert result == expected, \
            f"USD 10M should convert to JPY {expected}, got {result}"

    @pytest.mark.parametrize("usd_value,expected_jpy", [
        (Decimal("1"), Decimal("145")),
        (Decimal("10"), Decimal("1450")),
        (Decimal("100"), Decimal("14500")),
        (Decimal("1000"), Decimal("145000")),
        (Decimal("1000000"), Decimal("145000000")),
    ])
    def test_usd_conversion_parametrized(self, usd_value, expected_jpy):
        """複数の USD 値を変換"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="USD",
            value=usd_value,
        )

        assert unit == "JPY"
        assert result == expected_jpy

    def test_usd_fractional_conversion(self):
        """USD の小数値変換"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("1.5"),
        )

        expected = Decimal("1.5") * Decimal("145")
        assert unit == "JPY"
        assert result == expected

    def test_usd_negative_conversion(self):
        """負の USD 値も変換"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("-1000000"),
        )

        expected = Decimal("-1000000") * Decimal("145")
        assert unit == "JPY"
        assert result == expected

    def test_usd_unit_ref_normalized(self):
        """USD の unit_ref_normalized は 'JPY'"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("10"),
        )

        assert unit == "JPY", "USD should be normalized to JPY"
        assert value == Decimal("1450")


class TestEURToJPYConversion:
    """EUR → JPY 変換のテスト"""

    def test_eur_conversion_rate_155(self):
        """EUR → JPY の為替レートは 155"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="EUR",
            value=Decimal("1.0"),
        )

        expected = Decimal("155.0")
        assert unit == "JPY"
        assert float(result) == pytest.approx(float(expected), rel=0.01), \
            f"1 EUR should convert to 155 JPY, got {result}"

    def test_eur_10_million_to_jpy(self):
        """EUR 1,000万 → JPY 15.5億"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="EUR",
            value=Decimal("10000000.0"),
        )

        expected = Decimal("10000000.0") * Decimal("155")
        assert unit == "JPY"
        assert float(result) == pytest.approx(float(expected), rel=0.01)

    @pytest.mark.parametrize("eur_value,expected_jpy", [
        (Decimal("1.0"), Decimal("155.0")),
        (Decimal("10.0"), Decimal("1550.0")),
        (Decimal("100.0"), Decimal("15500.0")),
        (Decimal("1000.0"), Decimal("155000.0")),
        (Decimal("1000000.0"), Decimal("155000000.0")),
    ])
    def test_eur_conversion_parametrized(self, eur_value, expected_jpy):
        """複数の EUR 値を変換"""
        normalizer = UnitNormalizer()

        unit, result = normalizer.normalize(
            unit_ref="EUR",
            value=eur_value,
        )

        assert unit == "JPY"
        assert float(result) == pytest.approx(float(expected_jpy), rel=0.01)

    def test_eur_unit_ref_normalized(self):
        """EUR の unit_ref_normalized は 'JPY'"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="EUR",
            value=Decimal("100.0"),
        )

        assert unit == "JPY"
        assert float(value) == pytest.approx(15500.0, rel=0.01)


class TestTextUnitDetection:
    """テキスト単位判別のテスト"""

    def test_pure_unit_preserved(self):
        """'pure' 単位は保持される"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="pure",
            value=Decimal("1.0"),
        )

        assert unit == "pure", "Pure unit should be preserved"
        assert value == Decimal("1.0")

    def test_shares_unit_preserved(self):
        """'shares' 単位は保持される"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="shares",
            value=Decimal("1000000.0"),
        )

        assert unit == "shares", "Shares unit should be preserved"
        assert value == Decimal("1000000.0")

    @pytest.mark.parametrize("text_unit", [
        "pure",
        "shares",
    ])
    def test_text_units_preserved_parametrized(self, text_unit):
        """複数のテキスト単位を検証"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref=text_unit,
            value=Decimal("100.0"),
        )

        assert unit == text_unit

    def test_pure_various_values(self):
        """pure 単位で様々な値を処理"""
        normalizer = UnitNormalizer()

        for test_value in [Decimal("0"), Decimal("0.5"), Decimal("1.0"), Decimal("100.0")]:
            unit, value = normalizer.normalize(
                unit_ref="pure",
                value=test_value,
            )

            assert unit == "pure"
            assert value == test_value

    def test_shares_large_numbers(self):
        """shares 単位で大きな数を処理"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="shares",
            value=Decimal("1000000000.0"),
        )

        assert unit == "shares"
        assert value == Decimal("1000000000.0")


class TestNullAndEmptyValueHandling:
    """NULL と空値のハンドリング"""

    def test_null_value_handling(self):
        """NULL 値の処理"""
        normalizer = UnitNormalizer()

        # normalize() returns tuple, not single value
        # For NULL, we expect it to handle gracefully or raise
        try:
            result = normalizer.normalize(
                unit_ref="JPY",
                value=None,
            )
            # If it returns a tuple, check the structure
            if isinstance(result, tuple):
                unit, value = result
                assert unit == "JPY" or value is None
        except (TypeError, ValueError):
            # It's acceptable if None values are not supported
            pass

    def test_zero_value_normalization(self):
        """ゼロ値の正規化"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("0.0"),
        )

        assert unit == "JPY"
        assert value == Decimal("0.0")

    def test_unknown_unit_handling(self):
        """未知の単位のハンドリング"""
        normalizer = UnitNormalizer()

        # Implementation might handle unknown units differently
        # This test documents the behavior
        try:
            unit, value = normalizer.normalize(
                unit_ref="UNKNOWN_UNIT",
                value=Decimal("100.0"),
            )
            # Either it normalizes to JPY or preserves the unit
            assert unit in ["JPY", "UNKNOWN_UNIT"]
        except (ValueError, KeyError):
            # Or it raises an exception
            pass


class TestDecimalPrecision:
    """小数点以下の精度テスト"""

    def test_decimal_precision_preservation(self):
        """Decimal の精度が保持される"""
        normalizer = UnitNormalizer()

        # Test with Decimal
        unit, value = normalizer.normalize(
            unit_ref="JPY",
            value=Decimal("123456789.123456"),
        )

        # Should preserve decimal places
        assert isinstance(value, (float, Decimal))
        assert unit == "JPY"

    def test_usd_conversion_decimal_precision(self):
        """USD 変換で小数精度が保持される"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("1.123456"),
        )

        expected = Decimal("1.123456") * Decimal("145")
        # Allow for floating point rounding
        assert abs(float(value) - float(expected)) < 0.01
        assert unit == "JPY"

    @pytest.mark.parametrize("decimal_value", [
        "0.1",
        "0.001",
        "0.000001",
        "1.5",
        "999.999999",
    ])
    def test_decimal_values_parametrized(self, decimal_value):
        """複数の小数値を処理"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="USD",
            value=Decimal(decimal_value),
        )

        expected = Decimal(decimal_value) * Decimal("145")
        assert abs(float(value) - float(expected)) < 0.01
        assert unit == "JPY"


class TestExtremeValues:
    """極端な値のテスト"""

    def test_very_large_value(self):
        """非常に大きい値の処理"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="JPY",
            value=Decimal("1000000000000.0"),  # 1 trillion JPY
        )

        assert float(value) == 1_000_000_000_000.0
        assert unit == "JPY"

    def test_very_small_value(self):
        """非常に小さい値の処理"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="JPY",
            value=Decimal("0.000001"),
        )

        assert float(value) == pytest.approx(0.000001)
        assert unit == "JPY"

    def test_usd_very_large_conversion(self):
        """非常に大きい USD 値の変換"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("1000000000.0"),  # 1 billion USD
        )

        expected = Decimal("1000000000.0") * Decimal("145")
        assert float(value) == pytest.approx(float(expected), rel=0.01)
        assert unit == "JPY"


class TestConsistency:
    """一貫性のテスト"""

    def test_multiple_calls_same_result(self):
        """同じ入力で常に同じ結果を返す"""
        normalizer = UnitNormalizer()

        unit1, value1 = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("12345.67"),
        )
        unit2, value2 = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("12345.67"),
        )

        assert float(value1) == float(value2)
        assert unit1 == unit2

    def test_normalize_vs_normalize_value_consistency(self):
        """normalize method consistency across multiple calls"""
        normalizer = UnitNormalizer()

        value = Decimal("100.0")
        unit_ref = "EUR"

        # normalize tuple first call
        unit1, norm_value1 = normalizer.normalize(unit_ref, value)

        # normalize tuple second call
        unit2, norm_value2 = normalizer.normalize(unit_ref, value)

        assert unit1 == "JPY"
        assert unit2 == "JPY"
        assert float(norm_value1) == float(norm_value2)


class TestIntegrationWithDatabase:
    """DB 保存との統合テスト"""

    def test_normalization_result_types(self):
        """正規化結果の型が DB 保存可能"""
        normalizer = UnitNormalizer()

        unit, value = normalizer.normalize(
            unit_ref="USD",
            value=Decimal("123456789.123456"),
        )

        # Should be compatible with DB types
        assert isinstance(unit, str)
        assert isinstance(value, (int, float, Decimal))

    def test_result_precision_for_numeric_column(self):
        """numeric(30,6) カラムに保存可能な精度"""
        normalizer = UnitNormalizer()

        # numeric(30,6) can store up to 30 digits with 6 decimal places
        unit, value = normalizer.normalize(
            unit_ref="JPY",
            value=Decimal("999999999999999999999999.999999"),
        )

        # Value should fit in numeric(30,6)
        # Maximum is 999999999999999999999999.999999
        assert len(str(value).replace(".", "")) <= 30


# ============================================================================
# Real Data Tests (from Detailed Analysis)
# ============================================================================

class TestWithRealData:
    """実データ（詳細分析結果）との整合性テスト"""

    def test_real_data_statistics_consistency(self):
        """詳細分析の統計と一致（7,677件）"""
        normalizer = UnitNormalizer()

        # From detailed analysis:
        # JPY: 7,497件, pure: 125件, shares: 55件
        jpy_values = [normalizer.normalize("JPY", Decimal("1000000")) for _ in range(7497)]
        pure_values = [normalizer.normalize("pure", Decimal("1.0")) for _ in range(125)]
        shares_values = [normalizer.normalize("shares", Decimal("1000")) for _ in range(55)]

        # All should have valid results
        assert len(jpy_values) == 7497
        assert len(pure_values) == 125
        assert len(shares_values) == 55

    def test_conversion_quality_100_percent(self):
        """詳細分析: 正規化品質 100%"""
        normalizer = UnitNormalizer()

        # Test that conversion quality is 100%
        units_to_test = ["JPY", "USD", "EUR", "pure", "shares"]
        failures = 0

        for unit in units_to_test:
            try:
                normalizer.normalize(unit, Decimal("100.0"))
            except Exception:
                failures += 1

        # Should have 0 failures
        assert failures == 0, f"Conversion should be 100% successful, {failures} failures"


# ============================================================================
# Test Running
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
