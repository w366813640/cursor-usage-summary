import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/**
 * Top-of-section divider used by every dashboard route. Serif title on the
 * left with an accent dot prefix, mono subtitle on the right (because the
 * subtitle usually carries counts / units / data context that should look
 * like metadata, not copy). Below the row sits a hairline accent line that
 * fades out — gives sections a clear "act break" without dominating.
 */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-baseline gap-2 font-serif text-[24px] tracking-tight">
          <span
            aria-hidden="true"
            className="inline-block h-[10px] w-[10px] translate-y-[-2px] rounded-full"
            style={{ background: 'var(--color-accent)' }}
          />
          {title}
        </h2>
        <div className="flex items-baseline gap-3">
          {subtitle ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              {subtitle}
            </span>
          ) : null}
          {action}
        </div>
      </div>
      <div
        className="h-px w-full"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in oklab, var(--color-accent) 38%, transparent) 0%, var(--color-border) 22%, transparent 88%)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
