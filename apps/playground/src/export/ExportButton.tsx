import { Check, Download, Loader2 } from '@cu/icons';
import { useCallback, useRef, useState } from 'react';
import { exportNodeToPng } from './exportNode';

interface ExportButtonProps {
  /**
   * The DOM node to snapshot. Use a `useRef<HTMLElement>` whose `.current`
   * is the wrapper around the section you want to export. Passed as a ref so
   * the button doesn't need to know the exact node ahead of time.
   */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Filename slug (no extension). Defaults to `cursor-usage-snapshot`. */
  fileBase?: string;
  label?: string;
  className?: string;
}

/**
 * Small button that captures the referenced DOM node as a PNG and downloads
 * it. Lives in its own component because the same affordance is reused on
 * the heatmap panel, the burn-story strip, and individual burn cards.
 */
export function ExportButton({
  targetRef,
  fileBase = 'cursor-usage-snapshot',
  label = 'Export PNG',
  className,
}: ExportButtonProps) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const errorMsgRef = useRef<string>('');

  const onClick = useCallback(async () => {
    if (state === 'busy') return;
    const node = targetRef.current;
    if (!node) {
      setState('error');
      errorMsgRef.current = 'Could not find the section to export.';
      return;
    }
    setState('busy');
    const result = await exportNodeToPng(node, {
      baseName: `${fileBase}-${dateSlug()}`,
    });
    if (result.ok) {
      setState('ok');
      setTimeout(() => setState('idle'), 1400);
    } else {
      errorMsgRef.current = result.error.message;
      setState('error');
      setTimeout(() => setState('idle'), 2400);
    }
  }, [targetRef, fileBase, state]);

  const icon =
    state === 'busy' ? (
      <Loader2 size={11} className="animate-spin" aria-hidden="true" />
    ) : state === 'ok' ? (
      <Check size={11} aria-hidden="true" />
    ) : (
      <Download size={11} aria-hidden="true" />
    );

  const buttonLabel =
    state === 'busy'
      ? 'Capturing…'
      : state === 'ok'
        ? 'Saved'
        : state === 'error'
          ? 'Retry'
          : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'busy'}
      className={[
        'inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-2 py-1',
        'font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-[160ms]',
        state === 'busy'
          ? 'text-[var(--color-text-subtle)]'
          : state === 'ok'
            ? 'border-[color:color-mix(in_oklab,var(--cu-cat-1)_60%,var(--color-border))] text-[var(--cu-cat-1)]'
            : state === 'error'
              ? 'border-[color:color-mix(in_oklab,var(--color-destructive)_55%,var(--color-border))] text-[var(--color-destructive)]'
              : 'text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]',
        className ?? '',
      ].join(' ')}
      title={state === 'error' ? errorMsgRef.current : 'Capture this section as PNG'}
    >
      {icon}
      <span>{buttonLabel}</span>
    </button>
  );
}

function dateSlug(): string {
  const d = new Date();
  // 20260514-093015 — short enough for filenames, sortable, no timezone noise.
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}
