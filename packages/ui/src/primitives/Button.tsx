import { Loader2 } from '@cu/icons';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
    'font-sans font-medium select-none',
    'transition-[background-color,box-shadow,transform,color,border-color]',
    'duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg)]',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-[#1B1A18] text-white border border-[#1B1A18]',
          'hover:bg-[#2C2A26] active:bg-[#0F0E0D]',
          'dark:bg-[#F1ECE2] dark:text-[#1F1E1B] dark:border-[#F1ECE2] dark:hover:bg-white',
        ],
        accent: [
          'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] border border-transparent',
          'hover:bg-[var(--color-accent-hover)] active:brightness-95',
        ],
        ghost: [
          'bg-transparent text-[var(--color-text)] border border-transparent',
          'hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-surface-sunken)]',
        ],
        outline: [
          'bg-transparent text-[var(--color-text)] border border-[var(--color-border)]',
          'hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)]',
          'active:bg-[var(--color-surface-sunken)]',
        ],
        soft: [
          'bg-[var(--color-surface-muted)] text-[var(--color-text)] border border-transparent',
          'hover:bg-[var(--color-surface-sunken)]',
        ],
        destructive: [
          'bg-[var(--color-destructive)] text-white border border-transparent',
          'hover:brightness-110 active:brightness-95',
        ],
        link: 'text-[var(--color-accent)] underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs rounded-[8px]',
        md: 'h-9 px-3.5 text-sm rounded-[10px]',
        lg: 'h-11 px-5 text-base rounded-[12px]',
        icon: 'h-9 w-9 p-0 rounded-[10px]',
        'icon-sm': 'h-7 w-7 p-0 rounded-[8px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref as never}
      className={cn(buttonVariants({ variant, size }), loading && 'cursor-progress', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
      {children}
    </Comp>
  );
});

export { buttonVariants };
