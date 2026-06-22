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

/**
 * Right-edge off-canvas drawer (Settings / Import preview / Import
 * history). The scrim decelerates in while the panel rides a `silky`
 * spring — the preset tuned for panel sweeps, slightly overdamped so it
 * settles with weight and no bounce. Exit accelerates out so dismissal
 * reads as instant. Under reduced motion, MotionConfig
 * (`reducedMotion="user"`) strips the x-transform and keeps the fade.
 */
export const drawerScrim: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durations.medium, ease: easings.decelerate } },
  exit: { opacity: 0, transition: { duration: durations.base, ease: easings.accelerate } },
};

export const drawerPanelRight: Variants = {
  // Slides in fully opaque so the body's staggered fade reads cleanly
  // (no double-fade from the panel itself). Exit fades + slides out.
  hidden: { x: 56 },
  visible: { x: 0, transition: springs.silky },
  exit: {
    opacity: 0,
    x: 56,
    transition: { duration: durations.medium, ease: easings.accelerate },
  },
};

/**
 * Drawer body orchestrator. Pair with `drawerPanelRight` on the panel:
 * the panel slides in while this container cascades its `drawerItem`
 * children (sections / list rows) so the title lands first and the
 * groups emerge in sequence. `delayChildren` lets the slide get under
 * way before the cascade starts. Reduced motion keeps the opacity fade
 * and drops the y-offset (handled globally by MotionConfig).
 */
export const drawerContent: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.08, staggerChildren: 0.04 } },
};

export const drawerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.medium, ease: easings.decelerate },
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
