import { useBrand, useBrandSwitcher } from '@cu/brand';
import { CuMark, FileSpreadsheet, Loader2, Moon, Sun, Upload } from '@cu/icons';
import { Badge, BrandMark, Button, IconButton, Tooltipped, useTheme } from '@cu/ui';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useCsvIngest } from '../hooks/useCsvIngest';
import { loadSession } from '../storage/persistence';

/**
 * App shell + entry surface.
 *
 *  Boot              → check IndexedDB. If something is there, auto-hydrate.
 *  Idle / parsing    → hero + drop zone + sample KPI preview.
 *  Success           → handoff to `<DashboardShell>` for the full dashboard.
 *
 * Single-user product → if there's data on disk, we go straight to the
 * dashboard. No "restore card" intermediate step. Wiping data still happens
 * from the FileToolbar's "Clear local" affordance.
 */
export function WelcomePage() {
  const { mode, resolved, toggle } = useTheme();
  const brand = useBrand();
  const { brands, setBrandById } = useBrandSwitcher();
  const { state, ingestFile, appendFile, reset, hydrateFromStorage, clearStorage } = useCsvIngest();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  // Two modes share one hidden input — toggled right before .click().
  const uploadModeRef = useRef<'replace' | 'append'>('replace');
  // Boot phase: we don't want to flash the welcome screen when persisted
  // data exists. `bootChecked` flips to true once we know what to show.
  const [bootChecked, setBootChecked] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await loadSession();
      if (!active) return;
      if (stored && stored.rows.length > 0) {
        await hydrateFromStorage();
      }
      setBootChecked(true);
    })();
    return () => {
      active = false;
    };
  }, [hydrateFromStorage]);

  const onPick = useCallback(() => {
    uploadModeRef.current = 'replace';
    inputRef.current?.click();
  }, []);

  const onPickAppend = useCallback(() => {
    uploadModeRef.current = 'append';
    inputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        if (uploadModeRef.current === 'append') {
          void appendFile(f);
        } else {
          void ingestFile(f);
        }
      }
      e.target.value = '';
    },
    [ingestFile, appendFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void ingestFile(f);
    },
    [ingestFile],
  );

  const parsing = state.status === 'parsing';
  const errMsg = state.status === 'error' ? state.message : null;
  const success = state.status === 'success' ? state : null;
  // Show a tiny gate during boot so we don't flash the welcome hero before
  // the auto-restored dashboard takes over.
  const booting = !bootChecked;

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
              v0.9 · monthly budget
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
          <Badge tone="neutral" className="font-mono text-[10px]">
            {mode === 'system'
              ? 'theme · system'
              : mode === 'dark'
                ? 'theme · dark'
                : 'theme · light'}
          </Badge>
        </div>
      </header>

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
            diff={success.diff}
            onReupload={() => {
              reset();
              onPick();
            }}
            onMergeAnother={onPickAppend}
            onClearStorage={async () => {
              await clearStorage();
            }}
          />
        ) : booting ? (
          <BootGate />
        ) : (
          <>
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
              className="flex flex-col items-center text-center pt-10 pb-12"
            >
              <div
                className="text-[var(--color-brand-mark,var(--color-accent))] mb-4"
                aria-hidden="true"
              >
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
                published pricing — 100% in your browser, nothing leaves the page.
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
                  Single <code className="font-mono">usage-events-YYYY-MM-DD.csv</code>. Full
                  summary is logged to the browser console (F12 → Console).
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
                  Privacy · 100% in-browser parsing
                </div>
                {errMsg && (
                  <div className="mt-5 text-[12px] font-mono text-[var(--color-destructive)]">
                    {errMsg}
                  </div>
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
        )}
      </main>

      <footer className="mx-auto max-w-[1280px] px-6 pt-4 pb-10">
        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-[11px] text-[var(--color-text-subtle)]">
          <span className="font-mono uppercase tracking-[0.08em]">
            cursor-usage-viz · monthly budget / persistence / hours filter
          </span>
          <span>Pricing source: cursor.com/docs/models-and-pricing</span>
        </div>
      </footer>
    </div>
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
