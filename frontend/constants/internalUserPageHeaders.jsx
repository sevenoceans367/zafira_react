import { appPath } from '@bainbridge/shared-routing';
import { resolveSopfHeader } from './sopfPageHeaders.jsx';

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
};

export function resolveInternalUserHeader(pathname) {
  if (STATIC_HEADERS[pathname]) {
    return STATIC_HEADERS[pathname];
  }

  if (pathname.startsWith('/internal-user/sopf')) {
    return resolveSopfHeader(pathname);
  }

  return {
    title: 'Internal User',
    currentPage: 'Internal User',
    breadcrumbs: [HOME],
  };
}
