import { toPng } from 'html-to-image';

/** Snapshot configuration shared by all "Export PNG" actions. */
interface ExportOptions {
  /** Filename without extension. We always append `.png`. */
  baseName: string;
  /**
   * Devicepixel multiplier. Default 2x produces a crisp result for retina
   * displays without ballooning the file too much.
   */
  pixelRatio?: number;
  /** CSS color (or `transparent`). Default = `var(--color-bg)` resolved at runtime. */
  backgroundColor?: string;
}

/**
 * Capture a DOM node as a PNG and trigger a browser download.
 *
 * `html-to-image` walks the node, inlines computed styles, and renders to
 * canvas. We resolve the page's resolved `--color-bg` so screenshots match
 * the user's current theme instead of defaulting to white.
 *
 * Errors are surfaced via the returned `result.error` so the caller can show
 * a toast / inline message without an uncaught console rejection.
 */
export async function exportNodeToPng(
  node: HTMLElement,
  options: ExportOptions,
): Promise<{ ok: true } | { ok: false; error: Error }> {
  try {
    const resolvedBg = readResolvedColor(node, '--color-bg', '#0e0d0c');
    const dataUrl = await toPng(node, {
      pixelRatio: options.pixelRatio ?? 2,
      backgroundColor: options.backgroundColor ?? resolvedBg,
      cacheBust: true,
      // We deliberately keep external fonts (Source Serif 4 / Inter / JetBrains
      // Mono via @fontsource) — they're already loaded by the page so the
      // capture inherits them.
      style: { fontDisplay: 'block' } as Partial<CSSStyleDeclaration>,
    });
    triggerDownload(dataUrl, `${options.baseName}.png`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Resolve a CSS custom property at the given node, falling back to a
 * literal default when the variable isn't defined / is whitespace.
 */
function readResolvedColor(node: HTMLElement, variable: string, fallback: string): string {
  const cs = getComputedStyle(node);
  const v = cs.getPropertyValue(variable).trim();
  return v.length > 0 ? v : fallback;
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
