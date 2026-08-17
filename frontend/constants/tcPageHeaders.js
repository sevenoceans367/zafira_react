import { appPath } from '@bainbridge/shared-routing';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';
import {
  TC_MODULE_LABELS,
  parseTcModuleFromPath,
  tcAppPath,
} from './tcModule.js';

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
      currentPage: 'Time Charter Business : Estimate',
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

export function resolveTcHeader(pathname) {
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
    return {
      title: meta.title,
      currentPage: 'Add Fixture Note',
      breadcrumbs: [HOME, crumb, listCrumb, { label: 'Add Fixture Note' }],
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
      title: meta.title,
      currentPage: 'Edit Fixture Note',
      breadcrumbs: [HOME, crumb, listCrumb, { label: 'Edit Fixture Note' }],
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
      title: meta.title,
      currentPage: 'View Estimate',
      breadcrumbs: [HOME, crumb, listCrumb, { label: 'View Estimate' }],
    };
  }

  return {
    title: meta.title,
    currentPage: meta.currentPage,
    breadcrumbs: [HOME, crumb, { label: meta.listLabel }],
  };
}
