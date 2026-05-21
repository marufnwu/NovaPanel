import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8443',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8443',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom')) return 'vendor-react';
          if (id.includes('react/')) return 'vendor-react';
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('xterm')) return 'vendor-xterm';
          if (id.includes('@tanstack/react-query')) return 'vendor-react-query';
          if (id.includes('@tanstack/react-router')) return 'vendor-router';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('dnd-kit')) return 'vendor-dnd';
          if (id.includes('zustand')) return 'vendor-state';
          if (id.includes('clsx') || id.includes('tailwind-merge')) return 'vendor-tailwind';
          if (id.includes('nanoid')) return 'vendor-utils';
          if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) return 'vendor-date';
          if (id.includes('zod')) return 'vendor-zod';
          if (id.includes('axios') || id.includes('ky') || id.includes('ky-universal')) return 'vendor-http';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          return 'vendor-misc';
        },
      },
    },
  },
});
