import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cu-ui-theme';

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const value = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = mode;
  if (typeof window === 'undefined') return;
  const bridge = (window as unknown as { bridge?: { theme?: { set?: (m: ThemeMode) => unknown } } })
    .bridge;
  bridge?.theme?.set?.(mode);
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

export function ThemeProvider({ children, defaultMode }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => defaultMode ?? readStoredTheme());
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    applyTheme(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);

  // Toggle is keyed off the *resolved* theme, not the raw mode. Otherwise
  // a user whose mode is `'system'` and OS-prefers-dark would tap the icon
  // and see "no change" (mode goes to `'dark'`, which looks identical) —
  // they'd have to tap a second time to actually get light, and the
  // first click feels broken.
  const toggle = useCallback(() => {
    setModeState(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      setMode,
      toggle,
    }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
