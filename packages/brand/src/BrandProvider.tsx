import { CuMark } from '@cu/icons';
import { type CSSProperties, type ReactNode, createContext, useContext, useMemo } from 'react';
import type { BrandTheme } from './types';

/**
 * Default brand · "Linear Glass" — cool graphite + violet.
 *
 * Deliberately carries NO palette overrides: the design tokens in
 * @cu/tokens (violet accent, glass shadows) are the single source of
 * truth, and this brand simply lets them through. Alternates below
 * override the accent trio for users who want a different mood.
 */
export const cuLinearGlassBrand: BrandTheme = {
  id: 'cu-linear-glass',
  name: 'Cursor Usage',
  tagline: 'Glass-dark usage analytics',
  logo: <CuMark size={22} />,
  logoCompact: <CuMark size={18} />,
  preferTheme: 'dark',
};

/**
 * Classic warm brand · the original Bloomberg-leaning amber palette,
 * kept as an alternate for users attached to the v1 look.
 */
export const cuClassicWarmBrand: BrandTheme = {
  id: 'cu-classic-warm',
  name: 'Cursor Usage · Classic',
  tagline: 'Warm amber terminal aesthetic',
  logo: <CuMark size={22} />,
  logoCompact: <CuMark size={18} />,
  preferTheme: 'dark',
  palette: {
    accent: '#db8460',
    accentHover: '#e9946f',
    accentSoft: '#3f2c22',
    mark: '#db8460',
  },
};

/**
 * Mono brand · charcoal/ink monochrome. Useful when you want the data
 * sparklines and the heatmap to do all the talking.
 */
export const cuMonoBrand: BrandTheme = {
  id: 'cu-mono',
  name: 'Cursor Usage · Mono',
  tagline: 'Monochrome — let the data speak',
  logo: <CuMark size={22} />,
  logoCompact: <CuMark size={18} />,
  preferTheme: 'dark',
  palette: {
    accent: '#c4c2bc',
    accentHover: '#e1dfd8',
    accentSoft: '#262833',
    mark: '#c4c2bc',
  },
};

/**
 * Aurora brand · electric cyan over the same graphite base. A cooler,
 * higher-energy alternate to the violet default.
 */
export const cuAuroraBrand: BrandTheme = {
  id: 'cu-aurora',
  name: 'Cursor Usage · Aurora',
  tagline: 'Electric cyan night mode',
  logo: <CuMark size={22} />,
  logoCompact: <CuMark size={18} />,
  preferTheme: 'dark',
  palette: {
    accent: '#22d3ee',
    accentHover: '#4be0f5',
    accentSoft: '#0f2e38',
    mark: '#22d3ee',
  },
};

/** @deprecated Renamed — the default brand is now `cuLinearGlassBrand`. */
export const cuBloombergBrand = cuClassicWarmBrand;

export const builtInBrands: readonly BrandTheme[] = [
  cuLinearGlassBrand,
  cuClassicWarmBrand,
  cuMonoBrand,
  cuAuroraBrand,
];

const BrandContext = createContext<BrandTheme>(cuLinearGlassBrand);

export interface BrandProviderProps {
  brand?: BrandTheme;
  children: ReactNode;
}

export function BrandProvider({ brand = cuLinearGlassBrand, children }: BrandProviderProps) {
  const cssVars = useMemo<CSSProperties>(() => {
    const style: Record<string, string> = {};
    const p = brand.palette;
    if (p?.accent) style['--color-accent'] = p.accent;
    if (p?.accentHover) style['--color-accent-hover'] = p.accentHover;
    if (p?.accentSoft) style['--color-accent-soft'] = p.accentSoft;
    if (p?.mark) style['--color-brand-mark'] = p.mark;
    const f = brand.fonts;
    if (f?.serif) style['--font-serif'] = f.serif;
    if (f?.sans) style['--font-sans'] = f.sans;
    if (f?.mono) style['--font-mono'] = f.mono;
    return style as CSSProperties;
  }, [brand]);

  const transitionStyle: CSSProperties = {
    transition:
      'background-color 320ms cubic-bezier(0.2,0,0,1), color 320ms cubic-bezier(0.2,0,0,1)',
  };

  return (
    <BrandContext.Provider value={brand}>
      <div style={{ ...cssVars, ...transitionStyle }} className="contents">
        {children}
      </div>
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandTheme {
  return useContext(BrandContext);
}
