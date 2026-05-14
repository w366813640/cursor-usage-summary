import { describe, expect, it } from 'vitest';
import { matchModel } from '../modelMatcher';

describe('matchModel', () => {
  it('matches direct keys without estimation', () => {
    const r = matchModel('claude-4-sonnet');
    expect(r.estimated).toBe(false);
    expect(r.pricing.key).toBe('claude-4-sonnet');
  });

  it('strips -thinking and matches the base model price', () => {
    const r = matchModel('claude-4-sonnet-thinking');
    expect(r.estimated).toBe(false);
    // We have an explicit -thinking entry but base would also match;
    // either is correct since prices are equal. We assert price not key.
    expect(r.pricing.unitPrice.input).toBe(3);
    expect(r.pricing.unitPrice.output).toBe(15);
  });

  it('strips -max for opus-max-thinking and matches normal Opus pricing', () => {
    const r = matchModel('claude-4.6-opus-max-thinking');
    expect(r.estimated).toBe(false);
    expect(r.pricing.key).toBe('claude-4.6-opus');
    expect(r.pricing.unitPrice.input).toBe(5);
    expect(r.pricing.unitPrice.output).toBe(25);
  });

  it('detects -fast and uses the 6× Fast tier price (CSV-form opus-prefix)', () => {
    // CSV exports use `claude-opus-4-6-fast` (opus before version, hyphens).
    // We reorder it internally to `claude-4.6-opus-fast` and match the
    // 6× Fast tier from PRICING_TABLE.
    const r = matchModel('claude-opus-4-6-fast');
    expect(r.estimated).toBe(false);
    expect(r.pricing.unitPrice.input).toBe(30);
    expect(r.pricing.unitPrice.output).toBe(150);
  });

  it('reorders opus-prefix Claude variants from real CSV exports', () => {
    // From input/usage-events-2026-05-14.csv: claude-opus-4-7-thinking-max
    const r = matchModel('claude-opus-4-7-thinking-max');
    expect(r.estimated).toBe(false);
    expect(r.pricing.key).toBe('claude-4.7-opus');
    expect(r.pricing.unitPrice.input).toBe(5);
    expect(r.pricing.unitPrice.output).toBe(25);
  });

  it('strips date suffix on gemini preview names', () => {
    const r = matchModel('gemini-2.5-pro-preview-05-06');
    expect(r.estimated).toBe(false);
    expect(r.pricing.key).toBe('gemini-2.5-pro');
  });

  it('matches gpt-5-high → gpt-5 base pricing', () => {
    const r = matchModel('gpt-5-high');
    expect(r.estimated).toBe(false);
    expect(r.pricing.key).toBe('gpt-5');
    expect(r.pricing.unitPrice.input).toBe(1.25);
  });

  it('matches gpt-5.5-medium → gpt-5.5', () => {
    const r = matchModel('gpt-5.5-medium');
    expect(r.estimated).toBe(false);
    expect(r.pricing.key).toBe('gpt-5.5');
  });

  it('matches gpt-5.3-codex-xhigh-fast → gpt-5-fast (Fast trumps version-specific fast)', () => {
    // Cursor's `gpt-5.3-codex-xhigh-fast` lacks an explicit -fast entry per
    // version; we expect either an exact match or the Fast tier rate.
    const r = matchModel('gpt-5.3-codex-xhigh-fast');
    expect(r.estimated).toBe(false);
    // Output rate must be one of the Fast tier rates
    expect([20, 14, 15]).toContain(r.pricing.unitPrice.output);
  });

  it('matches composer-2-fast directly', () => {
    const r = matchModel('composer-2-fast');
    expect(r.estimated).toBe(false);
    expect(r.pricing.key).toBe('composer-2-fast');
  });

  it('matches auto', () => {
    const r = matchModel('auto');
    expect(r.estimated).toBe(false);
    expect(r.pricing.key).toBe('auto');
  });

  it('falls back to Auto pool with estimated=true for an unknown model', () => {
    const r = matchModel('mystery-model-9000');
    expect(r.estimated).toBe(true);
    expect(r.pricing.key).toBe('auto');
    expect(r.fallbackReason).toMatch(/no exact match/);
  });
});
