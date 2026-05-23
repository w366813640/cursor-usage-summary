import { ArrowRight, ChevronLeft, X } from '@cu/icons';
import { useT } from '@cu/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useDrawerA11y } from '../hooks/useDrawerA11y';

const STORAGE_KEY = 'cu:onboardingV1Done';

interface Step {
  titleKey: string;
  bodyKey: string;
  ctaKey?: string;
}

// Step content lives in the dictionary (tour.step1.* / step2.* / step3.*).
// Keep this list short — 3 steps was the user-tested max before
// people started skipping.
const STEPS: Step[] = [
  { titleKey: 'tour.step1.title', bodyKey: 'tour.step1.body' },
  { titleKey: 'tour.step2.title', bodyKey: 'tour.step2.body' },
  { titleKey: 'tour.step3.title', bodyKey: 'tour.step3.body', ctaKey: 'tour.step3.cta' },
];

/**
 * First-run product tour. Pure modal-style (no DOM coachmarks) so it
 * survives layout changes between releases. Three steps — short
 * enough that an experienced user can dismiss with one Esc, long
 * enough to point out the chrome they'd otherwise miss on day one.
 *
 * Gate: localStorage `cu:onboardingV1Done`. Bumping the suffix
 * forces a re-show after a major UX revamp.
 */
export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useDrawerA11y(open, () => finish());
  const t = useT();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (seen !== '1') {
        // Defer one tick so we land *after* the dashboard's own
        // mount animation — popping a modal during the route's
        // fade-in feels jarring. Local `timerId` (not `t`) avoids
        // shadowing the outer translator binding.
        const timerId = window.setTimeout(() => setOpen(true), 600);
        return () => window.clearTimeout(timerId);
      }
    } catch {
      // localStorage unavailable (private mode) — just don't show
    }
  }, []);

  function finish() {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // ignore
      }
    }
    setOpen(false);
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && current ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[55] flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-6"
          role="presentation"
          onClick={finish}
        >
          <motion.div
            ref={dialogRef as React.Ref<HTMLDivElement>}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('quickTips.title')}
            className="flex w-full max-w-[420px] flex-col gap-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
                {t('tour.stepIndicator', { current: step + 1, total: STEPS.length })}
              </span>
              <button
                type="button"
                onClick={finish}
                aria-label={t('tour.skipAria')}
                className="rounded-md border border-[var(--color-border)] p-1 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-serif text-[20px] leading-tight tracking-tight">
                {t(current.titleKey)}
              </h2>
              <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                {t(current.bodyKey)}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft size={11} aria-hidden="true" />
                {t('common.back')}
              </button>
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: step dots are positional and stable
                    key={`tour-dot-${i}`}
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full transition-colors"
                    style={{
                      background: i === step ? 'var(--color-accent)' : 'var(--color-border-strong)',
                    }}
                  />
                ))}
              </div>
              {isLast ? (
                <button
                  type="button"
                  onClick={finish}
                  className="flex items-center gap-1 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-opacity"
                  style={{
                    background: 'var(--color-accent)',
                    color: 'var(--color-bg)',
                    borderColor: 'var(--color-accent)',
                  }}
                >
                  {current.ctaKey ? t(current.ctaKey) : t('common.done')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="flex items-center gap-1 rounded-md border border-[var(--color-accent)] bg-transparent px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)]"
                >
                  {t('common.next')}
                  <ArrowRight size={11} aria-hidden="true" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
