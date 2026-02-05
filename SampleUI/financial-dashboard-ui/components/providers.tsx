"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { CompanyProvider } from "@/contexts/company-context"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/sonner"

// デフォルトのクエリクライアント設定
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSRでは即座にstaleとみなす
        staleTime: typeof window === "undefined" ? 0 : 60 * 1000,
        // エラー時のリトライ設定
        retry: (failureCount, error) => {
          // 404エラーはリトライしない
          if (error instanceof Error && error.message.includes("404")) {
            return false
          }
          return failureCount < 3
        },
        // リトライ間隔
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // バックグラウンドでの再フェッチ
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  })
}

// ブラウザ用のシングルトン
let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === "undefined") {
    // サーバーサイドでは常に新しいクライアントを作成
    return makeQueryClient()
  } else {
    // ブラウザではシングルトンを使用
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient()
    }
    return browserQueryClient
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  // クライアントサイドでのみ初期化されるstate
  const [queryClient] = useState(() => getQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <CompanyProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={5000}
          />
        </CompanyProvider>
      </ErrorBoundary>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
