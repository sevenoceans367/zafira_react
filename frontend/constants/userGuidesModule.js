import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_IDS, FLEET_MODULE_LABELS } from './fleetModule.js';

export const USER_GUIDES_MODULE_IDS = FLEET_MODULE_IDS;

export function parseUserGuidesModuleFromPath(pathname) {
  const match = pathname.match(/\/internal-user\/(sopf|vc|tc)\/user-guides/);
  return match?.[1] ?? 'vc';
}

export function isUserGuidesModule(module) {
  return USER_GUIDES_MODULE_IDS.includes(module);
}

export function userGuidesBasePath(module) {
  return `/internal-user/${module}/user-guides`;
}

export function userGuidesAppPath(module, segment = '') {
  const base = userGuidesBasePath(module);
  return appPath(segment ? `${base}/${segment}` : base);
}

export { FLEET_MODULE_LABELS as USER_GUIDES_MODULE_LABELS };
