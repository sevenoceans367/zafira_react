import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_IDS, FLEET_MODULE_LABELS } from './fleetModule.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

export const MASTERS_MODULE_IDS = FLEET_MODULE_IDS;

export const MASTERS_MODULE_LABELS = FLEET_MODULE_LABELS;

export const MASTERS_SEGMENT = 'masters';

export function parseMastersModuleFromPath(pathname) {
  const match = pathname.match(/\/internal-user\/(sopf|vc|tc)(?:\/|$)/);
  return match?.[1] ?? 'vc';
}

export function mastersBasePath(module) {
  return `/internal-user/${module}/${MASTERS_SEGMENT}`;
}

export function masterAppPath(module, masterId) {
  return appPath(`${mastersBasePath(module)}/${masterId}`);
}

export function moduleBreadcrumb(module) {
  if (module === 'sopf') {
    return { label: MASTERS_MODULE_LABELS.sopf, href: appPath(SOPF_ENTRY_ROUTE) };
  }
  if (module === 'tc') {
    return { label: MASTERS_MODULE_LABELS.tc, href: appPath('/internal-user/tc') };
  }
  return { label: MASTERS_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}
