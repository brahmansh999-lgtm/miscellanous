import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the project from /miscellanous/; dev stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/miscellanous/' : '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
  },
}));
