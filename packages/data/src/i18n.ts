/**
 * Tiny translator contract for narrative builders.
 *
 * `@cu/data` is intentionally framework-free — it can't import React
 * or `@cu/ui`. To stay framework-free *and* let narrative output be
 * translatable, we define the minimal shape we need here and let
 * callers (the renderer) pass in their real translator.
 *
 * Default behaviour when no translator is provided: the builder falls
 * back to its built-in English literal. That keeps every consumer that
 * predates i18n (including the test suite) working unchanged.
 *
 * Placeholder syntax matches `@cu/ui`'s `interpolate` helper:
 * `{name}` segments in the template are replaced by the matching
 * value from `vars`. A missing variable is left as `{name}` so it's
 * easy to spot in QA.
 */
export type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Convenience: when a builder needs to translate *and* fall back to a
 * literal English sentence, wrap the literal with this helper so
 * placeholder interpolation works in both branches without copy-
 * pasting the regex.
 */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}

/**
 * Resolve a translation key with a built-in English fallback. Always
 * runs the template through `interpolate` so callers don't have to
 * remember the variable contract per call site.
 */
export function translate(
  t: Translator | undefined,
  key: string,
  englishFallback: string,
  vars?: Record<string, string | number>,
): string {
  if (!t) return interpolate(englishFallback, vars);
  // The provided translator may itself fall back to English when the
  // key is missing from the active locale dictionary — that's fine,
  // we just want a string out.
  const out = t(key, vars);
  if (out === key || out === '') return interpolate(englishFallback, vars);
  return out;
}
