import { type RowWithCost, type UsageSummary, redactRowsToCsv, redactedFileName } from '@cu/data';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HardDrive,
  History,
  Info,
  Layout,
  Loader2,
  Monitor,
  Moon,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Sun,
  Upload,
  X,
} from '@cu/icons';
import { type Locale, type ThemeMode, useI18n, useT, useTheme } from '@cu/ui';
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
import type { NavRouteId, UpdateStatus } from '../electron/types';
import { useDrawerA11y } from '../hooks/useDrawerA11y';
import { useSettings } from '../hooks/useSettings';
import { useUnreadChangelog } from '../hooks/useUnreadChangelog';
import { CHANGELOG_ENTRIES } from '../utils/changelog';
import { buildLocalReport, triggerDownload } from '../utils/localReport';

/**
 * Snapshot of the loaded dataset the Data management section needs to
 * export reports / redacted CSVs without going back through the
 * desktop bridge. `null` while the welcome hero is showing (no data
 * yet) so the export affordances render as disabled placeholders.
 */
export interface SettingsDataset {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  fileName: string;
}

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful backup restore — parent re-hydrates the dashboard. */
  onAfterRestore?: () => void | Promise<void>;
  /**
   * Snapshot of the currently-loaded dataset. Drives the export
   * affordances; absent while the welcome hero is up.
   */
  dataset?: SettingsDataset | null;
  /** Opens the CSV file picker (delegates back to WelcomePage). */
  onOpenImport?: () => void;
  /** Opens the Import history drawer (delegates back to WelcomePage). */
  onOpenHistory?: () => void;
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
export function SettingsDrawer({
  open,
  onClose,
  onAfterRestore,
  dataset,
  onOpenImport,
  onOpenHistory,
}: SettingsDrawerProps) {
  const dialogRef = useDrawerA11y(open, onClose);
  const { settings, loading, save } = useSettings();
  const { mode: themeMode, setMode: setThemeMode, resolved } = useTheme();
  const { locale, setLocale } = useI18n();
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [settingsPath, setSettingsPathState] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: 'idle' });
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<string>('');
  const [goalDraft, setGoalDraft] = useState({
    monthlyRequestTarget: '',
    habitFocus: '' as '' | 'cache' | 'top-burn' | 'volume',
  });
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
    setGoalDraft({
      monthlyRequestTarget:
        settings.personalGoals.monthlyRequestTarget === null
          ? ''
          : String(settings.personalGoals.monthlyRequestTarget),
      habitFocus: settings.personalGoals.habitFocus ?? '',
    });
  }, [loading, settings.monthlyRequestBudget, settings.currency, settings.personalGoals]);

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
        message: `Currency display set to ${code} (${symbol}, ?${multiplier}).`,
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

  const onSaveGoals = async () => {
    const rawTarget = goalDraft.monthlyRequestTarget.trim();
    const monthlyRequestTarget = rawTarget === '' ? null : Number(rawTarget);
    if (
      monthlyRequestTarget !== null &&
      (!Number.isFinite(monthlyRequestTarget) || monthlyRequestTarget <= 0)
    ) {
      setStatus({ kind: 'error', message: 'Monthly goal must be empty or a positive number.' });
      return;
    }
    setStatus({ kind: 'busy', message: 'Saving personal goals...' });
    try {
      await save({
        personalGoals: {
          monthlyRequestTarget:
            monthlyRequestTarget === null ? null : Math.round(monthlyRequestTarget),
          habitFocus: goalDraft.habitFocus || null,
        },
      });
      setStatus({ kind: 'ok', message: 'Personal goals saved.' });
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
      setStatus({ kind: 'ok', message: 'Currency reset to USD ($, ?1).' });
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
          className="fixed inset-0 z-[60] flex items-stretch justify-end bg-[rgba(0,0,0,0.45)]"
          role="presentation"
          onClick={onClose}
        >
          <motion.aside
            ref={dialogRef as React.Ref<HTMLDivElement>}
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('settings.title')}
            className="flex h-full w-[560px] max-w-full flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_-12px_60px_-12px_rgba(0,0,0,0.55)]"
          >
            {/* Sticky drawer-internal header — stays anchored at the
                drawer top even when the body scrolls past the visible
                viewport (the bug the user hit: "manage data 显示不完全,
                让标题栏覆盖了"). z-10 sits above sibling Section dot
                indicators but stays under the modal scrim layer. */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-6 pt-5 pb-3 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-surface)_88%,transparent)]">
              <div className="flex items-center gap-2.5">
                <Settings size={16} className="text-[var(--color-accent)]" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-serif text-[18px] leading-tight tracking-tight">
                    {t('settings.title')}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    {t('settings.subtitle')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('settings.closeAria')}
                className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-5 px-6 pt-5 pb-6">
              <StatusBanner status={status} />

              <DataManagementSection
                dataset={dataset ?? null}
                monthlyRequestBudget={settings.monthlyRequestBudget}
                onOpenImport={() => {
                  if (!onOpenImport) return;
                  onOpenImport();
                  onClose();
                }}
                onOpenHistory={() => {
                  if (!onOpenHistory) return;
                  onOpenHistory();
                  onClose();
                }}
                onStatus={setStatus}
              />

              <NavigationSection
                order={settings.navigation.order}
                hidden={settings.navigation.hidden}
                onChange={async (next) => {
                  setStatus({ kind: 'busy', message: 'Saving navigation layout…' });
                  try {
                    await save({ navigation: next });
                    setStatus({ kind: 'ok', message: 'Navigation layout saved.' });
                  } catch (err) {
                    setStatus({
                      kind: 'error',
                      message: err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
                onReset={async () => {
                  setStatus({ kind: 'busy', message: 'Restoring default navigation…' });
                  try {
                    await save({
                      navigation: {
                        order: ['overview', 'year', 'anomalies', 'models', 'details', 'day'],
                        hidden: [],
                      },
                    });
                    setStatus({ kind: 'ok', message: 'Navigation reset to default.' });
                  } catch (err) {
                    setStatus({
                      kind: 'error',
                      message: err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
              />

              <Section
                icon={
                  resolved === 'dark' ? (
                    <Moon size={12} aria-hidden="true" />
                  ) : (
                    <Sun size={12} aria-hidden="true" />
                  )
                }
                title={t('settings.theme')}
                hint={t('settings.themeHint')}
              >
                <div className="flex gap-2">
                  {(
                    [
                      {
                        id: 'system',
                        label: t('settings.theme.system'),
                        icon: <Monitor size={12} aria-hidden="true" />,
                      },
                      {
                        id: 'light',
                        label: t('settings.theme.light'),
                        icon: <Sun size={12} aria-hidden="true" />,
                      },
                      {
                        id: 'dark',
                        label: t('settings.theme.dark'),
                        icon: <Moon size={12} aria-hidden="true" />,
                      },
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
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                  resolved: {resolved}
                </p>
              </Section>

              {/* Language picker. Two languages for now (en / zh).
                  The dictionary is intentionally narrow — chrome only —
                  so the picker hint warns power users that data
                  narratives stay in English. */}
              <Section
                icon={<Settings size={12} aria-hidden="true" />}
                title={t('settings.language')}
                hint={t('settings.languageHint')}
              >
                <div className="flex gap-2">
                  {(
                    [
                      { id: 'en', label: t('settings.language.en') },
                      { id: 'zh', label: t('settings.language.zh') },
                    ] satisfies Array<{ id: Locale; label: string }>
                  ).map((opt) => {
                    const active = locale === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLocale(opt.id)}
                        className={[
                          'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-colors',
                          active
                            ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)]',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section
                icon={<Monitor size={12} aria-hidden="true" />}
                title={t('settings.density')}
                hint={t('settings.densityHint')}
              >
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      [
                        'comfortable',
                        t('settings.density.comfortable'),
                        'Balanced spacing for daily review.',
                      ],
                      [
                        'dense',
                        t('settings.density.dense'),
                        'Tighter rows and chrome for power scanning.',
                      ],
                      [
                        'presentation',
                        t('settings.density.presentation'),
                        'More breathing room for exports and demos.',
                      ],
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
                        <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
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
                title={t('settings.budget')}
                hint={t('settings.budgetHint')}
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
                    {t('settings.budget.unit')}
                  </span>
                  <div className="ml-auto">
                    <SaveButton onClick={onSaveBudget} disabled={loading} />
                  </div>
                </div>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                  {t('settings.budget.current', {
                    value: settings.monthlyRequestBudget.toLocaleString(),
                  })}
                </p>

                <label className="mt-3 flex items-start gap-2 text-[12px] text-[var(--color-text-muted)]">
                  <input
                    type="checkbox"
                    checked={settings.budgetNotificationsMuted}
                    onChange={async (e) => {
                      const muted = e.target.checked;
                      setStatus({
                        kind: 'busy',
                        message: muted ? 'Muting budget toasts…' : 'Unmuting budget toasts…',
                      });
                      try {
                        await save({ budgetNotificationsMuted: muted });
                        setStatus({
                          kind: 'ok',
                          message: muted
                            ? 'Budget notifications muted.'
                            : 'Budget notifications re-armed.',
                        });
                      } catch (err) {
                        setStatus({
                          kind: 'error',
                          message: err instanceof Error ? err.message : String(err),
                        });
                      }
                    }}
                    className="mt-1 h-3.5 w-3.5 cursor-pointer accent-[var(--color-accent)]"
                  />
                  <span className="leading-snug">
                    <strong className="text-[var(--color-text)]">
                      {t('settings.budget.muteLabel')}.
                    </strong>{' '}
                    {t('settings.budget.muteBody')}
                  </span>
                </label>
              </Section>

              <Section
                icon={<Check size={12} aria-hidden="true" />}
                title="Personal goals"
                hint="Optional local-only coaching targets. Leave target blank to follow the plan cap."
              >
                <div className="grid grid-cols-[1fr_1.4fr_auto] items-end gap-2">
                  <Field
                    label="Request target"
                    value={goalDraft.monthlyRequestTarget}
                    onChange={(v) => setGoalDraft((g) => ({ ...g, monthlyRequestTarget: v }))}
                    placeholder={String(settings.monthlyRequestBudget)}
                    type="number"
                  />
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                      Habit focus
                    </span>
                    <select
                      value={goalDraft.habitFocus}
                      onChange={(e) =>
                        setGoalDraft((g) => ({
                          ...g,
                          habitFocus: e.target.value as typeof goalDraft.habitFocus,
                        }))
                      }
                      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                    >
                      <option value="">No focus</option>
                      <option value="cache">Improve cache reuse</option>
                      <option value="top-burn">Trim top-burn runs</option>
                      <option value="volume">Reduce request volume</option>
                    </select>
                  </label>
                  <SaveButton onClick={onSaveGoals} disabled={loading} />
                </div>
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
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    current: {settings.currency.code} ({settings.currency.symbol}, ?
                    {settings.currency.multiplier})
                  </span>
                  <button
                    type="button"
                    onClick={() => void onResetCurrency()}
                    className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
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
                      className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FolderOpen size={10} aria-hidden="true" />
                      reveal
                    </button>
                  </div>
                  {settingsPath ? (
                    <div className="mt-1.5 font-mono text-[11px] text-[var(--color-text-subtle)]">
                      settings:{' '}
                      <span className="text-[var(--color-text-muted)]">{settingsPath}</span>
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
                  No raw CSV rows, prompt text, Cloud Agent IDs, Automation IDs, or database
                  contents are included.
                </p>
              </Section>

              <Section
                icon={<Download size={12} aria-hidden="true" />}
                title={t('settings.backup')}
                hint={t('settings.backup.hint')}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onExport()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      <Download size={12} aria-hidden="true" />
                      {t('settings.backup.export')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestore(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text)] transition-colors hover:border-[var(--color-destructive)] hover:text-[var(--color-destructive)]"
                    >
                      <Upload size={12} aria-hidden="true" />
                      {t('settings.backup.restore')}
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
                          {t('settings.backup.confirmWarning')}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmRestore(false)}
                          className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRestoreConfirmed()}
                          className="rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-white transition-opacity hover:opacity-90"
                        >
                          {t('settings.backup.confirmReplace')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {settings.lastBackupAt ? (
                    <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                      {t('settings.backup.lastExport', {
                        when: new Date(settings.lastBackupAt).toLocaleString(),
                      })}
                    </p>
                  ) : (
                    <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                      {t('settings.backup.noBackup')}
                    </p>
                  )}
                </div>
              </Section>

              <WhatsNewSection />
              <AboutSection />
            </div>
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
        <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
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
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
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
      className="flex items-center gap-1 rounded-md border border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)] px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
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
            className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            check
          </button>
          <button
            type="button"
            onClick={() => void onInstall()}
            disabled={!canInstall}
            className="rounded-md border border-[var(--color-accent)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
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

/* ----------------------------------------------------------------
 * Data management section
 *
 * Hosts the Import / History / Export affordances that used to live
 * on the FileToolbar. Centralising them here was the UI polish
 * pass's biggest information-architecture change — the toolbar now
 * carries only the high-value Focus toggle, and the routine
 * "manage my data" work is one settings click away.
 * ---------------------------------------------------------------- */
interface DataManagementSectionProps {
  dataset: SettingsDataset | null;
  monthlyRequestBudget: number;
  onOpenImport: () => void;
  onOpenHistory: () => void;
  onStatus: (status: Status) => void;
}

function DataManagementSection({
  dataset,
  monthlyRequestBudget,
  onOpenImport,
  onOpenHistory,
  onStatus,
}: DataManagementSectionProps) {
  const hasData = !!dataset && dataset.summary.totalRows > 0;
  const onExportRedacted = () => {
    if (!dataset) return;
    const csv = redactRowsToCsv(dataset.rows);
    triggerDownload(csv, redactedFileName(dataset.fileName));
    onStatus({ kind: 'ok', message: 'Redacted CSV download started.' });
  };
  const onExportReport = () => {
    if (!dataset) return;
    const markdown = buildLocalReport({
      summary: dataset.summary,
      rows: dataset.rows,
      fileName: dataset.fileName,
      monthlyRequestBudget,
    });
    triggerDownload(markdown, redactedFileName(dataset.fileName).replace(/\.csv$/i, '-report.md'));
    onStatus({ kind: 'ok', message: 'Local report download started.' });
  };

  const t = useT();
  return (
    <Section
      icon={<FileSpreadsheet size={12} aria-hidden="true" />}
      title={t('settings.dataManagement')}
      hint="Import another CSV, review past imports, or export a privacy-safe snapshot."
    >
      <div className="grid grid-cols-2 gap-2">
        <DataActionButton
          icon={<Upload size={12} aria-hidden="true" />}
          label={t('settings.dataManagement.import')}
          description="Preview new rows + skipped duplicates before the merge."
          onClick={onOpenImport}
        />
        <DataActionButton
          icon={<History size={12} aria-hidden="true" />}
          label={t('settings.dataManagement.history')}
          description="Every CSV you've imported · undo any batch."
          onClick={onOpenHistory}
        />
        <DataActionButton
          icon={<Download size={12} aria-hidden="true" />}
          label={t('settings.dataManagement.redacted')}
          description="Cloud Agent / Automation IDs replaced with hash aliases."
          onClick={onExportRedacted}
          disabled={!hasData}
        />
        <DataActionButton
          icon={<Download size={12} aria-hidden="true" />}
          label={t('settings.dataManagement.report')}
          description="Markdown summary with insights and planning scenarios."
          onClick={onExportReport}
          disabled={!hasData}
        />
      </div>
      {dataset ? (
        <p className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          loaded: {dataset.fileName} · {dataset.summary.totalRows.toLocaleString()} rows
        </p>
      ) : (
        <p className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          no data loaded · drop a CSV onto the welcome hero to get started
        </p>
      )}
    </Section>
  );
}

function DataActionButton({
  icon,
  label,
  description,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-[68px] flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-[var(--color-border)] text-[var(--color-text-subtle)] opacity-50'
          : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]',
      ].join(' ')}
    >
      <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em]">
        {icon}
        {label}
      </span>
      <span className="text-[11px] leading-snug text-[var(--color-text-subtle)]">
        {description}
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------
 * Navigation section
 *
 * Drag-reorder (HTML5 dnd) + per-route visibility toggle for the
 * left rail. Persisted via UserSettings.navigation; SideNav reads
 * the layout through DashboardShell.
 * ---------------------------------------------------------------- */
interface NavigationSectionProps {
  order: NavRouteId[];
  hidden: NavRouteId[];
  onChange: (next: { order: NavRouteId[]; hidden: NavRouteId[] }) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

const ROUTE_LABEL: Record<NavRouteId, string> = {
  overview: 'Overview',
  year: 'Year',
  anomalies: 'Anomalies',
  models: 'Models',
  details: 'Requests',
  day: 'Day audit',
};

const ROUTE_HINT: Record<NavRouteId, string> = {
  overview: 'Headline KPIs, action feed, week summary',
  year: 'Year-long heatmap and monthly trends',
  anomalies: 'Days that broke the weekly baseline',
  models: 'Per-model cost / tokens / share',
  details: 'Filterable request table',
  day: 'Single-day audit drilldown',
};

function NavigationSection({ order, hidden, onChange, onReset }: NavigationSectionProps) {
  const hiddenSet = new Set(hidden);
  const [dragId, setDragId] = useState<NavRouteId | null>(null);

  const move = (id: NavRouteId, direction: -1 | 1) => {
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [removed] = next.splice(idx, 1);
    if (removed) next.splice(target, 0, removed);
    void onChange({ order: next, hidden });
  };

  const toggleVisibility = (id: NavRouteId) => {
    if (hiddenSet.has(id)) {
      void onChange({ order, hidden: hidden.filter((h) => h !== id) });
      return;
    }
    if (hidden.length + 1 >= order.length) return; // refuse to hide the last visible route
    void onChange({ order, hidden: [...hidden, id] });
  };

  const reorderTo = (sourceId: NavRouteId, targetId: NavRouteId) => {
    if (sourceId === targetId) return;
    const sourceIdx = order.indexOf(sourceId);
    const targetIdx = order.indexOf(targetId);
    if (sourceIdx < 0 || targetIdx < 0) return;
    const next = [...order];
    const [removed] = next.splice(sourceIdx, 1);
    if (removed) next.splice(targetIdx, 0, removed);
    void onChange({ order: next, hidden });
  };

  const t = useT();
  return (
    <Section
      icon={<Layout size={12} aria-hidden="true" />}
      title={t('settings.navigation')}
      hint={t('settings.navigation.hint')}
    >
      <ul className="flex flex-col gap-1.5">
        {order.map((id, idx) => {
          const isHidden = hiddenSet.has(id);
          const isDragging = dragId === id;
          return (
            <li
              key={id}
              draggable
              onDragStart={(e) => {
                setDragId(id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== id) reorderTo(dragId, id);
                setDragId(null);
              }}
              className={[
                'flex items-center gap-2 rounded-md border bg-[var(--color-bg)] px-3 py-2 transition-colors',
                isDragging
                  ? 'border-[var(--color-accent)] opacity-60'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              <span
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]"
                aria-hidden="true"
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={[
                    'font-serif text-[14px] tracking-tight',
                    isHidden
                      ? 'text-[var(--color-text-subtle)] line-through'
                      : 'text-[var(--color-text)]',
                  ].join(' ')}
                >
                  {ROUTE_LABEL[id]}
                </span>
                <span className="font-mono text-[11px] text-[var(--color-text-subtle)]">
                  {ROUTE_HINT[id]}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <NavIconButton label="Move up" disabled={idx === 0} onClick={() => move(id, -1)}>
                  <ArrowUp size={11} aria-hidden="true" />
                </NavIconButton>
                <NavIconButton
                  label="Move down"
                  disabled={idx === order.length - 1}
                  onClick={() => move(id, 1)}
                >
                  <ArrowDown size={11} aria-hidden="true" />
                </NavIconButton>
                <NavIconButton
                  label={isHidden ? 'Show route' : 'Hide route'}
                  pressed={isHidden}
                  onClick={() => toggleVisibility(id)}
                >
                  {isHidden ? (
                    <EyeOff size={11} aria-hidden="true" />
                  ) : (
                    <Eye size={11} aria-hidden="true" />
                  )}
                </NavIconButton>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          {order.length - hidden.length} visible · {hidden.length} hidden
        </span>
        <button
          type="button"
          onClick={() => void onReset()}
          className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
        >
          <RotateCcw size={11} aria-hidden="true" />
          reset to default
        </button>
      </div>
    </Section>
  );
}

function NavIconButton({
  label,
  children,
  onClick,
  disabled = false,
  pressed = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed || undefined}
      title={label}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
        disabled
          ? 'cursor-not-allowed border-[var(--color-border)] text-[var(--color-text-subtle)] opacity-50'
          : pressed
            ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
            : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * Lists every entry in CHANGELOG_ENTRIES. Touching this section
 * auto-marks all entries seen, so the Quick Tips unread dot clears
 * as a side effect.
 */
function WhatsNewSection() {
  const { markAllSeen, hasUnread } = useUnreadChangelog();
  const t = useT();
  useEffect(() => {
    // Fire only when the drawer is open AND there's something new —
    // avoids touching localStorage on every render.
    if (hasUnread) markAllSeen();
  }, [hasUnread, markAllSeen]);

  return (
    <Section
      icon={<Sparkles size={12} aria-hidden="true" />}
      title={t('settings.whatsNew')}
      hint={t('settings.whatsNew.hint')}
    >
      <div className="flex flex-col gap-4">
        {CHANGELOG_ENTRIES.map((entry) => (
          <div key={entry.version} className="border-l-2 border-[var(--color-accent)] pl-3">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-serif text-[14px] text-[var(--color-text)]">{entry.title}</h4>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                {entry.version} · {entry.date}
              </span>
            </div>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              {entry.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

const APP_VERSION = CHANGELOG_ENTRIES[0]?.version ?? '0.0.0-dev';

/**
 * Read-only metadata: version + (when running in Electron) the
 * absolute path of the local SQLite database, so an operator can
 * find/back-up/restore-on-disaster the file without diving into
 * platform-specific app-data locations.
 */
function AboutSection() {
  const [dbPath, setDbPath] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    // Best-effort: the desktop bridge exposes the path via a tiny
    // IPC handler; web mode has no DB, so we leave it null and the
    // UI degrades to "managed by browser storage".
    const bridge = (window as { cursorUsage?: { getDbPath?: () => Promise<string> } }).cursorUsage;
    if (!bridge?.getDbPath) return;
    let cancelled = false;
    void bridge
      .getDbPath()
      .then((p) => {
        if (!cancelled) setDbPath(p);
      })
      .catch(() => {
        // ignore — older builds without the handler simply hide the row
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Section
      icon={<Info size={12} aria-hidden="true" />}
      title={t('settings.about')}
      hint={t('settings.about.hint')}
    >
      <dl className="flex flex-col gap-2 text-[12px]">
        <Row label={t('settings.about.version')}>
          <span className="font-mono">{APP_VERSION}</span>
        </Row>
        <Row label={t('settings.about.data')}>
          {dbPath ? (
            <span className="break-all font-mono text-[11px] text-[var(--color-text-muted)]">
              {dbPath}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-[var(--color-text-subtle)]">
              {t('settings.about.dataWeb')}
            </span>
          )}
        </Row>
        <Row label={t('settings.about.license')}>
          <span className="font-mono">{t('settings.about.licenseValue')}</span>
        </Row>
      </dl>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[68px] shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
        {label}
      </dt>
      <dd className="flex-1 text-[var(--color-text)]">{children}</dd>
    </div>
  );
}
