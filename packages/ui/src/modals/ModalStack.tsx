import {
  type ComponentType,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

interface ModalStackEntry<P = unknown> {
  id: string;
  Component: ComponentType<P & { open: boolean; onOpenChange: (o: boolean) => void }>;
  props: P;
}

interface ModalStackContextValue {
  push: <P>(
    Component: ComponentType<P & { open: boolean; onOpenChange: (o: boolean) => void }>,
    props: P,
  ) => string;
  dismiss: (id: string) => void;
  dismissTop: () => void;
  dismissAll: () => void;
  count: number;
}

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

export interface ModalStackProviderProps {
  children: ReactNode;
}

/**
 * Provider + portal renderer for stacked modals. Each pushed modal renders
 * with its own backdrop; Radix Dialog handles per-instance focus management.
 */
export function ModalStackProvider({ children }: ModalStackProviderProps) {
  const [stack, setStack] = useState<ModalStackEntry<unknown>[]>([]);

  const push = useCallback<ModalStackContextValue['push']>((Component, props) => {
    const id = `modal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setStack((prev) => [
      ...prev,
      { id, Component: Component as ModalStackEntry['Component'], props: props as unknown },
    ]);
    return id;
  }, []);

  const dismiss = useCallback<ModalStackContextValue['dismiss']>((id) => {
    setStack((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const dismissTop = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const dismissAll = useCallback(() => {
    setStack([]);
  }, []);

  const value = useMemo<ModalStackContextValue>(
    () => ({ push, dismiss, dismissTop, dismissAll, count: stack.length }),
    [push, dismiss, dismissTop, dismissAll, stack.length],
  );

  return (
    <ModalStackContext.Provider value={value}>
      {children}
      {stack.map((entry) => {
        const Component = entry.Component as ComponentType<{
          open: boolean;
          onOpenChange: (o: boolean) => void;
        }>;
        return (
          <Component
            key={entry.id}
            open
            onOpenChange={(open) => {
              if (!open) dismiss(entry.id);
            }}
            {...(entry.props as Record<string, unknown>)}
          />
        );
      })}
    </ModalStackContext.Provider>
  );
}

export function useModalStack(): ModalStackContextValue {
  const ctx = useContext(ModalStackContext);
  if (!ctx) throw new Error('useModalStack must be used within <ModalStackProvider>');
  return ctx;
}
