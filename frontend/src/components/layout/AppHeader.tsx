import type { ReactNode } from 'react'

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="relative z-[1150] flex h-14 shrink-0 items-center justify-between border-b border-white/20 bg-gradient-to-br from-primary to-slate-800 px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="text-lg font-bold tracking-tight text-white">CityStrata</div>
        <span className="hidden text-xs font-medium text-white/85 sm:inline">
          Eilat evacuation mapping
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </header>
  )
}
