import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageShellProps {
  children: ReactNode
  className?: string
}

/** Full-page wrapper: min height + semantic background (design system pilot). */
export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn('min-h-screen bg-background', className)}>{children}</div>
}

export interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  leading?: ReactNode
  className?: string
}

/** Page title row: optional leading icon, title + subtitle, actions (RTL-aware via document dir). */
export function PageHeader({ title, description, actions, leading, className }: PageHeaderProps) {
  return (
    <header className={cn('border-b border-border/80 bg-card shadow-soft', className)}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {leading}
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
