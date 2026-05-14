import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Optional className overrides — used by hero-styled panels. */
  className?: string;
}

/**
 * Card with a serif title bar + optional right-side action slot.
 *
 * The visual treatment is intentionally restrained: a soft border, a faint
 * inner top highlight (so the card reads as a "raised slab" in dark mode),
 * and a small dot prefix before the title that picks up the active brand
 * accent. Hover bumps the border to the stronger token — a Bloomberg-style
 * "this is interactive" cue without going full glow.
 */
export function Panel({ title, subtitle, action, children, className }: PanelProps) {
  return (
    <div
      className={[
        'group relative rounded-[14px] border border-[var(--color-border)]',
        'bg-[var(--color-surface)] p-5',
        'shadow-[0_1px_0_color-mix(in_oklab,var(--color-text)_3%,transparent)_inset,0_8px_20px_-18px_rgba(0,0,0,0.45)]',
        'transition-colors duration-[180ms]',
        'hover:border-[var(--color-border-strong)]',
        className ?? '',
      ].join(' ')}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-[6px] w-[6px] translate-y-[-2px] rounded-full opacity-70"
              style={{ background: 'var(--color-accent)' }}
            />
            <div className="font-serif text-[16px] tracking-tight">{title}</div>
          </div>
          {subtitle ? (
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              {subtitle}
            </div>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

interface MetricToggleProps<T extends string> {
  value: T;
  options: ReadonlyArray<T>;
  onChange: (v: T) => void;
}

/**
 * Small segmented control. Generic so it can drive any kind of metric tab.
 * Active pill uses the brand accent; inactive uses the muted text token so
 * the eye is pulled to the current selection without bright noise.
 */
export function MetricToggle<T extends string>({ value, options, onChange }: MetricToggleProps<T>) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-0.5 font-mono text-[10px] uppercase tracking-[0.08em]">
      {options.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={[
            'rounded-sm px-2 py-0.5 transition-colors',
            value === m
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] shadow-[0_1px_0_color-mix(in_oklab,var(--color-bg)_18%,transparent)_inset]'
              : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
