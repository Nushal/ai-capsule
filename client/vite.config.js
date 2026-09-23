import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In production Express serves the built files from client/dist, so the
// frontend and API share one URL. During `npm run dev:client` Vite proxies
// API calls to the Express server on port 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
