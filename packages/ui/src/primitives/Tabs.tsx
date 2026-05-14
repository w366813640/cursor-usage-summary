import * as TabsPrimitive from '@radix-ui/react-tabs';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';
import { cn } from '../utils';

export const Tabs = TabsPrimitive.Root;

export interface TabsListProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: 'underline' | 'pill';
}

export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  function TabsList({ className, variant = 'underline', ...props }, ref) {
    return (
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          'group/list',
          variant === 'underline' &&
            'flex items-center gap-4 border-b border-[var(--color-border)]',
          variant === 'pill' &&
            'inline-flex items-center gap-1 rounded-[10px] bg-[var(--color-surface-muted)] p-1',
          className,
        )}
        data-variant={variant}
        {...props}
      />
    );
  },
);

export interface TabsTriggerProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {}

export const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  function TabsTrigger({ className, ...props }, ref) {
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
          'group inline-flex items-center justify-center text-[13px] font-medium select-none',
          'transition-colors duration-[120ms] outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg)]',
          'data-[state=active]:text-[var(--color-text)] text-[var(--color-text-muted)]',
          'hover:text-[var(--color-text)]',
          'group-data-[variant=underline]/list:px-0.5 group-data-[variant=underline]/list:pb-2',
          'group-data-[variant=underline]/list:data-[state=active]:border-b-2 group-data-[variant=underline]/list:data-[state=active]:border-[var(--color-text)]',
          'group-data-[variant=underline]/list:data-[state=active]:-mb-px',
          'group-data-[variant=pill]/list:rounded-[8px] group-data-[variant=pill]/list:px-3 group-data-[variant=pill]/list:h-7',
          'group-data-[variant=pill]/list:data-[state=active]:bg-[var(--color-surface-raised)] group-data-[variant=pill]/list:data-[state=active]:shadow-[var(--shadow-card)]',
          className,
        )}
        {...props}
      />
    );
  },
);

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn('mt-4 outline-none focus-visible:outline-none', className)}
      {...props}
    />
  );
});
