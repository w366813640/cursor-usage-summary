import { HelpCircle, Keyboard, Sparkles } from '@cu/icons';
import { useShortcutRegistry } from '@cu/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useUnreadChangelog } from '../hooks/useUnreadChangelog';

interface QuickTipsButtonProps {
  /** Opens the Settings drawer (where the What's new panel lives). */
  onOpenSettings: () => void;
}

/**
 * Floating bottom-right helper. Replaces the "where do I find
 * help?" guessing game with one consistent affordance.
 *
 * Click expands a tiny menu with:
 *   - Keyboard shortcuts (opens the cheatsheet via @cu/ui registry)
 *   - What's new (opens Settings, where the changelog panel lives)
 *
 * A red dot appears on the icon when the user has a changelog entry
 * they haven't acknowledged. Clicking "What's new" marks all
 * outstanding entries as seen, which clears the dot.
 *
 * The button hides itself when the cheatsheet or settings are open
 * to avoid stacking floating chrome on top of modals.
 */
export function QuickTipsButton({ onOpenSettings }: QuickTipsButtonProps) {
  const registry = useShortcutRegistry();
  const { hasUnread, markAllSeen } = useUnreadChangelog();
  const [open, setOpen] = useState(false);

  if (registry.cheatsheetOpen) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="pointer-events-auto flex w-[240px] flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]"
          >
            <QuickAction
              icon={<Keyboard size={13} aria-hidden="true" />}
              label="Keyboard shortcuts"
              hint="?"
              onClick={() => {
                registry.setCheatsheetOpen(true);
                setOpen(false);
              }}
            />
            <QuickAction
              icon={<Sparkles size={13} aria-hidden="true" />}
              label="What's new"
              hint={hasUnread ? 'new' : undefined}
              onClick={() => {
                markAllSeen();
                onOpenSettings();
                setOpen(false);
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Quick tips and shortcuts"
        aria-expanded={open}
        title="Quick tips · press ? for shortcuts"
        className="pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-[0_18px_44px_-22px_rgba(0,0,0,0.6)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        <HelpCircle size={18} aria-hidden="true" />
        {hasUnread ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 inline-block h-2 w-2 rounded-full border border-[var(--color-surface)]"
            style={{ background: 'var(--color-accent)' }}
          />
        ) : null}
      </button>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-left text-[13px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-raised)]"
    >
      <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
        {icon}
        <span className="text-[var(--color-text)]">{label}</span>
      </span>
      {hint ? (
        <span className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
