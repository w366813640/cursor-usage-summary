import {
  type ParseWorkerRequest,
  type ParseWorkerResponse,
  parseAndCost,
} from './importEngineImpl';

/**
 * Dedicated worker that runs the CSV parse + cost pipeline off the main
 * thread, so importing a large export never freezes the UI.
 *
 * `self` is typed by hand (a minimal shape) rather than via the WebWorker
 * lib, which would collide with the DOM lib the rest of the app compiles
 * against. Costed rows carry `Date` objects; those survive structured
 * clone, so the main thread receives the exact shape a main-thread parse
 * would have produced.
 */
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<ParseWorkerRequest>) => void) | null;
  postMessage: (message: ParseWorkerResponse) => void;
};

ctx.onmessage = (event) => {
  const { id, text } = event.data;
  try {
    ctx.postMessage({ id, ok: true, result: parseAndCost(text) });
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
