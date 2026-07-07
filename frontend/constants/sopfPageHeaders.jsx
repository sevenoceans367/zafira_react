import { matchPath } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';

const HOME = { label: 'Home', href: appPath('/') };

export const SOPF_PAGE_HEADERS = {
  estimate_list: {
    title: 'VC Out Estimates',
    currentPage: 'VC Out Estimates : Estimate',
    breadcrumbs: [HOME, { label: 'VC Out Estimates : Estimate' }],
  },
};

const SOPF_ROUTE_PATTERNS = Object.keys(SOPF_PAGE_HEADERS).map(
  (segment) => `/internal-user/sopf/${segment}`,
);

export function resolveSopfHeader(pathname) {
  if (pathname.includes('/viewestimate')) {
    return {
      title: 'VC Out Estimates',
      currentPage: 'View Estimate',
      breadcrumbs: [
        HOME,
        { label: 'VC Out Estimates : Estimate', href: appPath('/internal-user/sopf/estimate_list') },
        { label: 'View Estimate' },
      ],
    };
  }

  if (pathname.includes('/updateestimate')) {
    return {
      title: 'VC Out Estimates',
      currentPage: 'Update Estimate',
      breadcrumbs: [
        HOME,
        { label: 'VC Out Estimates : Estimate', href: appPath('/internal-user/sopf/estimate_list') },
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
    breadcrumbs: [HOME, { label: 'SOPF' }],
  };
}
