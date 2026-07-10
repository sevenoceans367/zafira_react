import { appPath } from '@bainbridge/shared-routing';
import {
  PERIOD_CONTRACT_MODULE_IDS,
  PERIOD_CONTRACT_MODULE_LABELS,
  parsePeriodContractModuleFromPath,
  periodContractAppPath,
} from './periodContractModule.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

const HOME = { label: 'Home', href: appPath('/') };

function moduleBreadcrumb(module) {
  if (module === 'sopf') {
    return { label: PERIOD_CONTRACT_MODULE_LABELS.sopf, href: appPath(SOPF_ENTRY_ROUTE) };
  }
  if (module === 'tc') {
    return { label: PERIOD_CONTRACT_MODULE_LABELS.tc, href: appPath('/internal-user/tc') };
  }
  return { label: PERIOD_CONTRACT_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}

export function resolvePeriodContractHeader(pathname) {
  const module = parsePeriodContractModuleFromPath(pathname);
  if (!PERIOD_CONTRACT_MODULE_IDS.includes(module)) return null;
  if (!pathname.includes('/period-contracts')) return null;

  const listHref = periodContractAppPath(module);
  const isAdd = pathname.includes('/period-contracts/add');

  if (isAdd) {
    return {
      title: 'Period Contract',
      currentPage: 'Add New',
      breadcrumbs: [
        HOME,
        moduleBreadcrumb(module),
        { label: 'Period Contract', href: listHref },
        { label: 'Add New' },
      ],
    };
  }

  return {
    title: 'Period Contract',
    currentPage: 'Period Contract List',
    breadcrumbs: [
      HOME,
      moduleBreadcrumb(module),
      { label: 'Period Contract' },
    ],
  };
}

export function periodContractAddPath(module) {
  return periodContractAppPath(module, 'add');
}

export function periodContractListPath(module) {
  return periodContractAppPath(module);
}
