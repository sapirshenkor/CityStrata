import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

/**
 * Layers panel RTL layout: visually ON = thumb left, OFF = thumb right.
 * Thumb uses viewport X translates; swapping here avoids brittle `rtl:*` specificity vs base Switch utilities.
 * Parent panel is dir=rtl, which shifts flex inline-start / thumb anchoring unless the control isolates layout.
 */
const LayersPanelSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
      className,
    )}
    ref={ref}
    {...props}
    dir="ltr"
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
        'data-[state=unchecked]:translate-x-4 data-[state=checked]:translate-x-0',
      )}
    />
  </SwitchPrimitives.Root>
))
LayersPanelSwitch.displayName = 'LayersPanelSwitch'

export { LayersPanelSwitch }
