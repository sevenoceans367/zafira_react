import { appPath } from '@bainbridge/shared-routing';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';
import {
  TC_MODULE_LABELS,
  parseTcModuleFromPath,
  tcAppPath,
} from './tcModule.js';
import {
  parsePeriodContractModuleFromPath,
  periodContractAppPath,
} from './periodContractModule.js';

const HOME = { label: 'Home', href: appPath('/') };

function moduleCrumb(module) {
  if (module === 'sopf') {
    return { label: TC_MODULE_LABELS.sopf, href: appPath(SOPF_ENTRY_ROUTE) };
  }
  return { label: TC_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}

function listMeta(module) {
  const listHref = tcAppPath(module);
  if (module === 'sopf') {
    return {
      title: 'Time Charter Business',
      currentPage: 'Time Charter Business : Recap',
      listHref,
      listLabel: 'Time Charter Business',
    };
  }
  return {
    title: 'TC Out Estimates',
    currentPage: 'TC Out Estimates',
    listHref,
    listLabel: 'TC Out Estimates',
  };
}

export function resolveTcHeader(pathname, search = '') {
  const path = String(pathname || '');
  const isSopfTc = path.startsWith('/internal-user/sopf/time-charter');
  const isVcTc = path.startsWith('/internal-user/vc/tc')
    || path === '/internal-user/vc/decision-chart-tc';
  if (!isSopfTc && !isVcTc) return null;

  const module = parseTcModuleFromPath(path);
  const crumb = moduleCrumb(module);
  const meta = listMeta(module);
  const listCrumb = { label: meta.listLabel, href: meta.listHref };

  if (path.endsWith('/add')) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const isPeriod = Boolean(params.get('periodId') || params.get('periodid'));
    if (isPeriod) {
      let periodModule = module === 'sopf' ? 'sopf' : 'vc';
      let periodHref = periodContractAppPath(periodModule);
      const returnToRaw = params.get('returnTo') || '';
      if (returnToRaw) {
        try {
          const decoded = decodeURIComponent(returnToRaw);
          if (decoded.startsWith('/internal-user/')) {
            const pathOnly = decoded.split('?')[0];
            periodModule = parsePeriodContractModuleFromPath(pathOnly);
            periodHref = periodContractAppPath(periodModule);
          }
        } catch {
          /* ignore bad returnTo */
        }
      }
      const listLabel = periodModule === 'sopf' ? 'Period Business' : 'Period';
      return {
        title: 'Add New TC Recap',
        currentPage: 'Add New TC Recap',
        breadcrumbs: [
          HOME,
          crumb,
          { label: listLabel, href: periodHref },
          { label: 'Add New TC Recap' },
        ],
      };
    }
    return {
      title: 'Add TC Recap',
      currentPage: 'Add TC Recap',
      breadcrumbs: [HOME, crumb, listCrumb, { label: 'Add TC Recap' }],
    };
  }

  if (path.endsWith('/decision-charts') || path === '/internal-user/vc/decision-chart-tc') {
    return {
      title: meta.title,
      currentPage: 'Decision Charts',
      breadcrumbs: [HOME, crumb, listCrumb, { label: 'Decision Charts' }],
    };
  }

  if (/\/[^/]+\/edit$/.test(path)) {
    return {
      title: 'Edit TC Recap',
      currentPage: 'Edit TC Recap',
      breadcrumbs: [HOME, crumb, listCrumb, { label: 'Edit TC Recap' }],
    };
  }

  if (/\/[^/]+\/calculate$/.test(path)) {
    return {
      title: meta.title,
      currentPage: 'Calculate Estimate',
      breadcrumbs: [HOME, crumb, listCrumb, { label: 'Calculate Estimate' }],
    };
  }

  if (/\/[^/]+\/view$/.test(path)) {
    return {
      title: 'View TC Recap',
      currentPage: 'View TC Recap',
      breadcrumbs: [HOME, crumb, listCrumb, { label: 'View TC Recap' }],
    };
  }

  return {
    title: meta.title,
    currentPage: meta.currentPage,
    breadcrumbs: [HOME, crumb, { label: meta.listLabel }],
  };
}
