import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ApiErrorBannerProps {
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  children?: ReactNode
}

export function ApiErrorBanner({
  message,
  onRetry,
  retryLabel = 'Retry',
  className,
  children,
}: ApiErrorBannerProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive',
        className,
      )}
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="min-w-0 flex-1">{message}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRetry()}
          >
            {retryLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  )
}
