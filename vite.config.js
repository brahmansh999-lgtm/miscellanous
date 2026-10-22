import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths, so the same build works at a domain root (Vercel)
// and under a subpath (GitHub Pages /miscellanous/).
export default defineConfig(() => ({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
  },
}));
