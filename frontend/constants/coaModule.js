import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_LABELS } from './fleetModule.js';

export const COA_MODULE_IDS = ['sopf', 'vc'];

export const COA_ITEMS = [
  { id: 'running', label: 'Running COAs' },
  { id: 'in-ops', label: 'COA Ops' },
];

export function coaSidebarItems(_module) {
  return COA_ITEMS;
}

export function isCoaOpsPath(pathname = '') {
  return pathname.includes('/coas/in-ops') || pathname.includes('/coas/post-ops');
}

export function isCoaModule(module) {
  return COA_MODULE_IDS.includes(module);
}

export function parseCoaModuleFromPath(pathname) {
  const match = String(pathname || '').match(/\/internal-user\/(sopf|vc)\/coas(?:\/|$)/);
  if (match) return match[1];
  if (String(pathname || '').startsWith('/internal-user/sopf')) return 'sopf';
  return 'vc';
}

export function coaBasePath(module) {
  const host = isCoaModule(module) ? module : 'vc';
  return `/internal-user/${host}/coas`;
}

export function coaAppPath(module, segment = '') {
  const base = coaBasePath(module);
  return appPath(segment ? `${base}/${segment}` : base);
}

export { FLEET_MODULE_LABELS as COA_MODULE_LABELS };
