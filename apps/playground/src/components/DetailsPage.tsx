import { fmtTokens, fmtUSD } from '@cu/charts';
import type { RowWithCost, UsageSummary } from '@cu/data';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Panel } from './Panel';
import { SectionHeader } from './SectionHeader';

interface DetailsPageProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  /**
   * Switch to the Day Audit route. Fired by the hover-only "→ day"
   * cell so a row's context (date) can be picked back up there.
   * Optional — the page degrades to a hash-fallback when absent.
   */
  onJumpToDay?: (isoDate: string) => void;
}

type SortKey = 'date-desc' | 'cost-desc' | 'tokens-desc';

const PAGE_SIZE = 50;

/**
 * Full-fidelity request log. Every CSV row is searchable / filterable /
 * sortable so the user can answer arbitrary questions like "what's the most
 * expensive Gemini call I ever made?" without leaving the page.
 */
export function DetailsPage({ summary, rows, onJumpToDay }: DetailsPageProps) {
  const [sort, setSort] = useState<SortKey>('cost-desc');
  const [modelFilter, setModelFilter] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [page, setPage] = useState<number>(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (modelFilter && r.model !== modelFilter) return false;
      if (q) {
        const hay =
          `${r.model} ${r.kind} ${r.cloudAgentId ?? ''} ${r.automationId ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case 'date-desc':
          return b.date.getTime() - a.date.getTime();
        case 'tokens-desc':
          return b.tokens.total - a.tokens.total;
        default:
          return b.cost - a.cost;
      }
    });
    return list;
  }, [rows, modelFilter, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const hasActiveFilter = query.trim().length > 0 || modelFilter.length > 0;

  const allModels = useMemo(() => {
    return summary.byModel.map((m) => m.model);
  }, [summary.byModel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col gap-4"
    >
      <SectionHeader
        sticky
        title="All requests · details"
        subtitle={`${filtered.length} / ${rows.length} rows · page ${safePage + 1} / ${totalPages}`}
      />

      <Panel title="Filter + sort">
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="search">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="model / kind / agent id"
              className="w-[220px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </FilterField>
          <FilterField label="model">
            <select
              value={modelFilter}
              onChange={(e) => {
                setModelFilter(e.target.value);
                setPage(0);
              }}
              className="w-[220px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 font-mono text-[11px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="">All models</option>
              {allModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="sort">
            <div className="flex gap-1 font-mono text-[11px] uppercase tracking-[0.08em]">
              {(
                [
                  ['cost-desc', 'cost ↓'],
                  ['date-desc', 'date ↓'],
                  ['tokens-desc', 'tokens ↓'],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSort(k)}
                  className={[
                    'rounded-sm border px-2 py-1 transition-colors',
                    sort === k
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-subtle)] hover:text-[var(--color-text)]',
                  ].join(' ')}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </FilterField>
        </div>
      </Panel>

      <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-text)_3%,transparent),0_10px_28px_-22px_rgba(0,0,0,0.55)]">
        {/* maxWidth wrapper enables horizontal scroll on narrow viewports without breaking the rounded shell. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead className="sticky top-0 z-[1] bg-[var(--color-surface-muted)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface-muted)]/80">
              <tr className="border-b border-[var(--color-border)] text-left">
                {(
                  [
                    { key: 'Date', align: 'left' },
                    { key: 'Model', align: 'left' },
                    { key: 'Kind', align: 'left' },
                    { key: 'Cost', align: 'right' },
                    { key: 'Tokens', align: 'right' },
                    { key: 'Cache hit', align: 'right' },
                    { key: 'Max', align: 'center' },
                  ] as const
                ).map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)] text-${c.align}`}
                  >
                    {c.key}
                  </th>
                ))}
                <th aria-label="row actions" className="w-[44px]" />
                {/* hover-only actions */}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center">
                    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-2 font-mono text-[11px] text-[var(--color-text-subtle)]">
                      <span className="font-serif text-[16px] text-[var(--color-text)]">
                        No matching requests
                      </span>
                      <span>
                        {hasActiveFilter
                          ? 'Your current filters returned 0 rows.'
                          : 'There are no rows to show.'}
                      </span>
                      {hasActiveFilter ? (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery('');
                            setModelFilter('');
                            setPage(0);
                          }}
                          className="mt-1 rounded-sm border border-[var(--color-border)] px-2 py-1 uppercase tracking-[0.08em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => {
                  const totalInput =
                    r.tokens.inputWithoutCacheWrite +
                    r.tokens.inputWithCacheWrite +
                    r.tokens.cacheRead;
                  const hit = totalInput > 0 ? r.tokens.cacheRead / totalInput : 0;
                  const time = r.date.toISOString().slice(11, 16);
                  // Subtle zebra via color-mix so the alpha truly applies to the CSS variable.
                  // Tailwind's `/30` opacity modifier doesn't survive on arbitrary `var(...)` colors.
                  const zebraStyle: React.CSSProperties =
                    i % 2 === 1
                      ? {
                          background:
                            'color-mix(in oklab, var(--color-surface-muted) 45%, transparent)',
                        }
                      : {};
                  // Highlight the cost cell when this row's cost is meaningful — gives the eye
                  // an instant magnitude scan without a chart column.
                  const costIsHero = r.cost >= 1;
                  return (
                    <tr
                      key={`${r.date.toISOString()}-${i}`}
                      className="group/row border-b border-[var(--color-border)]/40 last:border-b-0 transition-colors hover:bg-[var(--color-surface-raised)]"
                      style={zebraStyle}
                    >
                      <td className="relative px-3 py-2 align-middle font-mono text-[11px] text-[var(--color-text-muted)]">
                        {/* Accent rail on hover — anchored to the row's first cell */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-1 left-0 w-px scale-y-0 bg-[var(--color-accent)] opacity-0 transition-all duration-[200ms] ease-out group-hover/row:scale-y-100 group-hover/row:opacity-100"
                        />
                        <span className="text-[var(--color-text)]">
                          {r.date.toISOString().slice(0, 10)}
                        </span>{' '}
                        <span className="text-[var(--color-text-subtle)]">{time}</span>
                      </td>
                      <td className="px-3 py-2 align-middle font-mono text-[11px] text-[var(--color-text)]">
                        {r.model}
                        {r.costEstimated ? (
                          <span
                            className="ml-1.5 rounded-sm border border-[var(--color-border)] px-1 py-0 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]"
                            title="Cost estimated (model not in official table)"
                          >
                            est
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                        {r.kind}
                      </td>
                      <td
                        className={[
                          'px-3 py-2 text-right align-middle font-mono tabular-nums',
                          costIsHero ? 'text-[12px] font-medium' : 'text-[11px]',
                        ].join(' ')}
                      >
                        <span style={{ color: r.cost > 0 ? 'var(--color-accent)' : 'inherit' }}>
                          {fmtUSD(r.cost)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right align-middle font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
                        {fmtTokens(r.tokens.total)}
                      </td>
                      <td className="px-3 py-2 text-right align-middle font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
                        {totalInput > 0 ? `${(hit * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center align-middle font-mono text-[11px] text-[var(--color-text-muted)]">
                        {r.maxMode ? (
                          <span
                            className="rounded-sm px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em]"
                            style={{
                              background:
                                'color-mix(in oklab, var(--color-accent) 18%, transparent)',
                              color: 'var(--color-accent)',
                              border:
                                '1px solid color-mix(in oklab, var(--color-accent) 32%, transparent)',
                            }}
                          >
                            max
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-2 text-right align-middle">
                        <button
                          type="button"
                          aria-label={`Open Day audit for ${r.date.toISOString().slice(0, 10)}`}
                          title="Open Day audit (g + h)"
                          onClick={() => {
                            if (onJumpToDay) {
                              onJumpToDay(r.date.toISOString().slice(0, 10));
                            } else {
                              window.location.hash = '#day';
                            }
                          }}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-transparent font-mono text-[11px] text-[var(--color-text-subtle)] opacity-0 transition-all duration-150 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:opacity-100 group-hover/row:opacity-100"
                        >
                          →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        <span>
          showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)}{' '}
          of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <PageButton onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage <= 0}>
            ← prev
          </PageButton>
          <span className="text-[var(--color-text-muted)]">
            {safePage + 1} / {totalPages}
          </span>
          <PageButton
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
          >
            next →
          </PageButton>
        </div>
      </div>
    </motion.div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  // Not a real <label> — the inputs nested in `children` are wrapped by the
  // caller, and the `for` attribute would point to nothing useful. Keep this
  // as a presentational stack instead.
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-sm border border-[var(--color-border)] px-2 py-1 transition-colors',
        disabled
          ? 'opacity-40'
          : 'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
