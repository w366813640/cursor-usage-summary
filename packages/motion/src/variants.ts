import type { Variants } from 'framer-motion';
import { durations, easings, springs } from './springs';

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durations.base, ease: easings.standard } },
  exit: { opacity: 0, transition: { duration: durations.fast, ease: easings.standard } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springs.gentle },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: durations.fast, ease: easings.standard },
  },
};

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.medium, ease: easings.emphasized },
  },
  exit: { opacity: 0, x: 24, transition: { duration: durations.fast, ease: easings.standard } },
};

export const slideFromBottom: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.medium, ease: easings.emphasized },
  },
  exit: { opacity: 0, y: 12, transition: { duration: durations.fast, ease: easings.standard } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: springs.snappy },
  exit: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: durations.fast, ease: easings.standard },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.medium, ease: easings.standard } },
};

/**
 * Suggestion-specific lifecycles. `staleOut` is what plays when a user edits
 * inside a suggestion's highlightRanges — the suggestion fades and slightly
 * collapses, signaling "this is no longer applicable" within ~120ms.
 */
export const suggestionMount: Variants = {
  hidden: { opacity: 0, y: 4, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springs.gentle },
};

export const staleOut: Variants = {
  visible: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: durations.fast, ease: easings.standard },
  },
};
