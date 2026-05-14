import * as PopoverPrimitive from '@radix-ui/react-popover';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';
import { cn } from '../utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent({ className, sideOffset = 6, align = 'center', ...props }, ref) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-[200] w-72 p-4',
          'rounded-[12px] bg-[var(--color-surface-raised)] border border-[var(--color-border)]',
          'shadow-[var(--shadow-popover)]',
          'data-[state=open]:animate-[pop-in_var(--duration-fast)_var(--ease-spring)]',
          'data-[state=closed]:opacity-0',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
