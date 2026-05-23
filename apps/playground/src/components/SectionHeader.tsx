import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /**
   * When true the header sticks to the top of the viewport while the
   * page scrolls. Designed to be used on the FIRST SectionHeader of a
   * route only — multiple sticky headers in the same scroll container
   * will stack on top of each other and look broken. Off-by-default
   * preserves backwards-compat for the secondary SectionHeader uses
   * inside OverviewActivity / OverviewBurns.
   *
   * The top offset (`top-12`) matches the app header height set in
   * `WelcomePage.tsx > AppShell` (`h-12 = 48px`). If that header ever
   * resizes, update this token in lockstep.
   */
  sticky?: boolean;
}

/**
 * Top-of-section divider used by every dashboard route. Serif title on the
 * left with an accent dot prefix, mono subtitle on the right (because the
 * subtitle usually carries counts / units / data context that should look
 * like metadata, not copy). Below the row sits a hairline accent line that
 * fades out — gives sections a clear "act break" without dominating.
 *
 * Set `sticky` on the first header of a route so users keep the section
 * title + metric toggle in view while scrolling through long lists or
 * tables. Backdrop blur + translucent surface tint avoid the "ghosted
 * text" effect from scroll content bleeding through.
 */
export function SectionHeader({ title, subtitle, action, sticky = false }: SectionHeaderProps) {
  const stickyClasses = sticky
    ? // top-[88px] = 48px (app header) + 40px (FileToolbar sticky strip).
      // Bump z so panel borders / table sticky thead don't fight us. The
      // -mx-1/-px-1 pair pulls the strip flush with the page-top padding
      // so the sticky band visually owns the full content width without
      // creating a fringe gap.
      'sticky top-[88px] z-30 -mx-1 px-1 pt-3 pb-3 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-bg)_70%,transparent)] bg-[var(--color-bg)]'
    : 'pt-2';
  return (
    <div className={`flex flex-col gap-2 ${stickyClasses}`}>
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
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
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
