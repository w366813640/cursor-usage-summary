import { fmtUSD } from '@cu/charts';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { IngestDiff } from '../hooks/useCsvIngest';
import { describeLastUpdate } from '../storage/persistence';

interface IngestDiffBannerProps {
  diff: IngestDiff | null;
}

/**
 * Shows what changed compared with the previous on-disk snapshot:
 *
 *   - `restore` → "Restored · last update X days ago · N rows loaded"
 *   - `append`  → "Merge complete · +N rows · +$Y · X days since last"
 *   - `replace` → "Replaced with new data · was N → now M rows"
 *
 * The banner auto-dismisses after ~6s for non-restore cases so it doesn't
 * sit there forever. Users can also click the × to dismiss immediately.
 */
export function IngestDiffBanner({ diff }: IngestDiffBannerProps) {
  const [visible, setVisible] = useState(false);
  // Hash of the current diff identity so the timer only resets when a new
  // diff actually arrives. Using the source + ms key avoids the "same object"
  // re-render loop.
  const lastDiffKey = useRef<string | null>(null);

  useEffect(() => {
    if (!diff) {
      setVisible(false);
      return;
    }
    const key = `${diff.source}:${diff.msSinceLast}:${diff.rowsAdded}:${diff.costAdded.toFixed(4)}`;
    if (lastDiffKey.current === key) return;
    lastDiffKey.current = key;
    setVisible(true);
    if (diff.source === 'restore') return;
    const id = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(id);
  }, [diff]);

  if (!diff) return null;

  const lastLabel = describeLastUpdate(Date.now() - diff.msSinceLast) ?? '';

  let copy: { title: string; body: React.ReactNode };
  if (diff.source === 'restore') {
    copy = {
      title: 'Restored your previous session',
      body: (
        <>
          <span>Last update · </span>
          <span className="text-[var(--color-text)]">{lastLabel}</span>
          <span className="px-1 text-[var(--color-text-subtle)]">·</span>
          <span>{diff.previousRowCount.toLocaleString()} rows loaded</span>
          <span className="px-1 text-[var(--color-text-subtle)]">·</span>
          <span>{fmtUSD(diff.previousTotalCost)} total</span>
        </>
      ),
    };
  } else if (diff.source === 'append') {
    copy = {
      title: `Merge complete · +${diff.rowsAdded.toLocaleString()} rows`,
      body: (
        <>
          <span>Since last update · </span>
          <span className="text-[var(--color-text)]">{lastLabel}</span>
          <span className="px-1 text-[var(--color-text-subtle)]">·</span>
          <span>
            cost added ·{' '}
            <span className="text-[var(--color-accent)]">{fmtUSD(diff.costAdded)}</span>
          </span>
          <span className="px-1 text-[var(--color-text-subtle)]">·</span>
          <span>
            total {diff.previousRowCount.toLocaleString()} →{' '}
            {(diff.previousRowCount + diff.rowsAdded).toLocaleString()}
          </span>
        </>
      ),
    };
  } else {
    copy = {
      title: 'Replaced with new data',
      body: (
        <>
          <span>Previously · </span>
          <span>
            {diff.previousRowCount.toLocaleString()} rows · {fmtUSD(diff.previousTotalCost)}
          </span>
          <span className="px-1 text-[var(--color-text-subtle)]">·</span>
          <span>last seen {lastLabel}</span>
        </>
      ),
    };
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
          className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-accent)]/45 bg-[var(--color-accent-soft)]/35 px-4 py-3"
        >
          <div className="flex flex-col gap-1">
            <div className="font-serif text-[15px] leading-tight">{copy.title}</div>
            <div className="font-mono text-[11px] text-[var(--color-text-muted)]">{copy.body}</div>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="font-mono text-[12px] text-[var(--color-text-subtle)] transition-colors hover:text-[var(--color-text)]"
            aria-label="Dismiss"
            title="Dismiss"
          >
            ✕
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
