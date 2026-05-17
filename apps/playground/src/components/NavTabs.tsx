import { motion } from 'framer-motion';
import { ALL_ROUTES, type AppRoute } from '../router/useRoute';

const LABELS: Record<AppRoute, string> = {
  overview: 'Overview',
  year: 'Year',
  models: 'Models',
  agents: 'Agents',
  details: 'Details',
  hours: 'Hours',
};

interface NavTabsProps {
  current: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

/**
 * Minimal six-tab nav strip. Bloomberg-style: small caps, mono, accent
 * underline on the active tab — animated with framer's `layoutId` so the bar
 * slides between tabs. Labels speak for themselves; we used to also attach
 * a `title` tooltip with a one-liner per route, but native tooltips are
 * inconsistent across browsers and the labels are unambiguous already.
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
