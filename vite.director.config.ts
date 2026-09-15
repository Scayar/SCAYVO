import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(root, 'src/director'),
  base: '/__scayvo/',
  plugins: [react()],
  build: {
    outDir: resolve(root, 'dist/director'),
    emptyOutDir: true,
    sourcemap: true,
    assetsDir: 'assets',
  },
});
