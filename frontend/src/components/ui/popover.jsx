import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef(({ className, align = 'start', sideOffset = 4, ...props }, ref) => (
  // Tailwind utilities here are scoped with important:'.admin-shell', so the
  // portaled content must live INSIDE .admin-shell or none of its bg/border/
  // etc. classes resolve. Portal into that node (fixed positioning still
  // escapes its overflow:hidden), falling back to body outside admin.
  <PopoverPrimitive.Portal container={typeof document !== 'undefined' ? document.querySelector('.admin-shell') : undefined}>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-[10000] rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
