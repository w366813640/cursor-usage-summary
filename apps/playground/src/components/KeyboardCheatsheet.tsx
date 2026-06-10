import { X } from '@cu/icons';
import {
  type ShortcutDef,
  formatCombo,
  useShortcut,
  useShortcutList,
  useShortcutRegistry,
  useT,
} from '@cu/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { useDrawerA11y } from '../hooks/useDrawerA11y';

/**
 * Centered modal listing every keyboard shortcut currently registered
 * with the @cu/ui ShortcutsProvider. Triggered by `?` (Shift+/) and
 * dismissed via Esc, click-outside, or the close button.
 *
 * The cheatsheet is intentionally read-only — it shows users what
 * shortcuts exist; the provider already wires them up.
 *
 * Why this lives in playground and not @cu/ui:
 *   - The provider in @cu/ui has zero UI dependencies. Keeping the
 *     overlay renderer here lets each app skin it differently (the
 *     consumer-app vs the dev playground might want different
 *     copy/visual styling) without forcing a UI dep on the provider.
 */
export function KeyboardCheatsheet() {
  const registry = useShortcutRegistry();
  const dialogRef = useDrawerA11y(registry.cheatsheetOpen, () => registry.setCheatsheetOpen(false));
  const t = useT();

  // `?` opens the cheatsheet. The provider already swallows the
  // keypress so it doesn't reach text inputs unless explicitly opted
  // in; `fireWhileTyping: false` keeps `?` available in plain typing
  // contexts.
  useShortcut(
    {
      id: 'cheatsheet-open',
      combo: { key: '?' },
      description: t('cheatsheet.title'),
      group: 'global',
      handler: () => registry.setCheatsheetOpen(true),
    },
    [registry.setCheatsheetOpen, t],
  );

  // Reactive snapshot — re-derives when shortcuts register/unregister
  // (e.g. our own Esc binding lands right after the modal opens).
  const shortcuts = useShortcutList();
  const grouped = useMemo(() => groupShortcuts(shortcuts), [shortcuts]);
  const open = registry.cheatsheetOpen;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(0,0,0,0.55)] p-6"
          role="presentation"
          onClick={() => registry.setCheatsheetOpen(false)}
        >
          <motion.div
            ref={dialogRef as React.Ref<HTMLDivElement>}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('cheatsheet.title')}
            className="flex max-h-[80vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)]"
          >
            <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-serif text-[18px] leading-tight tracking-tight">
                  {t('cheatsheet.title')}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                  ? · esc
                </span>
              </div>
              <button
                type="button"
                onClick={() => registry.setCheatsheetOpen(false)}
                aria-label={t('common.close')}
                className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </header>
            <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5">
              {grouped.length === 0 ? (
                <p className="font-mono text-[11px] text-[var(--color-text-subtle)]">
                  {t('cheatsheet.empty')}
                </p>
              ) : (
                grouped.map((g) => (
                  <section key={g.group} className="flex flex-col gap-2">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
                      {t(`cheatsheet.group.${g.group}`) === `cheatsheet.group.${g.group}`
                        ? (GROUP_LABEL[g.group] ?? g.group)
                        : t(`cheatsheet.group.${g.group}`)}
                    </h3>
                    <ul className="flex flex-col divide-y divide-[var(--color-border)]/60">
                      {g.entries.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-4 py-2">
                          <span className="text-[13px] text-[var(--color-text)]">
                            {s.description}
                          </span>
                          <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
                            {formatCombo(s.combo)}
                          </kbd>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const GROUP_LABEL: Record<string, string> = {
  global: 'Global',
  navigation: 'Navigation',
  document: 'Document',
  panel: 'Panel',
  editor: 'Editor',
};

function groupShortcuts(
  list: readonly ShortcutDef[],
): Array<{ group: string; entries: readonly ShortcutDef[] }> {
  const groups = new Map<string, ShortcutDef[]>();
  for (const def of list) {
    const arr = groups.get(def.group) ?? [];
    arr.push(def);
    groups.set(def.group, arr);
  }
  // Stable ordering: global first, then alpha by group label.
  const order = ['global', 'navigation', 'panel', 'document', 'editor'];
  const out: Array<{ group: string; entries: readonly ShortcutDef[] }> = [];
  for (const g of order) {
    const entries = groups.get(g);
    if (entries && entries.length > 0) out.push({ group: g, entries });
  }
  for (const [g, entries] of groups.entries()) {
    if (order.includes(g)) continue;
    out.push({ group: g, entries });
  }
  return out;
}
