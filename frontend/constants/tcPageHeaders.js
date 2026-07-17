import { appPath } from '@bainbridge/shared-routing';

const HOME = { label: 'Home', href: appPath('/') };
const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };
const TC_LIST = { label: 'TC Out Estimates', href: appPath('/internal-user/vc/tc') };

export function resolveTcHeader(pathname) {
  if (!pathname.startsWith('/internal-user/vc/tc')) return null;

  if (pathname === '/internal-user/vc/tc/add') {
    return {
      title: 'TC Out Estimates',
      currentPage: 'Add Fixture Note',
      breadcrumbs: [HOME, SOC, TC_LIST, { label: 'Add Fixture Note' }],
    };
  }

  if (pathname === '/internal-user/vc/tc/decision-charts') {
    return {
      title: 'TC Out Estimates',
      currentPage: 'Decision Charts',
      breadcrumbs: [HOME, SOC, TC_LIST, { label: 'Decision Charts' }],
    };
  }

  if (/^\/internal-user\/vc\/tc\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: 'TC Out Estimates',
      currentPage: 'Edit Fixture Note',
      breadcrumbs: [HOME, SOC, TC_LIST, { label: 'Edit Fixture Note' }],
    };
  }

  if (/^\/internal-user\/vc\/tc\/[^/]+\/calculate$/.test(pathname)) {
    return {
      title: 'TC Out Estimates',
      currentPage: 'Calculate Estimate',
      breadcrumbs: [HOME, SOC, TC_LIST, { label: 'Calculate Estimate' }],
    };
  }

  if (/^\/internal-user\/vc\/tc\/[^/]+\/view$/.test(pathname)) {
    return {
      title: 'TC Out Estimates',
      currentPage: 'View Estimate',
      breadcrumbs: [HOME, SOC, TC_LIST, { label: 'View Estimate' }],
    };
  }

  if (pathname === '/internal-user/vc/tc') {
    return {
      title: 'TC Out Estimates',
      currentPage: 'TC Out Estimates',
      breadcrumbs: [HOME, SOC, { label: 'TC Out Estimates' }],
    };
  }

  return {
    title: 'TC Out Estimates',
    currentPage: 'TC Out Estimates',
    breadcrumbs: [HOME, SOC, { label: 'TC Out Estimates' }],
  };
}
