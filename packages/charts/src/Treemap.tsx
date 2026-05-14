import {
  type HierarchyRectangularNode,
  treemap as d3Treemap,
  hierarchy,
  treemapSquarify,
} from 'd3-hierarchy';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { fmtPercent, fmtUSD } from './utils';

export interface TreemapDatum {
  id: string;
  label: string;
  value: number;
  color?: string;
  /** Optional secondary label (e.g. provider). */
  group?: string;
}

export interface TreemapProps {
  data: ReadonlyArray<TreemapDatum>;
  width?: number;
  height?: number;
  onSelect?: (id: string) => void;
  /** Optional value formatter. Default fmtUSD. */
  formatValue?: (n: number) => string;
}

const GROUP_PALETTE: Record<string, string> = {
  anthropic: 'var(--cu-cat-1)',
  openai: 'var(--cu-cat-2)',
  cursor: 'var(--cu-cat-3)',
  google: 'var(--cu-cat-4)',
  xai: 'var(--cu-cat-5)',
  other: 'var(--cu-cat-6)',
};

/**
 * Treemap = "what share of $ did each model burn?". Uses squarified
 * tiling for legibility; tiles smaller than 24×16 hide their label so
 * we don't render unreadable text overlapping a 2px sliver.
 */
export function Treemap({
  data,
  width = 720,
  height = 360,
  onSelect,
  formatValue = fmtUSD,
}: TreemapProps) {
  const [hover, setHover] = useState<string | null>(null);

  const leaves = useMemo(() => {
    const total = data.reduce((acc, d) => acc + d.value, 0);
    type Node = TreemapDatum & { children?: TreemapDatum[] };
    const root = hierarchy<Node>({ children: data as TreemapDatum[] } as Node)
      .sum((d) => (d.children ? 0 : (d.value ?? 0)))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const laid = d3Treemap<Node>()
      .tile(treemapSquarify)
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(0)(root) as HierarchyRectangularNode<Node>;
    return laid.leaves().map((leaf) => {
      const d = leaf.data;
      const w = leaf.x1 - leaf.x0;
      const h = leaf.y1 - leaf.y0;
      return {
        ...d,
        x: leaf.x0,
        y: leaf.y0,
        w,
        h,
        pct: total > 0 ? d.value / total : 0,
      };
    });
  }, [data, width, height]);

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} role="img" aria-label="Cost share treemap">
        {leaves.map((leaf, i) => {
          const color =
            leaf.color ??
            (leaf.group
              ? (GROUP_PALETTE[leaf.group.toLowerCase()] ?? 'var(--cu-cat-6)')
              : 'var(--cu-cat-6)');
          const isHover = hover === leaf.id;
          const showLabel = leaf.w >= 56 && leaf.h >= 30;
          const showSub = leaf.w >= 80 && leaf.h >= 48;
          // Tile grow is staggered by rank (largest first) so the most
          // significant tiles read before tiny slivers fill in.
          const growDelay = 0.08 + Math.min(i, 18) * 0.045;
          return (
            <motion.g
              key={leaf.id}
              transform={`translate(${leaf.x}, ${leaf.y})`}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.28, delay: growDelay, ease: [0.2, 0, 0, 1] }}
              onMouseEnter={() => setHover(leaf.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(leaf.id)}
            >
              <motion.rect
                width={leaf.w}
                height={leaf.h}
                rx={3}
                ry={3}
                fill={color}
                fillOpacity={isHover ? 0.95 : 0.75}
                stroke={isHover ? 'var(--color-text)' : 'transparent'}
                strokeWidth={1.5}
                initial={{ scaleX: 0, scaleY: 0, originX: 0, originY: 0 }}
                animate={{ scaleX: 1, scaleY: 1 }}
                transition={{
                  duration: 0.48,
                  delay: growDelay,
                  ease: [0.2, 0, 0, 1],
                }}
              />
              {showLabel ? (
                <motion.text
                  x={8}
                  y={16}
                  fill="var(--color-bg)"
                  fontFamily="var(--font-mono)"
                  fontSize={11}
                  fontWeight={600}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: growDelay + 0.36 }}
                >
                  {leaf.label.length > Math.floor(leaf.w / 7)
                    ? `${leaf.label.slice(0, Math.max(2, Math.floor(leaf.w / 7) - 1))}…`
                    : leaf.label}
                </motion.text>
              ) : null}
              {showSub ? (
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: growDelay + 0.46 }}
                >
                  <text
                    x={8}
                    y={32}
                    fill="var(--color-bg)"
                    fontFamily="var(--font-mono)"
                    fontSize={11}
                    fillOpacity={0.85}
                  >
                    {formatValue(leaf.value)}
                  </text>
                  <text
                    x={8}
                    y={46}
                    fill="var(--color-bg)"
                    fontFamily="var(--font-mono)"
                    fontSize={10}
                    fillOpacity={0.7}
                  >
                    {fmtPercent(leaf.pct, 1)}
                  </text>
                </motion.g>
              ) : null}
            </motion.g>
          );
        })}
      </svg>
      {hover ? (
        <div
          className="pointer-events-none absolute right-2 top-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 font-mono text-[11px] text-[var(--color-text)] shadow-lg"
          style={{ whiteSpace: 'nowrap' }}
        >
          {(() => {
            const leaf = leaves.find((l) => l.id === hover);
            if (!leaf) return null;
            return (
              <>
                <span className="text-[var(--color-accent)]">{leaf.label}</span>
                <span className="px-1 text-[var(--color-text-subtle)]">·</span>
                <span>{formatValue(leaf.value)}</span>
                <span className="px-1 text-[var(--color-text-subtle)]">·</span>
                <span>{fmtPercent(leaf.pct, 1)}</span>
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
