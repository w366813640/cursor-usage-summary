import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/**
 * KeyboardShortcuts — a tiny, opinionated global shortcut registry.
 *
 * Why our own:
 *
 *   - Tiptap already swallows most editor-targeted keys (text input,
 *     undo, formatting). We need a layer that fires only when the
 *     user is *not* actively typing, plus a list of registrations the
 *     cheatsheet can read for documentation.
 *   - Off-the-shelf libraries (mousetrap, hotkeys-js) ship a global
 *     keymap and lose the per-shortcut metadata (label, group) we
 *     want to render in the help dialog.
 *
 * Design:
 *
 *   - One window-level keydown listener. Each registered shortcut
 *     contributes a comparator + a handler. Newest registration wins
 *     for duplicate combos (LIFO), which lets a focused modal hijack
 *     a global key (e.g. cheatsheet's `Esc`) without unregistering
 *     the global one.
 *   - Shortcut combos are described declaratively:
 *
 *       { mod: true, shift: false, key: 'h' }       → Cmd/Ctrl-H
 *       { key: '?' }                                → just "?"
 *
 *     `mod` is "Cmd on macOS, Ctrl elsewhere" — keeping the user's
 *     muscle memory consistent across platforms.
 *   - When the active element is a text input or contenteditable,
 *     non-modifier shortcuts (`?`, `j`, `a`, ...) skip dispatch so
 *     the user can type normally. Modifier-bearing combos still
 *     fire so `Cmd+H` works inside the editor.
 *
 * Use the `useShortcut` hook to register from any component. The
 * `useShortcutList` hook exposes a reactive registry snapshot to the
 * cheatsheet renderer. The provider mounts the listener and a single
 * cheatsheet modal trigger keyed on `?`.
 */

export type ShortcutGroup = 'global' | 'navigation' | 'document' | 'panel' | 'editor';

export interface ShortcutCombo {
  /** Cmd on macOS / Ctrl elsewhere. Defaults to false. */
  mod?: boolean;
  /** Literal Shift modifier. Defaults to false. */
  shift?: boolean;
  /** Literal Alt modifier. Defaults to false. */
  alt?: boolean;
  /**
   * The non-modifier key. Compared against `event.key` lowercased.
   * `?` and other punctuation are accepted verbatim.
   */
  key: string;
}

export interface ShortcutDef {
  /** Unique id used for unregistration. */
  id: string;
  combo: ShortcutCombo;
  /** Human-readable description for the cheatsheet. */
  description: string;
  /** Group label for the cheatsheet. */
  group: ShortcutGroup;
  /**
   * If `false` (default), the shortcut is suppressed when the active
   * element is a text input / contenteditable AND the combo has no
   * `mod` / `alt` modifier (i.e. plain letters / `?`). Set `true` to
   * fire even while the user is typing — useful for `Esc` etc.
   */
  fireWhileTyping?: boolean;
  handler: (e: KeyboardEvent) => void;
}

interface ShortcutsContextValue {
  register: (def: ShortcutDef) => () => void;
  /** Snapshot of currently registered defs, ordered for cheatsheet. */
  list: () => readonly ShortcutDef[];
  /** Subscribe to registry mutations (used by useShortcutList). */
  subscribe: (cb: () => void) => () => void;
  /** Open / close the cheatsheet modal. */
  cheatsheetOpen: boolean;
  setCheatsheetOpen: (open: boolean) => void;
}

/**
 * Perf note (perf plan 1.3): the registry API lives in its own context
 * whose value is created once and NEVER changes identity. Registering or
 * unregistering a shortcut mutates a ref and pings subscribers — it does
 * not set React state — so the dozens of `useShortcut` consumers across
 * the app no longer re-render on every registration storm (mount, route
 * change, modal open). Only the cheatsheet open/close flag stays in a
 * separate, rarely-changing context.
 */
type ShortcutsApi = Omit<ShortcutsContextValue, 'cheatsheetOpen'>;

const ShortcutsApiContext = createContext<ShortcutsApi | null>(null);
const CheatsheetOpenContext = createContext(false);

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return true;
  }
  // Tiptap puts `contenteditable=true` on a child, so a click can
  // land on a wrapper. Walk up just enough to catch it.
  return !!target.closest('[contenteditable=true], input, textarea, .scribe-editor-content');
}

/**
 * Punctuation keys that require Shift on most keyboard layouts (e.g.
 * `?` is `Shift+/` on US/UK). When the combo's `key` is one of these
 * we deliberately ignore the event's shift state — otherwise users
 * would have to remember "Shift + ?" which is redundant.
 */
const SHIFT_PUNCTUATION = new Set([
  '?',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
  '_',
  '+',
  '{',
  '}',
  '|',
  ':',
  '"',
  '<',
  '>',
  '~',
]);

function comboMatches(combo: ShortcutCombo, e: KeyboardEvent): boolean {
  const mod = !!combo.mod;
  const shift = !!combo.shift;
  const alt = !!combo.alt;
  const eMod = isMac ? e.metaKey : e.ctrlKey;
  const eOtherMod = isMac ? e.ctrlKey : e.metaKey;
  if (mod !== eMod) return false;
  if (eOtherMod) return false;
  if (alt !== e.altKey) return false;
  // Layout-dependent shifted punctuation: skip the shift check.
  if (!(combo.key.length === 1 && SHIFT_PUNCTUATION.has(combo.key))) {
    if (shift !== e.shiftKey) return false;
  }
  // Compare against `event.key` lowercased so `Cmd+H` and `Cmd+h` both work.
  return combo.key.toLowerCase() === e.key.toLowerCase();
}

export interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  // Registry kept in a ref so the keydown listener is attached once
  // and reads the latest set on each event. Storing as an array
  // (instead of a Map) preserves insertion order — newest wins via
  // reverse iteration for duplicate combos. Mutations rebuild the array
  // (never splice in place) so useSyncExternalStore snapshots compare
  // by reference.
  const registry = useRef<ShortcutDef[]>([]);
  const listeners = useRef<Set<() => void>>(new Set());
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  const register = useCallback((def: ShortcutDef) => {
    registry.current = [...registry.current.filter((d) => d.id !== def.id), def];
    for (const cb of listeners.current) cb();
    return () => {
      registry.current = registry.current.filter((d) => d.id !== def.id);
      for (const cb of listeners.current) cb();
    };
  }, []);

  const list = useCallback((): readonly ShortcutDef[] => registry.current, []);

  const subscribe = useCallback((cb: () => void) => {
    listeners.current.add(cb);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Iterate newest-first so a recently-registered modal-scoped
      // shortcut wins over an older global one with the same combo.
      const defs = registry.current;
      for (let i = defs.length - 1; i >= 0; i--) {
        const def = defs[i];
        if (!def) continue;
        if (!comboMatches(def.combo, e)) continue;
        // Suppress plain-letter shortcuts while the user is actively
        // typing inside the editor / inputs unless explicitly opted in.
        const hasMod = !!def.combo.mod || !!def.combo.alt;
        if (!hasMod && !def.fireWhileTyping && isTypingTarget(e.target)) {
          continue;
        }
        // Stop here — first match wins.
        e.preventDefault();
        def.handler(e);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // All four members are useCallback([])-stable, so this object is
  // created exactly once for the provider's lifetime — `useShortcut`
  // consumers never re-render because of registry traffic.
  const api = useMemo<ShortcutsApi>(
    () => ({ register, list, subscribe, setCheatsheetOpen }),
    [register, list, subscribe],
  );

  return (
    <ShortcutsApiContext.Provider value={api}>
      <CheatsheetOpenContext.Provider value={cheatsheetOpen}>
        {children}
      </CheatsheetOpenContext.Provider>
    </ShortcutsApiContext.Provider>
  );
}

export function useShortcutRegistry(): ShortcutsContextValue {
  const api = useContext(ShortcutsApiContext);
  const cheatsheetOpen = useContext(CheatsheetOpenContext);
  if (!api) {
    throw new Error('useShortcutRegistry must be used within <KeyboardShortcutsProvider>');
  }
  return useMemo(() => ({ ...api, cheatsheetOpen }), [api, cheatsheetOpen]);
}

/**
 * Reactive snapshot of the registered shortcuts. Re-renders the caller
 * whenever a shortcut registers/unregisters — intended for the cheatsheet
 * renderer only; everything else should use `useShortcut` / the registry.
 */
export function useShortcutList(): readonly ShortcutDef[] {
  const api = useContext(ShortcutsApiContext);
  if (!api) {
    throw new Error('useShortcutList must be used within <KeyboardShortcutsProvider>');
  }
  return useSyncExternalStore(api.subscribe, api.list, api.list);
}

/**
 * Register a global shortcut. Pass a stable handler ref or wrap with
 * `useCallback`; the registration re-fires only when `id`, `combo`, or
 * the deps change.
 *
 * The api context value is provider-lifetime stable (registrations
 * mutate a ref instead of bumping state — see ShortcutsApiContext), so
 * registering N shortcuts no longer cascades re-renders through every
 * other useShortcut consumer. We still read the context via a ref inside
 * the effect to stay robust against a (very rare) provider remount
 * without listing `ctx` in the deps.
 */
export function useShortcut(def: ShortcutDef, deps: readonly unknown[] = []) {
  const ctx = useContext(ShortcutsApiContext);
  // Capture latest handler in a ref so the registration doesn't churn
  // on every render even when the consumer forgot to memoize.
  const handlerRef = useRef(def.handler);
  handlerRef.current = def.handler;

  // Latest provider ref — read at effect time so a (very rare) provider
  // remount picks up the new register fn without us listing `ctx` in
  // deps (which would loop, see above).
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  // The combo is intentionally part of the deps — changing combo should
  // re-register. Description / group changes don't need re-registration
  // but it's cheap. We list `def.*` fields rather than `def` itself to
  // avoid re-registering on every parent render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ctx is intentionally read via ref to break a tick-driven re-register loop; combo + deps drive re-register
  useEffect(() => {
    const liveCtx = ctxRef.current;
    if (!liveCtx) return;
    return liveCtx.register({
      ...def,
      handler: (e) => handlerRef.current(e),
    });
  }, [
    def.id,
    def.combo.mod,
    def.combo.shift,
    def.combo.alt,
    def.combo.key,
    def.fireWhileTyping,
    ...deps,
  ]);
}

/** Format a combo for display in the cheatsheet / tooltip. */
export function formatCombo(combo: ShortcutCombo): string {
  const parts: string[] = [];
  if (combo.mod) parts.push(isMac ? '⌘' : 'Ctrl');
  if (combo.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (combo.shift) parts.push(isMac ? '⇧' : 'Shift');
  parts.push(formatKey(combo.key));
  return parts.join(combo.mod || combo.alt || combo.shift ? (isMac ? '' : '+') : '');
}

function formatKey(key: string): string {
  if (key.length === 1) return key.toUpperCase();
  switch (key.toLowerCase()) {
    case 'enter':
      return 'Enter';
    case 'escape':
      return 'Esc';
    case 'arrowup':
      return '↑';
    case 'arrowdown':
      return '↓';
    case 'arrowleft':
      return '←';
    case 'arrowright':
      return '→';
    default:
      return key;
  }
}
