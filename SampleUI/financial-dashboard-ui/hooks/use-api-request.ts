"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  APIError,
  toAPIError,
  getRetryDelay,
  logError,
  isErrorRetryable,
} from "@/lib/error-handler"

interface UseAPIRequestOptions<T> {
  /** 初期データ */
  initialData?: T
  /** リトライ回数（デフォルト: 3） */
  maxRetries?: number
  /** リトライ遅延の基準時間（ms）（デフォルト: 1000） */
  retryDelay?: number
  /** リトライ遅延の最大時間（ms）（デフォルト: 30000） */
  maxRetryDelay?: number
  /** 自動リトライを有効にするか（デフォルト: true） */
  autoRetry?: boolean
  /** エラー時のコールバック */
  onError?: (error: APIError) => void
  /** 成功時のコールバック */
  onSuccess?: (data: T) => void
  /** リトライ時のコールバック */
  onRetry?: (attempt: number, error: APIError) => void
}

interface UseAPIRequestResult<T> {
  /** データ */
  data: T | undefined
  /** ローディング状態 */
  loading: boolean
  /** エラー */
  error: APIError | null
  /** リトライ中かどうか */
  retrying: boolean
  /** 現在のリトライ回数 */
  retryCount: number
  /** リクエストを実行 */
  execute: () => Promise<T | undefined>
  /** 手動リトライ */
  retry: () => Promise<T | undefined>
  /** エラーをリセット */
  reset: () => void
  /** データをセット */
  setData: (data: T | undefined) => void
}

/**
 * APIリクエストフック - リトライ機能付き
 *
 * @param fetcher - データ取得関数
 * @param options - オプション設定
 *
 * @example
 * ```tsx
 * const { data, loading, error, execute } = useAPIRequest(
 *   () => apiClient.getCompanies(),
 *   { maxRetries: 3, onError: (e) => toast.error(e.message) }
 * );
 *
 * useEffect(() => { execute(); }, [execute]);
 * ```
 */
export function useAPIRequest<T>(
  fetcher: () => Promise<T>,
  options: UseAPIRequestOptions<T> = {}
): UseAPIRequestResult<T> {
  const {
    initialData,
    maxRetries = 3,
    retryDelay = 1000,
    maxRetryDelay = 30000,
    autoRetry = true,
    onError,
    onSuccess,
    onRetry,
  } = options

  const [data, setData] = useState<T | undefined>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<APIError | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // アボートコントローラー
  const abortControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  // クリーンアップ
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  // リクエスト実行
  const executeWithRetry = useCallback(
    async (attempt = 0): Promise<T | undefined> => {
      // 既存のリクエストをキャンセル
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      if (!mountedRef.current) return undefined

      try {
        if (attempt === 0) {
          setLoading(true)
          setError(null)
          setRetryCount(0)
        } else {
          setRetrying(true)
          setRetryCount(attempt)
        }

        const result = await fetcher()

        if (!mountedRef.current) return undefined

        setData(result)
        setError(null)
        setLoading(false)
        setRetrying(false)
        setRetryCount(0)

        onSuccess?.(result)
        return result
      } catch (err) {
        if (!mountedRef.current) return undefined

        const apiError = toAPIError(err)
        logError(apiError, "useAPIRequest")

        // リトライ判定
        const canRetry =
          autoRetry &&
          isErrorRetryable(apiError) &&
          attempt < maxRetries

        if (canRetry) {
          const delay = getRetryDelay(attempt, retryDelay, maxRetryDelay)
          onRetry?.(attempt + 1, apiError)

          await new Promise((resolve) => setTimeout(resolve, delay))

          if (mountedRef.current) {
            return executeWithRetry(attempt + 1)
          }
        }

        // リトライ不可または最大回数到達
        setError(apiError)
        setLoading(false)
        setRetrying(false)

        onError?.(apiError)
        return undefined
      }
    },
    [fetcher, maxRetries, retryDelay, maxRetryDelay, autoRetry, onError, onSuccess, onRetry]
  )

  // 公開用execute
  const execute = useCallback(() => {
    return executeWithRetry(0)
  }, [executeWithRetry])

  // 手動リトライ
  const retry = useCallback(() => {
    setError(null)
    return executeWithRetry(0)
  }, [executeWithRetry])

  // リセット
  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    setData(initialData)
    setLoading(false)
    setError(null)
    setRetrying(false)
    setRetryCount(0)
  }, [initialData])

  return {
    data,
    loading,
    error,
    retrying,
    retryCount,
    execute,
    retry,
    reset,
    setData,
  }
}

/**
 * 遅延付きAPIリクエストフック
 *
 * ローディング表示のちらつきを防ぐため、
 * 短時間のローディングを抑制します。
 */
export function useDelayedLoading(
  loading: boolean,
  delay = 200
): boolean {
  const [delayedLoading, setDelayedLoading] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (loading) {
      timerRef.current = setTimeout(() => {
        setDelayedLoading(true)
      }, delay)
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      setDelayedLoading(false)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [loading, delay])

  return delayedLoading
}

/**
 * ポーリング付きAPIリクエストフック
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  interval: number,
  options: UseAPIRequestOptions<T> & { enabled?: boolean } = {}
): UseAPIRequestResult<T> & { start: () => void; stop: () => void } {
  const { enabled = true, ...requestOptions } = options
  const result = useAPIRequest(fetcher, requestOptions)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isPolling, setIsPolling] = useState(enabled)

  const start = useCallback(() => {
    setIsPolling(true)
  }, [])

  const stop = useCallback(() => {
    setIsPolling(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isPolling) return

    // 初回実行
    result.execute()

    // ポーリング開始
    intervalRef.current = setInterval(() => {
      result.execute()
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPolling, interval]) // result.executeは安定しているので依存配列に含めない

  return { ...result, start, stop }
}
