import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  root: path.resolve(import.meta.dirname, '..'),

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '../src'),
    },
    dedupe: ['react', 'react-dom'],
  },

  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,

    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'index.html'),
    },
  },

  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },

  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
