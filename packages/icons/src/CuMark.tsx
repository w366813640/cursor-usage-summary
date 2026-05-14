import type { SVGProps } from 'react';

export interface CuMarkProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number | string;
  strokeWidth?: number;
}

/**
 * CuMark — the cursor-usage-viz brand glyph.
 *
 * A bracketed bar-chart silhouette. The two outer brackets read as "scope
 * delimiters" (you're looking at *your* data), the three inner bars read as
 * a sparkline. Deliberately low-detail so it scales cleanly from 16px
 * (sidebar / favicon) to 64px (welcome card).
 */
export function CuMark({ size = 24, strokeWidth = 1.6, className, ...rest }: CuMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {/* Left bracket */}
      <path d="M5 5 L3 5 L3 19 L5 19" />
      {/* Right bracket */}
      <path d="M19 5 L21 5 L21 19 L19 19" />
      {/* Three ascending bars (a sparkline) */}
      <path d="M8 16 L8 13" />
      <path d="M12 16 L12 10" />
      <path d="M16 16 L16 7" />
    </svg>
  );
}
