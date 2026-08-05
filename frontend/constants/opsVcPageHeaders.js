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
  'pda-fda': 'PDA/FDA',
  documents: 'Documents',
  'payment-grid': 'Payment / Invoice Grid',
  sof: 'SOF',
  laytime: 'Laytime',
  bunker: 'Bunkers',
  'soa-report': 'SOA',
  'cost-sheet': 'Voyage Financials',
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

  if (pageId === 'pda-fda') {
    return {
      title: 'Ops - VC',
      currentPage: 'PDA/FDA',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'PDA/FDA' },
      ],
    };
  }

  if (pageId === 'documents') {
    return {
      title: 'Ops - VC',
      currentPage: 'Documents',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'Documents' },
      ],
    };
  }

  if (pageId === 'payment-grid') {
    return {
      title: 'Ops - VC',
      currentPage: 'Payment / Invoice Grid',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'Payment / Invoice Grid' },
      ],
    };
  }

  if (pageId === 'sof') {
    return {
      title: 'Ops - VC',
      currentPage: 'SOF',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'SOF' },
      ],
    };
  }

  if (pageId === 'laytime') {
    return {
      title: 'Ops - VC',
      currentPage: 'Laytime',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'Laytime' },
      ],
    };
  }

  if (pageId === 'bunker') {
    return {
      title: 'Ops - VC',
      currentPage: 'Bunkers',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'Bunkers' },
      ],
    };
  }

  if (pageId === 'soa-report') {
    return {
      title: 'Ops - VC',
      currentPage: 'SOA',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'SOA' },
      ],
    };
  }

  if (pageId === 'cost-sheet') {
    return {
      title: 'Ops - VC',
      currentPage: 'Voyage Financials',
      breadcrumbs: [
        HOME,
        SOC,
        OPS_VC,
        { label: 'In Ops at a glance VC', href: appPath('/internal-user/vc/ops/in-ops-glance') },
        { label: 'Voyage Financials' },
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
