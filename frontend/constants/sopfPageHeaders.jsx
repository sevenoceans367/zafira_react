import { matchPath } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import {
  COA_MODULE_LABELS,
  coaAppPath,
  parseCoaModuleFromPath,
} from './coaModule.js';
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
    title: 'Time Charter Business',
    currentPage: 'Time Charter Business : Recap',
    breadcrumbs: [HOME, SOPF, { label: 'Time Charter Business' }],
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
    const isCoa = Boolean(params.get('coaId') || params.get('coaid'));
    if (isCoa) {
      let runningHref = coaAppPath('sopf', 'running');
      let moduleCrumb = SOPF;
      const returnToRaw = params.get('returnTo') || '';
      if (returnToRaw) {
        try {
          const decoded = decodeURIComponent(returnToRaw);
          if (decoded.startsWith('/internal-user/')) {
            const pathOnly = decoded.split('?')[0];
            const coaModule = parseCoaModuleFromPath(pathOnly);
            runningHref = coaAppPath(coaModule, 'running');
            moduleCrumb = coaModule === 'sopf'
              ? SOPF
              : { label: COA_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
          }
        } catch {
          /* ignore bad returnTo */
        }
      }
      return {
        title: 'New Spot Estimate',
        currentPage: 'New Spot Estimate',
        breadcrumbs: [
          HOME,
          moduleCrumb,
          { label: 'Running COA Business', href: runningHref },
          { label: 'New Spot Estimate' },
        ],
      };
    }
    const isNominate = Boolean(params.get('periodid'));
    const pageLabel = isNominate ? 'Nominate' : 'New Spot Estimate';
    return {
      title: pageLabel,
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
        ? { label: 'Spot Post Ops', href: appPath('/internal-user/vc/ops/in-ops-glance?tab=post-ops') }
        : rttype === '4'
          ? { label: 'Voyage History', href: appPath('/internal-user/vc/ops/in-ops-glance?tab=history') }
          : { label: 'Spot Ops', href: appPath('/internal-user/vc/ops/in-ops-glance') };
      return {
        title: 'View Estimate',
        currentPage: 'View Estimate',
        breadcrumbs: [
          HOME,
          { label: 'SOC', href: appPath('/internal-user/vc') },
          { label: 'Spot Ops', href: appPath('/internal-user/vc/ops/in-ops-glance') },
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
