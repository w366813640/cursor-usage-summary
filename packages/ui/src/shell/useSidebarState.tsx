import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'cu-ui-sidebar-expanded';

interface SidebarStateContextValue {
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<SidebarStateContextValue | null>(null);

export function SidebarStateProvider({
  children,
  defaultExpanded = false,
}: {
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpandedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultExpanded;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return defaultExpanded;
    return saved === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, String(expanded));
  }, [expanded]);

  const setExpanded = useCallback((value: boolean) => setExpandedState(value), []);
  const toggle = useCallback(() => setExpandedState((prev) => !prev), []);

  const value = useMemo(() => ({ expanded, setExpanded, toggle }), [expanded, setExpanded, toggle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSidebarState(): SidebarStateContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSidebarState must be used within <SidebarStateProvider>');
  return ctx;
}
