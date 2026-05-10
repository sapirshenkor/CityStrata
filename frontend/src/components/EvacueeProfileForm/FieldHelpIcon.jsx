import React from 'react'
import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * @param {{ text: string, ariaLabel: string, className?: string }} props
 */
export default function FieldHelpIcon({ text, ariaLabel, className }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
          aria-label={ariaLabel}
        >
          <HelpCircle className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" className="max-w-[min(20rem,calc(100vw-2rem))]" dir="rtl">
        <p className="text-sm leading-relaxed">{text}</p>
      </TooltipContent>
    </Tooltip>
  )
}
