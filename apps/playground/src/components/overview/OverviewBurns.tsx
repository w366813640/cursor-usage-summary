import { BurnStoryCard, fmtUSD, fmtUSDCompact } from '@cu/charts';
import type { RowWithCost, UsageSummary } from '@cu/data';
import { formatSonnetEquivalence, medianSonnetCost, ratioOver } from '@cu/pricing';
import { motion } from 'framer-motion';
import { type RefObject, useMemo, useRef } from 'react';
import { ExportButton } from '../../export/ExportButton';
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
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.42, delay: 0.18 }}
      className="flex flex-col gap-4"
    >
      <SectionHeader
        title="Top 5 burns"
        subtitle={
          sonnetBaseline > 0
            ? `Each request ≈ N regular Sonnet calls · baseline ${fmtUSDCompact(sonnetBaseline)} / call (median Sonnet in this dataset)`
            : 'No Sonnet baseline in this dataset'
        }
        action={
          <ExportButton
            targetRef={burnsRef as RefObject<HTMLDivElement>}
            fileBase="cursor-usage-burns"
          />
        }
      />
      {hottestDay.date ? (
        <p className="font-serif text-[15px] italic leading-snug text-[var(--color-text-muted)]">
          The hottest day was <span className="text-[var(--color-text)]">{hottestDay.date}</span> —
          burned <span className="text-[var(--color-accent)]">{fmtUSD(hottestDay.cost)}</span>{' '}
          across {hottestDay.rows} rows. Below are the five single requests that cost the most in
          the past {daysSpan} days — each one tells its own token-mix story.
        </p>
      ) : null}
      <div
        ref={burnsRef}
        className="grid grid-cols-1 gap-4 bg-[var(--color-bg)] p-2 lg:grid-cols-2 2xl:grid-cols-3"
      >
        {top5.map((r, idx) => {
          const ratio = ratioOver(r.cost, sonnetBaseline);
          const equivalence = formatSonnetEquivalence(ratio);
          const caption = burnCaption({ row: r });
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
    </motion.section>
  );
}

interface BurnCaptionArgs {
  row: RowWithCost;
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
 */
function burnCaption({ row }: BurnCaptionArgs): string | null {
  const t = row.tokens;
  const total = t.inputWithoutCacheWrite + t.inputWithCacheWrite + t.cacheRead + t.output;
  if (total === 0) return null;

  const shareCR = t.cacheRead / total;
  const shareCW = t.inputWithCacheWrite / total;
  const shareIn = t.inputWithoutCacheWrite / total;
  const shareOut = t.output / total;

  // Pick the dominant bucket. Thresholds tuned so a 40-50% slice already
  // wins (very few requests are perfectly 25/25/25/25).
  let core: string;
  if (shareOut >= 0.5) {
    core = `output-heavy · ${(shareOut * 100).toFixed(0)}% generated by the model`;
  } else if (shareCR >= 0.5) {
    core = `warm-cache rerun · ${(shareCR * 100).toFixed(0)}% replayed from cache`;
  } else if (shareCW >= 0.4) {
    core = `cold-cache build · ${(shareCW * 100).toFixed(0)}% feeding the cache for the first time`;
  } else if (shareIn >= 0.4) {
    core = `fresh input-heavy · ${(shareIn * 100).toFixed(0)}% billed at the full input rate`;
  } else {
    core = `balanced mix · ${(total / 1_000_000).toFixed(1)}M tokens in one shot`;
  }

  if (row.maxMode) {
    return `Max-mode 2× billing · ${core}`;
  }
  // Capitalise the first letter for non-max-mode cases so the sentence reads
  // cleanly without the "Max-mode" prefix doing the heavy lifting.
  return core[0]!.toUpperCase() + core.slice(1);
}
