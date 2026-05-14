import { describe, expect, it } from 'vitest';
import { matchModel } from '../modelMatcher';

/**
 * Acceptance test: every model name observed in real Cursor CSV exports
 * (input/usage-events-2026-05-14.csv → unique Model column → 36 names)
 * must produce a finite, non-negative price match.
 *
 * Some are tolerated as `estimated: true` (Auto-pool fallback) because
 * Cursor has not published an explicit rate. Anything in the "exact"
 * list MUST match a hand-curated entry — these are the high-volume
 * models that drive the cost report.
 */

const REAL_MODELS = [
  'claude-4-sonnet-thinking',
  'claude-4.5-sonnet-thinking',
  'claude-4.6-opus-max-thinking',
  'claude-3.7-sonnet-thinking',
  'gpt-5-high',
  'gemini-2.5-pro-preview-05-06',
  'auto',
  'claude-4.5-opus-high-thinking',
  'claude-opus-4-7-thinking-max',
  'claude-opus-4-7-thinking-xhigh',
  'claude-4-sonnet',
  'grok-code-fast-1',
  'claude-4.6-opus-high-thinking',
  'composer-1.5',
  'gpt-5',
  'gpt-5.1-codex-high',
  'code-supernova-1-million',
  'composer-1',
  'claude-3.7-sonnet',
  'claude-4.1-opus-thinking',
  'claude-4.5-sonnet',
  'gpt-4o',
  'composer-2-fast',
  'gpt-5-fast',
  'claude-4.5-haiku-thinking',
  'composer-2',
  'gemini-2.5-pro-exp-03-25',
  'gemini-3-pro-preview',
  'gpt-5.3-codex-xhigh-fast',
  'gpt-5.1-codex-high-fast',
  'claude-4.6-sonnet-medium-thinking',
  'code-supernova',
  'gemini-3.1-pro',
  'gpt-5.5-medium',
  'gpt-5.5-extra-high-fast',
  'gemini-3-pro',
];

/** Subset that MUST match an explicit entry (volume drivers). */
const MUST_BE_EXACT = [
  'claude-4-sonnet-thinking',
  'claude-4.5-sonnet-thinking',
  'claude-4.6-opus-max-thinking',
  'claude-3.7-sonnet-thinking',
  'gpt-5-high',
  'gemini-2.5-pro-preview-05-06',
  'auto',
  'claude-4.5-opus-high-thinking',
  'claude-opus-4-7-thinking-max',
  'claude-opus-4-7-thinking-xhigh',
  'claude-4-sonnet',
  'grok-code-fast-1',
  'claude-4.6-opus-high-thinking',
  'composer-1.5',
  'gpt-5',
  'composer-1',
  'claude-3.7-sonnet',
  'claude-4.5-sonnet',
  'gpt-4o',
  'composer-2-fast',
  'gpt-5-fast',
  'claude-4.5-haiku-thinking',
  'composer-2',
  'gemini-2.5-pro-exp-03-25',
  'gemini-3-pro-preview',
  'claude-4.6-sonnet-medium-thinking',
  'gemini-3-pro',
  'gemini-3.1-pro',
  'gpt-5.5-medium',
  'claude-4.1-opus-thinking',
  'code-supernova',
  'code-supernova-1-million',
];

describe('matchModel — real-world CSV sweep', () => {
  it.each(REAL_MODELS)('produces finite non-negative pricing for: %s', (model) => {
    const r = matchModel(model);
    expect(Number.isFinite(r.pricing.unitPrice.input)).toBe(true);
    expect(r.pricing.unitPrice.input).toBeGreaterThanOrEqual(0);
    expect(r.pricing.unitPrice.output).toBeGreaterThanOrEqual(0);
    expect(r.pricing.unitPrice.cacheRead).toBeGreaterThanOrEqual(0);
  });

  it.each(MUST_BE_EXACT)('high-volume model must match without estimation: %s', (model) => {
    const r = matchModel(model);
    expect(r.estimated).toBe(false);
  });
});
