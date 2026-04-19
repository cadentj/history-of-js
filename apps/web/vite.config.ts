import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lessonsPlugin } from './vite-plugins/lessons';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react(), tailwindcss(), lessonsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
});
