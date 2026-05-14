import type { ReactNode } from 'react';

export interface BrandPalette {
  accent?: string;
  accentHover?: string;
  accentSoft?: string;
  mark?: string;
}

export interface BrandFonts {
  serif?: string;
  sans?: string;
  mono?: string;
}

export interface BrandTheme {
  /** Stable id, lowercase kebab. */
  id: string;
  /** Display name shown in TitleBar / Sidebar. */
  name: string;
  /** Logo node — pass any React element. */
  logo?: ReactNode;
  /** Compact logo for narrow icon rail (16-20px). */
  logoCompact?: ReactNode;
  /** Color overrides; falls back to active design tokens. */
  palette?: BrandPalette;
  /** Font family overrides. */
  fonts?: BrandFonts;
  /** Optional one-line tagline shown under the brand name in welcome. */
  tagline?: string;
  /** Default theme this brand was designed for ("dark" | "light"). */
  preferTheme?: 'dark' | 'light';
}
