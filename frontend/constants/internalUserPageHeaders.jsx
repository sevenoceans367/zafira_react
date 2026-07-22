import { appPath } from '@bainbridge/shared-routing';
import { resolveSopfHeader } from './sopfPageHeaders.jsx';
import { resolveFleetHeader } from './fleetPageHeaders.js';
import { resolvePeriodContractHeader } from './periodContractPageHeaders.js';
import { resolveTodoListHeader } from './todoListPageHeaders.js';
import { resolveCombinedSoaPayableHeader } from './combinedSoaPayablePageHeaders.js';
import { resolveMastersHeader } from './mastersPageHeaders.js';
import { resolveCoaHeader } from './coaPageHeaders.js';
import { resolveOpsVcHeader } from './opsVcPageHeaders.js';
import { resolveOpsTcHeader } from './opsTcPageHeaders.js';
import { resolveTcHeader } from './tcPageHeaders.js';
import { resolveReportsHeader } from './reportsPageHeaders.js';

const HOME = { label: 'Home', href: appPath('/') };

const STATIC_HEADERS = {
  '/': {
    title: 'Dashboard',
    currentPage: 'Dashboard',
    breadcrumbs: [HOME],
  },
  '/internal-user/vc': {
    title: 'Dashboard',
    currentPage: 'Dashboard',
    breadcrumbs: [HOME, { label: 'SOC', href: appPath('/internal-user/vc') }, { label: 'Dashboard' }],
  },
  '/internal-user/vc/decision-chart-tc': {
    title: 'TC Estimates',
    currentPage: 'Decision Chart',
    breadcrumbs: [
      HOME,
      { label: 'SOC', href: appPath('/internal-user/vc') },
      { label: 'Decision Chart' },
    ],
  },
  '/internal-user/tc': {
    title: 'Time Charter',
    currentPage: 'Time Charter',
    breadcrumbs: [HOME, { label: 'SOC', href: appPath('/internal-user/vc') }, { label: 'Time Charter' }],
  },
};

export function resolveInternalUserHeader(pathname) {
  if (STATIC_HEADERS[pathname]) {
    return STATIC_HEADERS[pathname];
  }

  if (pathname.startsWith('/internal-user/sopf')) {
    const mastersHeader = resolveMastersHeader(pathname);
    if (mastersHeader) return mastersHeader;
    const todoListHeader = resolveTodoListHeader(pathname);
    if (todoListHeader) return todoListHeader;
    const periodContractHeader = resolvePeriodContractHeader(pathname);
    if (periodContractHeader) return periodContractHeader;
    const fleetHeader = resolveFleetHeader(pathname);
    if (fleetHeader) return fleetHeader;
    return resolveSopfHeader(pathname);
  }

  const mastersHeader = resolveMastersHeader(pathname);
  if (mastersHeader) return mastersHeader;

  const todoListHeader = resolveTodoListHeader(pathname);
  if (todoListHeader) return todoListHeader;

  const combinedSoaPayableHeader = resolveCombinedSoaPayableHeader(pathname);
  if (combinedSoaPayableHeader) return combinedSoaPayableHeader;

  const periodContractHeader = resolvePeriodContractHeader(pathname);
  if (periodContractHeader) return periodContractHeader;

  const fleetHeader = resolveFleetHeader(pathname);
  if (fleetHeader) return fleetHeader;

  const coaHeader = resolveCoaHeader(pathname);
  if (coaHeader) return coaHeader;

  const opsVcHeader = resolveOpsVcHeader(pathname);
  if (opsVcHeader) return opsVcHeader;

  const opsTcHeader = resolveOpsTcHeader(pathname);
  if (opsTcHeader) return opsTcHeader;

  const tcHeader = resolveTcHeader(pathname);
  if (tcHeader) return tcHeader;

  const reportsHeader = resolveReportsHeader(pathname);
  if (reportsHeader) return reportsHeader;

  if (pathname.startsWith('/internal-user/vc')) {
    return STATIC_HEADERS['/internal-user/vc'];
  }

  if (pathname.startsWith('/internal-user/tc')) {
    return STATIC_HEADERS['/internal-user/tc'];
  }

  return {
    title: 'Internal User',
    currentPage: 'Internal User',
    breadcrumbs: [HOME],
  };
}
