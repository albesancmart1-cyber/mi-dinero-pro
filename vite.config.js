import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // En local, `vercel dev` sirve /api; con `npm run dev` se puede apuntar a producción:
    // VITE_API_PROXY=https://mi-dinero-pro-ohx7.vercel.app npm run dev
    proxy: process.env.VITE_API_PROXY ? { '/api': { target: process.env.VITE_API_PROXY, changeOrigin: true } } : undefined,
  },
});
