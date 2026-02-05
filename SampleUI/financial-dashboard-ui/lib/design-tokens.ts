/**
 * Design Tokens - 財務ダッシュボード用デザイントークン定義
 *
 * CSS変数と連携した一元的なデザイン管理システム
 * OKLCH色空間を使用（より知覚的に均一な色表現）
 */

// ============================================================
// Color Tokens
// ============================================================

export const colors = {
  // 財務指標用カラー
  financial: {
    profit: {
      DEFAULT: 'oklch(0.65 0.18 145)',      // 緑系 - 利益
      light: 'oklch(0.85 0.12 145)',
      dark: 'oklch(0.45 0.15 145)',
    },
    loss: {
      DEFAULT: 'oklch(0.60 0.20 25)',       // 赤系 - 損失
      light: 'oklch(0.80 0.12 25)',
      dark: 'oklch(0.45 0.18 25)',
    },
    neutral: {
      DEFAULT: 'oklch(0.60 0.02 240)',      // グレー系 - 中立
      light: 'oklch(0.80 0.01 240)',
      dark: 'oklch(0.40 0.02 240)',
    },
  },

  // ステータスカラー
  status: {
    good: {
      DEFAULT: 'oklch(0.65 0.18 145)',      // 良好
      bg: 'oklch(0.95 0.04 145)',
      border: 'oklch(0.75 0.12 145)',
    },
    warning: {
      DEFAULT: 'oklch(0.75 0.15 80)',       // 注意
      bg: 'oklch(0.95 0.04 80)',
      border: 'oklch(0.80 0.10 80)',
    },
    danger: {
      DEFAULT: 'oklch(0.60 0.20 25)',       // 危険
      bg: 'oklch(0.95 0.04 25)',
      border: 'oklch(0.75 0.12 25)',
    },
    info: {
      DEFAULT: 'oklch(0.55 0.15 240)',      // 情報
      bg: 'oklch(0.95 0.03 240)',
      border: 'oklch(0.75 0.10 240)',
    },
  },

  // チャート用カラーパレット
  chart: {
    primary: 'oklch(0.55 0.15 155)',        // メイン
    secondary: 'oklch(0.65 0.12 200)',      // サブ
    tertiary: 'oklch(0.70 0.14 80)',        // 第3
    quaternary: 'oklch(0.60 0.16 300)',     // 第4
    quinary: 'oklch(0.55 0.18 25)',         // 第5
  },

  // 財務諸表セクション用
  sections: {
    assets: 'oklch(0.55 0.15 155)',         // 資産の部
    liabilities: 'oklch(0.60 0.18 25)',     // 負債の部
    equity: 'oklch(0.55 0.15 240)',         // 純資産の部
    operating: 'oklch(0.55 0.15 155)',      // 営業活動
    investing: 'oklch(0.65 0.12 200)',      // 投資活動
    financing: 'oklch(0.60 0.16 300)',      // 財務活動
  },
} as const

// ============================================================
// Spacing Tokens
// ============================================================

export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
} as const

// ============================================================
// Typography Tokens
// ============================================================

export const typography = {
  fontFamily: {
    sans: '"Noto Sans JP", "Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const

// ============================================================
// Animation Tokens
// ============================================================

export const animation = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const

// ============================================================
// Border Radius Tokens
// ============================================================

export const borderRadius = {
  none: '0',
  sm: '0.25rem',
  DEFAULT: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const

// ============================================================
// Shadow Tokens
// ============================================================

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const

// ============================================================
// Z-Index Tokens
// ============================================================

export const zIndex = {
  base: 0,
  dropdown: 50,
  sticky: 100,
  modal: 200,
  popover: 300,
  tooltip: 400,
  toast: 500,
} as const

// ============================================================
// Financial Specific Utilities
// ============================================================

/**
 * 数値に基づいて適切な色を返す
 * @param value - 数値
 * @param threshold - 閾値（デフォルト: 0）
 */
export function getValueColor(value: number | null | undefined, threshold = 0): string {
  if (value === null || value === undefined) {
    return colors.financial.neutral.DEFAULT
  }
  if (value > threshold) {
    return colors.financial.profit.DEFAULT
  }
  if (value < threshold) {
    return colors.financial.loss.DEFAULT
  }
  return colors.financial.neutral.DEFAULT
}

/**
 * パーセンテージに基づいてステータス色を返す
 * @param percent - パーセンテージ
 * @param thresholds - 閾値設定 { warning, danger }
 */
export function getPercentageStatus(
  percent: number | null | undefined,
  thresholds = { warning: 50, danger: 20 }
): keyof typeof colors.status {
  if (percent === null || percent === undefined) {
    return 'info'
  }
  if (percent >= 100 - thresholds.danger) {
    return 'good'
  }
  if (percent >= 100 - thresholds.warning) {
    return 'warning'
  }
  return 'danger'
}

/**
 * ROEに基づいてステータスを返す
 * @param roe - ROE値
 */
export function getROEStatus(roe: number | null | undefined): keyof typeof colors.status {
  if (roe === null || roe === undefined) return 'info'
  if (roe >= 10) return 'good'
  if (roe >= 5) return 'warning'
  return 'danger'
}

/**
 * 自己資本比率に基づいてステータスを返す
 * @param ratio - 自己資本比率
 */
export function getEquityRatioStatus(ratio: number | null | undefined): keyof typeof colors.status {
  if (ratio === null || ratio === undefined) return 'info'
  if (ratio >= 40) return 'good'
  if (ratio >= 20) return 'warning'
  return 'danger'
}

// ============================================================
// CSS Variable Mapping
// ============================================================

export const cssVariables = {
  // 財務用
  '--financial-profit': colors.financial.profit.DEFAULT,
  '--financial-profit-light': colors.financial.profit.light,
  '--financial-profit-dark': colors.financial.profit.dark,
  '--financial-loss': colors.financial.loss.DEFAULT,
  '--financial-loss-light': colors.financial.loss.light,
  '--financial-loss-dark': colors.financial.loss.dark,
  '--financial-neutral': colors.financial.neutral.DEFAULT,

  // ステータス用
  '--status-good': colors.status.good.DEFAULT,
  '--status-good-bg': colors.status.good.bg,
  '--status-warning': colors.status.warning.DEFAULT,
  '--status-warning-bg': colors.status.warning.bg,
  '--status-danger': colors.status.danger.DEFAULT,
  '--status-danger-bg': colors.status.danger.bg,
  '--status-info': colors.status.info.DEFAULT,
  '--status-info-bg': colors.status.info.bg,

  // 財務セクション用
  '--section-assets': colors.sections.assets,
  '--section-liabilities': colors.sections.liabilities,
  '--section-equity': colors.sections.equity,
  '--section-operating': colors.sections.operating,
  '--section-investing': colors.sections.investing,
  '--section-financing': colors.sections.financing,
} as const

// Type exports
export type ColorToken = typeof colors
export type SpacingToken = typeof spacing
export type TypographyToken = typeof typography
export type AnimationToken = typeof animation
