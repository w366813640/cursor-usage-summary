import { Clock, FileSpreadsheet, History, Loader2, Sliders, Trash2, X } from '@cu/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { BatchSummary } from '../electron/types';
import { describeLastUpdate } from '../utils/relativeTime';
import { CompareBatchesModal } from './CompareBatchesModal';

interface ImportHistoryDrawerProps {
  open: boolean;
  loadBatches: () => Promise<BatchSummary[]>;
  onUndo: (id: number) => Promise<{ removedRows: number }>;
  onClose: () => void;
}

/**
 * Right-side drawer with the full `import_batches` audit log. Each
 * entry shows the source filename, when it landed, the date range it
 * covered, and an "Undo" button that asks for a two-step confirmation
 * before cascading the delete (rows ON DELETE CASCADE on the FK).
 *
 * Rows that were dedup-collapsed onto an earlier batch are *not*
 * removed by an undo — they belong to that earlier batch's lineage.
 * The copy below the undo button explains this so the user isn't
 * surprised when the row counts don't drop as much as expected.
 */
export function ImportHistoryDrawer({
  open,
  loadBatches,
  onUndo,
  onClose,
}: ImportHistoryDrawerProps) {
  const [batches, setBatches] = useState<BatchSummary[] | null>(null);
  const [pendingUndoId, setPendingUndoId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    setBatches(null);
    (async () => {
      try {
        const list = await loadBatches();
        if (active) setBatches(list);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setBatches([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [open, loadBatches]);

  const handleConfirmUndo = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await onUndo(id);
      const next = await loadBatches();
      setBatches(next);
      setPendingUndoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(0,0,0,0.45)]"
          role="presentation"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Import history"
            className="flex h-full w-[520px] max-w-full flex-col gap-4 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-6 pt-5 shadow-[0_-12px_60px_-12px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <History size={16} className="text-[var(--color-accent)]" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-serif text-[18px] leading-tight tracking-tight">
                    Import history
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    every CSV you've ever imported, newest first
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCompareOpen(true)}
                  disabled={!batches || batches.length < 2}
                  title={
                    !batches || batches.length < 2
                      ? 'Need at least two imports to compare'
                      : 'Compare any two import batches'
                  }
                  className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sliders size={11} aria-hidden="true" />
                  compare
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close history"
                  className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>

            {error ? (
              <div
                className="rounded-md border px-3.5 py-3 font-mono text-[11px]"
                style={{
                  borderColor:
                    'color-mix(in oklab, var(--color-destructive) 55%, var(--color-border))',
                  background: 'color-mix(in oklab, var(--color-destructive) 8%, transparent)',
                  color: 'var(--color-destructive)',
                }}
              >
                {error}
              </div>
            ) : null}

            {batches === null ? (
              <div className="flex h-[200px] items-center justify-center text-[var(--color-text-subtle)]">
                <Loader2 size={18} aria-hidden="true" className="animate-spin" />
                <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.08em]">
                  Loading batches…
                </span>
              </div>
            ) : batches.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-[var(--color-text-subtle)]">
                <History size={20} aria-hidden="true" />
                <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
                  No imports yet — drop a CSV to get started.
                </span>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {batches.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span
                          className="flex items-center gap-1.5 truncate font-mono text-[12px] text-[var(--color-text)]"
                          title={b.sourceFilename}
                        >
                          <FileSpreadsheet
                            size={12}
                            className="shrink-0 text-[var(--color-accent)]"
                            aria-hidden="true"
                          />
                          {b.sourceFilename}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                          <Clock size={10} aria-hidden="true" />
                          {describeLastUpdate(b.importedAt) ?? 'just now'}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                          {b.dateMin ?? '—'} → {b.dateMax ?? '—'}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-[11px] text-[var(--color-text)]">
                          +{b.rowCountAdded.toLocaleString()} rows
                        </span>
                        {b.rowCountSkipped > 0 ? (
                          <span className="font-mono text-[10px] text-[var(--color-text-subtle)]">
                            {b.rowCountSkipped.toLocaleString()} skipped
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {pendingUndoId === b.id ? (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-2">
                        <span className="mr-auto font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                          Undo will delete{' '}
                          <span className="text-[var(--color-text)]">
                            {b.rowCountAdded.toLocaleString()}
                          </span>{' '}
                          rows from this batch
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingUndoId(null)}
                          disabled={busyId === b.id}
                          className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleConfirmUndo(b.id)}
                          disabled={busyId === b.id}
                          className="flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                          style={{
                            background: 'var(--color-destructive)',
                            color: 'white',
                            borderColor: 'var(--color-destructive)',
                          }}
                        >
                          {busyId === b.id ? (
                            <Loader2 size={10} aria-hidden="true" className="animate-spin" />
                          ) : (
                            <Trash2 size={10} aria-hidden="true" />
                          )}
                          Delete batch
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setPendingUndoId(b.id)}
                          className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-destructive)] hover:text-[var(--color-destructive)]"
                        >
                          <Trash2 size={10} aria-hidden="true" />
                          Undo
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-auto border-t border-[var(--color-border)] pt-3 font-mono text-[10px] leading-relaxed text-[var(--color-text-subtle)]">
              Undo only removes rows this batch actually wrote. Rows that dedup-collapsed onto an
              earlier import stay with their original batch.
            </p>

            <CompareBatchesModal
              open={compareOpen}
              batches={batches ?? []}
              initialLeftId={batches?.[0]?.id}
              initialRightId={batches?.[1]?.id}
              onClose={() => setCompareOpen(false)}
            />
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
