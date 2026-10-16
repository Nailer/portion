import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787', '/metrics': 'http://localhost:8787' } },
  define: { global: 'globalThis' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
