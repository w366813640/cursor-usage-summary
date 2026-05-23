import type { ModelPricing } from './types';

/**
 * ISO date of the pricing snapshot below. Read by `TrustHint` / About
 * panel so the user can correlate sudden cost-shifts in their data
 * with table updates. Bump this together with any row edit.
 */
export const PRICING_TABLE_AS_OF = '2026-05-14';

/**
 * Cursor public per-token pricing snapshot.
 *
 * Source of truth: https://cursor.com/docs/models-and-pricing (verified
 * 2026-05-14 during PRD research; cross-checked with Cursor changelog).
 *
 * Units are USD per 1,000,000 tokens. Numbers are intentionally kept as
 * literals so they diff cleanly when Cursor publishes new prices.
 *
 * The `key` is what the rest of the app uses; `modelMatcher.ts` is in
 * charge of mapping the raw CSV "Model" string onto one of these keys
 * (with a Auto-pool fallback for legacy / unknown).
 */
export const PRICING_TABLE: ReadonlyArray<ModelPricing> = [
  // ── Anthropic — Claude 4 Sonnet family ─────────────────────────────────
  {
    key: 'claude-4-sonnet',
    displayName: 'Claude 4 Sonnet',
    provider: 'Anthropic',
    unitPrice: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
  },
  {
    key: 'claude-4-sonnet-thinking',
    displayName: 'Claude 4 Sonnet · Thinking',
    provider: 'Anthropic',
    unitPrice: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
    notes: ['thinking-2x'],
  },
  // ── Anthropic — Claude 4.5 Sonnet family ───────────────────────────────
  {
    key: 'claude-4.5-sonnet',
    displayName: 'Claude 4.5 Sonnet',
    provider: 'Anthropic',
    unitPrice: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
  },
  {
    key: 'claude-4.5-sonnet-thinking',
    displayName: 'Claude 4.5 Sonnet · Thinking',
    provider: 'Anthropic',
    unitPrice: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
  },
  // ── Anthropic — Claude 4.6 Sonnet family ───────────────────────────────
  {
    key: 'claude-4.6-sonnet',
    displayName: 'Claude 4.6 Sonnet',
    provider: 'Anthropic',
    unitPrice: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
  },
  {
    key: 'claude-4.6-sonnet-thinking',
    displayName: 'Claude 4.6 Sonnet · Thinking',
    provider: 'Anthropic',
    unitPrice: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
  },
  // ── Anthropic — Claude 4.1 Opus family ─────────────────────────────────
  // Cursor still routes some legacy 4.1 Opus calls; same price tier as 4.5+.
  {
    key: 'claude-4.1-opus',
    displayName: 'Claude 4.1 Opus',
    provider: 'Anthropic',
    unitPrice: { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
    notes: ['max-mode'],
  },
  // ── Anthropic — Claude 4.5 Haiku family ────────────────────────────────
  // Anthropic published Haiku 4.5 at: input $1 / cacheWrite $1.25 /
  // cacheRead $0.1 / output $5 (per million).
  {
    key: 'claude-4.5-haiku',
    displayName: 'Claude 4.5 Haiku',
    provider: 'Anthropic',
    unitPrice: { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 },
  },
  // ── Anthropic — Claude 3.7 Sonnet family ───────────────────────────────
  {
    key: 'claude-3.7-sonnet',
    displayName: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    unitPrice: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
  },
  {
    key: 'claude-3.7-sonnet-thinking',
    displayName: 'Claude 3.7 Sonnet · Thinking',
    provider: 'Anthropic',
    unitPrice: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 },
    notes: ['thinking-2x'],
  },
  // ── Anthropic — Opus family (normal) ───────────────────────────────────
  {
    key: 'claude-4.5-opus',
    displayName: 'Claude 4.5 Opus',
    provider: 'Anthropic',
    unitPrice: { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
    notes: ['max-mode'],
  },
  {
    key: 'claude-4.6-opus',
    displayName: 'Claude 4.6 Opus',
    provider: 'Anthropic',
    unitPrice: { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
    notes: ['max-mode'],
  },
  {
    key: 'claude-4.7-opus',
    displayName: 'Claude 4.7 Opus',
    provider: 'Anthropic',
    unitPrice: { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  },
  // ── Anthropic — Opus Fast tier (6× normal) ─────────────────────────────
  {
    key: 'claude-4.6-opus-fast',
    displayName: 'Claude 4.6 Opus · Fast',
    provider: 'Anthropic',
    unitPrice: { input: 30, cacheWrite: 37.5, cacheRead: 3, output: 150 },
    notes: ['fast'],
  },
  {
    key: 'claude-4.7-opus-fast',
    displayName: 'Claude 4.7 Opus · Fast',
    provider: 'Anthropic',
    unitPrice: { input: 30, cacheWrite: 37.5, cacheRead: 3, output: 150 },
    notes: ['fast'],
  },
  // ── Cursor in-house ────────────────────────────────────────────────────
  {
    key: 'composer-1',
    displayName: 'Composer 1',
    provider: 'Cursor',
    unitPrice: { input: 1.25, cacheWrite: null, cacheRead: 0.125, output: 10 },
  },
  {
    key: 'composer-1.5',
    displayName: 'Composer 1.5',
    provider: 'Cursor',
    unitPrice: { input: 3.5, cacheWrite: null, cacheRead: 0.35, output: 17.5 },
  },
  {
    key: 'composer-2',
    displayName: 'Composer 2',
    provider: 'Cursor',
    unitPrice: { input: 0.5, cacheWrite: null, cacheRead: 0.2, output: 2.5 },
  },
  {
    key: 'composer-2-fast',
    displayName: 'Composer 2 · Fast',
    provider: 'Cursor',
    unitPrice: { input: 0.5, cacheWrite: null, cacheRead: 0.2, output: 2.5 },
    notes: ['fast'],
  },
  {
    key: 'auto',
    displayName: 'Auto',
    provider: 'Cursor',
    unitPrice: { input: 1.25, cacheWrite: null, cacheRead: 0.25, output: 6 },
  },
  // ── OpenAI — GPT-4o (legacy, kept for old CSV imports) ─────────────────
  {
    key: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'OpenAI',
    unitPrice: { input: 2.5, cacheWrite: null, cacheRead: 1.25, output: 10 },
  },
  // ── OpenAI — GPT 5 family ──────────────────────────────────────────────
  {
    key: 'gpt-5',
    displayName: 'GPT-5',
    provider: 'OpenAI',
    unitPrice: { input: 1.25, cacheWrite: null, cacheRead: 0.125, output: 10 },
  },
  {
    key: 'gpt-5-fast',
    displayName: 'GPT-5 · Fast',
    provider: 'OpenAI',
    unitPrice: { input: 2.5, cacheWrite: null, cacheRead: 0.25, output: 20 },
    notes: ['fast'],
  },
  {
    key: 'gpt-5-codex',
    displayName: 'GPT-5 Codex',
    provider: 'OpenAI',
    unitPrice: { input: 1.25, cacheWrite: null, cacheRead: 0.125, output: 10 },
  },
  {
    key: 'gpt-5.1-codex',
    displayName: 'GPT-5.1 Codex',
    provider: 'OpenAI',
    unitPrice: { input: 1.25, cacheWrite: null, cacheRead: 0.125, output: 10 },
  },
  {
    key: 'gpt-5.2',
    displayName: 'GPT-5.2',
    provider: 'OpenAI',
    unitPrice: { input: 1.75, cacheWrite: null, cacheRead: 0.175, output: 14 },
  },
  {
    key: 'gpt-5.3-codex',
    displayName: 'GPT-5.3 Codex',
    provider: 'OpenAI',
    unitPrice: { input: 1.75, cacheWrite: null, cacheRead: 0.175, output: 14 },
  },
  {
    key: 'gpt-5.4',
    displayName: 'GPT-5.4',
    provider: 'OpenAI',
    unitPrice: { input: 2.5, cacheWrite: null, cacheRead: 0.25, output: 15 },
  },
  {
    key: 'gpt-5.5',
    displayName: 'GPT-5.5',
    provider: 'OpenAI',
    unitPrice: { input: 5, cacheWrite: null, cacheRead: 0.5, output: 30 },
  },
  // ── Google — Gemini family ─────────────────────────────────────────────
  {
    key: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'Google',
    unitPrice: { input: 1.25, cacheWrite: null, cacheRead: 0.31, output: 10 },
  },
  {
    key: 'gemini-3-pro',
    displayName: 'Gemini 3 Pro',
    provider: 'Google',
    unitPrice: { input: 2, cacheWrite: null, cacheRead: 0.4, output: 12 },
  },
  {
    key: 'gemini-3.1-pro',
    displayName: 'Gemini 3.1 Pro',
    provider: 'Google',
    unitPrice: { input: 2, cacheWrite: null, cacheRead: 0.4, output: 12 },
  },
  // ── xAI — Grok family ──────────────────────────────────────────────────
  {
    key: 'grok-4',
    displayName: 'Grok 4',
    provider: 'xAI',
    unitPrice: { input: 3, cacheWrite: null, cacheRead: 0.75, output: 15 },
  },
  {
    key: 'grok-4-fast',
    displayName: 'Grok 4 · Fast',
    provider: 'xAI',
    unitPrice: { input: 0.2, cacheWrite: null, cacheRead: 0.05, output: 0.5 },
    notes: ['fast'],
  },
  // ── xAI — Grok Code Fast ───────────────────────────────────────────────
  // Cheap dedicated code-completion model. Cursor exposes it as
  // `grok-code-fast-1` in CSV exports.
  {
    key: 'grok-code-fast-1',
    displayName: 'Grok Code · Fast 1',
    provider: 'xAI',
    unitPrice: { input: 0.2, cacheWrite: null, cacheRead: 0.02, output: 1.5 },
    notes: ['fast'],
  },
  // ── Cursor — code-supernova (in-house code completion) ─────────────────
  // Cursor's own ultra-fast code model; we treat it as Composer 2-class
  // until official rates land in pricing docs.
  {
    key: 'code-supernova',
    displayName: 'Code Supernova',
    provider: 'Cursor',
    unitPrice: { input: 0.5, cacheWrite: null, cacheRead: 0.2, output: 2.5 },
  },
  {
    key: 'code-supernova-1-million',
    displayName: 'Code Supernova · 1M',
    provider: 'Cursor',
    unitPrice: { input: 1, cacheWrite: null, cacheRead: 0.2, output: 5 },
  },
];

/** Lookup helper. */
export function findPricingByKey(key: string): ModelPricing | undefined {
  return PRICING_TABLE.find((p) => p.key === key);
}
