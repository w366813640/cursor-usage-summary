import { useBrand, useBrandSwitcher } from '@cu/brand';
import {
  AlertTriangle,
  CuMark,
  FileSpreadsheet,
  Loader2,
  Moon,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
  Upload,
} from '@cu/icons';
import { Badge, BrandMark, Button, IconButton, Tooltipped, useTheme } from '@cu/ui';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { ImportHistoryDrawer } from '../components/ImportHistoryDrawer';
import { ImportPreviewDrawer } from '../components/ImportPreviewDrawer';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { isDesktop as detectDesktop } from '../electron/bridge';
import { useDesktopIngest } from '../hooks/useDesktopIngest';

/**
 * App shell + entry surface.
 *
 *   Boot         → hydrate from cursor-usage.db. If anything's there,
 *                  go straight to the dashboard.
 *   Idle         → onboarding hero + dropzone. Drag a CSV (or click
 *                  "Choose CSV") to enter the import flow.
 *   Preview      → right-side drawer over a faded dashboard, showing
 *                  "+N rows would land · M skipped · file SHA already
 *                  imported?" + a confirm button.
 *   Success      → handoff to `<DashboardShell>` with the loaded data.
 *
 * Single-user product → if there's data on disk, we go straight to the
 * dashboard. No "restore card" intermediate step. Wiping data still
 * happens from the FileToolbar's affordances (via the history drawer).
 *
 * Web mode (IndexedDB) was retired in PR20 — the desktop SQLite stack
 * is the only supported runtime now. Loading this bundle outside of
 * Electron shows a small "open in the desktop app" notice instead of
 * crashing.
 */
export function WelcomePage() {
  // We don't expect `isDesktop()` to change at runtime — the preload
  // bridge is mounted synchronously before any React code runs. Computing
  // it once at mount keeps the render shape stable.
  const isDesktop = useMemo(() => detectDesktop(), []);
  if (!isDesktop) return <NonDesktopNotice />;
  return <DesktopWelcomePage />;
}

/**
 * Renderer entry that talks to better-sqlite3 in the main process via
 * the preload bridge. CSV imports go through a preview-then-commit
 * drawer (so the user can see what will be added / skipped before
 * anything lands on disk), and a History drawer exposes per-batch undo.
 */
function DesktopWelcomePage() {
  const desktop = useDesktopIngest();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Keep the last `success` snapshot so the dashboard stays visible
  // underneath the preview / history drawers when state transitions
  // through `parsing` → `preview` → `committing`. Without this, the
  // page would briefly collapse to the welcome hero behind the
  // drawer overlay.
  const [lastSuccess, setLastSuccess] = useState<Extract<
    ReturnType<typeof useDesktopIngest>['state'],
    { status: 'success' }
  > | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      await desktop.hydrateFromDb();
      if (active) setBootChecked(true);
    })();
    return () => {
      active = false;
    };
  }, [desktop.hydrateFromDb]);

  useEffect(() => {
    if (desktop.state.status === 'success') {
      setLastSuccess(desktop.state);
    }
  }, [desktop.state]);

  const onPick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void desktop.startImport(f);
      e.target.value = '';
    },
    [desktop.startImport],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void desktop.startImport(f);
    },
    [desktop.startImport],
  );

  // Global drop catcher so users can drop a CSV anywhere on the window,
  // not just on the dropzone. Only active while the dashboard is shown
  // (the empty-state hero already has its own dropzone).
  useEffect(() => {
    if (desktop.state.status !== 'success') return;
    const onWindowDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      e.preventDefault();
      void desktop.startImport(file);
    };
    const onWindowDragOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener('drop', onWindowDrop);
    window.addEventListener('dragover', onWindowDragOver);
    return () => {
      window.removeEventListener('drop', onWindowDrop);
      window.removeEventListener('dragover', onWindowDragOver);
    };
  }, [desktop.state.status, desktop.startImport]);

  // Render priority:
  //  1. live success state (just landed an import / hydrated)
  //  2. last-known success snapshot (so dashboard sticks during
  //     preview / committing transitions; the drawer overlays on top)
  //  3. nothing → show the welcome hero
  const liveSuccess = desktop.state.status === 'success' ? desktop.state : null;
  const success = liveSuccess ?? lastSuccess;
  const parsing = desktop.state.status === 'parsing' || desktop.state.status === 'committing';
  const errMsg = desktop.state.status === 'error' ? desktop.state.message : null;
  const previewOpen = desktop.state.status === 'preview' || desktop.state.status === 'committing';

  const previewSnapshot =
    desktop.state.status === 'preview' || desktop.state.status === 'committing'
      ? desktop.state
      : null;

  return (
    <PageChrome onOpenSettings={() => setSettingsOpen(true)}>
      <main className="max-w-[1280px] mx-auto px-6 py-8">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
        />

        {success ? (
          <DashboardShell
            summary={success.summary}
            rows={success.rows}
            fileName={success.fileName}
            sourceFiles={success.sourceFiles}
            rowsSeen={success.rowsSeen}
            failures={success.failures}
            elapsedMs={success.elapsedMs}
            lastIngestedAt={success.lastIngestedAt}
            desktopActions={{
              onOpenImport: onPick,
              onOpenHistory: () => setHistoryOpen(true),
              storageHint: 'Saved locally in cursor-usage.db (better-sqlite3, main process)',
            }}
          />
        ) : !bootChecked ? (
          <BootGate />
        ) : (
          <WelcomeHero
            parsing={parsing}
            dragActive={dragActive}
            setDragActive={setDragActive}
            onPick={onPick}
            onDrop={onDrop}
            errMsg={errMsg}
            onReset={desktop.reset}
          />
        )}
      </main>

      {/* Preview + history drawers — always mounted so AnimatePresence
          can choreograph open/close. */}
      {previewSnapshot ? (
        <ImportPreviewDrawer
          open={previewOpen}
          fileName={
            previewSnapshot.status === 'preview'
              ? previewSnapshot.fileName
              : previewSnapshot.fileName
          }
          rowsSeen={previewSnapshot.status === 'preview' ? previewSnapshot.rowsSeen : 0}
          failures={previewSnapshot.status === 'preview' ? previewSnapshot.failures : 0}
          preview={
            previewSnapshot.status === 'preview'
              ? previewSnapshot.preview
              : { wouldAdd: 0, wouldSkip: 0, dateMin: null, dateMax: null, isDuplicateFile: false }
          }
          committing={desktop.state.status === 'committing'}
          onConfirm={() => {
            void desktop.confirmImport();
          }}
          onCancel={desktop.cancelImport}
        />
      ) : null}

      <ImportHistoryDrawer
        open={historyOpen}
        loadBatches={desktop.loadBatches}
        onUndo={desktop.undoBatchById}
        onClose={() => setHistoryOpen(false)}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onAfterRestore={async () => {
          await desktop.hydrateFromDb();
        }}
      />
    </PageChrome>
  );
}

/**
 * Shown if the renderer bundle was loaded outside of Electron (e.g. by
 * running `pnpm --filter @cu/playground dev` directly in a browser). We
 * could ship a web-flavour fallback, but PR20 cut the IndexedDB path
 * to reduce maintenance — this notice points the user to the desktop
 * binary instead of letting the empty bridge crash on first import.
 */
function NonDesktopNotice() {
  return (
    <PageChrome>
      <main className="mx-auto flex max-w-[640px] flex-col items-center gap-4 px-6 py-24 text-center">
        <AlertTriangle size={32} className="text-[var(--color-warning)]" aria-hidden="true" />
        <h1 className="font-serif text-[32px] tracking-tight">Open in the desktop app</h1>
        <p className="text-[14px] text-[var(--color-text-muted)] max-w-[480px]">
          Cursor Usage v1.0 is desktop-only — the local SQLite database lives in the Electron main
          process, so the browser-only build no longer runs the dashboard. Launch{' '}
          <code className="font-mono text-[var(--color-accent)]">Cursor Usage.exe</code> (or build
          it with <code className="font-mono">pnpm desktop:dev</code>) to import your CSVs.
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          installer · apps/desktop/release/Cursor Usage-Setup-*.exe
        </p>
      </main>
    </PageChrome>
  );
}

/**
 * Shared header / footer / background gradient. Desktop is now the
 * only supported runtime, so the variant prop is gone — the brand
 * strip always shows the desktop / sqlite badge. When `onOpenSettings`
 * is provided the header renders a cog button next to the theme
 * toggle; the welcome hero omits it (no DB to configure yet).
 */
function PageChrome({
  children,
  onOpenSettings,
}: {
  children: React.ReactNode;
  onOpenSettings?: () => void;
}) {
  const { mode, resolved, toggle } = useTheme();
  const brand = useBrand();
  const { brands, setBrandById } = useBrandSwitcher();
  return (
    <div
      className="relative min-h-screen w-full"
      style={{
        background:
          'radial-gradient(1200px 600px at 80% -10%, color-mix(in oklab, var(--color-accent) 8%, transparent), transparent 60%), radial-gradient(800px 500px at -10% 30%, color-mix(in oklab, var(--color-accent) 5%, transparent), transparent 70%), var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      <header
        className="flex h-12 items-center justify-between border-b border-[var(--color-border)] px-6"
        style={{
          background: 'color-mix(in oklab, var(--color-bg) 78%, transparent)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex items-center gap-3">
          <BrandMark size={22} motion="hover" />
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[17px] tracking-tight">{brand.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              v1.0 · desktop · sqlite
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 mr-2">
            {brands.map((b) => {
              const active = b.id === brand.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrandById(b.id)}
                  className={[
                    'h-7 w-7 rounded-full transition-transform duration-[160ms]',
                    'hover:scale-110 active:scale-95',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                    active ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg)]' : '',
                  ].join(' ')}
                  style={{
                    background: b.palette?.accent ?? 'var(--color-accent)',
                    boxShadow: active ? '0 0 0 1.5px var(--color-accent)' : undefined,
                  }}
                  title={b.name}
                  aria-label={`Switch brand to ${b.name}`}
                />
              );
            })}
          </div>
          <Tooltipped
            label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            side="bottom"
          >
            <IconButton label="Toggle theme" onClick={toggle} variant="ghost" size="sm">
              {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
          </Tooltipped>
          {onOpenSettings ? (
            <Tooltipped label="Settings · budget · backup" side="bottom">
              <IconButton label="Open settings" onClick={onOpenSettings} variant="ghost" size="sm">
                <SettingsIcon size={16} />
              </IconButton>
            </Tooltipped>
          ) : null}
          <Badge tone="neutral" className="font-mono text-[10px]">
            {mode === 'system'
              ? 'theme · system'
              : mode === 'dark'
                ? 'theme · dark'
                : 'theme · light'}
          </Badge>
        </div>
      </header>

      {children}

      <footer className="mx-auto max-w-[1280px] px-6 pt-4 pb-10">
        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-[11px] text-[var(--color-text-subtle)]">
          <span className="font-mono uppercase tracking-[0.08em]">
            cursor-usage-viz · desktop · sqlite persistence
          </span>
          <span>Pricing source: cursor.com/docs/models-and-pricing</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Empty-state hero — shown when there's no data in the DB yet. Same
 * dropzone as in the desktop app, with a desktop-specific storage
 * badge so the user knows the import lands in `cursor-usage.db`.
 */
function WelcomeHero({
  parsing,
  dragActive,
  setDragActive,
  onPick,
  onDrop,
  errMsg,
  onReset,
}: {
  parsing: boolean;
  dragActive: boolean;
  setDragActive: (v: boolean) => void;
  onPick: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  errMsg: string | null;
  onReset: () => void;
}) {
  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
        className="flex flex-col items-center text-center pt-10 pb-12"
      >
        <div className="text-[var(--color-brand-mark,var(--color-accent))] mb-4" aria-hidden="true">
          <CuMark size={64} />
        </div>
        <h1 className="font-serif text-[44px] leading-[1.05] tracking-[-0.01em] mb-3">
          Make your Cursor usage
          <br />
          add up.
        </h1>
        <p className="text-[15px] text-[var(--color-text-muted)] max-w-[560px]">
          Drop in a{' '}
          <code className="font-mono text-[13px] text-[var(--color-accent)]">
            usage-events-*.csv
          </code>{' '}
          exported from cursor.com/dashboard/usage. Costs are computed against the official
          published pricing — 100% on your device, nothing leaves the page.
        </p>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.08, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={[
            'relative rounded-[14px] border-2 border-dashed',
            'transition-colors duration-[180ms] p-10 flex flex-col items-center text-center',
            dragActive
              ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/40'
              : 'border-[var(--color-border)] bg-[var(--color-surface)]/50 hover:border-[var(--color-border-strong)]',
          ].join(' ')}
        >
          <FileSpreadsheet
            size={32}
            className="text-[var(--color-text-subtle)] mb-3"
            aria-hidden="true"
          />
          <div className="font-serif text-[18px] mb-1">
            {parsing ? 'Parsing…' : 'Drop CSV here or click to upload'}
          </div>
          <div className="text-[13px] text-[var(--color-text-muted)] mb-5 max-w-[420px]">
            Single <code className="font-mono">usage-events-YYYY-MM-DD.csv</code>. Full summary is
            logged to the browser console (F12 → Console).
          </div>
          <Button variant="primary" size="md" onClick={onPick} disabled={parsing}>
            {parsing ? (
              <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            ) : (
              <Upload size={14} aria-hidden="true" />
            )}
            {parsing ? 'Parsing…' : 'Choose CSV'}
          </Button>
          <div className="mt-4 text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Storage · desktop · cursor-usage.db
          </div>
          {errMsg && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              role="alert"
              className="mt-5 flex w-full max-w-[480px] flex-col gap-2 rounded-md border px-3.5 py-3 text-left text-[12px]"
              style={{
                borderColor:
                  'color-mix(in oklab, var(--color-destructive) 55%, var(--color-border))',
                background: 'color-mix(in oklab, var(--color-destructive) 8%, transparent)',
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--color-destructive)]"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-1">
                  <span className="font-serif text-[14px] leading-tight text-[var(--color-destructive)]">
                    Couldn't parse that CSV
                  </span>
                  <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                    {errMsg}
                  </span>
                </div>
              </div>
              <ul className="ml-5 list-disc font-mono text-[10px] leading-relaxed text-[var(--color-text-subtle)]">
                <li>
                  Make sure you exported{' '}
                  <code className="rounded-sm bg-[var(--color-surface-raised)] px-1">
                    usage-events-YYYY-MM-DD.csv
                  </code>{' '}
                  from cursor.com/dashboard/usage (not the monthly summary).
                </li>
                <li>Files larger than 16 MB are rejected — split them by month.</li>
                <li>If you re-saved the file via Excel, re-export from Cursor instead.</li>
              </ul>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
                >
                  <RefreshCw size={10} aria-hidden="true" />
                  try again
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.42, delay: 0.16 }}
      >
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-[20px] tracking-tight">Design system preview</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Sample · replaced with your data after upload
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiPreviewCard
            label="Total spend"
            value="$1,247.83"
            meta="60 days · 2,335 requests"
            accent
          />
          <KpiPreviewCard
            label="Single most expensive"
            value="$139.37"
            meta="claude-opus-4-7-thinking-max · 2026-05-13"
          />
          <KpiPreviewCard
            label="Top model by spend"
            value="claude-4-sonnet-thinking"
            meta="557 requests · 23.8% of total cost"
            valueClass="font-mono text-[18px] leading-[1.4] tracking-tight"
          />
        </div>
      </motion.section>
    </>
  );
}

/**
 * Lightweight placeholder while we figure out whether to auto-restore or
 * show the welcome page. Keeps layout stable so the user doesn't see a
 * jarring flash.
 */
function BootGate() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex h-[280px] items-center justify-center text-[var(--color-text-subtle)]"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={20} aria-hidden="true" className="animate-spin" />
      <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.1em]">
        Restoring local session…
      </span>
    </motion.div>
  );
}

interface KpiPreviewCardProps {
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
  valueClass?: string;
}

function KpiPreviewCard({
  label,
  value,
  meta,
  accent = false,
  valueClass = 'font-serif text-[38px] leading-[1.1] tracking-[-0.01em]',
}: KpiPreviewCardProps) {
  return (
    <div
      className="
        group rounded-[14px] border border-[var(--color-border)]
        bg-[var(--color-surface)] p-5
        hover:border-[var(--color-border-strong)]
        transition-colors duration-[180ms]
      "
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {label}
        </div>
        {accent ? (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--color-accent)' }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className={valueClass} style={accent ? { color: 'var(--color-accent)' } : undefined}>
        {value}
      </div>
      <div className="mt-2 text-[12px] text-[var(--color-text-muted)] font-mono">{meta}</div>
    </div>
  );
}
