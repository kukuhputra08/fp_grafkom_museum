import { defineConfig } from 'vite';

// base './' membuat hasil build bisa dipasang di subfolder (GitHub Pages, dll.)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
