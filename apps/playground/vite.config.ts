import path from 'node:path';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

const devHost = process.env.HOST ?? 'localhost';
const devPort = Number(process.env.PORT ?? '5173');

/**
 * Inject `<link rel="preload" as="font">` for the latin variable-font
 * subsets so the browser starts fetching them during HTML parse instead
 * of after CSS is parsed and layout discovers the @font-face. We preload
 * only `*-latin-wght-normal` (Inter body, JetBrains mono labels, Space
 * Grotesk display) — all three render above the fold immediately. The
 * heavier `latin-ext` subsets keep their unicode-range lazy behaviour
 * (only fetched if an extended-latin glyph actually paints), so we never
 * push them onto the critical path. Hashes are read from the emitted
 * bundle so this stays correct across rebuilds.
 */
function preloadLatinFonts(): Plugin {
  return {
    name: 'cu-preload-latin-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const fontFiles = Object.keys(bundle)
          .filter((fileName) => /latin-wght-normal-[^/]*\.woff2$/.test(fileName))
          .sort();
        return {
          html,
          tags: fontFiles.map((fileName) => ({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              href: `./${fileName}`,
              crossorigin: '',
            },
            injectTo: 'head',
          })),
        };
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwind(), preloadLatinFonts()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@cu/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@cu/tokens': path.resolve(__dirname, '../../packages/tokens/src'),
      '@cu/motion': path.resolve(__dirname, '../../packages/motion/src'),
      '@cu/icons': path.resolve(__dirname, '../../packages/icons/src'),
      '@cu/brand': path.resolve(__dirname, '../../packages/brand/src'),
      '@cu/data': path.resolve(__dirname, '../../packages/data/src'),
      '@cu/pricing': path.resolve(__dirname, '../../packages/pricing/src'),
      '@cu/charts': path.resolve(__dirname, '../../packages/charts/src'),
    },
  },
  server: {
    host: devHost,
    port: devPort,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'chrome120',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // framer-motion is intentionally NOT pinned to a manual chunk: the
          // LazyMotion `m` core is statically imported (first paint) while the
          // `domMax` feature bundle is dynamically imported (src/motionFeatures.ts).
          // Forcing both into one chunk would defeat the lazy split and pull the
          // heavy feature code back onto the critical path, so we let Rollup
          // separate the static core from the async feature chunk.
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('lucide-react')) return 'vendor-icons';
          // d3 is split by first-paint need. The eager KPI hero pulls
          // d3-array/scale/shape (sparkline) + d3-format (number fmt);
          // scaleTime also drags in d3-time and d3-time-format, so all of
          // those stay in the eager vendor chunk. d3-hierarchy (Treemap)
          // is reachable only from lazy routes (Models/YearReview), so it
          // gets its own shared lazy chunk off the critical path.
          if (id.includes('d3-hierarchy')) return 'vendor-d3-lazy';
          if (id.includes('d3-')) return 'vendor-d3';
          if (id.includes('@tanstack')) return 'vendor-tanstack';
          return undefined;
        },
      },
    },
  },
});
