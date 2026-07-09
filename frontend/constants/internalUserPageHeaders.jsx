import { appPath } from '@bainbridge/shared-routing';
import { resolveSopfHeader } from './sopfPageHeaders.jsx';
import { resolveFleetHeader } from './fleetPageHeaders.js';

const HOME = { label: 'Home', href: appPath('/') };

const STATIC_HEADERS = {
  '/': {
    title: 'Dashboard',
    currentPage: 'Dashboard',
    breadcrumbs: [HOME],
  },
  '/reports': {
    title: 'Reports',
    currentPage: 'Reports',
    breadcrumbs: [HOME, { label: 'Reports' }],
  },
  '/internal-user/vc': {
    title: 'Dashboard',
    currentPage: 'Dashboard',
    breadcrumbs: [HOME, { label: 'VC', href: appPath('/internal-user/vc') }, { label: 'Dashboard' }],
  },
  '/internal-user/tc': {
    title: 'TC',
    currentPage: 'Time Charter',
    breadcrumbs: [HOME, { label: 'TC' }],
  },
};

export function resolveInternalUserHeader(pathname) {
  if (STATIC_HEADERS[pathname]) {
    return STATIC_HEADERS[pathname];
  }

  if (pathname.startsWith('/internal-user/sopf')) {
    const fleetHeader = resolveFleetHeader(pathname);
    if (fleetHeader) return fleetHeader;
    return resolveSopfHeader(pathname);
  }

  const fleetHeader = resolveFleetHeader(pathname);
  if (fleetHeader) return fleetHeader;

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
