import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { type ComponentPropsWithoutRef, type ElementRef, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils';

export interface AvatarProps extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  status?: 'online' | 'busy' | 'offline';
}

const sizeMap = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-[11px]',
  md: 'h-7 w-7 text-[12px]',
  lg: 'h-9 w-9 text-[14px]',
};

const pipColorMap = {
  online: 'bg-[var(--color-success)]',
  busy: 'bg-[var(--color-warning)]',
  offline: 'bg-[var(--color-text-subtle)]',
};

export const Avatar = forwardRef<ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  function Avatar({ className, size = 'md', status, children, ...props }, ref) {
    return (
      <span className="relative inline-flex">
        <AvatarPrimitive.Root
          ref={ref}
          className={cn(
            'relative inline-flex select-none items-center justify-center overflow-hidden',
            'rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text)] font-medium',
            sizeMap[size],
            className,
          )}
          {...props}
        >
          {children}
        </AvatarPrimitive.Root>
        {status ? (
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--color-bg)]',
              pipColorMap[status],
            )}
          />
        ) : null}
      </span>
    );
  },
);

export const AvatarImage = forwardRef<
  ElementRef<typeof AvatarPrimitive.Image>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn('h-full w-full object-cover', className)}
      {...props}
    />
  );
});

export const AvatarFallback = forwardRef<
  ElementRef<typeof AvatarPrimitive.Fallback>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn('flex h-full w-full items-center justify-center', className)}
      {...props}
    />
  );
});

export function AvatarInitials({
  initials,
  size,
  status,
  className,
  tone = 'neutral',
}: {
  initials: string;
  size?: AvatarProps['size'];
  status?: AvatarProps['status'];
  className?: string;
  tone?: 'neutral' | 'accent' | 'dark';
}): ReactNode {
  const toneClasses = {
    neutral: 'bg-[var(--color-surface-sunken)] text-[var(--color-text)]',
    accent: 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]',
    dark: 'bg-[#15171E] text-white dark:bg-[#EDEEF4] dark:text-[#15171E]',
  } as const;
  return (
    <Avatar size={size} status={status} className={cn(toneClasses[tone], className)}>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
