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
    title: 'Vessel Positions',
    currentPage: 'Vessel Positions',
    breadcrumbs: [HOME, SOPF, { label: 'Vessel Positions' }],
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

export function resolveSopfHeader(pathname) {
  if (pathname.includes('/addestimate')) {
    return {
      title: SPOT_BUSINESS,
      currentPage: 'Add Estimate',
      breadcrumbs: [
        HOME,
        SOPF,
        { label: SPOT_BUSINESS, href: appPath('/internal-user/sopf/estimate_list') },
        { label: 'Add Estimate' },
      ],
    };
  }

  if (pathname.includes('/viewestimate')) {
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
