import {
  AlertTriangle,
  Calendar,
  Clock,
  Cpu,
  type IconProps,
  Layout,
  PanelLeftClose,
  PanelLeftOpen,
  Table2,
} from '@cu/icons';
import { useSidebarState, useT } from '@cu/ui';
import type { ComponentType } from 'react';
import type { AppRoute } from '../router/useRoute';

const ICONS: Record<AppRoute, ComponentType<IconProps>> = {
  overview: Layout,
  year: Calendar,
  anomalies: AlertTriangle,
  models: Cpu,
  details: Table2,
  day: Clock,
};

const LABEL_KEYS: Record<AppRoute, string> = {
  overview: 'nav.overview',
  year: 'nav.year',
  anomalies: 'nav.anomalies',
  models: 'nav.models',
  details: 'nav.details',
  day: 'nav.day',
};

const SHORTCUTS: Record<AppRoute, string> = {
  overview: 'g o',
  year: 'g y',
  anomalies: 'g n',
  models: 'g m',
  details: 'g r',
  day: 'g d',
};

// Group labels intentionally left untranslated for now — they're
// internal scaffolding strings ("Analyze" / "Investigate") that are
// only visible when the sidebar is expanded. Add to the dictionary
// later if a translator asks for them.
const ROUTE_GROUPS: ReadonlyArray<{
  label: string;
  routes: ReadonlyArray<AppRoute>;
}> = [
  { label: 'Analyze', routes: ['overview', 'year', 'anomalies'] },
  { label: 'Investigate', routes: ['models', 'details', 'day'] },
];

interface SideNavProps {
  current: AppRoute;
  onNavigate: (route: AppRoute) => void;
  /**
   * Optional per-user nav layout — order + visibility. Sourced from
   * settings.navigation when present; SideNav falls back to the static
   * ROUTE_GROUPS when undefined so unconfigured installs still get the
   * curated Analyze / Investigate split.
   */
  routeLayout?: ReadonlyArray<AppRoute>;
}

/**
 * Left-rail vertical nav with a sticky collapse toggle.
 *
 * Behaviour notes (post UI polish pass):
 *   - No hover-expand any more. The rail used to slide open when the
 *     mouse entered, which made dragging across the page feel skittish
 *     and stole horizontal space at random. Now the only way to open
 *     it is the chevron button at the bottom; the choice is persisted
 *     via `SidebarStateProvider`.
 *   - Collapsed group labels are removed from the layout (height 0)
 *     instead of just fading to opacity 0 — keeps the rail tight.
 *   - The rail still uses a cheap CSS width transition; we deliberately
 *     don't animate layout for the surrounding page (would compete
 *     with the dense charts on Year / Day).
 */
export function SideNav({ current, onNavigate, routeLayout }: SideNavProps) {
  const { expanded, toggle } = useSidebarState();
  const orderedRoutes = useNavRouteLayout(routeLayout);
  const t = useT();

  return (
    <nav
      aria-label="Sections"
      className="sticky top-[88px] flex shrink-0 flex-col justify-between gap-1 self-start overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
      style={{
        minHeight: 56 * 8,
        width: expanded ? 196 : 56,
        transition: 'width 140ms ease-out',
        willChange: 'width',
      }}
    >
      <ul className="flex flex-col gap-2">
        {orderedRoutes.map((group) => (
          <li key={group.label} className="flex flex-col gap-1">
            <div
              className={[
                'overflow-hidden font-mono uppercase tracking-[0.12em] text-[var(--color-text-subtle)]',
                'transition-[max-height,opacity,padding] duration-150',
                expanded
                  ? 'max-h-[18px] px-2 pt-1 text-[11px] opacity-100'
                  : 'max-h-0 px-2 pt-0 text-[11px] opacity-0',
              ].join(' ')}
              aria-hidden={!expanded}
            >
              {group.label}
            </div>
            <ul className="flex flex-col gap-1">
              {group.routes.map((route) => {
                const Icon = ICONS[route];
                const isActive = route === current;
                const label = t(LABEL_KEYS[route]);
                return (
                  <li key={route} className="relative">
                    <button
                      type="button"
                      onClick={() => onNavigate(route)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={label}
                      title={!expanded ? label : undefined}
                      className={[
                        'group flex h-10 w-full items-center gap-3 rounded-[10px] px-2.5 transition-colors',
                        isActive
                          ? 'text-[var(--color-text)]'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                        isActive
                          ? 'bg-[var(--color-surface-muted)]'
                          : 'hover:bg-[var(--color-surface-muted)]/40',
                      ].join(' ')}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span
                        className={[
                          'flex-1 text-left font-serif text-[14px] tracking-tight transition-opacity duration-150',
                          expanded ? 'opacity-100' : 'opacity-0',
                        ].join(' ')}
                        style={{ pointerEvents: expanded ? 'auto' : 'none' }}
                      >
                        {label}
                      </span>
                      {expanded ? (
                        <span className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-[1px] font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
                          {SHORTCUTS[route]}
                        </span>
                      ) : null}
                    </button>
                    {isActive ? (
                      <span
                        className="-translate-y-1/2 absolute top-1/2 left-0 h-5 w-[3px] rounded-r"
                        style={{ background: 'var(--color-accent)' }}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-[var(--color-border)] pt-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={expanded}
          aria-label={expanded ? t('nav.collapse') : t('nav.expand')}
          title={expanded ? t('nav.collapse') : t('nav.expand')}
          className={[
            'flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 transition-colors',
            'text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-muted)]/60 hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          {expanded ? (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span
            className={[
              'flex-1 text-left font-mono text-[11px] uppercase tracking-[0.08em] transition-opacity duration-150',
              expanded ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            style={{ pointerEvents: expanded ? 'auto' : 'none' }}
          >
            {t('nav.collapse')}
          </span>
        </button>
      </div>
    </nav>
  );
}

/**
 * Build the group layout SideNav should render.
 *
 * When the user provides a custom `routeLayout` (drag-reorder + hide
 * from Settings), the rail collapses the curated Analyze / Investigate
 * split into a single "Pinned" group. The static groups still drive
 * the default install so the rail keeps its narrative shape when no
 * preference exists yet.
 */
function useNavRouteLayout(
  layout: ReadonlyArray<AppRoute> | undefined,
): ReadonlyArray<{ label: string; routes: ReadonlyArray<AppRoute> }> {
  if (!layout || layout.length === 0) return ROUTE_GROUPS;
  return [{ label: 'Sections', routes: layout }];
}
