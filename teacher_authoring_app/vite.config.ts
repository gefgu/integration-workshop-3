import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // graph_validator (FastAPI): `npm run validator`
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
});
