import { CuMark } from '@cu/icons';
import { type CSSProperties, type ReactNode, createContext, useContext, useMemo } from 'react';
import type { BrandTheme } from './types';

/**
 * Default brand · Bloomberg-leaning power tool aesthetic.
 *
 * Deep brown background, warm orange accent, JetBrains Mono for data — the
 * intent is "open this in a dim room at midnight to find that one expensive
 * Opus request." Pairs naturally with the dark theme.
 */
export const cuBloombergBrand: BrandTheme = {
  id: 'cu-bloomberg',
  name: 'Cursor Usage',
  tagline: 'Bloomberg Terminal-style usage analytics',
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
 * Warm restrained brand · same warm palette as the base projects, recommended
 * for daytime use. Same data, gentler aesthetic.
 */
export const cuWarmBrand: BrandTheme = {
  id: 'cu-warm',
  name: 'Cursor Usage · Warm',
  tagline: 'Warm-restrained tool aesthetic',
  logo: <CuMark size={22} />,
  logoCompact: <CuMark size={18} />,
  preferTheme: 'light',
  palette: {
    accent: '#c96f4a',
    accentHover: '#b85f3d',
    accentSoft: '#f7e7d9',
    mark: '#c96f4a',
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
    accentSoft: '#2b2926',
    mark: '#c4c2bc',
  },
};

export const builtInBrands: readonly BrandTheme[] = [cuBloombergBrand, cuWarmBrand, cuMonoBrand];

const BrandContext = createContext<BrandTheme>(cuBloombergBrand);

export interface BrandProviderProps {
  brand?: BrandTheme;
  children: ReactNode;
}

export function BrandProvider({ brand = cuBloombergBrand, children }: BrandProviderProps) {
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
