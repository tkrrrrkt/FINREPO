/**
 * Error Handler - 統一的なエラーハンドリング
 *
 * APIエラー、ネットワークエラー、予期しないエラーを
 * 一貫した方法で処理するためのユーティリティ
 */

// エラーコード定義
export const ErrorCode = {
  // ネットワーク関連
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',

  // API関連
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SERVER_ERROR: 'SERVER_ERROR',

  // アプリケーション関連
  UNKNOWN: 'UNKNOWN',
  PARSE_ERROR: 'PARSE_ERROR',
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

// エラーメッセージマッピング（日本語）
const errorMessages: Record<ErrorCodeType, string> = {
  [ErrorCode.NETWORK_ERROR]: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
  [ErrorCode.TIMEOUT]: 'リクエストがタイムアウトしました。しばらく待ってから再試行してください。',
  [ErrorCode.CONNECTION_REFUSED]: 'サーバーに接続できません。APIサーバーが起動しているか確認してください。',
  [ErrorCode.NOT_FOUND]: '指定されたリソースが見つかりません。',
  [ErrorCode.VALIDATION_ERROR]: '入力内容に問題があります。',
  [ErrorCode.UNAUTHORIZED]: '認証が必要です。ログインしてください。',
  [ErrorCode.FORBIDDEN]: 'このリソースへのアクセス権限がありません。',
  [ErrorCode.SERVER_ERROR]: 'サーバーエラーが発生しました。しばらく待ってから再試行してください。',
  [ErrorCode.UNKNOWN]: '予期しないエラーが発生しました。',
  [ErrorCode.PARSE_ERROR]: 'データの解析に失敗しました。',
}

// カスタムAPIエラークラス
export class APIError extends Error {
  public readonly code: ErrorCodeType
  public readonly statusCode?: number
  public readonly detail?: string
  public readonly retryable: boolean
  public readonly timestamp: Date

  constructor(
    code: ErrorCodeType,
    message?: string,
    options?: {
      statusCode?: number
      detail?: string
      retryable?: boolean
      cause?: unknown
    }
  ) {
    const finalMessage = message || errorMessages[code] || errorMessages[ErrorCode.UNKNOWN]
    super(finalMessage, { cause: options?.cause })

    this.name = 'APIError'
    this.code = code
    this.statusCode = options?.statusCode
    this.detail = options?.detail
    this.retryable = options?.retryable ?? isRetryable(code)
    this.timestamp = new Date()

    // V8スタックトレースを正しく保持
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      detail: this.detail,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
    }
  }
}

// リトライ可能なエラーコード
const RETRYABLE_CODES: ReadonlySet<ErrorCodeType> = new Set([
  ErrorCode.NETWORK_ERROR,
  ErrorCode.TIMEOUT,
  ErrorCode.CONNECTION_REFUSED,
  ErrorCode.SERVER_ERROR,
])

// リトライ可能かどうかを判定
function isRetryable(code: ErrorCodeType): boolean {
  return RETRYABLE_CODES.has(code)
}

// HTTPステータスコードからエラーコードを取得
export function getErrorCodeFromStatus(status: number): ErrorCodeType {
  if (status === 404) return ErrorCode.NOT_FOUND
  if (status === 401) return ErrorCode.UNAUTHORIZED
  if (status === 403) return ErrorCode.FORBIDDEN
  if (status === 422) return ErrorCode.VALIDATION_ERROR
  if (status >= 500) return ErrorCode.SERVER_ERROR
  return ErrorCode.UNKNOWN
}

// エラーをAPIErrorに変換
export function toAPIError(error: unknown): APIError {
  // 既にAPIErrorの場合はそのまま返す
  if (error instanceof APIError) {
    return error
  }

  // fetch関連のエラー
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase()
    if (message.includes('fetch') || message.includes('network')) {
      return new APIError(ErrorCode.NETWORK_ERROR, undefined, { cause: error })
    }
    if (message.includes('timeout') || message.includes('aborted')) {
      return new APIError(ErrorCode.TIMEOUT, undefined, { cause: error })
    }
  }

  // Responseエラー（fetch APIから）
  if (error instanceof Response) {
    const code = getErrorCodeFromStatus(error.status)
    return new APIError(code, undefined, {
      statusCode: error.status,
      cause: error,
    })
  }

  // 標準のErrorオブジェクト
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // 接続エラーの検出
    if (
      message.includes('econnrefused') ||
      message.includes('connection refused') ||
      message.includes('failed to fetch')
    ) {
      return new APIError(ErrorCode.CONNECTION_REFUSED, undefined, { cause: error })
    }

    // タイムアウトエラーの検出
    if (message.includes('timeout') || message.includes('timed out')) {
      return new APIError(ErrorCode.TIMEOUT, undefined, { cause: error })
    }

    // JSONパースエラー
    if (message.includes('json') && message.includes('parse')) {
      return new APIError(ErrorCode.PARSE_ERROR, undefined, { cause: error })
    }

    // その他のエラー
    return new APIError(ErrorCode.UNKNOWN, error.message, { cause: error })
  }

  // その他の場合
  return new APIError(ErrorCode.UNKNOWN, String(error))
}

// ユーザーフレンドリーなエラーメッセージを取得
export function getUserMessage(error: unknown): string {
  const apiError = toAPIError(error)
  return apiError.message
}

// エラーがリトライ可能かを判定
export function isErrorRetryable(error: unknown): boolean {
  const apiError = toAPIError(error)
  return apiError.retryable
}

// リトライ遅延時間を計算（指数バックオフ）
export function getRetryDelay(attempt: number, baseDelay = 1000, maxDelay = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  // ジッターを追加（±25%）
  const jitter = delay * 0.25 * (Math.random() * 2 - 1)
  return Math.round(delay + jitter)
}

// エラーをコンソールにログ出力
export function logError(error: unknown, context?: string): void {
  const apiError = toAPIError(error)
  const prefix = context ? `[${context}]` : ''

  if (process.env.NODE_ENV === 'development') {
    console.error(`${prefix} APIError:`, apiError.toJSON())
    if (apiError.cause) {
      console.error('Caused by:', apiError.cause)
    }
  } else {
    // 本番環境では簡略化
    console.error(`${prefix} Error: ${apiError.code} - ${apiError.message}`)
  }
}
