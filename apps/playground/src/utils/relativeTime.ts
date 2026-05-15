/**
 * Short human-readable "how long ago" caption used in the file toolbar
 * and import history drawer. Buckets are deliberately coarse — we
 * don't want a re-render every second, just an at-a-glance hint.
 *
 * Returns null only when `lastIngestedAt` is invalid (NaN). For the
 * common 0 / undefined cases the caller's nullish-coalesce path takes
 * over with copy like "just now".
 */
export function describeLastUpdate(
  lastIngestedAt: number,
  now: number = Date.now(),
): string | null {
  if (!Number.isFinite(lastIngestedAt)) return null;
  const deltaMs = Math.max(0, now - lastIngestedAt);
  const deltaMin = Math.floor(deltaMs / 60000);
  if (deltaMin < 1) return 'just now';
  if (deltaMin === 1) return '1 minute ago';
  if (deltaMin < 60) return `${deltaMin} minutes ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr === 1) return '1 hour ago';
  if (deltaHr < 24) return `${deltaHr} hours ago`;
  const deltaDay = Math.floor(deltaHr / 24);
  if (deltaDay === 1) return 'yesterday';
  if (deltaDay < 30) return `${deltaDay} days ago`;
  const deltaMon = Math.floor(deltaDay / 30);
  if (deltaMon === 1) return '1 month ago';
  if (deltaMon < 12) return `${deltaMon} months ago`;
  const years = Math.floor(deltaMon / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
