import { useEffect, useRef } from 'react';

/**
 * Modal / drawer accessibility primitives. Each function is small
 * enough on its own that we could inline them, but bundling them
 * here keeps the contract explicit:
 *
 *   - `useEscToClose(open, onClose)` — Esc key closes the drawer.
 *     Listener only attaches while `open` is true so multiple
 *     simultaneous drawers don't fight over the keystroke.
 *   - `useAutoFocusFirst(open, ref)` — focuses the first
 *     interactive element inside `ref` when the drawer opens.
 *     Falls back to the container itself if no focusable child is
 *     found (so screen readers still get the dialog announcement).
 *   - `useFocusTrap(open, ref)` — keeps Tab/Shift-Tab cycling
 *     within the drawer while it's open. Prevents the user from
 *     escaping into the underlying dashboard chrome.
 *
 * The user-facing payoff: keyboard users can open Settings, Tab to
 * what they need, hit Esc to dismiss, and never accidentally focus
 * a button behind the modal backdrop.
 */

export function useEscToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Stop propagation so a parent listener (e.g. command
        // palette's own Esc handling) doesn't double-fire.
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [open, onClose]);
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useAutoFocusFirst(open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    // Defer to next tick so the drawer's content has actually
    // rendered into the DOM before we query for focusables.
    const timer = window.setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('data-skip-autofocus'),
      );
      const target = focusables[0] ?? node;
      target.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open, ref]);
}

export function useFocusTrap(open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const node = ref.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('data-skip-autofocus'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, ref]);
}

/**
 * Convenience bundle for the common drawer/modal pattern. Returns a
 * ref to attach to the dialog container. Consumers just do:
 *
 *   const dialogRef = useDrawerA11y(open, onClose);
 *   <motion.aside ref={dialogRef} ...>
 */
export function useDrawerA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement | null>(null);
  useEscToClose(open, onClose);
  useAutoFocusFirst(open, ref);
  useFocusTrap(open, ref);
  return ref;
}
