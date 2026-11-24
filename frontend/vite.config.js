import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLegacyDryoutProxy } from './packages/shared-routing/viteProxyApp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  // Keep in sync with backend/.env PORT (override via frontend/.env BACKEND_PORT).
  const backendPort = env.BACKEND_PORT || env.PORT || process.env.BACKEND_PORT || '3000';
  const backendTarget = env.VITE_BACKEND_PROXY || `http://localhost:${backendPort}`;

  function backendProxy() {
    return {
      target: backendTarget,
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

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': backendProxy(),
        '/attachment': backendProxy(),
        ...createLegacyDryoutProxy(__dirname),
      },
    },
    resolve: {
      alias: {
        '@bainbridge/shared-ui': path.resolve(__dirname, 'packages/shared-ui/src'),
        '@bainbridge/shared-routing': path.resolve(__dirname, 'packages/shared-routing/src'),
        '@bainbridge/shared-auth': path.resolve(__dirname, 'packages/shared-auth/src'),
      },
    },
  };
});