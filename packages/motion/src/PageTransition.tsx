import { AnimatePresence, m } from 'framer-motion';
import type { ReactNode } from 'react';
import { durations, easings } from './springs';

export interface PageTransitionProps {
  /** Unique key per "page" — change to trigger crossfade. */
  pageKey: string;
  children: ReactNode;
  /** Disable transition (e.g. on first paint). */
  disabled?: boolean;
}

/**
 * Wrap your route outlet to crossfade between pages with a soft 80–180ms fade.
 */
export function PageTransition({ pageKey, children, disabled }: PageTransitionProps) {
  if (disabled) return <>{children}</>;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={pageKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: durations.base, ease: easings.standard } }}
        exit={{ opacity: 0, transition: { duration: durations.fast, ease: easings.standard } }}
        className="h-full w-full"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
