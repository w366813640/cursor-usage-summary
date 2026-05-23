import { type RowWithCost, type UsageSummary, redactedFileName } from '@cu/data';
import { Eye, EyeOff, Settings2 } from '@cu/icons';
import { motion } from 'framer-motion';
import { useFocusMode } from '../hooks/useFocusMode';

/**
 * Wiring originally consumed by the toolbar action buttons. After the
 * UI polish pass we hide the buttons + metadata strip entirely (the
 * user reported the strip felt noisy once data was loaded), but keep
 * the contract so DashboardShell + the data-management section of the
 * Settings drawer can still call into the desktop bridge for imports
 * / history / etc.
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
  rows: ReadonlyArray<RowWithCost>;
  desktopActions: DesktopActions;
  /**
   * Opens the Settings drawer pre-scrolled to the Data management
   * section. Required because Import / History / Redacted / Report
   * used to live on the toolbar ? we still need a single visible
   * affordance to reach them.
   */
  onOpenSettings: () => void;
}

/**
 * Slim persistent context strip ? post UI polish pass.
 *
 * Originally a Bloomberg-style metadata header (file name + rows seen +
 * parsed + parse-time + date range + saved-ago) plus five action
 * buttons. The user reported it as visual noise once data was already
 * imported, so:
 *
 *   - The metadata block is gone. Anything useful (file name, date
 *     range, saved-ago) is reachable from Settings -> Data management
 *     or the Import history drawer.
 *   - Import / History / Redacted export / Report export migrated to
 *     the Settings drawer under "Data management".
 *   - We keep the Focus toggle on the dashboard chrome because it
 *     visibly reshapes the active page, not just a side affordance.
 *   - A small "Manage data" button surfaces the new Settings entry so
 *     the user is never more than one click from the data tools.
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
  desktopActions,
  onOpenSettings,
}: FileToolbarProps) {
  const [focusMode, setFocusMode] = useFocusMode();
  // Compose a one-line context hint that lives in the button's tooltip
  // - keeps the surface clean while still letting power users verify
  // what data is loaded without opening any drawer.
  const sourceLabel = sourceFiles.length > 1 ? `${sourceFiles.length} files merged` : fileName;
  const ageHint = lastIngestedAt > 0 ? `saved ${describeAge(lastIngestedAt)}` : 'unsaved';
  const tooltip = [
    sourceLabel,
    `${summary.totalRows.toLocaleString()} rows (parsed in ${elapsedMs.toFixed(0)}ms)`,
    `${rowsSeen.toLocaleString()} seen / ${failures} skipped`,
    summary.dateRange.firstISO && summary.dateRange.lastISO
      ? `${summary.dateRange.firstISO.slice(0, 10)} -> ${summary.dateRange.lastISO.slice(0, 10)}`
      : 'no date range',
    ageHint,
    `download: ${redactedFileName(fileName)}`,
    `${rows.length.toLocaleString()} rows live in memory`,
  ].join(' / ');

  // Silence unused-variable lint when only the tooltip uses
  // desktopActions; the prop is kept for ABI compatibility with
  // existing callers and Storybook mocks.
  void desktopActions;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
      // Sticky so the Focus / Manage data buttons stay reachable from any
      // route at any scroll position. top-12 = app header height (48px);
      // z-40 sits below the right-edge SettingsDrawer (z-50-ish) but above
      // every Panel border and the sticky SectionHeader (z-30). The faint
      // backdrop blur + bg color avoid the "ghosted text" effect from
      // scrolling content bleeding through a transparent bar.
      className="sticky top-12 z-40 -mx-1 flex items-center justify-end gap-2 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-bg)_72%,transparent)]"
    >
      <ToolbarButton
        icon={
          focusMode ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />
        }
        label={focusMode ? 'focused' : 'focus'}
        onClick={() => setFocusMode(!focusMode)}
        title={
          focusMode
            ? 'Focus mode on - context panels hidden. Click to show everything.'
            : 'Focus mode - hide forecast / budget / activity panels and show only week summary + KPIs + efficiency.'
        }
        active={focusMode}
      />
      <ToolbarButton
        icon={<Settings2 size={12} aria-hidden="true" />}
        label="manage data"
        onClick={onOpenSettings}
        title={`Open Settings -> Data management (import, history, exports). Current dataset: ${tooltip}`}
      />
    </motion.div>
  );
}

function describeAge(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  title: string;
  active?: boolean;
}

function ToolbarButton({ icon, label, onClick, title, active = false }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border)] text-[var(--color-text-muted)]',
        'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}
