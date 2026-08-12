import { matchPath } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

const HOME = { label: 'Home', href: appPath('/') };
const SOPF = { label: 'SOPF', href: appPath(SOPF_ENTRY_ROUTE) };
const SPOT_BUSINESS = 'Spot Business';

export const SOPF_PAGE_HEADERS = {
  estimate_list: {
    title: SPOT_BUSINESS,
    currentPage: 'Spot Business : Estimate',
    breadcrumbs: [HOME, SOPF, { label: SPOT_BUSINESS }],
  },
  vessel_position: {
    title: 'Vessels on Water',
    currentPage: 'Vessels on Water',
    breadcrumbs: [HOME, SOPF, { label: 'Vessels on Water' }],
  },
  pools: {
    title: 'Pools',
    currentPage: 'Pools',
    breadcrumbs: [HOME, SOPF, { label: 'Pools' }],
  },
  'time-charter': {
    title: 'Time Charter',
    currentPage: 'Time Charter',
    breadcrumbs: [HOME, SOPF, { label: 'Time Charter' }],
  },
  support_ticket: {
    title: 'Help Desk',
    currentPage: 'Help Desk',
    breadcrumbs: [HOME, SOPF, { label: 'Help Desk' }],
  },
};

const SOPF_ROUTE_PATTERNS = Object.keys(SOPF_PAGE_HEADERS).map(
  (segment) => `/internal-user/sopf/${segment}`,
);

export function resolveSopfHeader(pathname, search = '') {
  if (pathname.includes('/addestimate')) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const isNominate = Boolean(params.get('periodid'));
    const pageLabel = isNominate ? 'Nominate' : 'Add Estimate';
    return {
      title: SPOT_BUSINESS,
      currentPage: pageLabel,
      breadcrumbs: [
        HOME,
        SOPF,
        { label: SPOT_BUSINESS, href: appPath('/internal-user/sopf/estimate_list') },
        { label: pageLabel },
      ],
    };
  }

  if (pathname.includes('/viewestimate')) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const rttype = String(params.get('rttype') || '');
    if (rttype === '1' || rttype === '3' || rttype === '4') {
      const opsBack = rttype === '3'
        ? { label: 'Vessels in Post Ops VC', href: appPath('/internal-user/vc/ops/post-ops') }
        : rttype === '4'
          ? { label: 'Vessels in History VC', href: appPath('/internal-user/vc/ops/history') }
          : { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') };
      return {
        title: 'Ops - VC',
        currentPage: 'View Estimate',
        breadcrumbs: [
          HOME,
          { label: 'SOC', href: appPath('/internal-user/vc') },
          { label: 'Ops - VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
          opsBack,
          { label: 'View Estimate' },
        ],
      };
    }
    return {
      title: SPOT_BUSINESS,
      currentPage: 'View Estimate',
      breadcrumbs: [
        HOME,
        SOPF,
        { label: SPOT_BUSINESS, href: appPath('/internal-user/sopf/estimate_list') },
        { label: 'View Estimate' },
      ],
    };
  }

  if (pathname.includes('/updateestimate')) {
    return {
      title: SPOT_BUSINESS,
      currentPage: 'Update Estimate',
      breadcrumbs: [
        HOME,
        SOPF,
        { label: SPOT_BUSINESS, href: appPath('/internal-user/sopf/estimate_list') },
        { label: 'Update Estimate' },
      ],
    };
  }

  for (const pattern of SOPF_ROUTE_PATTERNS) {
    if (matchPath({ path: pattern, end: true }, pathname)) {
      const segment = pattern.split('/').pop();
      return SOPF_PAGE_HEADERS[segment];
    }
  }

  return {
    title: 'SOPF',
    currentPage: 'SOPF',
    breadcrumbs: [HOME, SOPF],
  };
}
