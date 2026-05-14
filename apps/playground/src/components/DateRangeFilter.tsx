import type { RowWithCost } from '@cu/data';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

/**
 * A date-shaped filter used by the Hours page (and re-usable elsewhere).
 *
 * `single`, `multi`, and `range` all index by ISO date strings (`YYYY-MM-DD`,
 * UTC), matching `UsageRow.dateISO` so we never have to deal with timezone
 * drift inside the filter.
 */
export type DateFilter =
  | { kind: 'all' }
  | { kind: 'single'; date: string }
  | { kind: 'multi'; dates: ReadonlyArray<string> }
  | { kind: 'range'; start: string; end: string };

interface DateRangeFilterProps {
  rows: ReadonlyArray<RowWithCost>;
  value: DateFilter;
  onChange: (next: DateFilter) => void;
}

/**
 * Calendar-style filter for the Hours page.
 *
 * Interaction model — designed to stay one-click for the common case:
 *
 *   - Click a day                 → select that single day
 *   - Click another day after that → form a range between the two
 *   - Click inside the range      → reset to a single day (avoids confusion)
 *   - Cmd/Ctrl-click              → toggle multi-day selection
 *   - Quick presets (7d / 30d / month / all) live above the grid
 *
 * Days with no data are dimmed but still clickable, so the user can verify
 * "yep, that day really was empty". The active selection is reflected in the
 * subtitle summary plus highlighted cells so the user always sees both
 * "what's selected" and "what data exists".
 */
export function DateRangeFilter({ rows, value, onChange }: DateRangeFilterProps) {
  const { dataDays, minISO, maxISO } = useMemo(() => buildDayIndex(rows), [rows]);

  // The month currently rendered in the picker. Defaults to the month of the
  // most recent data day so the user always sees something useful first.
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    if (maxISO) {
      const [y, m] = maxISO.split('-').map(Number) as [number, number];
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });

  // We track the "anchor" click so a subsequent click forms a range.
  const [anchor, setAnchor] = useState<string | null>(null);

  const monthDays = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  function handleDayClick(iso: string, event: React.MouseEvent) {
    const multiKey = event.metaKey || event.ctrlKey;
    if (multiKey) {
      // Toggle add/remove for multi-select.
      const existing =
        value.kind === 'multi' ? new Set(value.dates) : new Set<string>(singletonsOf(value));
      if (existing.has(iso)) existing.delete(iso);
      else existing.add(iso);
      const next = Array.from(existing).sort();
      if (next.length === 0) onChange({ kind: 'all' });
      else if (next.length === 1) onChange({ kind: 'single', date: next[0]! });
      else onChange({ kind: 'multi', dates: next });
      setAnchor(iso);
      return;
    }

    // Plain click — single-day or extend-to-range from anchor.
    if (anchor && anchor !== iso) {
      const [start, end] = anchor < iso ? [anchor, iso] : [iso, anchor];
      onChange({ kind: 'range', start, end });
      setAnchor(null);
      return;
    }
    onChange({ kind: 'single', date: iso });
    setAnchor(iso);
  }

  function applyPreset(preset: 'all' | 'last7' | 'last30' | 'thisMonth') {
    if (preset === 'all') {
      onChange({ kind: 'all' });
      setAnchor(null);
      return;
    }
    if (!maxISO) return;
    const max = new Date(`${maxISO}T00:00:00Z`);
    if (preset === 'last7' || preset === 'last30') {
      const span = preset === 'last7' ? 6 : 29;
      const start = new Date(max);
      start.setUTCDate(start.getUTCDate() - span);
      onChange({ kind: 'range', start: toISO(start), end: maxISO });
    } else {
      // this month — relative to the most recent data point.
      const y = max.getUTCFullYear();
      const m = max.getUTCMonth();
      const start = new Date(Date.UTC(y, m, 1));
      const end = new Date(Date.UTC(y, m + 1, 0));
      onChange({
        kind: 'range',
        start: toISO(start),
        end: toISO(end),
      });
      setCursor({ year: y, month: m });
    }
    setAnchor(null);
  }

  const selectionSummary = describeSelection(value);
  const monthLabel = formatMonthLabel(cursor.year, cursor.month);
  // Count of "data days" within the visible month — drives a small badge so the
  // user knows whether this month has anything to look at.
  const visibleDataDays = useMemo(() => {
    let c = 0;
    for (const d of monthDays) {
      if (d && dataDays.has(d.iso)) c++;
    }
    return c;
  }, [monthDays, dataDays]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-text)_3%,transparent),0_8px_24px_-22px_rgba(0,0,0,0.45)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ background: 'var(--color-accent)' }}
          />
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
              Date filter
            </span>
            <span className="font-serif text-[16px] leading-tight text-[var(--color-text)]">
              {selectionSummary}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 font-mono text-[10px] uppercase tracking-[0.08em] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-text)_2%,transparent)]">
          <PresetButton active={value.kind === 'all'} onClick={() => applyPreset('all')}>
            All
          </PresetButton>
          <PresetButton onClick={() => applyPreset('last7')}>Last 7d</PresetButton>
          <PresetButton onClick={() => applyPreset('last30')}>Last 30d</PresetButton>
          <PresetButton onClick={() => applyPreset('thisMonth')}>This month</PresetButton>
        </div>
      </header>

      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-6">
        <div className="lg:w-[320px]">
          <div className="flex items-center justify-between font-mono text-[11px] text-[var(--color-text-muted)]">
            <button
              type="button"
              onClick={() =>
                setCursor((c) =>
                  c.month === 0
                    ? { year: c.year - 1, month: 11 }
                    : { year: c.year, month: c.month - 1 },
                )
              }
              className="rounded-sm border border-transparent px-2 py-0.5 hover:border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]"
              aria-label="Previous month"
            >
              ←
            </button>
            <span className="flex items-baseline gap-1.5">
              <span className="font-serif text-[14px] text-[var(--color-text)]">{monthLabel}</span>
              {visibleDataDays > 0 ? (
                <span
                  className="rounded-sm px-1 py-px font-mono text-[8px] uppercase tracking-[0.1em]"
                  style={{
                    background: 'color-mix(in oklab, var(--color-accent) 14%, transparent)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {visibleDataDays}d
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() =>
                setCursor((c) =>
                  c.month === 11
                    ? { year: c.year + 1, month: 0 }
                    : { year: c.year, month: c.month + 1 },
                )
              }
              className="rounded-sm border border-transparent px-2 py-0.5 hover:border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]"
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            {/* Fixed Sun→Sat header — using slot identifiers so keys stay stable across re-renders. */}
            {(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map((slot, idx) => (
              <span key={slot} className="text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'][idx]}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthDays.map((d, i) => {
              // Each slot in the 6×7 calendar grid is stable by index inside a
              // given month. The slot index is also semantic (slot 0 = top-left)
              // so this isn't a "moving target" key — biome's array-index rule
              // doesn't really apply here.
              if (!d) return <span key={`empty-slot-${cursor.year}-${cursor.month}-${i}`} />;
              const hasData = dataDays.has(d.iso);
              const selected = isSelected(value, d.iso);
              const inRange = value.kind === 'range' && d.iso >= value.start && d.iso <= value.end;
              const isToday = d.iso === today;
              const isEdge =
                value.kind === 'range' && (d.iso === value.start || d.iso === value.end);
              return (
                <motion.button
                  type="button"
                  key={d.iso}
                  onClick={(e) => handleDayClick(d.iso, e)}
                  whileTap={{ scale: 0.92 }}
                  className={[
                    'relative aspect-square rounded-sm font-mono text-[11px] transition-all duration-[140ms]',
                    'border',
                    selected
                      ? 'border-[var(--color-accent)] font-semibold text-[var(--color-bg)] shadow-[0_4px_12px_-6px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]'
                      : inRange
                        ? 'border-[color:color-mix(in_oklab,var(--color-accent)_50%,transparent)] text-[var(--color-text)]'
                        : hasData
                          ? 'border-[var(--color-border)] text-[var(--color-text)] hover:border-[color:color-mix(in_oklab,var(--color-accent)_60%,transparent)] hover:bg-[var(--color-surface-raised)]'
                          : 'border-transparent text-[var(--color-text-subtle)] hover:border-[var(--color-border)]',
                    isToday && !selected
                      ? 'ring-1 ring-[color:color-mix(in_oklab,var(--color-text-muted)_50%,transparent)] ring-offset-1 ring-offset-[var(--color-surface)]'
                      : '',
                  ].join(' ')}
                  style={{
                    background: selected
                      ? 'var(--color-accent)'
                      : inRange
                        ? 'color-mix(in oklab, var(--color-accent) 18%, transparent)'
                        : hasData
                          ? 'var(--color-surface-raised)'
                          : 'transparent',
                  }}
                  title={
                    hasData
                      ? `${d.iso} · click to select, ⌘/Ctrl-click for multi${isToday ? ' · today' : ''}`
                      : `${d.iso}${isToday ? ' · today' : ''} · no data`
                  }
                >
                  {d.day}
                  {/* Range edges get a slightly bigger dot so start/end stand out from inner range days */}
                  {hasData && !selected ? (
                    <span
                      className={[
                        'absolute left-1/2 -translate-x-1/2 rounded-full',
                        isEdge ? 'bottom-[2px] h-[4px] w-[4px]' : 'bottom-[3px] h-[3px] w-[3px]',
                      ].join(' ')}
                      style={{ background: 'var(--color-accent)' }}
                    />
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          <p className="text-[11px] normal-case tracking-normal text-[var(--color-text-muted)]">
            Click a day to focus on it. Click a second day to form a range. ⌘ / Ctrl-click to toggle
            multiple days.
          </p>
          <ul className="flex flex-col gap-1">
            <li>
              · Data range:{' '}
              <span className="text-[var(--color-text)]">
                {minISO && maxISO ? `${minISO} → ${maxISO}` : 'no data'}
              </span>
            </li>
            <li>
              · Days with data: <span className="text-[var(--color-text)]">{dataDays.size}</span>
            </li>
            <li>
              · Selection: <span className="text-[var(--color-text)]">{selectionSummary}</span>
            </li>
          </ul>
          {value.kind !== 'all' ? (
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className="self-start rounded-sm border border-[var(--color-border)] px-2 py-1 uppercase tracking-[0.08em] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
            >
              Clear selection
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Apply a `DateFilter` to a row stream. Row order is preserved — callers can
 * still rely on the original sort. Date comparisons happen on the date-only
 * prefix of `RowWithCost.dateISO` (which is otherwise a full timestamp).
 */
export function applyDateFilter(
  rows: ReadonlyArray<RowWithCost>,
  filter: DateFilter,
): RowWithCost[] {
  if (filter.kind === 'all') return rows.slice();
  if (filter.kind === 'single') {
    return rows.filter((r) => r.dateISO.slice(0, 10) === filter.date);
  }
  if (filter.kind === 'multi') {
    const set = new Set(filter.dates);
    return rows.filter((r) => set.has(r.dateISO.slice(0, 10)));
  }
  return rows.filter((r) => {
    const k = r.dateISO.slice(0, 10);
    return k >= filter.start && k <= filter.end;
  });
}

function PresetButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-sm px-2 py-1 transition-all duration-[160ms]',
        active
          ? 'bg-[var(--color-surface-raised)] text-[var(--color-accent)] shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--color-accent)_60%,transparent)]'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]/60 hover:text-[var(--color-text)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function buildDayIndex(rows: ReadonlyArray<RowWithCost>): {
  dataDays: Set<string>;
  minISO: string | null;
  maxISO: string | null;
} {
  // `RowWithCost.dateISO` is a full ISO 8601 timestamp (yyyy-mm-ddThh:mm…),
  // not a date-only string. Slice the date portion so day-indexed filters
  // and the calendar grid can match against `YYYY-MM-DD` keys.
  const dataDays = new Set<string>();
  let minISO: string | null = null;
  let maxISO: string | null = null;
  for (const r of rows) {
    const dayKey = r.dateISO.slice(0, 10);
    dataDays.add(dayKey);
    if (!minISO || dayKey < minISO) minISO = dayKey;
    if (!maxISO || dayKey > maxISO) maxISO = dayKey;
  }
  return { dataDays, minISO, maxISO };
}

function buildMonthGrid(year: number, month: number): Array<{ iso: string; day: number } | null> {
  // Compose a 6-row x 7-col grid that starts on Sunday. Empty slots are nulls
  // so we don't accidentally collide with adjacent months.
  const first = new Date(Date.UTC(year, month, 1));
  const lead = first.getUTCDay();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(Date.UTC(year, month, d));
    cells.push({ iso: toISO(date), day: d });
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}

function isSelected(filter: DateFilter, iso: string): boolean {
  if (filter.kind === 'all') return false;
  if (filter.kind === 'single') return filter.date === iso;
  if (filter.kind === 'multi') return filter.dates.includes(iso);
  return iso === filter.start || iso === filter.end;
}

function singletonsOf(filter: DateFilter): string[] {
  if (filter.kind === 'single') return [filter.date];
  if (filter.kind === 'range') return [filter.start, filter.end];
  return [];
}

function describeSelection(filter: DateFilter): string {
  if (filter.kind === 'all') return 'All days';
  if (filter.kind === 'single') return filter.date;
  if (filter.kind === 'multi') return `${filter.dates.length} days`;
  if (filter.start === filter.end) return filter.start;
  return `${filter.start} → ${filter.end}`;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 1));
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
