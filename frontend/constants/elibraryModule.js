import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_IDS, FLEET_MODULE_LABELS } from './fleetModule.js';

export const ELIBRARY_MODULE_IDS = FLEET_MODULE_IDS;

export function parseElibraryModuleFromPath(pathname) {
  const match = pathname.match(/\/internal-user\/(sopf|vc|tc)\/elibrary/);
  return match?.[1] ?? 'vc';
}

export function isElibraryModule(module) {
  return ELIBRARY_MODULE_IDS.includes(module);
}

export function elibraryBasePath(module) {
  return `/internal-user/${module}/elibrary`;
}

export function elibraryAppPath(module, segment = '') {
  const base = elibraryBasePath(module);
  return appPath(segment ? `${base}/${segment}` : base);
}

export { FLEET_MODULE_LABELS as ELIBRARY_MODULE_LABELS };
