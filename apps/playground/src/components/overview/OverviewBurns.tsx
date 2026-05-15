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
 * One sentence of human-readable colour about the dominant token bucket — kept
 * deliberately separate from the Sonnet equivalence chip above so the caption
 * adds information instead of restating it.
 */
function burnCaption({ row }: BurnCaptionArgs): string | null {
  const t = row.tokens;
  const total = t.inputWithoutCacheWrite + t.inputWithCacheWrite + t.cacheRead + t.output;
  if (total === 0) return null;

  const shareCR = t.cacheRead / total;
  const shareCW = t.inputWithCacheWrite / total;
  const shareIn = t.inputWithoutCacheWrite / total;
  const shareOut = t.output / total;

  // The single biggest contributor drives the caption — that's the story.
  const entries: Array<[number, string]> = [
    [shareCR, `${(shareCR * 100).toFixed(0)}% in cache-read — long context replayed`],
    [shareCW, `${(shareCW * 100).toFixed(0)}% in cache-write — first feed of a large context`],
    [shareOut, `${(shareOut * 100).toFixed(0)}% as output — model wrote a lot`],
    [shareIn, `${(shareIn * 100).toFixed(0)}% as fresh input — billed at full rate`],
  ];
  entries.sort((a, b) => b[0] - a[0]);
  const winner = entries[0];
  if (!winner || winner[0] < 0.4) {
    return `${(total / 1_000_000).toFixed(1)}M tokens in one shot — well-balanced mix`;
  }
  return winner[1];
}
