import { Info } from '@cu/icons';
import { PRICING_TABLE_AS_OF } from '@cu/pricing';
import { Tooltipped, useT } from '@cu/ui';
import type { ReactNode } from 'react';

interface TrustHintProps {
  /** Optional override; defaults to the standard pricing-source line. */
  children?: ReactNode;
  /** When true, append "some rows costed via Auto-pool fallback" warning. */
  partiallyEstimated?: boolean;
  /** "top" / "bottom" / "left" / "right" — defaults to "top". */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Tiny info-dot that explains where a number came from. Wrap any
 * cost / percentage / ratio figure to give users the receipts:
 *
 *   <span>$356 <TrustHint partiallyEstimated={summary.costPartiallyEstimated} /></span>
 *
 * Design notes:
 *   - One canonical sentence keeps the user from learning a new
 *     story per figure. Add per-figure context via the optional
 *     `children` slot only when meaningfully different.
 *   - The icon is `aria-hidden` because the Tooltipped wrapper
 *     handles the screen-reader label.
 *   - Translated via `trust.*` keys (en/zh). The Auto-pool warning
 *     wraps a JSX badge so we split the template around `{badge}`
 *     rather than letting the interpolator stringify it.
 */
export function TrustHint({ children, partiallyEstimated, side = 'top' }: TrustHintProps) {
  const t = useT();
  const estimatedTpl = t('trust.estimated', { badge: '<<BADGE>>' });
  const [estPre, estPost] = estimatedTpl.split('<<BADGE>>');

  const content = (
    <div className="max-w-[260px] space-y-1 text-left text-[11px] leading-relaxed">
      <p>{t('trust.base', { date: PRICING_TABLE_AS_OF })}</p>
      {partiallyEstimated ? (
        <p className="text-[var(--color-accent)]">
          {estPre}
          <span className="mx-1 rounded-sm border border-current px-0.5 font-mono text-[10px]">
            {t('trust.estimatedBadge')}
          </span>
          {estPost}
        </p>
      ) : null}
      {children}
    </div>
  );

  return (
    <Tooltipped label={content} side={side}>
      <button
        type="button"
        aria-label={t('trust.aria')}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[var(--color-text-subtle)] transition-colors hover:text-[var(--color-accent)]"
      >
        <Info size={11} aria-hidden="true" />
      </button>
    </Tooltipped>
  );
}
