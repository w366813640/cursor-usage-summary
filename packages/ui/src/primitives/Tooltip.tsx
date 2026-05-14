import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ComponentPropsWithoutRef, type ElementRef, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils';

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = TooltipPrimitive.Root;

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-[300] px-2 py-1 rounded-[6px] text-[12px] leading-none origin-[var(--radix-tooltip-content-transform-origin)]',
          'bg-[#1B1A18] text-white shadow-[0_4px_12px_rgba(0,0,0,0.18)]',
          'dark:bg-[#F1ECE2] dark:text-[#1F1E1B] dark:shadow-[0_4px_12px_rgba(0,0,0,0.45)]',
          'will-change-[opacity,transform]',
          'data-[state=delayed-open]:animate-[tooltip-in_140ms_var(--ease-spring)_forwards]',
          'data-[state=instant-open]:animate-[tooltip-in_140ms_var(--ease-spring)_forwards]',
          'data-[state=closed]:animate-[tooltip-out_100ms_var(--ease-standard)_forwards]',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});

export function Tooltipped({
  label,
  children,
  side = 'top',
  delayDuration = 200,
  asChild = true,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
  asChild?: boolean;
}) {
  if (!label) return <>{children}</>;
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
