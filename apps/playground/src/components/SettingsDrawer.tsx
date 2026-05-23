import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  Loader2,
  Monitor,
  Moon,
  RotateCcw,
  Save,
  Settings,
  Sun,
  Upload,
  X,
} from '@cu/icons';
import { type ThemeMode, useTheme } from '@cu/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode, useEffect, useState } from 'react';
import {
  checkForUpdates,
  exportDbToFile,
  exportDiagnosticsToFile,
  getDbPath,
  getSettingsPath,
  getUpdateStatus,
  importDbFromFile,
  installUpdateAndRestart,
  onUpdateStatus,
  revealDbInFolder,
  updateSettings,
} from '../electron/desktopStorage';
import type { UpdateStatus } from '../electron/types';
import { useSettings } from '../hooks/useSettings';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful backup restore — parent re-hydrates the dashboard. */
  onAfterRestore?: () => void | Promise<void>;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

/**
 * Right-side drawer hosting all per-user preferences + backup/restore
 * affordances. Lives behind a cog icon in the top-bar.
 *
 * Sections (top to bottom):
 *   1. Theme — system / light / dark radio, persists to localStorage
 *      via the existing useTheme hook.
 *   2. Monthly request budget — drives `MonthlyBudgetPanel`'s plan
 *      cap (was hardcoded to 500 before PR22).
 *   3. Currency display — code / symbol / multiplier; display-only,
 *      USD remains the source of truth.
 *   4. Local database — read-only path display + reveal-in-folder.
 *   5. Backup & restore — export DbSnapshot to JSON, restore from
 *      JSON (replaces current data, two-step confirm).
 *
 * Errors and successes funnel into a single `Status` banner at the
 * top so the user always has feedback in eye-line.
 */
export function SettingsDrawer({ open, onClose, onAfterRestore }: SettingsDrawerProps) {
  const { settings, loading, save } = useSettings();
  const { mode: themeMode, setMode: setThemeMode, resolved } = useTheme();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [settingsPath, setSettingsPathState] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: 'idle' });
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<string>('');
  const [currencyDraft, setCurrencyDraft] = useState({
    code: '',
    symbol: '',
    multiplier: '',
  });

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const [p1, p2, update] = await Promise.all([
          getDbPath(),
          getSettingsPath(),
          getUpdateStatus(),
        ]);
        if (!active) return;
        setDbPath(p1);
        setSettingsPathState(p2);
        setUpdateStatus(update);
      } catch {
        // Path display is best-effort — fall back to silent miss.
      }
    })();
    const offUpdate = onUpdateStatus((next) => {
      if (active) setUpdateStatus(next);
    });
    return () => {
      active = false;
      offUpdate();
    };
  }, [open]);

  useEffect(() => {
    if (loading) return;
    setBudgetDraft(String(settings.monthlyRequestBudget));
    setCurrencyDraft({
      code: settings.currency.code,
      symbol: settings.currency.symbol,
      multiplier: String(settings.currency.multiplier),
    });
  }, [loading, settings.monthlyRequestBudget, settings.currency]);

  const onSaveBudget = async () => {
    const next = Number(budgetDraft);
    if (!Number.isFinite(next) || next <= 0) {
      setStatus({ kind: 'error', message: 'Budget must be a positive number.' });
      return;
    }
    setStatus({ kind: 'busy', message: 'Saving budget…' });
    try {
      await save({ monthlyRequestBudget: Math.round(next) });
      setStatus({ kind: 'ok', message: `Monthly budget set to ${Math.round(next)} requests.` });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onSaveCurrency = async () => {
    const code = currencyDraft.code.trim().toUpperCase().slice(0, 4) || 'USD';
    const symbol = currencyDraft.symbol.trim().slice(0, 4) || '$';
    const multiplier = Number(currencyDraft.multiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      setStatus({ kind: 'error', message: 'Currency multiplier must be > 0.' });
      return;
    }
    setStatus({ kind: 'busy', message: 'Saving currency override…' });
    try {
      await save({ currency: { code, symbol, multiplier } });
      setStatus({
        kind: 'ok',
        message: `Currency display set to ${code} (${symbol}, ×${multiplier}).`,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onSaveDensity = async (displayDensity: 'comfortable' | 'dense' | 'presentation') => {
    setStatus({ kind: 'busy', message: `Switching display density to ${displayDensity}...` });
    try {
      await save({ displayDensity });
      document.documentElement.dataset.density = displayDensity;
      setStatus({ kind: 'ok', message: `Display density set to ${displayDensity}.` });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onResetCurrency = async () => {
    setStatus({ kind: 'busy', message: 'Restoring USD default…' });
    try {
      await save({ currency: { code: 'USD', symbol: '$', multiplier: 1 } });
      setCurrencyDraft({ code: 'USD', symbol: '$', multiplier: '1' });
      setStatus({ kind: 'ok', message: 'Currency reset to USD ($, ×1).' });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onCheckForUpdates = async () => {
    setStatus({ kind: 'busy', message: 'Checking for updates...' });
    try {
      const result = await checkForUpdates();
      if (result.ok) {
        setStatus({ kind: 'ok', message: 'Update check started.' });
        return;
      }
      setStatus({ kind: 'error', message: `Update check unavailable: ${result.reason}` });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onInstallUpdate = async () => {
    setStatus({ kind: 'busy', message: 'Installing update and restarting...' });
    try {
      const result = await installUpdateAndRestart();
      if (!result.ok) {
        setStatus({ kind: 'error', message: `Install unavailable: ${result.reason}` });
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onExport = async () => {
    setStatus({ kind: 'busy', message: 'Exporting backup…' });
    try {
      const result = await exportDbToFile();
      if (result.canceled) {
        setStatus({ kind: 'idle' });
        return;
      }
      const kb = ((result.bytesWritten ?? 0) / 1024).toFixed(1);
      await updateSettings({ lastBackupAt: new Date().toISOString() });
      setStatus({
        kind: 'ok',
        message: `Backup written to ${result.path} (${kb} KB).`,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onExportDiagnostics = async () => {
    setStatus({ kind: 'busy', message: 'Exporting privacy-safe diagnostics...' });
    try {
      const result = await exportDiagnosticsToFile();
      if (result.canceled) {
        setStatus({ kind: 'idle' });
        return;
      }
      const kb = ((result.bytesWritten ?? 0) / 1024).toFixed(1);
      setStatus({
        kind: 'ok',
        message: `Diagnostics written to ${result.path} (${kb} KB).`,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onRestoreConfirmed = async () => {
    setStatus({ kind: 'busy', message: 'Restoring backup — your current data will be replaced.' });
    setConfirmRestore(false);
    try {
      const result = await importDbFromFile();
      if (result.canceled) {
        setStatus({ kind: 'idle' });
        return;
      }
      if (result.error) {
        setStatus({ kind: 'error', message: `Restore failed: ${result.error}` });
        return;
      }
      setStatus({
        kind: 'ok',
        message: `Restored ${result.batchesRestored ?? 0} batch(es) · ${(
          result.rowsRestored ?? 0
        ).toLocaleString()} rows from ${result.path}.`,
      });
      if (onAfterRestore) await onAfterRestore();
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
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
            aria-label="Settings"
            className="flex h-full w-[560px] max-w-full flex-col gap-5 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-6 pt-5 shadow-[0_-12px_60px_-12px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Settings size={16} className="text-[var(--color-accent)]" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-serif text-[18px] leading-tight tracking-tight">
                    Settings
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    preferences · backup & restore
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <StatusBanner status={status} />

            <Section
              icon={
                resolved === 'dark' ? (
                  <Moon size={12} aria-hidden="true" />
                ) : (
                  <Sun size={12} aria-hidden="true" />
                )
              }
              title="Theme"
              hint="System follows your OS — light / dark force the choice."
            >
              <div className="flex gap-2">
                {(
                  [
                    {
                      id: 'system',
                      label: 'System',
                      icon: <Monitor size={12} aria-hidden="true" />,
                    },
                    { id: 'light', label: 'Light', icon: <Sun size={12} aria-hidden="true" /> },
                    { id: 'dark', label: 'Dark', icon: <Moon size={12} aria-hidden="true" /> },
                  ] satisfies Array<{ id: ThemeMode; label: string; icon: ReactNode }>
                ).map((opt) => {
                  const active = themeMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setThemeMode(opt.id)}
                      className={[
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors',
                        active
                          ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)]',
                      ].join(' ')}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                resolved: {resolved}
              </p>
            </Section>

            <Section
              icon={<Monitor size={12} aria-hidden="true" />}
              title="Display density"
              hint="Comfortable is the default. Dense tightens the workbench; Presentation gives screenshots more air."
            >
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['comfortable', 'Comfortable', 'Balanced spacing for daily review.'],
                    ['dense', 'Dense', 'Tighter rows and chrome for power scanning.'],
                    ['presentation', 'Presentation', 'More breathing room for exports and demos.'],
                  ] as const
                ).map(([id, label, hint]) => {
                  const active = settings.displayDensity === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => void onSaveDensity(id)}
                      className={[
                        'flex min-h-[76px] flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/35 text-[var(--color-text)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)]',
                      ].join(' ')}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
                        {label}
                      </span>
                      <span className="text-[11px] leading-snug text-[var(--color-text-subtle)]">
                        {hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section
              icon={<HardDrive size={12} aria-hidden="true" />}
              title="Monthly request budget"
              hint="Drives the plan cap displayed on the Overview → Monthly panel."
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={50}
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(e.target.value)}
                  className="w-32 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 font-mono text-[12px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                <span className="font-mono text-[11px] text-[var(--color-text-subtle)]">
                  requests / month
                </span>
                <div className="ml-auto">
                  <SaveButton onClick={onSaveBudget} disabled={loading} />
                </div>
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                current persisted: {settings.monthlyRequestBudget.toLocaleString()} req/mo
              </p>
            </Section>

            <Section
              icon={<Download size={12} aria-hidden="true" />}
              title="Updates"
              hint="Release channels are explicit: dev builds explain why updates are disabled."
            >
              <UpdateStatusCard
                status={updateStatus}
                onCheck={onCheckForUpdates}
                onInstall={onInstallUpdate}
              />
            </Section>

            <Section
              icon={<HardDrive size={12} aria-hidden="true" />}
              title="Currency display"
              hint="USD remains source of truth — these fields override the renderer's formatter."
            >
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                <Field
                  label="Code"
                  value={currencyDraft.code}
                  onChange={(v) => setCurrencyDraft((c) => ({ ...c, code: v }))}
                  placeholder="USD"
                />
                <Field
                  label="Symbol"
                  value={currencyDraft.symbol}
                  onChange={(v) => setCurrencyDraft((c) => ({ ...c, symbol: v }))}
                  placeholder="$"
                />
                <Field
                  label="Multiplier"
                  value={currencyDraft.multiplier}
                  onChange={(v) => setCurrencyDraft((c) => ({ ...c, multiplier: v }))}
                  placeholder="1"
                  type="number"
                />
                <div className="flex flex-col gap-1.5">
                  <SaveButton onClick={onSaveCurrency} disabled={loading} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                  current: {settings.currency.code} ({settings.currency.symbol}, ×
                  {settings.currency.multiplier})
                </span>
                <button
                  type="button"
                  onClick={() => void onResetCurrency()}
                  className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
                >
                  <RotateCcw size={10} aria-hidden="true" />
                  reset to USD
                </button>
              </div>
            </Section>

            <Section
              icon={<HardDrive size={12} aria-hidden="true" />}
              title="Local database"
              hint="cursor-usage.db lives in your OS user-data folder — never leaves the device."
            >
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <code className="truncate font-mono text-[11px] text-[var(--color-text)]">
                    {dbPath ?? 'resolving…'}
                  </code>
                  <button
                    type="button"
                    onClick={() => void revealDbInFolder()}
                    disabled={!dbPath}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FolderOpen size={10} aria-hidden="true" />
                    reveal
                  </button>
                </div>
                {settingsPath ? (
                  <div className="mt-1.5 font-mono text-[10px] text-[var(--color-text-subtle)]">
                    settings: <span className="text-[var(--color-text-muted)]">{settingsPath}</span>
                  </div>
                ) : null}
              </div>
            </Section>

            <Section
              icon={<FileText size={12} aria-hidden="true" />}
              title="Support diagnostics"
              hint="Exports metadata only: versions, counts, settings summary, update state, and paths."
            >
              <button
                type="button"
                onClick={() => void onExportDiagnostics()}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                <Download size={12} aria-hidden="true" />
                Export diagnostics JSON
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
                No raw CSV rows, prompt text, Cloud Agent IDs, Automation IDs, or database contents
                are included.
              </p>
            </Section>

            <Section
              icon={<Download size={12} aria-hidden="true" />}
              title="Backup & restore"
              hint="JSON export bundles every batch + row so you can replay on another machine."
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onExport()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  >
                    <Download size={12} aria-hidden="true" />
                    Export to .json
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text)] transition-colors hover:border-[var(--color-destructive)] hover:text-[var(--color-destructive)]"
                  >
                    <Upload size={12} aria-hidden="true" />
                    Restore from .json
                  </button>
                </div>
                {confirmRestore ? (
                  <div className="rounded-md border border-[var(--color-destructive)] bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)] px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        size={12}
                        className="mt-0.5 shrink-0 text-[var(--color-destructive)]"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-[11px] text-[var(--color-text)]">
                        Restoring will <strong>replace</strong> every batch + row currently in the
                        database. Export a backup first if you're unsure.
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmRestore(false)}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void onRestoreConfirmed()}
                        className="rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white transition-opacity hover:opacity-90"
                      >
                        Replace + restore
                      </button>
                    </div>
                  </div>
                ) : null}
                {settings.lastBackupAt ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    last export: {new Date(settings.lastBackupAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    no backup taken yet
                  </p>
                )}
              </div>
            </Section>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface SectionProps {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}

function Section({ icon, title, hint, children }: SectionProps) {
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 px-4 py-3.5">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {icon}
        {title}
      </div>
      {hint ? (
        <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          {hint}
        </p>
      ) : null}
      {children}
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}

function Field({ label, value, onChange, placeholder, type = 'text' }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
      />
    </label>
  );
}

function SaveButton({
  onClick,
  disabled,
}: { onClick: () => void | Promise<void>; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      className="flex items-center gap-1 rounded-md border border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Save size={11} aria-hidden="true" />
      save
    </button>
  );
}

function UpdateStatusCard({
  status,
  onCheck,
  onInstall,
}: {
  status: UpdateStatus;
  onCheck: () => void | Promise<void>;
  onInstall: () => void | Promise<void>;
}) {
  const message = describeUpdateStatus(status);
  const canInstall = status.kind === 'downloaded';
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            {status.kind}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            {message}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void onCheck()}
            disabled={status.kind === 'checking' || status.kind === 'downloading'}
            className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            check
          </button>
          <button
            type="button"
            onClick={() => void onInstall()}
            disabled={!canInstall}
            className="rounded-md border border-[var(--color-accent)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            restart
          </button>
        </div>
      </div>
    </div>
  );
}

function describeUpdateStatus(status: UpdateStatus): string {
  switch (status.kind) {
    case 'idle':
      return 'No update check has run in this session yet.';
    case 'disabled':
      return `Auto-update is disabled for this build (${status.reason}). Packaged release builds can enable it with CU_AUTO_UPDATE=1.`;
    case 'checking':
      return 'Checking the configured release feed now.';
    case 'available':
      return `Version ${status.version} is available and will download through the updater.`;
    case 'not-available':
      return `You are up to date on version ${status.version}.`;
    case 'downloading':
      return `Downloading update (${Math.round(status.percent)}%).`;
    case 'downloaded':
      return `Version ${status.version} is downloaded. Restart to install it.`;
    case 'error':
      return `Update check failed: ${status.message}`;
  }
}

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;
  const color =
    status.kind === 'error'
      ? 'var(--color-destructive)'
      : status.kind === 'ok'
        ? 'var(--color-success, #4ade80)'
        : 'var(--color-accent)';
  const icon =
    status.kind === 'busy' ? (
      <Loader2 size={12} aria-hidden="true" className="animate-spin" />
    ) : status.kind === 'error' ? (
      <AlertTriangle size={12} aria-hidden="true" />
    ) : (
      <Check size={12} aria-hidden="true" />
    );
  return (
    <div
      className="rounded-md border px-3 py-2 font-mono text-[11px]"
      style={{
        borderColor: `color-mix(in oklab, ${color} 55%, var(--color-border))`,
        background: `color-mix(in oklab, ${color} 8%, transparent)`,
        color,
      }}
    >
      <div className="flex items-start gap-2">
        {icon}
        <span className="break-words">{status.message}</span>
      </div>
    </div>
  );
}
