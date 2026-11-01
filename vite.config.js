/**
 * Vite configuration for the frontend: React and Tailwind CSS plugins, the development server on port 5190 with
 * /api proxied to the backend (VITE_API_PROXY, default http://localhost:4200), production source maps, and the
 * Vitest unit-test environment (jsdom).
 *
 * @author Kwasi Adabo Boakye
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5190,
    strictPort: true,
    proxy: { '/api': { target: process.env.VITE_API_PROXY || 'http://localhost:4200', changeOrigin: false } },
  },
  build: { sourcemap: true, chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.{js,jsx}'],
    css: false,
  },
});
