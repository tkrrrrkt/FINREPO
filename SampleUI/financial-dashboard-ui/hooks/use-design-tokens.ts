/**
 * useDesignTokens - デザイントークン参照用カスタムフック
 *
 * コンポーネントからデザイントークンを簡単に利用するためのフック
 */
'use client'

import { useMemo } from 'react'
import {
  colors,
  spacing,
  typography,
  animation,
  borderRadius,
  shadows,
  zIndex,
  getValueColor,
  getPercentageStatus,
  getROEStatus,
  getEquityRatioStatus,
  type ColorToken,
} from '@/lib/design-tokens'

/**
 * 財務データの色を取得するためのフック
 */
export function useFinancialColors() {
  return useMemo(() => ({
    // 基本色
    profit: colors.financial.profit,
    loss: colors.financial.loss,
    neutral: colors.financial.neutral,

    // ステータス色
    status: colors.status,

    // セクション色
    sections: colors.sections,

    // チャート色
    chart: colors.chart,

    // ユーティリティ関数
    getValueColor,
    getPercentageStatus,
    getROEStatus,
    getEquityRatioStatus,
  }), [])
}

/**
 * 数値の増減に応じたスタイルを返すフック
 */
export function useValueStyle(value: number | null | undefined, threshold = 0) {
  return useMemo(() => {
    if (value === null || value === undefined) {
      return {
        color: 'var(--financial-neutral)',
        className: 'text-muted-foreground',
        indicator: '',
      }
    }

    if (value > threshold) {
      return {
        color: 'var(--financial-profit)',
        className: 'text-[var(--financial-profit)]',
        indicator: '+',
      }
    }

    if (value < threshold) {
      return {
        color: 'var(--financial-loss)',
        className: 'text-[var(--financial-loss)]',
        indicator: '',
      }
    }

    return {
      color: 'var(--financial-neutral)',
      className: 'text-muted-foreground',
      indicator: '',
    }
  }, [value, threshold])
}

/**
 * ステータスに応じたスタイルを返すフック
 */
export function useStatusStyle(status: keyof typeof colors.status) {
  return useMemo(() => {
    const statusColors = colors.status[status]

    return {
      color: statusColors.DEFAULT,
      bgColor: statusColors.bg,
      borderColor: statusColors.border,
      className: `text-[var(--status-${status})] bg-[var(--status-${status}-bg)]`,
    }
  }, [status])
}

/**
 * ROEに応じたスタイルを返すフック
 */
export function useROEStyle(roe: number | null | undefined) {
  return useMemo(() => {
    const status = getROEStatus(roe)

    return {
      status,
      color: colors.status[status].DEFAULT,
      className: `text-[var(--status-${status})]`,
      label: roe === null || roe === undefined
        ? 'N/A'
        : roe >= 10
          ? '優良'
          : roe >= 5
            ? '標準'
            : '要注意',
    }
  }, [roe])
}

/**
 * 自己資本比率に応じたスタイルを返すフック
 */
export function useEquityRatioStyle(ratio: number | null | undefined) {
  return useMemo(() => {
    const status = getEquityRatioStatus(ratio)

    return {
      status,
      color: colors.status[status].DEFAULT,
      className: `text-[var(--status-${status})]`,
      label: ratio === null || ratio === undefined
        ? 'N/A'
        : ratio >= 40
          ? '健全'
          : ratio >= 20
            ? '標準'
            : '要注意',
    }
  }, [ratio])
}

/**
 * 財務諸表セクションの色を取得するフック
 */
export function useSectionColor(
  section: 'assets' | 'liabilities' | 'equity' | 'operating' | 'investing' | 'financing'
) {
  return useMemo(() => ({
    color: colors.sections[section],
    cssVar: `var(--section-${section})`,
    className: `text-[var(--section-${section})]`,
    bgClassName: `bg-[var(--section-${section})]/10`,
  }), [section])
}

/**
 * 全デザイントークンを取得するフック
 */
export function useDesignTokens() {
  return useMemo(() => ({
    colors,
    spacing,
    typography,
    animation,
    borderRadius,
    shadows,
    zIndex,
  }), [])
}

/**
 * チャート用カラーパレットを取得するフック
 * @param count - 必要な色の数
 */
export function useChartColors(count = 5) {
  return useMemo(() => {
    const chartColors = [
      colors.chart.primary,
      colors.chart.secondary,
      colors.chart.tertiary,
      colors.chart.quaternary,
      colors.chart.quinary,
    ]

    // 必要な数だけ返す（足りない場合は循環）
    return Array.from({ length: count }, (_, i) => chartColors[i % chartColors.length])
  }, [count])
}

/**
 * 比較チャート用の企業別カラーを生成するフック
 * @param companyCount - 企業数
 */
export function useCompanyCompareColors(companyCount: number) {
  return useMemo(() => {
    // 企業比較用に視覚的に区別しやすい色を生成
    const baseHues = [155, 200, 80, 300, 25, 240, 120, 350]

    return Array.from({ length: companyCount }, (_, i) => ({
      fill: `oklch(0.55 0.15 ${baseHues[i % baseHues.length]})`,
      stroke: `oklch(0.45 0.18 ${baseHues[i % baseHues.length]})`,
    }))
  }, [companyCount])
}
