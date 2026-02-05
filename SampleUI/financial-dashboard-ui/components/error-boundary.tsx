"use client"

import * as React from "react"
import { AlertCircle, RefreshCw, Home, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toAPIError, type APIError } from "@/lib/error-handler"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * React Error Boundary - エラーを捕捉して表示
 *
 * 子コンポーネントで発生したエラーを捕捉し、
 * フォールバックUIを表示します。
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)

    // 開発環境ではコンソールにも出力
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

// エラーフォールバックUI
interface ErrorFallbackProps {
  error: Error | null
  errorInfo?: React.ErrorInfo | null
  onReset?: () => void
}

export function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false)
  const apiError = error ? toAPIError(error) : null

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">エラーが発生しました</CardTitle>
              <CardDescription>
                {apiError?.code || "UNKNOWN_ERROR"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {apiError?.message || "予期しないエラーが発生しました。"}
          </p>

          {apiError?.retryable && (
            <p className="text-sm text-muted-foreground">
              この問題は一時的なものの可能性があります。しばらく待ってから再試行してください。
            </p>
          )}

          {process.env.NODE_ENV === "development" && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>詳細情報</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showDetails ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-auto max-h-48">
                  <p className="font-semibold mb-2">Error Details:</p>
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(apiError?.toJSON?.() || { message: error?.message }, null, 2)}
                  </pre>
                  {errorInfo?.componentStack && (
                    <>
                      <p className="font-semibold mt-4 mb-2">Component Stack:</p>
                      <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                        {errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          {onReset && (
            <Button onClick={onReset} variant="default" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              再試行
            </Button>
          )}
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => (window.location.href = "/")}
          >
            <Home className="mr-2 h-4 w-4" />
            ホームに戻る
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// 関数コンポーネント版（use client での利用用）
interface AsyncErrorBoundaryProps {
  children: React.ReactNode
  onReset?: () => void
}

export function AsyncBoundary({ children, onReset }: AsyncErrorBoundaryProps) {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(event.error)
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      setError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)))
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [])

  const handleReset = () => {
    setError(null)
    onReset?.()
  }

  if (error) {
    return <ErrorFallback error={error} onReset={handleReset} />
  }

  return <>{children}</>
}
