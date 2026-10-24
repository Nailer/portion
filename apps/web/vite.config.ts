import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Public preview can proxy the hosted API without copying server credentials.
const apiTarget = process.env.PORTION_API_TARGET ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: apiTarget, changeOrigin: true }, '/metrics': { target: apiTarget, changeOrigin: true } } },
  define: { global: 'globalThis' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
