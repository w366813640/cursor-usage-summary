import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Plus,
  SkipForward,
  X,
} from '@cu/icons';
import { AnimatePresence, motion } from 'framer-motion';
import type { PreviewResult } from '../electron/types';

interface ImportPreviewDrawerProps {
  open: boolean;
  fileName: string;
  rowsSeen: number;
  failures: number;
  preview: PreviewResult;
  committing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Right-side slide-in drawer that shows what an import *would* do
 * before the user confirms. Three flavors:
 *
 *  - `isDuplicateFile`: this exact CSV was already imported. Show a
 *    "nothing to do" copy + an OK button that just closes the drawer.
 *  - `wouldAdd === 0`: every row already exists (e.g. user re-exported
 *    the same window from cursor.com). Show "no new rows" + close.
 *  - default: KPI strip with adds / skipped / date range, plus a
 *    primary "Import" button that fires the real commit.
 *
 * Why a custom drawer instead of Radix Sheet: the rest of the
 * playground already uses Framer Motion for overlay choreography
 * (`ConfirmClearOverlay` in FileToolbar), and this keeps the
 * shared-motion vocabulary consistent.
 */
export function ImportPreviewDrawer({
  open,
  fileName,
  rowsSeen,
  failures,
  preview,
  committing,
  onConfirm,
  onCancel,
}: ImportPreviewDrawerProps) {
  const nothingToImport = preview.isDuplicateFile || preview.wouldAdd === 0;
  const showCommit = !nothingToImport;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-[rgba(0,0,0,0.45)]"
          role="presentation"
          onClick={() => {
            if (!committing) onCancel();
          }}
        >
          <motion.aside
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Import preview"
            className="flex h-full w-[480px] max-w-full flex-col gap-5 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-6 pt-5 shadow-[0_-12px_60px_-12px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet
                  size={16}
                  className="text-[var(--color-accent)]"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-serif text-[18px] leading-tight tracking-tight">
                    Import preview
                  </span>
                  <span
                    className="max-w-[280px] truncate font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]"
                    title={fileName}
                  >
                    {fileName}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    review before saving to cursor-usage.db
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={committing}
                aria-label="Close preview"
                className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            {preview.isDuplicateFile ? (
              <DuplicateFileNotice fileName={fileName} />
            ) : preview.wouldAdd === 0 ? (
              <NoNewRowsNotice rowsSeen={rowsSeen} />
            ) : (
              <PreviewSummary preview={preview} rowsSeen={rowsSeen} failures={failures} />
            )}

            <div className="mt-auto flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={committing}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {showCommit ? 'Cancel' : 'Close'}
              </button>
              {showCommit ? (
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={committing}
                  className="flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: 'var(--color-accent)',
                    color: 'var(--color-bg)',
                    borderColor: 'var(--color-accent)',
                  }}
                >
                  {committing ? (
                    <Loader2 size={12} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} aria-hidden="true" />
                  )}
                  {committing ? 'Importing…' : `Import ${preview.wouldAdd.toLocaleString()} rows`}
                </button>
              ) : null}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PreviewSummary({
  preview,
  rowsSeen,
  failures,
}: {
  preview: PreviewResult;
  rowsSeen: number;
  failures: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <PreviewKpi
          label="Would add"
          value={preview.wouldAdd.toLocaleString()}
          icon={<Plus size={12} aria-hidden="true" />}
          accent
        />
        <PreviewKpi
          label="Would skip"
          value={preview.wouldSkip.toLocaleString()}
          icon={<SkipForward size={12} aria-hidden="true" />}
          subtle
        />
      </div>
      <div
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-3"
        title="The earliest and latest day among the rows that would be added."
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          New date range
        </div>
        <div className="mt-1 font-mono text-[13px] text-[var(--color-text)]">
          {preview.dateMin ?? '—'} → {preview.dateMax ?? '—'}
        </div>
      </div>
      <ul className="flex flex-col gap-1 font-mono text-[11px] text-[var(--color-text-subtle)]">
        <li>
          <span className="text-[var(--color-text-muted)]">{rowsSeen.toLocaleString()}</span> rows
          in the CSV
        </li>
        {failures > 0 ? (
          <li className="text-[var(--color-warning)]">
            {failures.toLocaleString()} parse failure(s) — skipped before preview
          </li>
        ) : null}
        <li>
          Deduplication is on{' '}
          <code className="rounded-sm bg-[var(--color-surface-raised)] px-1 text-[var(--color-text-muted)]">
            dateISO + model + tokens + cloud-agent + automation
          </code>{' '}
          — same row never lands twice.
        </li>
        <li>You can undo this batch from the Import history drawer afterwards.</li>
      </ul>
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          Commit guarantee
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          Confirming writes only the {preview.wouldAdd.toLocaleString()} new row(s). Skipped rows
          stay attached to their original batch, and the whole import can be undone as one unit.
        </p>
      </div>
    </div>
  );
}

function DuplicateFileNotice({ fileName }: { fileName: string }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-[12px] leading-relaxed"
      style={{
        borderColor: 'color-mix(in oklab, var(--color-accent) 50%, var(--color-border))',
        background: 'color-mix(in oklab, var(--color-accent) 6%, transparent)',
      }}
    >
      <CheckCircle2
        size={14}
        className="mt-0.5 shrink-0 text-[var(--color-accent)]"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1.5">
        <span className="font-serif text-[14px] text-[var(--color-text)]">
          You already imported this exact file.
        </span>
        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{fileName}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          File SHA-256 matches a previous batch · nothing to do
        </span>
      </div>
    </div>
  );
}

function NoNewRowsNotice({ rowsSeen }: { rowsSeen: number }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-[12px] leading-relaxed"
      style={{
        borderColor: 'color-mix(in oklab, var(--color-warning) 45%, var(--color-border))',
        background: 'color-mix(in oklab, var(--color-warning) 6%, transparent)',
      }}
    >
      <AlertTriangle
        size={14}
        className="mt-0.5 shrink-0 text-[var(--color-warning)]"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1">
        <span className="font-serif text-[14px] text-[var(--color-text)]">
          Every row in this CSV is already on disk.
        </span>
        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
          {rowsSeen.toLocaleString()} rows were parsed; all dedupe-collapsed to existing data.
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          Re-exporting an overlapping window from cursor.com is the usual cause.
        </span>
      </div>
    </div>
  );
}

function PreviewKpi({
  label,
  value,
  icon,
  accent,
  subtle,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  subtle?: boolean;
}) {
  return (
    <div
      className="rounded-md border border-[var(--color-border)] px-3.5 py-3"
      style={{
        background: accent
          ? 'color-mix(in oklab, var(--color-accent) 8%, var(--color-surface))'
          : 'var(--color-surface-muted)',
      }}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {icon}
        {label}
      </div>
      <div
        className="mt-1 font-serif text-[28px] leading-[1.05] tracking-tight tabular-nums"
        style={{
          color: accent
            ? 'var(--color-accent)'
            : subtle
              ? 'var(--color-text-muted)'
              : 'var(--color-text)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
