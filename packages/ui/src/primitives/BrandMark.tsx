import { CuMark } from '@cu/icons';
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../utils';

export interface BrandMarkProps {
  size?: number;
  /** Replace the default CuMark glyph. */
  glyph?: ReactNode;
  /**
   * Animation strategy:
   *  - `none`     : static
   *  - `hover`    : tilt + pop on hover (default)
   *  - `idle-pulse`: slow ambient breathe-rotate
   *  - `streaming`: continuous spin (use during async work)
   */
  motion?: 'none' | 'hover' | 'idle-pulse' | 'streaming';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * Animated wrapper around the brand glyph. Pure visual layer — no business
 * logic — so any consumer can give the brand mark a subtle feeling of life.
 */
export function BrandMark({
  size = 22,
  glyph,
  motion: variant = 'hover',
  className,
  style,
  onClick,
  ariaLabel = 'Brand',
}: BrandMarkProps) {
  const reduced = useReducedMotion();

  const inner = glyph ?? <CuMark size={size} />;

  const motionProps: Record<string, unknown> = (() => {
    if (reduced || variant === 'none') return {};
    if (variant === 'streaming') {
      return {
        animate: { rotate: 360 },
        transition: { duration: 1.4, ease: 'linear', repeat: Number.POSITIVE_INFINITY },
      };
    }
    if (variant === 'idle-pulse') {
      return {
        animate: {
          rotate: [0, 6, 0, -6, 0],
          scale: [1, 1.05, 1, 1.02, 1],
        },
        transition: {
          duration: 6,
          ease: 'easeInOut',
          repeat: Number.POSITIVE_INFINITY,
        },
      };
    }
    return {
      whileHover: { rotate: 6, scale: 1.06 },
      whileTap: { rotate: -4, scale: 0.94 },
      transition: { type: 'spring', stiffness: 360, damping: 18 },
    };
  })();

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center justify-center text-[var(--color-brand-mark,var(--color-accent))]',
          'rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          className,
        )}
        style={style}
        {...motionProps}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <motion.span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center text-[var(--color-brand-mark,var(--color-accent))]',
        className,
      )}
      style={style}
      {...motionProps}
    >
      {inner}
    </motion.span>
  );
}
