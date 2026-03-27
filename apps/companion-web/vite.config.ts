import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/metrics': 'http://localhost:3001',
      '/state': 'http://localhost:3001',
      '/ws': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
