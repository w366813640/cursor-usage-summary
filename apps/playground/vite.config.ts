import path from 'node:path';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const devHost = process.env.HOST ?? 'localhost';
const devPort = Number(process.env.PORT ?? '5173');

export default defineConfig({
  base: './',
  plugins: [react(), tailwind()],
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
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('d3-')) return 'vendor-d3';
          if (id.includes('@tanstack')) return 'vendor-tanstack';
          return undefined;
        },
      },
    },
  },
});
