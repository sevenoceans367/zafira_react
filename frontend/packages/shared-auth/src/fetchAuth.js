import { getToken, clearSession } from './session.js';
import { redirectToPortal } from './redirect.js';

export const setupAuthFetch = () => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isApi = typeof url === 'string' && url.startsWith('/api');

    if (isApi) {
      const token = getToken();
      if (token) {
        init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } };
      }
    }

    const response = await originalFetch(input, init);

    if (isApi && response.status === 401 && !url.includes('/api/auth/login')) {
      clearSession();
      redirectToPortal();
    }

    return response;
  };
};
