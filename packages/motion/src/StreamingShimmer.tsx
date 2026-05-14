import type { ReactNode } from 'react';

export interface StreamingShimmerProps {
  /** Override the leading icon. */
  icon?: ReactNode;
  /** Width pattern of the skeleton lines. */
  lines?: number;
  /** Tailwind classes for sizing. */
  className?: string;
  /** Show the leading status row. */
  showAvatar?: boolean;
  /** Status text shown next to the icon (default `Analyzing…`). */
  label?: string;
}

/**
 * "Analyzing…" streaming placeholder — used while an agent run is in flight,
 * before any suggestion cards have arrived. Two/three lines of shimmer keep
 * the panel feeling alive without simulating fake content.
 */
export function StreamingShimmer({
  icon,
  lines = 3,
  className,
  showAvatar = true,
  label = 'Analyzing…',
}: StreamingShimmerProps) {
  return (
    <div className={className} role="status" aria-label={label}>
      {showAvatar ? (
        <div className="flex items-center gap-2 mb-3 text-[var(--color-accent)]">
          {icon ?? (
            <span
              className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]"
              style={{ animation: 'shimmer 1.4s linear infinite' }}
              aria-hidden="true"
            />
          )}
          <span className="text-[12px] text-[var(--color-text-muted)]">{label}</span>
        </div>
      ) : null}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => {
          const widthPct = 100 - i * 12;
          return (
            <div
              key={`line-${widthPct}`}
              className="h-3.5 rounded-md"
              style={{
                width: `${widthPct}%`,
                backgroundImage:
                  'linear-gradient(90deg, var(--color-surface-muted) 0%, var(--color-surface-sunken) 50%, var(--color-surface-muted) 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
