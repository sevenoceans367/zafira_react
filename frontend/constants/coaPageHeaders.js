import { appPath } from '@bainbridge/shared-routing';
import {
  COA_MODULE_IDS,
  COA_MODULE_LABELS,
  coaAppPath,
  parseCoaModuleFromPath,
} from './coaModule.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

const HOME = { label: 'Home', href: appPath('/') };

function moduleBreadcrumb(module) {
  if (module === 'sopf') {
    return { label: COA_MODULE_LABELS.sopf, href: appPath(SOPF_ENTRY_ROUTE) };
  }
  return { label: COA_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}

export function resolveCoaHeader(pathname, search = '') {
  if (!pathname.includes('/coas')) return null;
  const module = parseCoaModuleFromPath(pathname);
  if (!COA_MODULE_IDS.includes(module)) return null;
  if (!pathname.startsWith(`/internal-user/${module}/coas`)) return null;

  const runningHref = coaAppPath(module, 'running');
  const opsReletHref = `${coaAppPath(module, 'in-ops')}?tradeType=relet`;
  const moduleCrumb = moduleBreadcrumb(module);
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fromRunning = params.get('from') === 'running';
  const reletParent = fromRunning
    ? { label: 'Running COA Business', href: runningHref }
    : { label: 'COA Ops', href: opsReletHref };

  if (pathname.includes('/coas/running/add')) {
    return {
      title: 'Add a new COA',
      currentPage: 'New COA',
      breadcrumbs: [
        HOME,
        moduleCrumb,
        { label: 'Running COA Business', href: runningHref },
        { label: 'New COA' },
      ],
    };
  }

  if (/\/coas\/running\/[^/]+$/.test(pathname)) {
    return {
      title: 'Update COA',
      currentPage: 'Update COA',
      breadcrumbs: [
        HOME,
        moduleCrumb,
        { label: 'Running COA Business', href: runningHref },
        { label: 'Update COA' },
      ],
    };
  }

  if (pathname.endsWith('/coas/running') || pathname.endsWith('/coas/running/')) {
    return {
      title: 'Running COA Business',
      currentPage: 'Running COA Business',
      breadcrumbs: [HOME, moduleCrumb, { label: 'Running COA Business' }],
    };
  }

  if (pathname.includes('/coas/cargo-relet/add')) {
    return {
      title: 'New Cargo Relet',
      currentPage: 'New Cargo Relet',
      breadcrumbs: [
        HOME,
        moduleCrumb,
        reletParent,
        { label: 'New Cargo Relet' },
      ],
    };
  }

  if (/\/coas\/cargo-relet\/[^/]+$/.test(pathname)) {
    return {
      title: 'Update Cargo Relet',
      currentPage: 'Update Cargo Relet',
      breadcrumbs: [
        HOME,
        moduleCrumb,
        reletParent,
        { label: 'Update Cargo Relet' },
      ],
    };
  }

  if (pathname.endsWith('/coas/cargo-relet') || pathname.endsWith('/coas/cargo-relet/')) {
    return {
      title: 'COA Ops',
      currentPage: 'Cargo Relet',
      breadcrumbs: [
        HOME,
        moduleCrumb,
        { label: 'COA Ops', href: opsReletHref },
        { label: 'Cargo Relet' },
      ],
    };
  }

  if (pathname.includes('/coas/in-ops') || pathname.includes('/coas/post-ops')) {
    return {
      title: 'COA Ops',
      currentPage: 'COA Ops',
      breadcrumbs: [HOME, moduleCrumb, { label: 'COA Ops' }],
    };
  }

  return {
    title: 'COAs',
    currentPage: 'COAs',
    breadcrumbs: [HOME, moduleCrumb, { label: 'COAs', href: runningHref }],
  };
}
