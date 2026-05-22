import { AlertTriangle, Calendar, Clock, Cpu, type IconProps, Layout, Table2 } from '@cu/icons';
import type { ComponentType } from 'react';
import { ALL_ROUTES, type AppRoute } from '../router/useRoute';

const ICONS: Record<AppRoute, ComponentType<IconProps>> = {
  overview: Layout,
  year: Calendar,
  anomalies: AlertTriangle,
  models: Cpu,
  details: Table2,
  day: Clock,
};

const LABELS: Record<AppRoute, string> = {
  overview: 'Overview',
  year: 'Year',
  anomalies: 'Anomalies',
  models: 'Models',
  details: 'Rows',
  day: 'Day',
};

const SHORTCUTS: Record<AppRoute, string> = {
  overview: 'g o',
  year: 'g y',
  anomalies: 'g n',
  models: 'g m',
  details: 'g r',
  day: 'g d',
};

interface SideNavProps {
  current: AppRoute;
  onNavigate: (route: AppRoute) => void;
  /** Externally controlled expanded state; SideNav is uncontrolled-by-default. */
  expanded: boolean;
  onSetExpanded: (next: boolean) => void;
}

/**
 * Left-rail vertical nav with collapsible labels.
 *
 * Collapsed state shows icon-only at 56px wide; expanded state pushes to
 * 196px and reveals the route label + the Cmd+K shortcut hint. The user
 * has two ways to expand:
 *
 *   - Click the chevron at the bottom (sticky toggle, persisted via prop)
 *   - Hover the rail (transient — collapses again on mouse leave)
 *
 * We deliberately keep the rail in the document flow (no `position: fixed`)
 * so the page never has to know about its width. The rail uses a cheap CSS
 * width transition instead of layout animation; expanding it should never
 * compete with the dense charts on the Year page.
 */
export function SideNav({ current, onNavigate, expanded, onSetExpanded }: SideNavProps) {
  return (
    <nav
      aria-label="Sections"
      onMouseEnter={() => onSetExpanded(true)}
      onMouseLeave={() => onSetExpanded(false)}
      className="sticky top-4 flex shrink-0 flex-col justify-between gap-1 self-start overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
      style={{
        minHeight: 56 * 8,
        width: expanded ? 196 : 56,
        transition: 'width 140ms ease-out',
        willChange: 'width',
      }}
    >
      <ul className="flex flex-col gap-1">
        {ALL_ROUTES.map((route) => {
          const Icon = ICONS[route];
          const isActive = route === current;
          return (
            <li key={route} className="relative">
              <button
                type="button"
                onClick={() => onNavigate(route)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Navigate to ${LABELS[route]}`}
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
                  {LABELS[route]}
                </span>
                {expanded ? (
                  <span className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
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
    </nav>
  );
}
