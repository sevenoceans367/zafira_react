/** Idle session lifetime — 1 hour. */
export const SESSION_TTL_MS = 60 * 60 * 1000;

/** Known app scopes that each keep an independent browser session. */
export const SESSION_SCOPES = ['portal', 'admin', 'internal', 'superadmin', 'external', 'agent'];

const LEGACY_TOKEN_KEY = 'auth_token';
const LEGACY_USER_KEY = 'auth_user';
const LEGACY_EXPIRES_KEY = 'auth_expires_at';

/** Default scope for this SPA when not on an agent route. */
let defaultSessionScope = 'internal';
let legacyMigrated = false;

const tokenKey = (scope) => `auth_token_${scope}`;
const userKey = (scope) => `auth_user_${scope}`;
const expiresKey = (scope) => `auth_expires_at_${scope}`;

/**
 * Set the default session namespace for this app (e.g. 'internal', 'admin').
 * Agent routes still use the 'agent' scope via getSessionScope().
 */
export const configureSessionScope = (scope) => {
  if (scope && SESSION_SCOPES.includes(scope)) {
    defaultSessionScope = scope;
  }
};

export const getDefaultSessionScope = () => defaultSessionScope;

/**
 * Active session bucket for the current page.
 * Agent portal paths use 'agent'; everything else uses the configured app scope.
 */
export const getSessionScope = () => {
  try {
    const path = window.location?.pathname || '';
    if (path.includes('/agent')) return 'agent';
  } catch {
    // SSR / non-browser
  }
  return defaultSessionScope;
};

function readExpiresAt(scope) {
  const raw = localStorage.getItem(expiresKey(scope));
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function isExpired(scope) {
  const expiresAt = readExpiresAt(scope);
  if (expiresAt == null) return true;
  return Date.now() >= expiresAt;
}

function clearScope(scope) {
  localStorage.removeItem(tokenKey(scope));
  localStorage.removeItem(userKey(scope));
  localStorage.removeItem(expiresKey(scope));
}

function clearLegacyKeys() {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
  localStorage.removeItem(LEGACY_EXPIRES_KEY);
}

function writeScope(scope, token, user) {
  localStorage.setItem(tokenKey(scope), token);
  localStorage.setItem(userKey(scope), JSON.stringify(user || {}));
  localStorage.setItem(expiresKey(scope), String(Date.now() + SESSION_TTL_MS));
}

function readUserRaw(scope) {
  try {
    const raw = localStorage.getItem(userKey(scope));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * One-time move of unscoped auth_* keys into auth_*_<appKey>.
 * Call with a resolveAppKey(userType) => scope helper to avoid circular imports.
 */
export const migrateLegacySession = (resolveAppKey) => {
  if (legacyMigrated || typeof resolveAppKey !== 'function') return;
  legacyMigrated = true;

  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (!legacyToken) return;

  const legacyExpires = Number(localStorage.getItem(LEGACY_EXPIRES_KEY));
  if (Number.isFinite(legacyExpires) && Date.now() >= legacyExpires) {
    clearLegacyKeys();
    return;
  }

  let user = {};
  try {
    const raw = localStorage.getItem(LEGACY_USER_KEY);
    user = raw ? JSON.parse(raw) : {};
  } catch {
    user = {};
  }

  const scope = resolveAppKey(user?.userType) || defaultSessionScope;
  // Prefer an already-scoped session; only fill an empty bucket.
  if (!localStorage.getItem(tokenKey(scope))) {
    localStorage.setItem(tokenKey(scope), legacyToken);
    localStorage.setItem(userKey(scope), JSON.stringify(user || {}));
    localStorage.setItem(
      expiresKey(scope),
      String(Number.isFinite(legacyExpires) ? legacyExpires : Date.now() + SESSION_TTL_MS),
    );
  }
  clearLegacyKeys();
};

export const getToken = (scope = getSessionScope()) => {
  const token = localStorage.getItem(tokenKey(scope));
  if (!token) return null;
  if (isExpired(scope)) {
    clearScope(scope);
    return null;
  }
  return token;
};

export const getUser = (scope = getSessionScope()) => {
  if (!getToken(scope)) return null;
  return readUserRaw(scope);
};

export const isAuthenticated = (scope = getSessionScope()) => Boolean(getToken(scope));

/**
 * Persist a session into a specific app scope.
 * Prefer passing `scope` from resolveAppKey(user.userType) so admin/internal/agent never overwrite each other.
 */
export const storeSession = (token, user, scope = getSessionScope()) => {
  const target = SESSION_SCOPES.includes(scope) ? scope : getSessionScope();
  writeScope(target, token, user);
};

/** Extend idle timeout while the user is actively using the app. */
export const touchSession = (scope = getSessionScope()) => {
  if (!localStorage.getItem(tokenKey(scope))) return;
  if (isExpired(scope)) {
    clearScope(scope);
    return;
  }
  localStorage.setItem(expiresKey(scope), String(Date.now() + SESSION_TTL_MS));
};

/** Clear one app session (default: current page scope). Does not clear other apps. */
export const clearSession = (scope = getSessionScope()) => {
  clearScope(scope);
};
