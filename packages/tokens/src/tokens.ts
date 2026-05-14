/**
 * Design tokens — TypeScript representation.
 *
 * The ground truth lives in CSS variables (see `./css/*.css`). These TS
 * exports mirror the shape so consumers can inspect / generate docs /
 * theme programmatically.
 */

export const lightColors = {
  bg: '#F7F3EA',
  surface: '#FFFAF2',
  surfaceMuted: '#EFE8DC',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EBE3D5',
  text: '#2B2926',
  textMuted: '#7B746B',
  textSubtle: '#A8A096',
  border: '#E2D9CB',
  borderStrong: '#CFC4B2',
  accent: '#C96F4A',
  accentHover: '#B85F3D',
  accentSoft: '#F7E7D9',
  accentText: '#FFFFFF',
  destructive: '#D14343',
  destructiveSoft: '#FBE7E7',
  success: '#3F9871',
  warning: '#C8862A',
  info: '#5577B8',
  user: '#33312D',
  userBg: '#EEE7DC',
} as const;

export const darkColors = {
  bg: '#1D1B17',
  surface: '#25231F',
  surfaceMuted: '#2E2B25',
  surfaceRaised: '#36332C',
  surfaceSunken: '#161412',
  text: '#F1ECE2',
  textMuted: '#B8AF9F',
  textSubtle: '#877E70',
  border: '#3C3832',
  borderStrong: '#554F45',
  accent: '#DB8460',
  accentHover: '#E9946F',
  accentSoft: '#3F2C22',
  accentText: '#FFFFFF',
  destructive: '#E16868',
  destructiveSoft: '#3B1F1F',
  success: '#5BAE85',
  warning: '#D49A45',
  info: '#7C9AD9',
  user: '#F1ECE2',
  userBg: '#2E2B25',
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
  serif:
    "'Source Serif 4', 'Source Serif Pro', 'Tiempos Headline', 'Iowan Old Style', 'Apple Garamond', Georgia, 'Times New Roman', serif",
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
  xs: '0 1px 2px rgba(53, 41, 28, 0.05)',
  composer: '0 1px 0 rgba(53,41,28,0.04), 0 8px 24px -12px rgba(53,41,28,0.10)',
  composerFocus: '0 1px 0 rgba(53,41,28,0.06), 0 12px 32px -10px rgba(53,41,28,0.14)',
  popover: '0 8px 28px -8px rgba(53,41,28,0.18), 0 2px 6px rgba(53,41,28,0.06)',
  modal: '0 24px 64px -16px rgba(53,41,28,0.28), 0 8px 16px -8px rgba(53,41,28,0.10)',
  card: '0 1px 2px rgba(53, 41, 28, 0.04)',
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
