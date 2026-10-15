import { configureSessionScope, migrateLegacySession } from './session.js';
import { resolveAppKey } from './redirect.js';

/**
 * Boot shared auth for an app.
 * @param {{ sessionScope?: string }} [options]
 *   sessionScope — 'internal' | 'admin' | 'agent' | … (default 'internal')
 */
export const initSharedAuth = (options = {}) => {
  configureSessionScope(options.sessionScope || 'internal');
  migrateLegacySession(resolveAppKey);
};
