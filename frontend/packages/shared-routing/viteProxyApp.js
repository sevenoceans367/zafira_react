import { loadEnv } from 'vite';

const DEFAULT_PROXY_TARGET = 'http://127.0.0.1:8012';
const DEFAULT_PROXY_PATH = 'bainbridge/internal-user/dryout';

const normalizeProxyFilePath = (requestPath, proxyPath) => {
  let file = requestPath.replace(/^\/legacy-dryout\/?/, '');
  if (proxyPath && /\/dryout$/i.test(proxyPath) && file.startsWith('dryout/')) {
    file = file.slice('dryout/'.length);
  }
  return file;
};

/** Proxy /legacy-dryout/* to Apache/XAMPP (defaults to localhost:8012 dryout folder). */
export const createLegacyDryoutProxy = (envDir) => {
  const env = loadEnv('development', envDir, '');
  const target = env.VITE_LEGACY_DRYOUT_PROXY_TARGET?.trim() || DEFAULT_PROXY_TARGET;
  const proxyPath = (env.VITE_LEGACY_DRYOUT_PROXY_PATH || DEFAULT_PROXY_PATH).trim().replace(/\/$/, '');

  return {
    '/legacy-dryout': {
      target,
      changeOrigin: true,
      rewrite: (requestPath) => {
        const file = normalizeProxyFilePath(requestPath, proxyPath);
        return proxyPath ? `${proxyPath}/${file}` : `/${file}`;
      },
    },
  };
};

/** Shared dev-server settings for apps proxied through the portal gateway (5173). */
export const createProxiedAppServer = (port, hmrPath, envDir) => ({
  host: '127.0.0.1',
  port,
  strictPort: true,
  // WS listens on this app's port (e.g. 5174). Browser connects via portal (5173).
  hmr: {
    protocol: 'ws',
    host: '127.0.0.1',
    port,
    clientPort: 5173,
    path: hmrPath,
  },
  proxy: {
    '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    '/attachment': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    ...(envDir ? createLegacyDryoutProxy(envDir) : {}),
  },
});
