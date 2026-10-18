import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Two pages: the teacher website (index.html) and the workbench screen (bench.html).
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), bench: resolve(__dirname, 'bench.html') },
    },
  },
  server: {
    // the bench UI imports the shared protocol types from ../protocol
    fs: { allow: ['..'] },
    // graph_validator (FastAPI): `npm run validator`
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
});
