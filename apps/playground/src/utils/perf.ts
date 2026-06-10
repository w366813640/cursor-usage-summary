/**
 * Lightweight performance instrumentation (Phase 0 of the perf plan).
 *
 * `perfSpan(name)` opens a span and returns a closer; the closer records a
 * `performance.measure` entry (visible in the DevTools Performance panel
 * under "User Timing") and, in dev builds, logs the duration to console so
 * regressions are visible without opening a profiler.
 *
 * Zero dependencies, no-op safe outside a browser context.
 */

const HAS_PERF = typeof performance !== 'undefined';

/** Open a measurement span. Call the returned function to close + record. */
export function perfSpan(name: string): (extra?: string) => number {
  if (!HAS_PERF) return () => 0;
  const start = performance.now();
  return (extra?: string) => {
    const duration = performance.now() - start;
    try {
      performance.measure(`cu:${name}`, { start, duration });
    } catch {
      // measure() with options requires a recent runtime; ignore failures.
    }
    if (import.meta.env.DEV) {
      console.log(`[cu/perf] ${name} ${duration.toFixed(1)}ms${extra ? ` · ${extra}` : ''}`);
    }
    return duration;
  };
}

/**
 * Dev-only "route switch → painted" reporter. Called from render with the
 * current route; when the route changes it stamps t0 synchronously (so the
 * render phase is included) and reports after the next two animation frames
 * (i.e. once the new route has actually painted).
 */
export function reportRoutePaint(route: string, lastRouteRef: { current: string | null }): void {
  if (!HAS_PERF || !import.meta.env.DEV) return;
  if (lastRouteRef.current === route) return;
  const from = lastRouteRef.current;
  lastRouteRef.current = route;
  if (from === null) return; // initial mount is covered by the hydrate span
  const end = perfSpan(`route ${from}→${route}`);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      end('painted');
    });
  });
}
