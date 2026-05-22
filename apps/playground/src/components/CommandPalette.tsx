import {
  type Action,
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarProvider,
  KBarResults,
  KBarSearch,
  useMatches,
  useRegisterActions,
} from 'kbar';
import { type ReactNode, useMemo } from 'react';
import { ALL_ROUTES, type AppRoute } from '../router/useRoute';

/**
 * Global Cmd/Ctrl-K command palette. Powers:
 *
 *   - Route jumps (g o / g y / g n / g m / g r / g d)
 *   - Quick actions (Import CSV, Export PNG, Open History, …)
 *   - Settings drawer toggle
 *
 * The palette is mounted at the top of the app tree (WelcomePage) so it
 * works across the welcome screen AND the dashboard. Route actions resolve
 * via `window.location.hash` directly because the kbar `<KBarProvider>`
 * needs `actions` at construction time, while `useRoute` is a hook that
 * only exists inside the dashboard subtree.
 *
 * Style is hand-rolled in design tokens so the palette feels native to the
 * Bloomberg/Tufte aesthetic — kbar's stock theme is too "marketing-y".
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const baseActions = useMemo<Action[]>(() => {
    const navAction = (route: AppRoute, shortcut: string[], hint: string): Action => ({
      id: `nav-${route}`,
      name: `Go to ${titleCase(route)}`,
      keywords: `${route} navigate jump open ${hint}`,
      shortcut,
      section: 'Navigate',
      perform: () => {
        window.location.hash = `/${route}`;
      },
    });

    return [
      // Navigation
      navAction('overview', ['g', 'o'], 'home dashboard kpi'),
      navAction('year', ['g', 'y'], 'annual review heatmap calendar'),
      navAction('anomalies', ['g', 'n'], 'anomaly outlier spike z-score'),
      navAction('models', ['g', 'm'], 'per model breakdown table'),
      navAction('details', ['g', 'r'], 'every row request table'),
      navAction('day', ['g', 'd'], 'single day request timeline hour weekday burn schedule'),
    ];
  }, []);

  return (
    <KBarProvider
      actions={baseActions}
      options={{
        enableHistory: false,
        // Default keybinding `mod+k` already works — kbar handles
        // both `Cmd+K` on mac and `Ctrl+K` on win/linux.
      }}
    >
      {children}
      <PaletteUI />
    </KBarProvider>
  );
}

/**
 * Inside-the-provider helper hook for child components that want to
 * register additional contextual actions (e.g. desktop actions like
 * Import CSV / History / Settings appear only inside the dashboard).
 */
export function useExtraPaletteActions(actions: Action[]) {
  useRegisterActions(actions, [actions]);
}

function PaletteUI() {
  return (
    <KBarPortal>
      <KBarPositioner
        style={{
          background: 'color-mix(in oklab, var(--color-bg) 70%, transparent)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          // Bias upward — the palette feels less cramped pushed off center.
          paddingTop: '15vh',
          alignItems: 'flex-start',
        }}
      >
        <KBarAnimator
          style={{
            width: 'min(640px, 92vw)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 12,
            boxShadow:
              '0 24px 64px -16px rgba(0,0,0,0.45), 0 8px 16px -8px rgba(0,0,0,0.18), inset 0 1px 0 color-mix(in oklab, var(--color-text) 6%, transparent)',
            overflow: 'hidden',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <KBarSearch
            style={{
              width: '100%',
              padding: '14px 18px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: 15,
              fontFamily: 'var(--font-sans)',
              borderBottom: '1px solid var(--color-border)',
            }}
            placeholder="Jump to · search actions"
            defaultPlaceholder="Jump to · search actions"
          />
          <PaletteResults />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}

function PaletteResults() {
  const { results } = useMatches();
  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) => {
        if (typeof item === 'string') {
          return (
            <div
              style={{
                padding: '10px 18px 4px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-text-subtle)',
              }}
            >
              {item}
            </div>
          );
        }
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 18px',
              cursor: 'pointer',
              background: active ? 'var(--color-surface-muted)' : 'transparent',
              borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
              transition: 'background 120ms ease, border-color 120ms ease',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{item.name}</span>
              {item.subtitle ? (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-subtle)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {item.subtitle}
                </span>
              ) : null}
            </div>
            {item.shortcut && item.shortcut.length > 0 ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {item.shortcut.map((s, i) => (
                  <span
                    key={`${item.id}-shortcut-${i}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 20,
                      height: 20,
                      padding: '0 6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      color: 'var(--color-text-subtle)',
                      background: 'var(--color-surface-muted)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      }}
    />
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Re-export for ergonomics — callers shouldn't have to import ALL_ROUTES separately.
export { ALL_ROUTES };
