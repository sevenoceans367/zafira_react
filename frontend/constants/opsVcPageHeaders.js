import { appPath } from '@bainbridge/shared-routing';

const HOME = { label: 'Home', href: appPath('/') };
const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };
const OPS_VC = { label: 'Ops - VC', href: appPath('/internal-user/vc/ops/in-ops-glance') };

const PAGES = {
  'in-ops-glance': 'In Ops at a glance VC',
  'post-ops': 'Vessels in Post Ops VC',
  history: 'Vessels in History VC',
  'year-updation': 'Year Updation-VC/COA',
  'voyage-report': 'Voyage Report',
  'agency-letter': 'Generate Port Related Letters',
};

export function resolveOpsVcHeader(pathname) {
  if (!pathname.startsWith('/internal-user/vc/ops')) return null;

  const match = pathname.match(/^\/internal-user\/vc\/ops\/([^/]+)/);
  const pageId = match?.[1];
  const label = PAGES[pageId];

  if (pageId === 'voyage-report') {
    return {
      title: 'Ops - VC',
      currentPage: 'Voyage Report',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'Voyage Report' },
      ],
    };
  }

  if (pageId === 'agency-letter') {
    return {
      title: 'Ops - VC',
      currentPage: 'Generate Port Related Letters',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'Generate Port Related Letters' },
      ],
    };
  }

  if (label) {
    return {
      title: 'Ops - VC',
      currentPage: label,
      breadcrumbs: [HOME, SOC, OPS_VC, { label }],
    };
  }

  return {
    title: 'Ops - VC',
    currentPage: 'Ops - VC',
    breadcrumbs: [HOME, SOC, { label: 'Ops - VC' }],
  };
}
