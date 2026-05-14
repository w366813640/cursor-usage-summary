import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils';

export const Kbd = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function Kbd(
  { className, children, ...props },
  ref,
) {
  return (
    <kbd
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
        'text-[10px] font-mono font-medium text-[var(--color-text-muted)]',
        'bg-[var(--color-surface-muted)] border border-[var(--color-border)]',
        'rounded-[4px]',
        className,
      )}
      {...(props as HTMLAttributes<HTMLElement>)}
    >
      {children}
    </kbd>
  );
});
