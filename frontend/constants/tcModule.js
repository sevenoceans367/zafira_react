import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_LABELS } from './fleetModule.js';

export const TC_MODULE_IDS = ['sopf', 'vc'];

export function isTcModule(module) {
  return TC_MODULE_IDS.includes(module);
}

export function parseTcModuleFromPath(pathname) {
  const path = String(pathname || '');
  if (path.startsWith('/internal-user/sopf/time-charter')) return 'sopf';
  if (path.startsWith('/internal-user/vc/tc')) return 'vc';
  if (path.startsWith('/internal-user/vc/decision-chart-tc')) return 'vc';
  if (path.startsWith('/internal-user/sopf')) return 'sopf';
  return 'vc';
}

export function tcBasePath(module) {
  return isTcModule(module) && module === 'sopf'
    ? '/internal-user/sopf/time-charter'
    : '/internal-user/vc/tc';
}

export function tcAppPath(module, segment = '') {
  const host = isTcModule(module) ? module : 'vc';
  if (segment === 'decision-charts') {
    return host === 'sopf'
      ? appPath('/internal-user/sopf/time-charter/decision-charts')
      : appPath('/internal-user/vc/decision-chart-tc');
  }
  const base = tcBasePath(host);
  return appPath(segment ? `${base}/${segment}` : base);
}

export { FLEET_MODULE_LABELS as TC_MODULE_LABELS };
