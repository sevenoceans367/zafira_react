export { getLegacyDryoutBase, getLegacyDryoutHref } from './legacyDryout.js';

/** App mount path, e.g. '' for portal, '/admin' for admin, '/ops' for internal-user. */
export const getAppBase = () => import.meta.env.VITE_APP_BASE || '';

const EXTERNAL_PREFIXES = ['/api', '/attachment', '/legacy-dryout'];

const usesExternalPath = (route) =>
  EXTERNAL_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));

/** Build a full browser path for in-app navigation. */
export const appPath = (route = '/') => {
  if (!route) return getAppBase() || '/';
  const normalized = route.startsWith('/') ? route : `/${route}`;
  if (usesExternalPath(normalized)) return normalized;

  const base = getAppBase();
  if (!base) return normalized;
  if (normalized === base || normalized.startsWith(`${base}/`)) return normalized;
  if (normalized === '/') return base.endsWith('/') ? base : `${base}/`;
  return `${base}${normalized}`;
};

/** Strip the app base and return the in-app route (e.g. /shipping_user). */
export const getAppRoute = () => {
  const base = getAppBase();
  let path = window.location.pathname;
  if (base && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length) || '/';
  }
  return path;
};

export const navigateTo = (route) => {
  window.location.href = appPath(route);
};

/** Prefix in-app <a href="/..."> clicks when apps are mounted under a base path. */
export const installLinkInterceptor = () => {
  const base = getAppBase();
  if (!base) return;

  document.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest('a[href]');
      if (!link || link.target === '_blank') return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
      if (!href.startsWith('/')) return;
      if (usesExternalPath(href)) return;

      const resolved = appPath(href);
      if (resolved !== href) {
        event.preventDefault();
        window.location.href = resolved;
      }
    },
    true,
  );
};

export const installBasePathGlobals = () => {
  window.appPath = appPath;
  window.getAppRoute = getAppRoute;
  window.navigateTo = navigateTo;
};
