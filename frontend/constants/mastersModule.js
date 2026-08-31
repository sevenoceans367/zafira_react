import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_LABELS } from './fleetModule.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

/** Masters host modules (SOPF + SOC VC / TC). */
export const MASTERS_MODULE_IDS = ['sopf', 'vc', 'tc'];

export const MASTERS_MODULE_LABELS = {
  sopf: FLEET_MODULE_LABELS.sopf,
  vc: FLEET_MODULE_LABELS.vc,
  tc: FLEET_MODULE_LABELS.tc,
  soc: FLEET_MODULE_LABELS.soc,
};

export const MASTERS_SEGMENT = 'masters';

export function isMastersHostModule(module) {
  return MASTERS_MODULE_IDS.includes(module);
}

export function parseMastersModuleFromPath(pathname) {
  const match = pathname.match(/\/internal-user\/(sopf|vc|tc)(?:\/|$)/);
  return match?.[1] ?? 'vc';
}

export function mastersBasePath(module) {
  const host = isMastersHostModule(module) ? module : 'vc';
  return `/internal-user/${host}/${MASTERS_SEGMENT}`;
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
