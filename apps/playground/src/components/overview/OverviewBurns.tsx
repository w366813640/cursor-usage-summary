import { BurnStoryCard, fmtUSD, fmtUSDCompact } from '@cu/charts';
import { type RowWithCost, type Translator, type UsageSummary, translate } from '@cu/data';
import { formatSonnetEquivalence, medianSonnetCost, ratioOver } from '@cu/pricing';
import { useT } from '@cu/ui';
import { m } from 'framer-motion';
import { type RefObject, useMemo, useRef } from 'react';
import { ExportButton } from '../../export/ExportButton';
import { useEntrance } from '../../hooks/useEntranceOnce';
import { SectionHeader } from '../SectionHeader';

interface OverviewBurnsProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  daysSpan: number;
}

/**
 * Act 3 of the Overview — the Top 5 burn stories.
 *
 * Each card is a single, expensive request told as a small narrative:
 * model + date + token mix + a one-sentence caption + a "≈ N regular
 * Sonnet calls" equivalence chip. Median Sonnet cost is computed once
 * across the dataset so the comparison is internally consistent even
 * when the user has only a handful of Sonnet calls.
 */
export function OverviewBurns({ summary, rows, daysSpan }: OverviewBurnsProps) {
  const burnsRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const entrance = useEntrance();

  const top5 = useMemo(() => summary.topBurns.slice(0, 5), [summary.topBurns]);
  const sonnetBaseline = useMemo(() => medianSonnetCost(rows), [rows]);

  // Hottest day, used as a quote in the burns intro paragraph.
  const hottestDay = useMemo(() => {
    const max = summary.byDay.reduce(
      (acc, d) => (d.cost > acc.cost ? d : acc),
      summary.byDay[0] ??
        ({ date: '', cost: 0, rows: 0, requestUnits: 0 } as (typeof summary.byDay)[0]),
    );
    return max;
  }, [summary.byDay]);

  return (
    <m.section
      initial={entrance ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.42, delay: 0.18 }}
      className="flex flex-col gap-4"
    >
      <SectionHeader
        title={t('overview.burns.title')}
        subtitle={
          sonnetBaseline > 0
            ? t('overview.burns.subtitleWithBaseline', { baseline: fmtUSDCompact(sonnetBaseline) })
            : t('overview.burns.subtitleNoBaseline')
        }
        action={
          <ExportButton
            targetRef={burnsRef as RefObject<HTMLDivElement>}
            fileBase="cursor-usage-burns"
          />
        }
      />
      {hottestDay.date
        ? (() => {
            // Translate, then split on placeholders so we can colour the
            // date + cost inline. Keeping the split here (not in the
            // dictionary) means translators only worry about the
            // sentence, not the JSX structure.
            const template = t('overview.burns.hottest', {
              date: '<<DATE>>',
              cost: '<<COST>>',
              rows: hottestDay.rows,
              days: daysSpan,
            });
            const [before, mid, after] = template.split(/<<(?:DATE|COST)>>/);
            return (
              <p className="font-serif text-[15px] italic leading-snug text-[var(--color-text-muted)]">
                {before}
                <span className="text-[var(--color-text)]">{hottestDay.date}</span>
                {mid}
                <span className="text-[var(--color-accent)]">{fmtUSD(hottestDay.cost)}</span>
                {after}
              </p>
            );
          })()
        : null}
      <div
        ref={burnsRef}
        className="grid grid-cols-1 gap-4 bg-[var(--color-bg)] p-2 lg:grid-cols-2 2xl:grid-cols-3"
      >
        {top5.map((r, idx) => {
          const ratio = ratioOver(r.cost, sonnetBaseline);
          const equivalence = formatSonnetEquivalence(ratio);
          const caption = burnCaption({ row: r, t });
          return (
            <BurnStoryCard
              key={`${r.dateISO}-${idx}`}
              rank={idx + 1}
              cost={r.cost}
              model={r.model}
              dateISO={r.dateISO}
              maxMode={r.maxMode}
              costEstimated={r.costEstimated}
              tokens={{
                inputWithoutCacheWrite: r.tokens.inputWithoutCacheWrite,
                inputWithCacheWrite: r.tokens.inputWithCacheWrite,
                cacheRead: r.tokens.cacheRead,
                output: r.tokens.output,
              }}
              equivalence={equivalence}
              caption={caption}
            />
          );
        })}
      </div>
    </m.section>
  );
}

interface BurnCaptionArgs {
  row: RowWithCost;
  /** UI translator threaded through from the parent component. */
  t: Translator;
}

/**
 * One sentence of human-readable colour about *why* the row was expensive.
 *
 * Classifies into five well-known burn categories:
 *
 *   1. Max-mode amplified   — request paid 2× because max-mode was on
 *   2. Output-heavy         — model wrote a lot, output is the cost lever
 *   3. Warm-cache rerun     — long context replayed cheaply
 *   4. Cold-cache build     — first feed of a large context (cache-write)
 *   5. Fresh input-heavy    — no caching, billed at full input rate
 *
 * Max-mode is always called out *first* when it's on, because it's the cost
 * amplifier sitting on top of whichever token bucket dominated — the BurnStoryCard
 * already has a MAX MODE badge, but the caption is where we explain the
 * billing impact rather than just the label.
 *
 * Note: we deliberately don't title-case localised strings — CJK locales
 * don't have a "first letter" concept, and the dictionary entries are
 * already written in their natural sentence case.
 */
function burnCaption({ row, t }: BurnCaptionArgs): string | null {
  const tk = row.tokens;
  const total = tk.inputWithoutCacheWrite + tk.inputWithCacheWrite + tk.cacheRead + tk.output;
  if (total === 0) return null;

  const shareCR = tk.cacheRead / total;
  const shareCW = tk.inputWithCacheWrite / total;
  const shareIn = tk.inputWithoutCacheWrite / total;
  const shareOut = tk.output / total;

  // Pick the dominant bucket. Thresholds tuned so a 40-50% slice already
  // wins (very few requests are perfectly 25/25/25/25).
  let core: string;
  if (shareOut >= 0.5) {
    core = translate(
      t,
      'narrative.burn.outputHeavy',
      'output-heavy · {pct}% generated by the model',
      { pct: (shareOut * 100).toFixed(0) },
    );
  } else if (shareCR >= 0.5) {
    core = translate(
      t,
      'narrative.burn.warmCache',
      'warm-cache rerun · {pct}% replayed from cache',
      { pct: (shareCR * 100).toFixed(0) },
    );
  } else if (shareCW >= 0.4) {
    core = translate(
      t,
      'narrative.burn.coldCache',
      'cold-cache build · {pct}% feeding the cache for the first time',
      { pct: (shareCW * 100).toFixed(0) },
    );
  } else if (shareIn >= 0.4) {
    core = translate(
      t,
      'narrative.burn.freshInput',
      'fresh input-heavy · {pct}% billed at the full input rate',
      { pct: (shareIn * 100).toFixed(0) },
    );
  } else {
    core = translate(t, 'narrative.burn.balanced', 'balanced mix · {tokens}M tokens in one shot', {
      tokens: (total / 1_000_000).toFixed(1),
    });
  }

  if (row.maxMode) {
    return translate(t, 'narrative.burn.maxMode', 'Max-mode 2× billing · {core}', {
      core,
    });
  }
  // Capitalise the first letter only for English — CJK doesn't need it
  // and our localised strings are already sentence-cased. We detect by
  // checking whether the first char is in the ASCII range.
  const first = core[0]!;
  if (first >= 'a' && first <= 'z') return first.toUpperCase() + core.slice(1);
  return core;
}
