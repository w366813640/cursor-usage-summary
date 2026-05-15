import { motion } from 'framer-motion';
import { ALL_ROUTES, type AppRoute } from '../router/useRoute';

const LABELS: Record<AppRoute, string> = {
  overview: 'Overview',
  year: 'Year',
  models: 'Models',
  details: 'Details',
  hours: 'Hours',
};

const TAB_HINTS: Record<AppRoute, string> = {
  overview: 'Hero KPIs · activity rhythm · top burns',
  year: 'Year-in-review · 12-month roll-up · cross-month trends',
  models: 'Per-model drill-down · cost / share / cache hit',
  details: 'Full request log · filterable, sortable, paginated',
  hours: 'When did the money burn · 24h × 7d patterns + filters',
};

interface NavTabsProps {
  current: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

/**
 * Minimal four-tab nav strip. Bloomberg-style: small caps, mono, accent
 * underline on the active tab — animated with framer's `layoutId` so the bar
 * slides between tabs. Hints live in the title tooltip so the strip stays
 * compact.
 */
export function NavTabs({ current, onNavigate }: NavTabsProps) {
  return (
    <nav
      aria-label="Sections"
      className="flex items-center gap-1 border-b border-[var(--color-border)]"
    >
      {ALL_ROUTES.map((route) => {
        const isActive = route === current;
        return (
          <button
            key={route}
            type="button"
            onClick={() => onNavigate(route)}
            title={TAB_HINTS[route]}
            className={[
              'group relative px-4 py-2.5 transition-colors',
              isActive ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            <span className="font-serif text-[15px] tracking-tight">{LABELS[route]}</span>
            {isActive ? (
              <motion.span
                layoutId="nav-underline"
                transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                className="-bottom-px absolute inset-x-2 h-[2px] rounded-full"
                style={{ background: 'var(--color-accent)' }}
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
