import { appPath } from '@bainbridge/shared-routing';

const HOME = { label: 'Home', href: appPath('/') };
const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };
const OPS_TC = { label: 'TC Ops', href: appPath('/internal-user/vc/ops-tc/finalised-fixtures') };

const PAGES = {
  'finalised-fixtures': 'Finalised Voyage Fixtures TC',
  'in-ops-glance': 'In Ops at a glance TC',
  'post-ops': 'Vessels in Post Ops TC',
  history: 'Vessels in History TC',
  'year-updation': 'Year Updation-TC',
  checklist: 'Ops Checklist',
  'fixture-note': 'Fixture Note',
  'cost-sheet': 'TC Cost Sheet',
  'agency-letter': 'Generate Agency Letter',
  documents: 'Documents',
  'payment-grid': 'Payment / Invoice Grid',
};

export function resolveOpsTcHeader(pathname) {
  if (!pathname.startsWith('/internal-user/vc/ops-tc')) return null;

  const match = pathname.match(/^\/internal-user\/vc\/ops-tc\/([^/]+)/);
  const pageId = match?.[1];
  const label = PAGES[pageId];

  if (
    pageId === 'checklist'
    || pageId === 'fixture-note'
    || pageId === 'cost-sheet'
    || pageId === 'agency-letter'
    || pageId === 'documents'
    || pageId === 'payment-grid'
  ) {
    return {
      title: label,
      currentPage: label,
      breadcrumbs: [
        HOME,
        SOC,
        OPS_TC,
        { label: 'In Ops at a glance TC', href: appPath('/internal-user/vc/ops-tc/in-ops-glance') },
        { label },
      ],
    };
  }

  if (label) {
    return {
      title: label,
      currentPage: label,
      breadcrumbs: [HOME, SOC, OPS_TC, { label }],
    };
  }

  return {
    title: 'TC Ops',
    currentPage: 'TC Ops',
    breadcrumbs: [HOME, SOC, { label: 'TC Ops' }],
  };
}
