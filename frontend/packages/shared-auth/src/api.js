import { storeSession, clearSession } from './session.js';

export const login = async (username, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Login failed. Please try again.');
  }

  storeSession(data.token, data.user);
  return { token: data.token, user: data.user };
};

/** Agent portal login — legacy checklogin_agent.php (generate_agency_letter). */
export const agentLogin = async (username, password) => {
  const response = await fetch('/api/auth/agent-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Login failed. Please try again.');
  }

  storeSession(data.token, data.user);
  return { token: data.token, user: data.user };
};

/** Try staff login first, then agent credentials (same portal form). */
export const loginWithAgentFallback = async (username, password) => {
  try {
    return await login(username, password);
  } catch (staffErr) {
    try {
      return await agentLogin(username, password);
    } catch {
      throw staffErr;
    }
  }
};

export const logout = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore network errors; we clear the local session regardless.
  } finally {
    clearSession();
  }
};
