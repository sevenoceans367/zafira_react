import { appPath } from '@bainbridge/shared-routing';
import {
  ELIBRARY_MODULE_IDS,
  ELIBRARY_MODULE_LABELS,
  elibraryAppPath,
  parseElibraryModuleFromPath,
} from './elibraryModule.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

const HOME = { label: 'Home', href: appPath('/') };

function moduleBreadcrumb(module) {
  if (module === 'sopf') {
    return { label: ELIBRARY_MODULE_LABELS.sopf, href: appPath(SOPF_ENTRY_ROUTE) };
  }
  if (module === 'tc') {
    return { label: ELIBRARY_MODULE_LABELS.tc, href: appPath('/internal-user/tc') };
  }
  return { label: ELIBRARY_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}

export function resolveElibraryHeader(pathname) {
  const module = parseElibraryModuleFromPath(pathname);
  if (!ELIBRARY_MODULE_IDS.includes(module)) return null;
  if (!pathname.includes('/elibrary')) return null;

  const listHref = elibraryAppPath(module);
  const isAdd = pathname.includes('/elibrary/add');
  const isEdit = /\/elibrary\/edit\//.test(pathname);

  if (isAdd) {
    return {
      title: 'E-Library',
      currentPage: 'Add References',
      breadcrumbs: [
        HOME,
        moduleBreadcrumb(module),
        { label: 'E-Library', href: listHref },
        { label: 'Add References' },
      ],
    };
  }

  if (isEdit) {
    return {
      title: 'E-Library',
      currentPage: 'Edit Details',
      breadcrumbs: [
        HOME,
        moduleBreadcrumb(module),
        { label: 'E-Library', href: listHref },
        { label: 'Edit Details' },
      ],
    };
  }

  return {
    title: 'E-Library',
    currentPage: 'E-Library',
    breadcrumbs: [
      HOME,
      moduleBreadcrumb(module),
      { label: 'E-Library' },
    ],
  };
}
