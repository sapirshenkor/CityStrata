import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type AppHeaderVariant = 'map' | 'landing'

const variants: Record<
  AppHeaderVariant,
  { root: string; title: string; subtitle: string }
> = {
  landing: {
    root: 'border-b border-white/20 bg-gradient-to-br from-primary to-slate-800',
    title: 'text-white',
    subtitle: 'text-white/85',
  },
  map: {
    root: 'border-b border-border bg-background',
    title: 'text-foreground',
    subtitle: 'text-muted-foreground',
  },
}

export function AppHeader({
  children,
  variant = 'landing',
}: {
  children?: ReactNode
  /** `map` = dark-first map chrome. `landing` = legacy marketing header (isolated from `/map`). */
  variant?: AppHeaderVariant
}) {
  const s = variants[variant]
  return (
    <header
      className={cn(
        'relative z-[1150] flex h-14 shrink-0 items-center justify-between px-4 shadow-sm',
        s.root,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          className={cn(
            'text-lg font-bold tracking-tight transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm',
            s.title,
          )}
        >
          CityStrata
        </Link>
        <span className={cn('hidden text-xs font-medium sm:inline', s.subtitle)}>
        אילת · מערכת לניהול פינוי
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </header>
  )
}
