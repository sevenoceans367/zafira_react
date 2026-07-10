import { appPath } from '@bainbridge/shared-routing';
import { getMasterModule, MASTERS_MODULES } from './mastersModules.js';
import {
  MASTERS_MODULE_IDS,
  moduleBreadcrumb,
  parseMastersModuleFromPath,
} from './mastersModule.js';

const HOME = { label: 'Home', href: appPath('/') };

export function resolveMastersHeader(pathname) {
  const module = parseMastersModuleFromPath(pathname);
  if (!MASTERS_MODULE_IDS.includes(module)) return null;
  if (!pathname.includes('/masters/')) return null;

  const masterMatch = pathname.match(/\/masters\/([^/]+)/);
  const masterId = masterMatch?.[1];
  const master = getMasterModule(masterId);

  if (!master) return null;

  return {
    title: 'Masters',
    currentPage: master.label,
    breadcrumbs: [
      HOME,
      moduleBreadcrumb(module),
      { label: 'Masters' },
      { label: master.label },
    ],
  };
}

export function isMastersPath(pathname) {
  return MASTERS_MODULES.some((item) => pathname.includes(`/masters/${item.id}`));
}
