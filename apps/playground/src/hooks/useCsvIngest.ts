import { type RowWithCost, type UsageSummary, aggregate, parseUsageCsv } from '@cu/data';
import { costRows } from '@cu/pricing';
import { useCallback, useState } from 'react';
import { clearSession, loadSession, saveSession } from '../storage/persistence';

/**
 * State machine for "user picks a CSV file → we have a UsageSummary".
 *
 * Idle → Parsing → (Success | Error). The previous summary is retained
 * across re-uploads so the UI doesn't blank out while a new file parses.
 */
export type IngestState =
  | { status: 'idle' }
  | { status: 'parsing'; fileName: string }
  | {
      status: 'success';
      fileName: string;
      sourceFiles: string[];
      summary: UsageSummary;
      rows: RowWithCost[];
      rowsSeen: number;
      failures: number;
      elapsedMs: number;
      lastIngestedAt: number;
      /**
       * Diff vs. the previous on-disk snapshot. Populated whenever we
       * successfully merge or replace data and there *was* something stored
       * already. Used by the dashboard to show a "+N rows since last time"
       * banner. `null` on a fresh ingest with empty IDB.
       */
      diff: IngestDiff | null;
    }
  | { status: 'error'; fileName: string; message: string };

/** Summary of what a merge / replace added relative to the stored baseline. */
export interface IngestDiff {
  source: 'append' | 'replace' | 'restore';
  rowsAdded: number;
  costAdded: number;
  /** Milliseconds between the previous persist and this ingest. */
  msSinceLast: number;
  /** Previous totals — used for "before / after" copy. */
  previousRowCount: number;
  previousTotalCost: number;
}

export interface UseCsvIngest {
  state: IngestState;
  /** Accept a `File` from `<input type="file">` or a drag-drop event. Replaces any existing data. */
  ingestFile: (file: File) => Promise<void>;
  /**
   * Merge the contents of another CSV with whatever's already loaded. No-op
   * when there is no current success state (caller should fall back to
   * `ingestFile`).
   */
  appendFile: (file: File) => Promise<void>;
  /** Reset back to idle (kept for cancel/clear buttons in later PRs). */
  reset: () => void;
  /**
   * Try to hydrate from IndexedDB. Returns true if a stored session was
   * restored, false otherwise. Safe to call multiple times.
   */
  hydrateFromStorage: () => Promise<boolean>;
  /** Wipe IDB and return to idle. */
  clearStorage: () => Promise<void>;
}

const MAX_BYTES = 16 * 1024 * 1024;

/**
 * Build a stable per-row key for dedup-on-merge. We deliberately *don't*
 * include the per-CSV `id` (which embeds row number) because the same event
 * exported in two CSVs gets two different row numbers. Instead the key
 * combines the immutable observable fields. Collision-resistant enough to
 * survive overlapping windows from multiple exports of the same workspace.
 */
function dedupeKey(r: RowWithCost): string {
  return [
    r.dateISO,
    r.model,
    r.cloudAgentId,
    r.automationId,
    r.maxMode ? 'Y' : 'N',
    r.tokens.inputWithoutCacheWrite,
    r.tokens.inputWithCacheWrite,
    r.tokens.cacheRead,
    r.tokens.output,
    r.tokens.total,
    r.requests.kind === 'units' ? `u${r.requests.value}` : r.requests.kind,
  ].join('|');
}

function sumCost(rows: ReadonlyArray<RowWithCost>): number {
  let acc = 0;
  for (const r of rows) acc += r.cost;
  return acc;
}

export function useCsvIngest(): UseCsvIngest {
  const [state, setState] = useState<IngestState>({ status: 'idle' });

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const ingestFile = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setState({
        status: 'error',
        fileName: file.name,
        message: `File exceeds the ${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB limit`,
      });
      return;
    }
    setState({ status: 'parsing', fileName: file.name });

    const t0 = performance.now();
    try {
      const text = await file.text();
      const { rows, failures, rowsSeen } = parseUsageCsv(text);
      const costed = costRows(rows);
      const summary = aggregate(costed, { topBurnsCount: 10 });
      const elapsedMs = performance.now() - t0;

      // Build a diff vs. the previously persisted snapshot, if any. We do
      // this *before* overwriting storage so the user sees what changed.
      const prev = await loadSession();
      const lastIngestedAt = Date.now();
      const diff: IngestDiff | null = prev
        ? {
            source: 'replace',
            rowsAdded: Math.max(0, costed.length - prev.rows.length),
            costAdded: Math.max(0, summary.totalCost - sumCost(prev.rows)),
            msSinceLast: lastIngestedAt - prev.lastIngestedAt,
            previousRowCount: prev.rows.length,
            previousTotalCost: sumCost(prev.rows),
          }
        : null;

      setState({
        status: 'success',
        fileName: file.name,
        sourceFiles: [file.name],
        summary,
        rows: costed,
        rowsSeen,
        failures: failures.length,
        elapsedMs,
        lastIngestedAt,
        diff,
      });

      void saveSession({
        rows: costed,
        sourceFiles: [file.name],
        rowsSeen,
        failures: failures.length,
        lastIngestedAt,
      });

      console.groupCollapsed(
        `[cu] ingested ${file.name} · ${rows.length} rows · $${summary.totalCost.toFixed(2)} · ${elapsedMs.toFixed(0)}ms`,
      );
      console.table([
        {
          fileName: file.name,
          rowsSeen,
          rowsParsed: rows.length,
          failures: failures.length,
          totalCost: Number(summary.totalCost.toFixed(2)),
          totalRequestUnits: Number(summary.totalRequestUnits.toFixed(2)),
          totalTokens: summary.totalTokens.total,
          dateRange: `${summary.dateRange.firstISO?.slice(0, 10)} → ${summary.dateRange.lastISO?.slice(0, 10)}`,
          costPartiallyEstimated: summary.costPartiallyEstimated,
          cacheHitRatio: Number((summary.cacheHitStats.hitRatio * 100).toFixed(1)),
        },
      ]);
      console.log('top 10 burns:');
      console.table(
        summary.topBurns.map((r) => ({
          date: r.dateISO,
          model: r.model,
          maxMode: r.maxMode,
          tokensTotal: r.tokens.total,
          cost: Number(r.cost.toFixed(2)),
          estimated: r.costEstimated,
        })),
      );
      console.log('by model (top 10):');
      console.table(
        summary.byModel.slice(0, 10).map((m) => ({
          model: m.model,
          rows: m.rows,
          requestUnits: Number(m.requestUnits.toFixed(2)),
          cost: Number(m.cost.toFixed(2)),
          shareOfCost: `${(m.shareOfCost * 100).toFixed(1)}%`,
          estimated: m.costEstimated,
        })),
      );
      console.groupEnd();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', fileName: file.name, message });
      console.error('[cu] CSV ingest failed:', err);
    }
  }, []);

  const appendFile = useCallback(
    async (file: File) => {
      if (state.status !== 'success') {
        // No prior data — degrade gracefully to a plain ingest. The hook
        // contract above documents this fallback.
        await ingestFile(file);
        return;
      }
      const previous = state;
      if (file.size > MAX_BYTES) {
        setState({
          status: 'error',
          fileName: file.name,
          message: `File exceeds the ${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB limit`,
        });
        return;
      }

      setState({ status: 'parsing', fileName: file.name });

      const t0 = performance.now();
      try {
        const text = await file.text();
        const { rows, failures, rowsSeen } = parseUsageCsv(text);
        const costed = costRows(rows);

        const seen = new Set<string>(previous.rows.map(dedupeKey));
        let added = 0;
        const merged: RowWithCost[] = previous.rows.slice();
        for (const r of costed) {
          const k = dedupeKey(r);
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(r);
          added++;
        }

        // Restore chronological order so all downstream charts stay sane.
        merged.sort((a, b) => a.date.getTime() - b.date.getTime());

        const summary = aggregate(merged, { topBurnsCount: 10 });
        const elapsedMs = performance.now() - t0;
        const prevTotalCost = sumCost(previous.rows);
        const lastIngestedAt = Date.now();
        const diff: IngestDiff = {
          source: 'append',
          rowsAdded: added,
          costAdded: Math.max(0, summary.totalCost - prevTotalCost),
          msSinceLast: lastIngestedAt - previous.lastIngestedAt,
          previousRowCount: previous.rows.length,
          previousTotalCost: prevTotalCost,
        };
        const sourceFiles = [...previous.sourceFiles, file.name];

        setState({
          status: 'success',
          fileName: file.name,
          sourceFiles,
          summary,
          rows: merged,
          rowsSeen: previous.rowsSeen + rowsSeen,
          failures: previous.failures + failures.length,
          elapsedMs,
          lastIngestedAt,
          diff,
        });

        void saveSession({
          rows: merged,
          sourceFiles,
          rowsSeen: previous.rowsSeen + rowsSeen,
          failures: previous.failures + failures.length,
          lastIngestedAt,
        });

        console.groupCollapsed(
          `[cu] merged ${file.name} · +${added} new rows (${rows.length - added} dup) · total ${merged.length} · $${summary.totalCost.toFixed(2)} · ${elapsedMs.toFixed(0)}ms`,
        );
        console.table([
          {
            mergedFromFile: file.name,
            newRowsAdded: added,
            duplicatesDropped: rows.length - added,
            totalRowsNow: merged.length,
            totalCostNow: Number(summary.totalCost.toFixed(2)),
            dateRange: `${summary.dateRange.firstISO?.slice(0, 10)} → ${summary.dateRange.lastISO?.slice(0, 10)}`,
            sourceFiles: [...previous.sourceFiles, file.name].join(', '),
          },
        ]);
        console.groupEnd();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', fileName: file.name, message });
        console.error('[cu] CSV merge failed:', err);
      }
    },
    [state, ingestFile],
  );

  const hydrateFromStorage = useCallback(async () => {
    const stored = await loadSession();
    if (!stored) return false;
    const summary = aggregate(stored.rows, { topBurnsCount: 10 });
    setState({
      status: 'success',
      fileName: stored.sourceFiles[stored.sourceFiles.length - 1] ?? 'restored.csv',
      sourceFiles: stored.sourceFiles,
      summary,
      rows: stored.rows,
      rowsSeen: stored.rowsSeen,
      failures: stored.failures,
      elapsedMs: 0,
      lastIngestedAt: stored.lastIngestedAt,
      diff: {
        source: 'restore',
        rowsAdded: 0,
        costAdded: 0,
        msSinceLast: Date.now() - stored.lastIngestedAt,
        previousRowCount: stored.rows.length,
        previousTotalCost: sumCost(stored.rows),
      },
    });
    console.log(
      `[cu] hydrated stored session · ${stored.rows.length} rows · ${stored.sourceFiles.length} file(s)`,
    );
    return true;
  }, []);

  const clearStorage = useCallback(async () => {
    await clearSession();
    setState({ status: 'idle' });
  }, []);

  return { state, ingestFile, appendFile, reset, hydrateFromStorage, clearStorage };
}
