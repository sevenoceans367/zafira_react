import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_LABELS } from './fleetModule.js';

/** Masters is SOC-only (VC / TC). Not shown under SOPF. */
export const MASTERS_MODULE_IDS = ['vc', 'tc'];

export const MASTERS_MODULE_LABELS = {
  vc: FLEET_MODULE_LABELS.vc,
  tc: FLEET_MODULE_LABELS.tc,
  soc: FLEET_MODULE_LABELS.soc,
};

export const MASTERS_SEGMENT = 'masters';

export function isMastersHostModule(module) {
  return MASTERS_MODULE_IDS.includes(module);
}

export function parseMastersModuleFromPath(pathname) {
  const match = pathname.match(/\/internal-user\/(vc|tc)(?:\/|$)/);
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
  if (module === 'tc') {
    return { label: MASTERS_MODULE_LABELS.tc, href: appPath('/internal-user/tc') };
  }
  return { label: MASTERS_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}
