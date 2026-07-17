import { getToken, clearSession, touchSession } from './session.js';
import { redirectToPortal } from './redirect.js';

export const setupAuthFetch = () => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isApi = typeof url === 'string' && url.startsWith('/api');

    if (isApi) {
      const token = getToken();
      if (!token && !url.includes('/api/auth/login') && !url.includes('/api/auth/agent-login')) {
        // Session expired while idle — force re-login before calling APIs.
        clearSession();
        redirectToPortal();
        return new Response(JSON.stringify({ error: 'Session expired.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (token) {
        init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } };
      }
    }

    const response = await originalFetch(input, init);

    if (isApi && response.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/agent-login')) {
      clearSession();
      redirectToPortal();
    } else if (isApi && response.ok) {
      touchSession();
    }

    return response;
  };
};
