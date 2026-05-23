import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.stories.tsx',
        'src/test/**',
        'src/index.tsx',
        'src/router.tsx',
      ],
      thresholds: {
        statements: 49,
        branches: 75,
        functions: 27,
        lines: 49,
      },
    },
  },
});