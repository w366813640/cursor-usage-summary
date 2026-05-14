import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)]',
        'rounded-[10px] px-3 py-1.5 text-sm text-[var(--color-text)]',
        'placeholder:text-[var(--color-text-subtle)]',
        'transition-[border-color,box-shadow,background-color] duration-[160ms] ease-[var(--ease-spring)]',
        'hover:border-[var(--color-border-strong)]',
        'focus:outline-none focus:border-[var(--color-accent)]',
        'focus:shadow-[0_0_0_3px_var(--color-ring),inset_0_0_0_1px_var(--color-accent)]',
        'focus:bg-[var(--color-surface-raised)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        invalid &&
          'border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-destructive)_22%,transparent),inset_0_0_0_1px_var(--color-destructive)]',
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  autoGrow?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, autoGrow = true, rows = 1, style, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      style={autoGrow ? ({ fieldSizing: 'content', ...style } as React.CSSProperties) : style}
      className={cn(
        'block w-full bg-transparent text-[var(--color-text)] resize-none',
        'placeholder:text-[var(--color-text-subtle)]',
        'text-[15px] leading-[22px] font-sans',
        'focus:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        invalid && 'text-[var(--color-destructive)]',
        className,
      )}
      {...props}
    />
  );
});
