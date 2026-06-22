import type {
  ParseAndCostResult,
  ParseWorkerRequest,
  ParseWorkerResponse,
} from './importEngineImpl';
import ParseWorker from './parseWorker?worker';

export type { ParseAndCostResult };

// Singleton worker, spawned lazily and reused across imports so the
// prefetch (idle / dropzone hover) keeps a warm thread ready. If it ever
// fails to load — a sandboxed file:// quirk, an environment without worker
// support — we latch `workerBroken` and every caller transparently falls
// back to a main-thread parse, so import never hard-fails.
let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (result: ParseAndCostResult) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    const spawned = new ParseWorker();
    spawned.onmessage = (event: MessageEvent<ParseWorkerResponse>) => {
      const message = event.data;
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.ok) entry.resolve(message.result);
      else entry.reject(new Error(message.error));
    };
    spawned.onerror = () => {
      // Hard worker failure: latch broken, reject everything in flight (so
      // those callers retry on the main thread), and make getWorker()
      // return null from here on.
      workerBroken = true;
      worker = null;
      for (const entry of pending.values()) entry.reject(new Error('parse worker failed'));
      pending.clear();
    };
    worker = spawned;
    return spawned;
  } catch {
    workerBroken = true;
    return null;
  }
}

/** Warm the parse worker ahead of the first import. Idempotent; never throws. */
export function prefetchImportEngine(): void {
  try {
    getWorker();
  } catch {
    // Ignore — parseAndCostAsync falls back to the main thread on demand.
  }
}

/**
 * Parse + cost a CSV off the main thread. Falls back to a synchronous
 * main-thread parse when the worker is unavailable or errors mid-flight,
 * so a worker problem degrades performance instead of breaking import.
 */
export async function parseAndCostAsync(text: string): Promise<ParseAndCostResult> {
  const active = getWorker();
  if (active) {
    try {
      return await postToWorker(active, text);
    } catch {
      // Fall through to the main-thread path below.
    }
  }
  if (import.meta.env.DEV) {
    console.warn('[cu/import] parse worker unavailable — parsing on the main thread');
  }
  const { parseAndCost } = await import('./importEngineImpl');
  return parseAndCost(text);
}

function postToWorker(active: Worker, text: string): Promise<ParseAndCostResult> {
  return new Promise<ParseAndCostResult>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    active.postMessage({ id, text } satisfies ParseWorkerRequest);
  });
}
