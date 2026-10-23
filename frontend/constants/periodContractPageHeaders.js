import { appPath } from '@bainbridge/shared-routing';
import {
  PERIOD_CONTRACT_MODULE_IDS,
  PERIOD_CONTRACT_MODULE_LABELS,
  parsePeriodContractModuleFromPath,
  periodContractAppPath,
} from './periodContractModule.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';
import { periodListReturnPath } from '../utils/periodContractListSession.js';

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

function periodPageLabel(module) {
  return module === 'sopf' ? 'Period Business' : 'Period';
}

export function resolvePeriodContractHeader(pathname) {
  const module = parsePeriodContractModuleFromPath(pathname);
  if (!PERIOD_CONTRACT_MODULE_IDS.includes(module)) return null;
  if (!pathname.includes('/period-contracts')) return null;

  const listHref = periodListReturnPath(periodContractAppPath(module));
  const listLabel = periodPageLabel(module);
  const isAdd = pathname.includes('/period-contracts/add');
  const isEdit = /\/period-contracts\/edit\//.test(pathname);

  if (isAdd) {
    return {
      title: 'Add Period Recap',
      currentPage: 'Add Period Recap',
      breadcrumbs: [
        HOME,
        moduleBreadcrumb(module),
        { label: listLabel, href: listHref },
        { label: 'Add Period Recap' },
      ],
    };
  }

  if (isEdit) {
    return {
      title: listLabel,
      currentPage: 'Update Period Recap',
      breadcrumbs: [
        HOME,
        moduleBreadcrumb(module),
        { label: listLabel, href: listHref },
        { label: 'Update Period Recap' },
      ],
    };
  }

  if (module === 'sopf') {
    return {
      title: 'Period Business',
      currentPage: 'Period Business',
      breadcrumbs: [
        HOME,
        moduleBreadcrumb(module),
        { label: 'Period Business' },
      ],
    };
  }

  return {
    title: 'Period',
    currentPage: 'Period',
    breadcrumbs: [
      HOME,
      moduleBreadcrumb(module),
      { label: 'Period' },
    ],
  };
}

export function periodContractAddPath(module) {
  return periodContractAppPath(module, 'add');
}

export function periodContractEditPath(module, id) {
  return periodContractAppPath(module, `edit/${id}`);
}

export function periodContractListPath(module) {
  return periodContractAppPath(module);
}
