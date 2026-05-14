/**
 * Tailwind v4 in this project consumes tokens via the CSS `@theme inline { ... }`
 * directive in `packages/ui/src/styles.css`. This TS preset is intentionally
 * minimal — it exports the source-of-truth path so build tooling can find it.
 */
const preset = {
  cssEntry: '@cu/tokens/css',
} as const;

export default preset;
