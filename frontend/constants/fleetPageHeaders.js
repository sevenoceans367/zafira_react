import { appPath } from '@bainbridge/shared-routing';
import {
  FLEET_MODULE_IDS,
  FLEET_MODULE_LABELS,
  fleetAppPath,
  moduleHomePath,
  parseFleetModuleFromPath,
} from './fleetModule.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

const HOME = { label: 'Home', href: appPath('/') };

function moduleBreadcrumb(module) {
  if (module === 'sopf') {
    return { label: FLEET_MODULE_LABELS.sopf, href: appPath(SOPF_ENTRY_ROUTE) };
  }
  if (module === 'tc') {
    return { label: FLEET_MODULE_LABELS.tc, href: appPath('/internal-user/tc') };
  }
  return { label: FLEET_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}

function fleetListHeader(module) {
  return {
    title: 'Fleet',
    currentPage: 'Fleet',
    breadcrumbs: [HOME, moduleBreadcrumb(module), { label: 'Fleet' }],
  };
}

export function resolveFleetHeader(pathname) {
  const module = parseFleetModuleFromPath(pathname);
  if (!FLEET_MODULE_IDS.includes(module)) return null;

  const fleetHref = fleetAppPath(module);
  const moduleCrumb = moduleBreadcrumb(module);

  if (pathname.match(/\/fleet\/vessel\/[^/]+\/(particulars|particulars-tanker)$/) && !pathname.endsWith('/edit')) {
    return {
      title: 'Fleet',
      currentPage: 'Vessel Particulars',
      breadcrumbs: [HOME, moduleCrumb, { label: 'Fleet', href: fleetHref }, { label: 'Vessel Particulars' }],
    };
  }

  if (pathname.match(/\/fleet\/vessel\/[^/]+\/particulars(\-tanker)?\/edit$/)) {
    return {
      title: 'Fleet',
      currentPage: 'Edit Vessel Particulars',
      breadcrumbs: [HOME, moduleCrumb, { label: 'Fleet', href: fleetHref }, { label: 'Edit Vessel Particulars' }],
    };
  }

  if (pathname.endsWith('/commercial')) {
    return {
      title: 'Fleet',
      currentPage: 'Commercial Parameters',
      breadcrumbs: [HOME, moduleCrumb, { label: 'Fleet', href: fleetHref }, { label: 'Commercial Parameters' }],
    };
  }

  if (pathname.endsWith('/primary')) {
    return {
      title: 'Fleet',
      currentPage: 'Update Vessel',
      breadcrumbs: [HOME, moduleCrumb, { label: 'Fleet', href: fleetHref }, { label: 'Update Vessel' }],
    };
  }

  if (pathname.endsWith('/fleet/add')) {
    return {
      title: 'Fleet',
      currentPage: 'Add Vessel',
      breadcrumbs: [HOME, moduleCrumb, { label: 'Fleet', href: fleetHref }, { label: 'Add Vessel' }],
    };
  }

  if (pathname.endsWith('/fleet') || pathname.endsWith('/fleet/')) {
    return fleetListHeader(module);
  }

  return null;
}

export { moduleHomePath };
