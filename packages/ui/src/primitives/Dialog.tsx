import { X } from '@cu/icons';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type ComponentPropsWithoutRef, type ElementRef, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-[400] bg-[var(--color-overlay)] backdrop-blur-[2px]',
        'data-[state=open]:animate-[fade-in_var(--duration-base)_var(--ease-standard)]',
        'data-[state=closed]:animate-[fade-in_var(--duration-fast)_var(--ease-standard)_reverse]',
        className,
      )}
      {...props}
    />
  );
});

export type DialogSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClass: Record<DialogSize, string> = {
  xs: 'max-w-[360px]',
  sm: 'max-w-[440px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[760px]',
  xl: 'max-w-[920px]',
};

export interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: DialogSize;
  hideCloseButton?: boolean;
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent({ className, children, size = 'md', hideCloseButton, ...props }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-[410] -translate-x-1/2 -translate-y-1/2',
          'w-[calc(100%-2rem)]',
          sizeClass[size],
          'bg-[var(--color-surface-raised)] border border-[var(--color-border)]',
          'shadow-[var(--shadow-modal)] rounded-[14px]',
          'p-6 outline-none',
          'data-[state=open]:animate-[pop-in_var(--duration-medium)_var(--ease-spring)]',
          'data-[state=closed]:animate-[pop-in_var(--duration-fast)_var(--ease-standard)_reverse]',
          className,
        )}
        {...props}
      >
        {children}
        {!hideCloseButton ? (
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center',
              'rounded-[8px] text-[var(--color-text-muted)]',
              'hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
              'transition-colors duration-[120ms]',
            )}
            aria-label="Close"
          >
            <X size={16} />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({
  className,
  ...props
}: { className?: string; children?: ReactNode }) {
  return <div className={cn('mb-4 flex flex-col gap-1.5 pr-8', className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        // serif title carries the editorial brand voice into every modal —
        // pairs with the Source Serif 4 used for editor headings.
        'font-serif text-[19px] leading-tight font-semibold text-[var(--color-text)]',
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-[var(--color-text-muted)]', className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: { className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn('mt-6 flex flex-row items-center justify-end gap-2', className)}
      {...props}
    />
  );
}
