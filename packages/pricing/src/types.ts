/**
 * Per-million-token unit prices in USD.
 * Each rate is for *that* token type only; the cost engine does the math.
 *
 * `cacheWrite` is `null` when the model has no cache-write tier
 * (e.g. GPT family, Composer, Auto — they only price input/cacheRead/output).
 */
export interface UnitPriceUSDPerMillion {
  input: number;
  cacheWrite: number | null;
  cacheRead: number;
  output: number;
}

/**
 * One pricing entry. `key` is the canonical name we expose in UI; the matcher
 * is responsible for going from the raw CSV `Model` string to this key.
 *
 * `appliesWhenMaxMode`:
 *  - `true`  → only used for rows with `maxMode === true`
 *  - `false` → only used for rows with `maxMode === false`
 *  - `undefined` → matches both (the common case)
 *
 * `displayName` is just for tooltips / details modal.
 *
 * `notes`:
 *  - "fast"     · Cursor Fast tier, 6× normal price
 *  - "max-mode" · Max Mode required (some Opus models)
 *  - "thinking-2x" · Old Anthropic thinking models that count as 2 requests
 */
export interface ModelPricing {
  key: string;
  displayName: string;
  provider:
    | 'Anthropic'
    | 'OpenAI'
    | 'Google'
    | 'xAI'
    | 'Cursor'
    | 'DeepSeek'
    | 'Moonshot'
    | 'Qwen'
    | 'Other';
  unitPrice: UnitPriceUSDPerMillion;
  appliesWhenMaxMode?: boolean;
  notes?: ReadonlyArray<'fast' | 'max-mode' | 'thinking-2x'>;
}
