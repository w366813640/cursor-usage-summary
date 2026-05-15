import { type UsageRow, type UsageSummary, redactRowsToCsv, redactedFileName } from '@cu/data';
import {
  Clock,
  Download,
  FileSpreadsheet,
  HardDrive,
  History,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from '@cu/icons';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { describeLastUpdate } from '../storage/persistence';

/**
 * When present, the toolbar swaps its web-only buttons (merge / re-upload /
 * clear) for the desktop equivalents (import / history). The desktop DB
 * handles dedup + cascading undo, so we don't need separate "merge" and
 * "re-upload" affordances any more — a single Import button + a History
 * drawer that owns per-batch undo cover both cases.
 */
export interface DesktopActions {
  onOpenImport: () => void;
  onOpenHistory: () => void;
  storageHint: string;
}

interface FileToolbarProps {
  fileName: string;
  sourceFiles: ReadonlyArray<string>;
  rowsSeen: number;
  failures: number;
  elapsedMs: number;
  lastIngestedAt: number;
  summary: UsageSummary;
  rows: ReadonlyArray<UsageRow>;
  onReupload: () => void;
  onMergeAnother: () => void;
  onClearStorage: () => void | Promise<void>;
  desktopActions?: DesktopActions;
}

function triggerDownload(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Persistent file context strip — shown above the route content. Tells the
 * user *what data they're looking at*, every page. Mirrors the Bloomberg /
 * trading-terminal "file → header" pattern, but warmer: icons on the left
 * for at-a-glance context (file / records / time), icons on action buttons
 * so the eye doesn't have to read every label.
 */
export function FileToolbar({
  fileName,
  sourceFiles,
  rowsSeen,
  failures,
  elapsedMs,
  lastIngestedAt,
  summary,
  rows,
  onReupload,
  onMergeAnother,
  onClearStorage,
  desktopActions,
}: FileToolbarProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const onExportRedacted = () => {
    const csv = redactRowsToCsv(rows);
    // When multiple files are merged, key the download name off the most
    // recent so the user knows it's a snapshot of "now".
    triggerDownload(csv, redactedFileName(fileName));
  };

  const mergedLabel = sourceFiles.length > 1 ? `${sourceFiles.length} files merged` : null;
  const lastSaved = describeLastUpdate(lastIngestedAt);
  const storageLabel = desktopActions?.storageHint ?? 'saved locally in IndexedDB';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
      className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2 shadow-[0_1px_0_color-mix(in_oklab,var(--color-text)_2%,transparent)_inset]"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
        <span
          className="flex items-center gap-1.5 text-[var(--color-text)]"
          title={sourceFiles.join(' · ')}
        >
          <FileSpreadsheet size={13} className="text-[var(--color-accent)]" aria-hidden="true" />
          {mergedLabel ?? fileName}
        </span>
        <Sep />
        <span title="rows seen by parser">{rowsSeen} seen</span>
        <span title="rows parsed successfully">{summary.totalRows} parsed</span>
        {failures > 0 ? (
          <span className="text-[var(--color-warning)]" title="rows skipped due to parse errors">
            {failures} skipped
          </span>
        ) : null}
        <Sep />
        <span className="flex items-center gap-1" title="parsing time">
          <Clock size={11} aria-hidden="true" />
          {elapsedMs.toFixed(0)}ms
        </span>
        <Sep />
        <span title="date range covered">
          {summary.dateRange.firstISO?.slice(0, 10)} → {summary.dateRange.lastISO?.slice(0, 10)}
        </span>
        {lastSaved ? (
          <>
            <Sep />
            <span
              className="flex items-center gap-1 text-[var(--color-text-subtle)]"
              title={storageLabel}
            >
              <HardDrive size={11} aria-hidden="true" />
              saved {lastSaved}
            </span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        {desktopActions ? (
          <>
            <ToolbarButton
              icon={<Upload size={12} aria-hidden="true" />}
              label="import"
              onClick={desktopActions.onOpenImport}
              title="Import another CSV — duplicate rows are skipped automatically"
            />
            <ToolbarButton
              icon={<History size={12} aria-hidden="true" />}
              label="history"
              onClick={desktopActions.onOpenHistory}
              title="See every CSV you've ever imported, and undo any batch"
            />
            <ToolbarButton
              icon={<Download size={12} aria-hidden="true" />}
              label="redacted"
              onClick={onExportRedacted}
              title="Export redacted CSV (Cloud Agent ID / Automation ID replaced with hash aliases)"
            />
          </>
        ) : (
          <>
            <ToolbarButton
              icon={<Plus size={12} aria-hidden="true" />}
              label="merge"
              onClick={onMergeAnother}
              title="Merge another CSV (dedupes by dateISO+model+tokens)"
            />
            <ToolbarButton
              icon={<Download size={12} aria-hidden="true" />}
              label="redacted"
              onClick={onExportRedacted}
              title="Export redacted CSV (Cloud Agent ID / Automation ID replaced with hash aliases)"
            />
            <ToolbarButton
              icon={<RefreshCw size={12} aria-hidden="true" />}
              label="re-upload"
              onClick={onReupload}
              title="Replace stored data with a new CSV"
            />
            <ToolbarButton
              icon={<Trash2 size={12} aria-hidden="true" />}
              label="clear"
              onClick={() => setConfirmClear(true)}
              title="Wipe all data stored in IndexedDB"
              danger
            />
          </>
        )}
      </div>

      {confirmClear ? (
        <ConfirmClearOverlay
          rowCount={summary.totalRows}
          onCancel={() => setConfirmClear(false)}
          onConfirm={async () => {
            await onClearStorage();
            setConfirmClear(false);
          }}
        />
      ) : null}
    </motion.div>
  );
}

function Sep() {
  return (
    <span aria-hidden="true" className="text-[var(--color-text-subtle)]/60">
      ·
    </span>
  );
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  title: string;
  danger?: boolean;
}

function ToolbarButton({ icon, label, onClick, title, danger = false }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        'flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
        'border-[var(--color-border)] text-[var(--color-text-muted)]',
        danger
          ? 'hover:border-[var(--color-destructive)] hover:text-[var(--color-destructive)]'
          : 'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}

function ConfirmClearOverlay({
  rowCount,
  onCancel,
  onConfirm,
}: {
  rowCount: number;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.5)] p-6"
      onClick={onCancel}
      role="presentation"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-[420px] max-w-full rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_18px_60px_-12px_rgba(0,0,0,0.45)]"
      >
        <h2 className="font-serif text-[22px] leading-tight">Clear local data?</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          This will permanently delete{' '}
          <span className="font-mono text-[var(--color-text)]">{rowCount.toLocaleString()}</span>{' '}
          stored rows from your browser. Your original CSV files are untouched — but you'll need to
          re-upload to see the dashboard again.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm();
            }}
            className="rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-white transition-opacity hover:opacity-90"
          >
            Clear data
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
