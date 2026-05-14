import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'soft' | 'outline';
  active?: boolean;
  children: ReactNode;
  label: string;
}

const sizeMap = {
  sm: 'h-7 w-7 rounded-[8px] [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-8 w-8 rounded-[10px] [&_svg]:h-[18px] [&_svg]:w-[18px]',
  lg: 'h-9 w-9 rounded-[10px] [&_svg]:h-5 [&_svg]:w-5',
};

const variantMap = {
  ghost:
    'bg-transparent hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-surface-sunken)]',
  soft: 'bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-sunken)]',
  outline:
    'bg-transparent border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)]',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, size = 'md', variant = 'ghost', active, children, label, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center text-[var(--color-text-muted)]',
        'transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
        'hover:text-[var(--color-text)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg)]',
        'disabled:opacity-40 disabled:pointer-events-none',
        sizeMap[size],
        variantMap[variant],
        active && 'bg-[var(--color-surface-sunken)] text-[var(--color-text)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
