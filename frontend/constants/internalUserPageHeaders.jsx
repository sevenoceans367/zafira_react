import { appPath } from '@bainbridge/shared-routing';
import { resolveSopfHeader } from './sopfPageHeaders.jsx';
import { resolveFleetHeader } from './fleetPageHeaders.js';
import { resolvePeriodContractHeader } from './periodContractPageHeaders.js';
import { resolveElibraryHeader } from './elibraryPageHeaders.js';
import { resolveUserGuidesHeader } from './userGuidesPageHeaders.js';
import { resolveTodoListHeader } from './todoListPageHeaders.js';
import { resolveCombinedSoaPayableHeader } from './combinedSoaPayablePageHeaders.js';
import { resolveGenericFinancesHeader } from './genericFinancesPageHeaders.js';
import { resolveMastersHeader } from './mastersPageHeaders.js';
import { resolveCoaHeader } from './coaPageHeaders.js';
import { resolveOpsVcHeader } from './opsVcPageHeaders.js';
import { resolveOpsTcHeader } from './opsTcPageHeaders.js';
import { resolveTcHeader } from './tcPageHeaders.js';
import { resolveReportsHeader } from './reportsPageHeaders.js';
import {
  LIVE_VESSEL_MAP_ENABLED,
  LIVE_VESSEL_MAP_PATH,
  LIVE_VESSEL_MAP_TITLE,
} from '../pages/internal-user/live-vessel-map/liveVesselMap.feature.js';

const STATIC_HEADERS = {
  '/': {
    title: 'Dashboard',
    currentPage: 'Dashboard',
    // AppHeader adds Home — middle crumbs empty on home dashboard
    breadcrumbs: [],
  },
  '/internal-user/vc': {
    title: 'Commercial Performance',
    currentPage: 'Commercial Performance',
    breadcrumbs: [{ label: 'SOC', href: appPath('/internal-user/vc') }],
  },
  '/internal-user/vc/decision-chart-tc': {
    title: 'TC Estimates',
    currentPage: 'Decision Chart',
    breadcrumbs: [{ label: 'SOC', href: appPath('/internal-user/vc') }],
  },
  '/internal-user/tc': {
    title: 'Time Charter',
    currentPage: 'Time Charter',
    breadcrumbs: [{ label: 'SOC', href: appPath('/internal-user/vc') }],
  },
};

export function resolveInternalUserHeader(pathname, search = '') {
  if (LIVE_VESSEL_MAP_ENABLED && pathname === LIVE_VESSEL_MAP_PATH) {
    return {
      title: LIVE_VESSEL_MAP_TITLE,
      currentPage: LIVE_VESSEL_MAP_TITLE,
      breadcrumbs: [{ label: 'Home', href: appPath('/') }],
    };
  }

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
    const elibraryHeader = resolveElibraryHeader(pathname);
    if (elibraryHeader) return elibraryHeader;
    const userGuidesHeader = resolveUserGuidesHeader(pathname);
    if (userGuidesHeader) return userGuidesHeader;
    const fleetHeader = resolveFleetHeader(pathname);
    if (fleetHeader) return fleetHeader;
    const coaHeader = resolveCoaHeader(pathname, search);
    if (coaHeader) return coaHeader;
    const sopfTcHeader = resolveTcHeader(pathname);
    if (sopfTcHeader) return sopfTcHeader;
    return resolveSopfHeader(pathname, search);
  }

  const mastersHeader = resolveMastersHeader(pathname);
  if (mastersHeader) return mastersHeader;

  const todoListHeader = resolveTodoListHeader(pathname);
  if (todoListHeader) return todoListHeader;

  const combinedSoaPayableHeader = resolveCombinedSoaPayableHeader(pathname);
  if (combinedSoaPayableHeader) return combinedSoaPayableHeader;

  const genericFinancesHeader = resolveGenericFinancesHeader(pathname);
  if (genericFinancesHeader) return genericFinancesHeader;

  const periodContractHeader = resolvePeriodContractHeader(pathname);
  if (periodContractHeader) return periodContractHeader;

  const elibraryHeader = resolveElibraryHeader(pathname);
  if (elibraryHeader) return elibraryHeader;

  const userGuidesHeader = resolveUserGuidesHeader(pathname);
  if (userGuidesHeader) return userGuidesHeader;

  const fleetHeader = resolveFleetHeader(pathname);
  if (fleetHeader) return fleetHeader;

  const coaHeader = resolveCoaHeader(pathname, search);
  if (coaHeader) return coaHeader;

  const opsVcHeader = resolveOpsVcHeader(pathname, search);
  if (opsVcHeader) return opsVcHeader;

  const opsTcHeader = resolveOpsTcHeader(pathname, search);
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
    breadcrumbs: [],
  };
}
