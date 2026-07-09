import { appPath } from '@bainbridge/shared-routing';

export const FLEET_MODULE_IDS = ['sopf', 'vc', 'tc'];

export const FLEET_MODULE_LABELS = {
  sopf: 'SOPF',
  vc: 'VC',
  tc: 'TC',
};

export const FLEET_NAV_ITEM = {
  id: 'fleet',
  segment: 'fleet',
  label: 'Fleet',
  icon: 'bi-anchor',
};

export function isFleetModule(module) {
  return FLEET_MODULE_IDS.includes(module);
}

export function parseFleetModuleFromPath(pathname) {
  const match = pathname.match(/\/internal-user\/(sopf|vc|tc)\/fleet/);
  return match?.[1] ?? 'vc';
}

export function fleetBasePath(module) {
  return `/internal-user/${module}/fleet`;
}

export function fleetVesselPath(module, vesselId, segment) {
  return `${fleetBasePath(module)}/vessel/${vesselId}/${segment}`;
}

export function fleetAppPath(module, segment = '') {
  const base = fleetBasePath(module);
  return appPath(segment ? `${base}/${segment}` : base);
}

export function moduleHomePath(module) {
  if (module === 'sopf') return appPath('/internal-user/sopf/estimate_list?selBType=2&estimatetype=2');
  if (module === 'tc') return appPath('/internal-user/tc');
  return appPath('/internal-user/vc');
}
