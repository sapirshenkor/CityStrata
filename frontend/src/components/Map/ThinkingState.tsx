import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

const PHRASES = [
  'אנחנו עובדים בשבילך...',
  'מנתח נתונים מרחביים...',
  'מגבש תובנות עירוניות...',
  'הסוכנים בדרך לפתרון...',
] as const

export type ThinkingStateVariant = 'default' | 'sidebar'

/**
 * Glass-style status card with cycling Hebrew copy; icon uses `animate-thinking-icon-pulse` (Tailwind theme).
 * Use `sidebar` for a narrower dock inside the map sidebar while the map stays interactive.
 */
export function ThinkingState({
  className,
  variant = 'default',
}: {
  className?: string
  variant?: ThinkingStateVariant
}) {
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length)
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const isSidebar = variant === 'sidebar'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`pointer-events-none flex w-full max-w-full flex-col items-center rounded-2xl border border-white/20 bg-card/65 text-center shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-card/50 ${isSidebar ? 'px-5 py-5' : 'max-w-[min(420px,calc(100vw-3rem))] px-10 py-8'} ${className ?? ''}`}
    >
      <Sparkles
        className={`${isSidebar ? 'size-10' : 'size-14'} shrink-0 text-primary animate-thinking-icon-pulse`}
        strokeWidth={1.5}
        aria-hidden
      />
      <p
        dir="rtl"
        className={`text-balance font-medium leading-relaxed text-foreground ${isSidebar ? 'mt-3 min-h-[2.75rem] text-sm' : 'mt-5 min-h-[3.5rem] text-base'} `}
        key={phraseIndex}
      >
        {PHRASES[phraseIndex]}
      </p>
    </div>
  )
}

export default ThinkingState
