import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_LABELS } from './fleetModule.js';

/** SOPF + SOC (vc) only — matches Time Charter / Period placement. */
export const CARGO_RELET_MODULE_IDS = ['sopf', 'vc'];

export const CARGO_RELET_MODULE_LABELS = {
  sopf: FLEET_MODULE_LABELS.sopf,
  vc: FLEET_MODULE_LABELS.vc,
};

export const CARGO_RELET_SIDEBAR_ITEMS = [
  { id: 'business', label: 'Cargo Relets', segment: '' },
  { id: 'ops', label: 'Cargo Relet Ops', segment: 'ops' },
];

export function parseCargoReletModuleFromPath(pathname) {
  const match = String(pathname || '').match(/\/internal-user\/(sopf|vc)\/cargo-relets/);
  return match?.[1] ?? 'sopf';
}

export function isCargoReletModule(module) {
  return CARGO_RELET_MODULE_IDS.includes(module);
}

export function isCargoReletPath(pathname) {
  return /\/internal-user\/(sopf|vc)\/cargo-relets/.test(String(pathname || ''));
}

export function cargoReletBasePath(module) {
  const id = isCargoReletModule(module) ? module : 'sopf';
  return `/internal-user/${id}/cargo-relets`;
}

export function cargoReletAppPath(module, segment = '') {
  const base = cargoReletBasePath(module);
  return appPath(segment ? `${base}/${segment}` : base);
}
