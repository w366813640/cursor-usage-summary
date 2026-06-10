import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Optional className overrides ? used by hero-styled panels. */
  className?: string;
}

/**
 * Card with a display-face title bar + optional right-side action slot.
 *
 * "Linear Glass" treatment: solid graphite surface that *reads* as glass
 * via the `--shadow-glass` inset top highlight + soft drop, a 1px border
 * that brightens on hover, and a small accent dot prefix. Real
 * backdrop-filter is deliberately NOT used here — dozens of panels with
 * live blur would tank scroll performance; the highlight trick gives the
 * same read for free.
 */
export function Panel({ title, subtitle, action, children, className }: PanelProps) {
  return (
    <div
      className={[
        'group relative border border-[var(--color-border)]',
        'bg-[var(--color-surface)]',
        'shadow-[var(--shadow-glass)]',
        'transition-colors duration-[180ms]',
        'hover:border-[var(--color-border-strong)]',
        className ?? '',
      ].join(' ')}
      style={{
        borderRadius: 'var(--cu-density-panel-radius)',
        padding: 'var(--cu-density-panel-padding)',
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-[7px] w-[7px] translate-y-[-2px] rounded-full opacity-90"
              style={{
                background: 'var(--color-accent)',
                boxShadow: '0 0 8px color-mix(in srgb, var(--color-accent) 65%, transparent)',
              }}
            />
            <div className="font-serif text-[17px] font-medium tracking-tight">{title}</div>
          </div>
          {subtitle ? (
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
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
    <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-0.5 font-mono text-[11px] uppercase tracking-[0.08em]">
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
