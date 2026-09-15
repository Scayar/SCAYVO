import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { scayvo } from 'scayvo/vite';

export default defineConfig({
  plugins: [react(), scayvo()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
