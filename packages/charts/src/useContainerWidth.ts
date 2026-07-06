import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

/**
 * Tracks the *content* width of a host element so fixed-coordinate SVG charts
 * can lay out at real pixels and never overflow their container.
 *
 * Why measurement (not a `viewBox` stretch): laying the chart out at the
 * measured pixel width keeps text crisp, dots round, and label show/hide
 * thresholds accurate — a `preserveAspectRatio="none"` scale would distort all
 * three. The width is floored so the SVG can only ever be ≤ the container
 * (never a sub-pixel overflow), and the initial read happens in a layout effect
 * (before paint) so there's no first-frame flash at the fallback width.
 *
 * Returns a ref to attach to the wrapper and the measured width (`null` until
 * first measured — callers fall back to a default during that single pre-paint
 * render). Guards `ResizeObserver` so it's safe under SSR / jsdom.
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(): {
  ref: RefObject<T | null>;
  width: number | null;
} {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number) => {
      if (w > 0) setWidth(Math.floor(w));
    };
    apply(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}
