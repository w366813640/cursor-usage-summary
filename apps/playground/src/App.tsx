import { BrandSwitcherProvider } from '@cu/brand';
import {
  I18nProvider,
  KeyboardShortcutsProvider,
  ModalStackProvider,
  SidebarStateProvider,
  ThemeProvider,
  ToastProvider,
  TooltipProvider,
  useT,
} from '@cu/ui';
import { MotionConfig } from 'framer-motion';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CommandPaletteProvider } from './components/CommandPalette';
import { WelcomePage } from './pages/WelcomePage';

export function App() {
  return (
    <ThemeProvider>
      {/* I18nProvider defaults to English; users opt into other locales
          from Settings → Language. Persisted via `cu:locale` so the
          choice survives reloads / app restarts. */}
      <I18nProvider initialLocale="en">
        <BrandSwitcherProvider initialBrandId="cu-linear-glass">
          <TooltipProvider delayDuration={150}>
            <ToastProvider>
              <ModalStackProvider>
                <KeyboardShortcutsProvider>
                  {/* Sidebar starts collapsed by default — the user opts into
                      the expanded rail with the chevron toggle (persisted via
                      SidebarStateProvider's localStorage backing). */}
                  <SidebarStateProvider>
                    {/* The palette wraps everything below so Cmd/Ctrl+K
                        works on both the welcome screen and the dashboard. */}
                    <CommandPaletteProvider>
                      <MotionConfig reducedMotion="user">
                        <AppErrorBoundary>
                          <WelcomePage />
                        </AppErrorBoundary>
                      </MotionConfig>
                    </CommandPaletteProvider>
                  </SidebarStateProvider>
                </KeyboardShortcutsProvider>
              </ModalStackProvider>
            </ToastProvider>
          </TooltipProvider>
        </BrandSwitcherProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; errorInfo: ErrorInfo | null }
> {
  override state: { error: Error | null; errorInfo: ErrorInfo | null } = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[renderer] recovered from top-level error', error, errorInfo);
    this.setState({ errorInfo });
  }

  override render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;
    return <ErrorFallback error={error} info={errorInfo} />;
  }
}

/**
 * Pulled out as a function component so it can call `useT()` — the
 * boundary itself is a class component (only contract React gives us
 * for `componentDidCatch`) and hooks aren't allowed in class bodies.
 */
function ErrorFallback({ error, info }: { error: Error; info: ErrorInfo | null }) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col justify-center px-6 py-10">
      <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-destructive)]">
          {t('chrome.recoverableError')}
        </p>
        <h1 className="mt-3 font-serif text-[28px] tracking-tight text-[var(--color-text)]">
          {t('chrome.recoverableErrorTitle')}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          {t('chrome.recoverableErrorBody')}
        </p>
        <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-[11px] text-[var(--color-text-muted)]">
          {error.message}
          {info?.componentStack}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md border border-[var(--color-accent)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)]"
        >
          {t('chrome.reloadWindow')}
        </button>
      </div>
    </main>
  );
}
