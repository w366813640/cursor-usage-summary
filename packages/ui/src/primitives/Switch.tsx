import * as SwitchPrimitive from '@radix-ui/react-switch';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';
import { cn } from '../utils';

export interface SwitchProps extends ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  size?: 'sm' | 'md';
}

export const Switch = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  function Switch({ className, size = 'md', ...props }, ref) {
    const isSmall = size === 'sm';
    return (
      <SwitchPrimitive.Root
        ref={ref}
        className={cn(
          'peer group/switch inline-flex shrink-0 cursor-pointer items-center rounded-full',
          'border border-transparent transition-colors duration-[200ms] ease-[var(--ease-spring)]',
          'data-[state=unchecked]:bg-[var(--color-border)] data-[state=checked]:bg-[var(--color-accent)]',
          'data-[state=unchecked]:hover:bg-[var(--color-border-strong)]',
          'data-[state=checked]:hover:bg-[var(--color-accent-hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:[&>span]:scale-110',
          isSmall ? 'h-4 w-7' : 'h-5 w-9',
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.18)]',
            'transition-[transform,box-shadow] duration-[260ms] ease-[var(--ease-spring)]',
            'group-data-[state=checked]/switch:shadow-[0_2px_6px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]',
            isSmall
              ? 'h-3 w-3 translate-x-0.5 data-[state=checked]:translate-x-3.5'
              : 'h-4 w-4 translate-x-0.5 data-[state=checked]:translate-x-4',
          )}
        />
      </SwitchPrimitive.Root>
    );
  },
);
