const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const EXPIRES_KEY = 'auth_expires_at';

/** Idle session lifetime — 1 hour. */
export const SESSION_TTL_MS = 60 * 60 * 1000;

function readExpiresAt() {
  const raw = localStorage.getItem(EXPIRES_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function isExpired() {
  const expiresAt = readExpiresAt();
  if (expiresAt == null) return true;
  return Date.now() >= expiresAt;
}

export const getToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isExpired()) {
    clearSession();
    return null;
  }
  return token;
};

export const getUser = () => {
  if (!getToken()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const isAuthenticated = () => Boolean(getToken());

export const storeSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  localStorage.setItem(EXPIRES_KEY, String(Date.now() + SESSION_TTL_MS));
};

/** Extend idle timeout while the user is actively using the app. */
export const touchSession = () => {
  if (!localStorage.getItem(TOKEN_KEY)) return;
  if (isExpired()) {
    clearSession();
    return;
  }
  localStorage.setItem(EXPIRES_KEY, String(Date.now() + SESSION_TTL_MS));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_KEY);
};
