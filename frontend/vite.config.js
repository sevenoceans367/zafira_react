import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/attachment': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@bainbridge/shared-ui': path.resolve(__dirname, 'packages/shared-ui/src'),
      '@bainbridge/shared-routing': path.resolve(__dirname, 'packages/shared-routing/src'),
      '@bainbridge/shared-auth': path.resolve(__dirname, 'packages/shared-auth/src'),
    },
  },
});
