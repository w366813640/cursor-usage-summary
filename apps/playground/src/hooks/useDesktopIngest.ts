import type { RowWithCost, UsageSummary } from '@cu/data';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  commitImport,
  getCounts,
  listBatches,
  loadSummaryCosted,
  previewImport,
  sha256File,
  undoBatch,
} from '../electron/desktopStorage';
import type { BatchSummary, PreviewResult } from '../electron/types';
import { perfSpan } from '../utils/perf';

/**
 * Desktop ingest state machine — the sole renderer-side data path
 * after PR20 retired the web (IndexedDB) variant.
 *
 * State machine:
 *
 *   idle
 *     ↳ parsing(file)
 *         ↳ preview(result)              ← user reviews drawer
 *             ↳ committing
 *                 ↳ success | error
 *             ↳ idle (cancelled)
 *         ↳ error
 *     ↳ success / hydrating-from-db
 */

const MAX_BYTES = 16 * 1024 * 1024;

// The CSV parse + cost pipeline (papaparse + the full pricing table) is the
// heaviest renderer-only dependency, but it's never needed to paint the
// upload hero or hydrate an existing DB. Load it behind a dynamic import so
// it stays off the first-paint chunk; `import()` is idempotent, so the
// prefetch below and the real call in `startImport` share one fetch.
const loadImportEngine = () => import('../import/importEngine');

/**
 * Warm the import-engine chunk ahead of an actual import. Safe to call
 * repeatedly (idle prefetch, dropzone hover, etc.) — failures are
 * swallowed so a flaky prefetch never surfaces as an unhandled rejection;
 * the real `startImport` call retries and reports any error.
 */
export function prefetchImportEngine(): void {
  void loadImportEngine().catch(() => {});
}

export type DesktopIngestState =
  | { status: 'idle' }
  | { status: 'parsing'; fileName: string }
  | {
      status: 'preview';
      fileName: string;
      file: File;
      rows: RowWithCost[];
      rowsSeen: number;
      failures: number;
      fileSha256: string;
      preview: PreviewResult;
    }
  | { status: 'committing'; fileName: string }
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
      lastImportAddedRows: number | null;
      lastImportSkippedRows: number | null;
    }
  | { status: 'error'; fileName: string; message: string };

export interface UseDesktopIngest {
  state: DesktopIngestState;
  /**
   * Start the import flow for a chosen / dropped file. Parses the CSV,
   * hashes its bytes, runs `previewImport`, and transitions the state
   * to `preview` so the caller can pop a confirmation drawer. Does
   * not write anything to disk.
   */
  startImport: (file: File) => Promise<void>;
  /**
   * Commit the previously-previewed import. No-op if state isn't `preview`.
   * After a successful commit we re-load *all* rows from the DB and
   * re-aggregate so the dashboard reflects every batch on disk, not
   * just the most recent file.
   */
  confirmImport: () => Promise<void>;
  /** Discard the previewed import and return to the previous state. */
  cancelImport: () => void;
  /** Force a refresh of rows + summary from the database. */
  refresh: () => Promise<void>;
  /**
   * Try to hydrate from the database. Resolves to `true` if any rows
   * were loaded, `false` otherwise (DB empty → caller should keep
   * showing the welcome page).
   */
  hydrateFromDb: () => Promise<boolean>;
  /** Reset back to idle without touching the database. */
  reset: () => void;
  /** Listing for the History panel. */
  loadBatches: () => Promise<BatchSummary[]>;
  /** Undo a specific import batch; refreshes summary on success. */
  undoBatchById: (id: number) => Promise<{ removedRows: number }>;
}

function nowMs(): number {
  return Date.now();
}

export function useDesktopIngest(): UseDesktopIngest {
  const [state, setState] = useState<DesktopIngestState>({ status: 'idle' });
  // Mirror `state` into a ref so callbacks can read the latest snapshot
  // synchronously without forming stale closures over `state`.
  const stateRef = useRef<DesktopIngestState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  /**
   * Pulls every row + the main-process aggregate out of the DB in one
   * IPC call and rebuilds a `success` state. Returns `false` when the
   * DB is empty so the welcome page knows to stay open.
   */
  const hydrateFromDb = useCallback(async () => {
    try {
      const endTotal = perfSpan('hydrateFromDb');
      const counts = await getCounts();
      if (counts.rowCount === 0) {
        setState({ status: 'idle' });
        return false;
      }
      // Single IPC round-trip: rows + summary aggregated in the main
      // process, so this thread never runs the O(rows) summarization.
      const endLoad = perfSpan('hydrate.summaryCosted');
      const { rows, summary } = await loadSummaryCosted();
      endLoad(`${rows.length} rows`);
      const batches = await listBatches();
      const sourceFiles = batches.map((b) => b.sourceFilename);
      const lastBatch = batches[0] ?? null;
      setState({
        status: 'success',
        fileName: lastBatch?.sourceFilename ?? 'cursor-usage.db',
        sourceFiles,
        summary,
        rows,
        rowsSeen: counts.rowCount,
        failures: 0,
        elapsedMs: 0,
        lastIngestedAt: lastBatch?.importedAt ?? nowMs(),
        lastImportAddedRows: lastBatch?.rowCountAdded ?? null,
        lastImportSkippedRows: lastBatch?.rowCountSkipped ?? null,
      });
      endTotal(`${rows.length} rows`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', fileName: 'cursor-usage.db', message });
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    await hydrateFromDb();
  }, [hydrateFromDb]);

  const startImport = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setState({
        status: 'error',
        fileName: file.name,
        message: `File exceeds the ${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB limit`,
      });
      return;
    }

    setState({ status: 'parsing', fileName: file.name });

    try {
      const text = await file.text();
      // Parse + cost in the lazily-loaded engine chunk (papaparse + pricing).
      const { parseAndCost } = await loadImportEngine();
      const { rows: costed, failures, rowsSeen } = parseAndCost(text);
      const fileSha256 = await sha256File(file);
      const preview = await previewImport(costed, {
        filename: file.name,
        fileSha256,
      });
      setState({
        status: 'preview',
        fileName: file.name,
        file,
        rows: costed,
        rowsSeen,
        failures,
        fileSha256,
        preview,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', fileName: file.name, message });
    }
  }, []);

  /**
   * Commit the previewed import. We read the latest snapshot from the
   * mirrored ref so the import always uses the rows + sha the user
   * actually saw in the drawer, even if React has queued updates.
   */
  const confirmImport = useCallback(async () => {
    const snapshot = stateRef.current;
    if (snapshot.status !== 'preview') return;
    const pre = snapshot;
    const t0 = performance.now();
    setState({ status: 'committing', fileName: pre.fileName });
    try {
      await commitImport(pre.rows, {
        filename: pre.fileName,
        fileSha256: pre.fileSha256,
      });

      // After commit, re-pull the whole row set so the dashboard reflects
      // every batch on disk (not just this file). Aggregation happens
      // main-side in the same IPC call.
      const { rows: allRows, summary } = await loadSummaryCosted();
      const batches = await listBatches();
      const sourceFiles = batches.map((b) => b.sourceFilename);
      const lastBatch = batches[0] ?? null;
      const elapsedMs = performance.now() - t0;

      setState({
        status: 'success',
        fileName: pre.fileName,
        sourceFiles,
        summary,
        rows: allRows,
        rowsSeen: pre.rowsSeen,
        failures: pre.failures,
        elapsedMs,
        lastIngestedAt: lastBatch?.importedAt ?? nowMs(),
        lastImportAddedRows: lastBatch?.rowCountAdded ?? null,
        lastImportSkippedRows: lastBatch?.rowCountSkipped ?? null,
      });

      console.log(
        `[cu/desktop] imported ${pre.fileName} · +${pre.preview.wouldAdd} new / ${pre.preview.wouldSkip} skipped · total ${allRows.length} · $${summary.totalCost.toFixed(2)} · ${elapsedMs.toFixed(0)}ms`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', fileName: pre.fileName, message });
    }
  }, []);

  const cancelImport = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'preview' && prev.status !== 'committing') return prev;
      return { status: 'idle' };
    });
  }, []);

  const loadBatches = useCallback(async () => {
    return listBatches();
  }, []);

  const undoBatchById = useCallback(
    async (id: number) => {
      const out = await undoBatch(id);
      await hydrateFromDb();
      return out;
    },
    [hydrateFromDb],
  );

  return {
    state,
    startImport,
    confirmImport,
    cancelImport,
    refresh,
    hydrateFromDb,
    reset,
    loadBatches,
    undoBatchById,
  };
}
