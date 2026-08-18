import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function backendProxy() {
  return {
    target: 'http://localhost:3000',
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('error', (_err, _req, res) => {
        if (res && !res.headersSent) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Backend is still starting. Please try again.',
          }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backendProxy(),
      '/attachment': backendProxy(),
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
