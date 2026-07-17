import { appPath } from '@bainbridge/shared-routing';

const HOME = { label: 'Home', href: appPath('/') };
const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };
const COAS = { label: 'COAs', href: appPath('/internal-user/vc/coas/running') };

export function resolveCoaHeader(pathname) {
  if (!pathname.startsWith('/internal-user/vc/coas')) return null;

  if (pathname.startsWith('/internal-user/vc/coas/running/add')) {
    return {
      title: 'Running COAs',
      currentPage: 'Add COA',
      breadcrumbs: [
        HOME,
        SOC,
        { label: 'Running COAs', href: appPath('/internal-user/vc/coas/running') },
        { label: 'Add COA' },
      ],
    };
  }

  if (/^\/internal-user\/vc\/coas\/running\/[^/]+$/.test(pathname)) {
    return {
      title: 'Running COAs',
      currentPage: 'Update COA',
      breadcrumbs: [
        HOME,
        SOC,
        { label: 'Running COAs', href: appPath('/internal-user/vc/coas/running') },
        { label: 'Update COA' },
      ],
    };
  }

  if (pathname === '/internal-user/vc/coas/running') {
    return {
      title: 'Running COAs',
      currentPage: 'Running COAs',
      breadcrumbs: [HOME, SOC, { label: 'Running COAs' }],
    };
  }

  if (pathname.startsWith('/internal-user/vc/coas/cargo-relet/add')) {
    return {
      title: 'COA - Cargo Relet',
      currentPage: 'Add Cargo Relet',
      breadcrumbs: [
        HOME,
        SOC,
        { label: 'COA - Cargo Relet', href: appPath('/internal-user/vc/coas/cargo-relet') },
        { label: 'Add Cargo Relet' },
      ],
    };
  }

  if (/^\/internal-user\/vc\/coas\/cargo-relet\/[^/]+$/.test(pathname)) {
    return {
      title: 'COA - Cargo Relet',
      currentPage: 'Update Cargo Relet',
      breadcrumbs: [
        HOME,
        SOC,
        { label: 'COA - Cargo Relet', href: appPath('/internal-user/vc/coas/cargo-relet') },
        { label: 'Update Cargo Relet' },
      ],
    };
  }

  if (pathname === '/internal-user/vc/coas/cargo-relet') {
    return {
      title: 'COA - Cargo Relet',
      currentPage: 'COA - Cargo Relet',
      breadcrumbs: [HOME, SOC, { label: 'COA - Cargo Relet' }],
    };
  }

  if (pathname.startsWith('/internal-user/vc/coas/in-ops')) {
    return {
      title: 'COA - In Ops',
      currentPage: 'COA - In Ops',
      breadcrumbs: [HOME, SOC, { label: 'COA - In Ops' }],
    };
  }

  if (pathname.startsWith('/internal-user/vc/coas/post-ops')) {
    return {
      title: 'COA - Post Ops',
      currentPage: 'COA - Post Ops',
      breadcrumbs: [HOME, SOC, { label: 'COA - Post Ops' }],
    };
  }

  return {
    title: 'COAs',
    currentPage: 'COAs',
    breadcrumbs: [HOME, SOC, COAS],
  };
}
