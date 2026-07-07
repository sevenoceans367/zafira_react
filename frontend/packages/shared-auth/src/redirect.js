import { storeSession } from './session.js';

const DEFAULT_APP_PATHS = {
  portal: '/',
  admin: '/admin/',
  internal: '/ops/',
  superadmin: '/superadmin/',
  external: '/external/',
  agent: '/agent/',
};

let appPaths = { ...DEFAULT_APP_PATHS };

/** @deprecated Use configureAppPaths. Kept for backward compatibility. */
export const configureAppUrls = (paths = {}) => {
  configureAppPaths({
    portal: paths.portal ?? appPaths.portal,
    admin: paths.admin ? toPath(paths.admin) : appPaths.admin,
    internal: paths.internal ? toPath(paths.internal) : appPaths.internal,
    superadmin: paths.superadmin ? toPath(paths.superadmin) : appPaths.superadmin,
    external: paths.external ? toPath(paths.external) : appPaths.external,
    agent: paths.agent ? toPath(paths.agent) : appPaths.agent,
  });
};

const toPath = (value) => {
  if (!value) return '/';
  if (value.startsWith('http')) {
    try {
      return new URL(value).pathname;
    } catch {
      return value;
    }
  }
  return value.endsWith('/') ? value : `${value}/`;
};

export const configureAppPaths = (paths = {}) => {
  appPaths = { ...appPaths, ...paths };
};

export const getPortalLoginUrl = () => appPaths.portal;

const INTERNAL_USER_TYPES = ['internal_user', 'mgmt_user', 'rm_user'];
const EXTERNAL_USER_TYPES = ['Broker', 'Finance', 'Traders'];
/** Reserved for the future superadmin app — not USER_TYPE 'admin' (company admin). */
const SUPERADMIN_USER_TYPES = ['superadmin', 'sadmin'];

export const resolveAppKey = (userType) => {
  if (INTERNAL_USER_TYPES.includes(userType)) return 'internal';
  if (EXTERNAL_USER_TYPES.includes(userType)) return 'external';
  if (SUPERADMIN_USER_TYPES.includes(userType)) return 'superadmin';
  if (userType === 'agent') return 'agent';
  // USER_TYPE 'admin' and other company-level users use the admin app.
  return 'admin';
};

export const resolveAppPath = (userType) => appPaths[resolveAppKey(userType)] || appPaths.admin;

/** @deprecated Use resolveAppPath */
export const resolveAppUrl = (userType) => resolveAppPath(userType);

export const isAdminAppUser = (userType) => resolveAppKey(userType) === 'admin';
export const isInternalAppUser = (userType) => resolveAppKey(userType) === 'internal';
export const isSuperadminAppUser = (userType) => resolveAppKey(userType) === 'superadmin';
export const isExternalAppUser = (userType) => resolveAppKey(userType) === 'external';
export const isAgentAppUser = (userType) => resolveAppKey(userType) === 'agent';

export const redirectAfterLogin = (_token, user) => {
  window.location.href = resolveAppPath(user?.userType);
};

export const redirectToPortal = () => {
  window.location.href = getPortalLoginUrl();
};

/** Legacy cross-port SSO — kept for backward compatibility during migration. */
export const consumeAuthFromHash = () => {
  const { hash } = window.location;
  if (!hash.startsWith('#auth=')) return false;

  try {
    const payload = JSON.parse(atob(decodeURIComponent(hash.slice(6))));
    if (!payload?.token) return false;
    storeSession(payload.token, payload.user);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  } catch {
    return false;
  }
};
