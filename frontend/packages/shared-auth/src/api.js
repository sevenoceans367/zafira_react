import { storeSession, clearSession } from './session.js';

const LOGIN_ATTEMPTS = 5;
const LOGIN_RETRY_MS = 400;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(error) {
  const msg = String(error?.message || error || '');
  return /failed to fetch|networkerror|econnreset|econnrefused|load failed/i.test(msg);
}

function isTransientLoginResponse(response, data) {
  if (response.status === 502 || response.status === 503 || response.status === 504) return true;
  // Vite maps proxy ECONNRESET (backend not listening yet) to 500 with no auth payload.
  return response.status === 500 && !data?.error;
}

async function postCredentials(url, username, password) {
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  };

  let lastError;
  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (isTransientNetworkError(err) && attempt < LOGIN_ATTEMPTS) {
        await sleep(LOGIN_RETRY_MS * attempt);
        continue;
      }
      throw new Error('Backend is still starting. Please try again.');
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    if (isTransientLoginResponse(response, data) && attempt < LOGIN_ATTEMPTS) {
      await sleep(LOGIN_RETRY_MS * attempt);
      continue;
    }
    throw new Error(data.error || 'Login failed. Please try again.');
  }

  throw lastError || new Error('Backend is still starting. Please try again.');
}

export const login = async (username, password) => {
  const data = await postCredentials('/api/auth/login', username, password);
  storeSession(data.token, data.user);
  return { token: data.token, user: data.user };
};

/** Agent portal login — legacy checklogin_agent.php (generate_agency_letter). */
export const agentLogin = async (username, password) => {
  const data = await postCredentials('/api/auth/agent-login', username, password);
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
