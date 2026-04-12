import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy all /api/* requests to the Express backend
      // This lets frontend code call /api/status without CORS issues
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy WebSocket connections for the agent dashboard
      // new WebSocket('ws://localhost:3000/ws') → ws://localhost:3001/ws
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
