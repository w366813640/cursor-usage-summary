import { PRICING_TABLE, findPricingByKey } from './pricingTable';
import type { ModelPricing } from './types';

/**
 * Result of matching a CSV "Model" string to a pricing entry.
 *
 * - `pricing.key === 'auto'` and `estimated === true` means we couldn't find
 *   a precise match and fell back to the Auto pool rate. The UI should badge
 *   this as an "estimated" rate so the user knows.
 */
export interface MatchResult {
  pricing: ModelPricing;
  estimated: boolean;
  /** Reason a fallback was used (only set if `estimated === true`). */
  fallbackReason?: string;
}

const NORMALIZE_RE = /[^a-z0-9.]/g;

function normalize(name: string): string {
  return name.toLowerCase().replace(NORMALIZE_RE, '');
}

/**
 * Cursor publishes some Claude variants with `opus`/`haiku` BEFORE the
 * version number, using `-` as the version separator (e.g.
 *   `claude-opus-4-7-thinking-max`
 *   `claude-opus-4-6-fast`
 *   `claude-haiku-4-5-thinking`
 * ).
 *
 * Rewrite these to the more common `claude-<MAJOR>.<MINOR>-<family>-<...>` form
 * so the rest of the matcher only has to learn one shape.
 */
const FAMILY_PREFIX_RE = /^claude-(opus|haiku|sonnet)-(\d+)(?:[-.](\d+))?(.*)$/i;

function reorderClaudeFamily(name: string): string {
  const m = FAMILY_PREFIX_RE.exec(name);
  if (!m) return name;
  const family = (m[1] ?? '').toLowerCase();
  const major = m[2] ?? '';
  const minor = m[3];
  const tail = m[4] ?? '';
  if (!family || !major) return name;
  const version = minor === undefined ? major : `${major}.${minor}`;
  return `claude-${version}-${family}${tail}`;
}

/**
 * Stripped suffixes that the CSV adds for routing flavors but that don't
 * change pricing in any tier we care about. Order matters: longest first.
 *
 * The matcher compares stripped-and-normalized forms, so e.g.
 *   "claude-4.6-opus-max-thinking"  (CSV verbatim)
 *   → strip "-max-thinking"
 *   → "claude-4.6-opus"             → matches PRICING_TABLE.key
 */
const STRIP_SUFFIXES = [
  '-extra-high-fast',
  '-extra-high',
  '-max-thinking',
  '-high-thinking',
  '-medium-thinking',
  '-low-thinking',
  '-thinking-max',
  '-thinking-high',
  '-thinking-xhigh',
  '-thinking-medium',
  '-thinking-low',
  '-thinking',
  '-max',
  '-high',
  '-medium',
  '-low',
  '-xhigh',
  '-exp',
  '-preview',
];

const DATE_TAIL_RE = /-\d{4}-\d{2}-\d{2}$/;
const SHORT_DATE_TAIL_RE = /-\d{2}-\d{2}$/;

function stripModelSuffixes(name: string): string {
  let s = name;
  s = s.replace(DATE_TAIL_RE, '');
  s = s.replace(SHORT_DATE_TAIL_RE, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of STRIP_SUFFIXES) {
      if (s.endsWith(suffix)) {
        s = s.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }
  return s;
}

/**
 * Heuristics for whether a CSV-form model string looks like a "Fast" tier.
 * Cursor sometimes encodes Fast as both `-fast` suffix and inside Max Mode;
 * we treat `-fast` substring as authoritative.
 */
function isFastTier(name: string): boolean {
  return /-fast(\b|$|-)/.test(name) || name.endsWith('-fast');
}

/**
 * Match a raw CSV "Model" cell to a pricing row.
 *
 *  Algorithm:
 *  1. Try direct key match (after normalizing punctuation).
 *  2. If `-fast`, try the `-fast` variant of the stripped key.
 *  3. Try the stripped key (suffix stripping + date stripping).
 *  4. Try a relaxed substring match (any pricing key whose normalized form
 *     is a prefix of the normalized model).
 *  5. Fallback to Auto pool with `estimated: true`.
 *
 *  This is *intentionally* a small, hand-tuned function. We do NOT use a
 *  fuzzy matcher because false positives on pricing are far worse than
 *  honest "estimated" badges.
 */
export function matchModel(rawModel: string): MatchResult {
  const canonical = reorderClaudeFamily(rawModel);
  const norm = normalize(canonical);

  // 1) Direct key match (rare but cheap to check first)
  const direct = PRICING_TABLE.find((p) => normalize(p.key) === norm);
  if (direct) return { pricing: direct, estimated: false };

  const fast = isFastTier(canonical);
  const stripped = stripModelSuffixes(canonical);
  const strippedNorm = normalize(stripped);

  // 2) Strip → check if there's a fast variant we should prefer
  if (fast) {
    const fastKey = `${stripped}-fast`;
    const fastMatch = PRICING_TABLE.find((p) => normalize(p.key) === normalize(fastKey));
    if (fastMatch) return { pricing: fastMatch, estimated: false };
  }

  // 3) Strip → exact match on the stripped form
  const strippedMatch = PRICING_TABLE.find((p) => normalize(p.key) === strippedNorm);
  if (strippedMatch) return { pricing: strippedMatch, estimated: false };

  // 4) Relaxed prefix match — pick the longest matching key to avoid e.g.
  //    'claude-4' matching 'claude-4-sonnet' for a 'claude-4.6-opus' input.
  const candidates = PRICING_TABLE.filter((p) => {
    const pn = normalize(p.key);
    return strippedNorm.startsWith(pn) || norm.startsWith(pn);
  }).sort((a, b) => normalize(b.key).length - normalize(a.key).length);

  const bestPrefix = candidates[0];
  if (bestPrefix) {
    return { pricing: bestPrefix, estimated: false };
  }

  // 5) Last resort: Auto pool with estimated badge
  const auto = findPricingByKey('auto');
  if (!auto) {
    throw new Error('PRICING_TABLE is missing required "auto" entry');
  }
  return {
    pricing: auto,
    estimated: true,
    fallbackReason: `no exact match for "${rawModel}" — using Auto pool rate as estimate`,
  };
}
