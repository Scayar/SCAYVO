import { defineConfig } from 'tsup';

const shared = {
  format: ['esm'] as const,
  dts: true,
  sourcemap: true,
  target: 'es2022' as const,
  treeshake: true,
};

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    clean: true,
    platform: 'neutral',
  },
  {
    ...shared,
    entry: { 'vite/index': 'src/vite/index.ts' },
    clean: false,
    platform: 'node',
    external: ['vite', 'jiti', 'msw', 'ws'],
  },
  {
    ...shared,
    entry: { 'cli/index': 'src/cli/index.ts' },
    clean: false,
    platform: 'node',
    external: ['vite', 'jiti', 'msw', 'ws'],
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    ...shared,
    entry: {
      'client/index': 'src/client/index.ts',
      'react/index': 'src/react/index.ts',
    },
    clean: false,
    platform: 'browser',
    external: [
      'msw',
      'msw/browser',
      'react',
      'react-dom',
      'react-dom/client',
      'virtual:scayvo/session',
    ],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
]);
