import { appPath } from '@bainbridge/shared-routing';
import { FLEET_MODULE_IDS, FLEET_MODULE_LABELS } from './fleetModule.js';

export const PERIOD_CONTRACT_MODULE_IDS = FLEET_MODULE_IDS;

export const PERIOD_CONTRACT_NAV_ITEM = {
  id: 'period-contracts',
  segment: 'period-contracts',
  label: 'Period',
  icon: 'bi-journal-text',
};

export function parsePeriodContractModuleFromPath(pathname) {
  const match = pathname.match(/\/internal-user\/(sopf|vc|tc)\/period-contracts/);
  return match?.[1] ?? 'vc';
}

export function isPeriodContractModule(module) {
  return PERIOD_CONTRACT_MODULE_IDS.includes(module);
}

export function periodContractBasePath(module) {
  return `/internal-user/${module}/period-contracts`;
}

export function periodContractAppPath(module, segment = '') {
  const base = periodContractBasePath(module);
  return appPath(segment ? `${base}/${segment}` : base);
}

export { FLEET_MODULE_LABELS as PERIOD_CONTRACT_MODULE_LABELS };
