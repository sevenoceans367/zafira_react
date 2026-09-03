import { appPath } from '@bainbridge/shared-routing';
import {
  CARGO_RELET_MODULE_IDS,
  CARGO_RELET_MODULE_LABELS,
  cargoReletAppPath,
  isCargoReletPath,
  parseCargoReletModuleFromPath,
} from './cargoReletModule.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

const HOME = { label: 'Home', href: appPath('/') };

function moduleBreadcrumb(module) {
  if (module === 'sopf') {
    return { label: CARGO_RELET_MODULE_LABELS.sopf, href: appPath(SOPF_ENTRY_ROUTE) };
  }
  return { label: CARGO_RELET_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}

export function resolveCargoReletHeader(pathname) {
  if (!isCargoReletPath(pathname)) return null;
  const module = parseCargoReletModuleFromPath(pathname);
  if (!CARGO_RELET_MODULE_IDS.includes(module)) return null;

  const listHref = cargoReletAppPath(module);
  const opsHref = cargoReletAppPath(module, 'ops');
  const parent = { label: 'Cargo Relet', href: listHref };

  if (pathname.includes('/cargo-relets/add')) {
    return {
      title: 'New Cargo Relet',
      currentPage: 'New Cargo Relet',
      breadcrumbs: [HOME, moduleBreadcrumb(module), parent, { label: 'New Cargo Relet' }],
    };
  }

  if (/\/cargo-relets\/[^/]+$/.test(pathname) && !pathname.endsWith('/ops')) {
    return {
      title: 'Update Cargo Relet',
      currentPage: 'Update Cargo Relet',
      breadcrumbs: [HOME, moduleBreadcrumb(module), parent, { label: 'Update Cargo Relet' }],
    };
  }

  if (pathname.includes('/cargo-relets/ops')) {
    return {
      title: 'Cargo Relet Ops',
      currentPage: 'Cargo Relet Ops',
      breadcrumbs: [HOME, moduleBreadcrumb(module), parent, { label: 'Cargo Relet Ops', href: opsHref }],
    };
  }

  return {
    title: 'Cargo Relets',
    currentPage: 'Cargo Relets',
    breadcrumbs: [HOME, moduleBreadcrumb(module), { label: 'Cargo Relets', href: listHref }],
  };
}
