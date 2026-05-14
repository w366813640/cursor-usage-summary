import { X } from '@cu/icons';
import * as ToastPrimitive from '@radix-ui/react-toast';
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { cn } from '../utils';

export const ToastProviderRoot = ToastPrimitive.Provider;

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        'fixed bottom-4 right-4 z-[500] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none',
        className,
      )}
      {...props}
    />
  );
});

export type ToastTone = 'neutral' | 'success' | 'warning' | 'destructive';

export interface ToastRootProps extends ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  tone?: ToastTone;
}

const toneClasses: Record<ToastTone, string> = {
  neutral: 'border-[var(--color-border)] bg-[var(--color-surface-raised)]',
  success: 'border-[var(--color-success)]/30 bg-[var(--color-surface-raised)]',
  warning: 'border-[var(--color-warning)]/30 bg-[var(--color-surface-raised)]',
  destructive: 'border-[var(--color-destructive)]/30 bg-[var(--color-surface-raised)]',
};

export const ToastRoot = forwardRef<ElementRef<typeof ToastPrimitive.Root>, ToastRootProps>(
  function ToastRoot({ className, tone = 'neutral', ...props }, ref) {
    return (
      <ToastPrimitive.Root
        ref={ref}
        className={cn(
          'group pointer-events-auto relative flex w-full items-start gap-3 rounded-[12px] border p-3.5 pr-8',
          'shadow-[var(--shadow-popover)] backdrop-blur-[2px]',
          'origin-bottom-right',
          'data-[state=open]:animate-[toast-in_280ms_var(--ease-spring)_forwards]',
          'data-[state=closed]:animate-[toast-out_180ms_var(--ease-standard)_forwards]',
          'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
          'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=cancel]:duration-200',
          'data-[swipe=end]:animate-[toast-swipe-out_180ms_var(--ease-accelerate)_forwards]',
          toneClasses[tone],
          className,
        )}
        {...props}
      />
    );
  },
);

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Title
      ref={ref}
      className={cn('text-[14px] font-semibold text-[var(--color-text)] leading-tight', className)}
      {...props}
    />
  );
});

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Description
      ref={ref}
      className={cn('text-[13px] text-[var(--color-text-muted)] mt-0.5', className)}
      {...props}
    />
  );
});

export const ToastClose = forwardRef<
  ElementRef<typeof ToastPrimitive.Close>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(function ToastClose({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Close
      ref={ref}
      className={cn(
        'absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--color-text-muted)]',
        'hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]',
        className,
      )}
      aria-label="Close"
      {...props}
    >
      <X size={14} />
    </ToastPrimitive.Close>
  );
});

export interface ToastAction {
  /** Button label. Kept short — Linear-style "Undo" / "Open" / "Retry". */
  label: string;
  /** Click handler. The toast self-dismisses after the click. */
  onClick: () => void;
  /**
   * Required by Radix's `<ToastAction>` for accessibility. A short
   * description used by screen readers when announcing the toast.
   */
  altText?: string;
}

interface ToastItem {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  duration?: number;
  action?: ToastAction;
}

interface ToastApi {
  show: (item: Omit<ToastItem, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

const ToastApiContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback<ToastApi['show']>((item) => {
    const id = item.id ?? Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { ...item, id }]);
    return id;
  }, []);

  const dismiss = useCallback<ToastApi['dismiss']>((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastApiContext.Provider value={{ show, dismiss }}>
      <ToastProviderRoot swipeDirection="right" duration={4500}>
        {children}
        {items.map((t) => (
          <ToastRoot
            key={t.id}
            tone={t.tone}
            duration={t.duration}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
          >
            <div className="flex-1 min-w-0">
              {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
              {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
            </div>
            {t.action ? (
              <ToastPrimitive.Action
                altText={t.action.altText ?? t.action.label}
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className={cn(
                  'shrink-0 inline-flex items-center justify-center h-7 px-2.5 rounded-[8px]',
                  'text-[12.5px] font-semibold text-[var(--color-accent)]',
                  'hover:bg-[var(--color-accent-soft)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                  'transition-colors duration-[120ms]',
                )}
              >
                {t.action.label}
              </ToastPrimitive.Action>
            ) : null}
            <ToastClose />
          </ToastRoot>
        ))}
        <ToastViewport />
      </ToastProviderRoot>
    </ToastApiContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastApiContext);
  if (!ctx) throw new Error('useToast() must be used within <ToastProvider>');
  return ctx;
}

export function useAutoDismissToast(id: string | null, ms = 3500) {
  const { dismiss } = useToast();
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => dismiss(id), ms);
    return () => clearTimeout(t);
  }, [id, ms, dismiss]);
}
