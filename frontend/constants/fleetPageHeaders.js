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

function fleetListLabel(module) {
  return module === 'sopf' ? 'Operated Vessels' : 'Fleet';
}

function fleetListHeader(module) {
  const label = fleetListLabel(module);
  return {
    title: label,
    currentPage: label,
    breadcrumbs: [HOME, moduleBreadcrumb(module), { label }],
  };
}

export function resolveFleetHeader(pathname) {
  const module = parseFleetModuleFromPath(pathname);
  if (!FLEET_MODULE_IDS.includes(module)) return null;

  const fleetHref = fleetAppPath(module);
  const moduleCrumb = moduleBreadcrumb(module);
  const listLabel = fleetListLabel(module);

  if (pathname.match(/\/fleet\/vessel\/[^/]+\/(particulars|particulars-tanker)$/) && !pathname.endsWith('/edit')) {
    return {
      title: listLabel,
      currentPage: 'Vessel Particulars',
      breadcrumbs: [HOME, moduleCrumb, { label: listLabel, href: fleetHref }, { label: 'Vessel Particulars' }],
    };
  }

  if (pathname.match(/\/fleet\/vessel\/[^/]+\/particulars(\-tanker)?\/edit$/)) {
    return {
      title: listLabel,
      currentPage: 'Edit Vessel Particulars',
      breadcrumbs: [HOME, moduleCrumb, { label: listLabel, href: fleetHref }, { label: 'Edit Vessel Particulars' }],
    };
  }

  if (pathname.endsWith('/commercial')) {
    return {
      title: listLabel,
      currentPage: 'Commercial Parameters',
      breadcrumbs: [HOME, moduleCrumb, { label: listLabel, href: fleetHref }, { label: 'Commercial Parameters' }],
    };
  }

  if (pathname.endsWith('/primary')) {
    return {
      title: listLabel,
      currentPage: 'Update Vessel',
      breadcrumbs: [HOME, moduleCrumb, { label: listLabel, href: fleetHref }, { label: 'Update Vessel' }],
    };
  }

  if (pathname.endsWith('/fleet/add')) {
    return {
      title: listLabel,
      currentPage: 'Add Vessel',
      breadcrumbs: [HOME, moduleCrumb, { label: listLabel, href: fleetHref }, { label: 'Add Vessel' }],
    };
  }

  if (pathname.endsWith('/fleet') || pathname.endsWith('/fleet/')) {
    return fleetListHeader(module);
  }

  return null;
}

export { moduleHomePath };
