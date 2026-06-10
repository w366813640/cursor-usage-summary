/**
 * Design tokens — TypeScript representation.
 *
 * The ground truth lives in CSS variables (see `./css/*.css`). These TS
 * exports mirror the shape so consumers can inspect / generate docs /
 * theme programmatically.
 */

export const lightColors = {
  bg: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F6',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#E7E9F1',
  text: '#15171E',
  textMuted: '#5B5E6B',
  textSubtle: '#9094A3',
  border: '#E3E5EE',
  borderStrong: '#C9CCDA',
  accent: '#7C3AED',
  accentHover: '#6D28D9',
  accentSoft: '#F1EBFE',
  accentText: '#FFFFFF',
  destructive: '#E5484D',
  destructiveSoft: '#FDEBEC',
  success: '#0E9F6E',
  warning: '#D97706',
  info: '#3B82F6',
  user: '#1D1F29',
  userBg: '#EAECF4',
} as const;

export const darkColors = {
  bg: '#0A0B0F',
  surface: '#12141A',
  surfaceMuted: '#1A1D26',
  surfaceRaised: '#1E212C',
  surfaceSunken: '#07080B',
  text: '#EDEEF4',
  textMuted: '#A5A8B7',
  textSubtle: '#6E7180',
  border: '#23262F',
  borderStrong: '#343845',
  accent: '#8B5CF6',
  accentHover: '#9D77F8',
  accentSoft: '#221C3D',
  accentText: '#FFFFFF',
  destructive: '#F26D7E',
  destructiveSoft: '#371B22',
  success: '#34D399',
  warning: '#FBBF24',
  info: '#60A5FA',
  user: '#EDEEF4',
  userBg: '#1A1D26',
} as const;

export type ColorKey = keyof typeof lightColors;

export const suggestionCategoryColors = {
  light: {
    correctness: '#C4493A',
    clarity: '#2F74C7',
    engagement: '#6B4EC1',
    delivery: '#2F8F6E',
    tone: '#B07024',
    citation: '#4A667A',
  },
  dark: {
    correctness: '#E07868',
    clarity: '#6C9EE3',
    engagement: '#9D8AD9',
    delivery: '#5DBE96',
    tone: '#D29959',
    citation: '#82A0B6',
  },
} as const;

export type SuggestionCategoryToken = keyof typeof suggestionCategoryColors.light;

export const radius = {
  none: '0px',
  xs: '6px',
  sm: '8px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const space = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const fontFamily = {
  /** Display face. The CSS variable is still `--font-serif` for legacy
   *  utility-class reasons; the actual face is Space Grotesk. */
  serif: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  display: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'SF Mono', Menlo, Consolas, monospace",
} as const;

export const fontSize = {
  '2xs': ['11px', { lineHeight: '14px' }],
  xs: ['12px', { lineHeight: '16px' }],
  sm: ['13px', { lineHeight: '18px' }],
  base: ['14px', { lineHeight: '21px' }],
  md: ['15px', { lineHeight: '23px' }],
  lg: ['17px', { lineHeight: '26px' }],
  xl: ['20px', { lineHeight: '28px' }],
  '2xl': ['24px', { lineHeight: '32px' }],
  '3xl': ['30px', { lineHeight: '38px' }],
  '4xl': ['38px', { lineHeight: '46px' }],
} as const;

export const shadow = {
  none: 'none',
  xs: '0 1px 2px rgba(18, 18, 26, 0.06)',
  composer: '0 1px 0 rgba(18,18,26,0.04), 0 8px 24px -12px rgba(18,18,26,0.10)',
  composerFocus: '0 1px 0 rgba(18,18,26,0.06), 0 12px 32px -10px rgba(18,18,26,0.14)',
  popover: '0 8px 28px -8px rgba(18,18,26,0.18), 0 2px 6px rgba(18,18,26,0.06)',
  modal: '0 24px 64px -16px rgba(18,18,26,0.28), 0 8px 16px -8px rgba(18,18,26,0.10)',
  card: '0 1px 2px rgba(18, 18, 26, 0.04)',
  glow: '0 0 28px -6px rgba(139, 92, 246, 0.55)',
} as const;

export const motion = {
  duration: {
    instant: '60ms',
    fast: '120ms',
    base: '180ms',
    medium: '240ms',
    slow: '320ms',
    slower: '480ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  spring: {
    gentle: { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 },
    snappy: { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 },
    bouncy: { type: 'spring', stiffness: 320, damping: 18, mass: 1 },
  },
} as const;

export const editorMetrics = {
  maxWidth: {
    narrow: '640px',
    medium: '760px',
    wide: '960px',
  },
  fontScale: {
    small: 0.9375,
    medium: 1,
    large: 1.0625,
  },
  gutterWidth: '28px',
  markerBarWidth: '3px',
  agentRailWidth: '56px',
  agentPanelWidth: '360px',
} as const;

export const z = {
  base: 0,
  raised: 10,
  sticky: 20,
  dropdown: 100,
  popover: 200,
  tooltip: 300,
  modalBackdrop: 400,
  modal: 410,
  toast: 500,
  titlebar: 1000,
} as const;

export const tokens = {
  colors: { light: lightColors, dark: darkColors },
  suggestionCategoryColors,
  radius,
  space,
  fontFamily,
  fontSize,
  shadow,
  motion,
  editorMetrics,
  z,
} as const;
