import { appPath } from '@bainbridge/shared-routing';
import { parseOpsTcTab } from '../pages/internal-user/ops/OpsTcStatusTabs.jsx';

const HOME = { label: 'Home', href: appPath('/') };
const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };
const OPS_TC = { label: 'TC Ops', href: appPath('/internal-user/vc/ops-tc/in-ops-glance') };

const PAGES = {
  'finalised-fixtures': 'TC Ops',
  'in-ops-glance': 'TC Ops',
  'post-ops': 'TC Ops',
  history: 'TC Ops',
  'year-updation': 'Year Updation-TC',
  checklist: 'Ops Checklist',
  'fixture-note': 'Fixture Note',
  'cost-sheet': 'TC Cost Sheet',
  'agency-letter': 'Generate Agency Letter',
  documents: 'Documents',
  'payment-grid': 'Payment / Invoice Grid',
};

const GLANCE_TAB_TITLES = {
  ops: 'TC Ops',
  'post-ops': 'Post Ops',
  history: 'Voyage History',
};

export function resolveOpsTcHeader(pathname, search = '') {
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
        { label },
      ],
    };
  }

  if (pageId === 'in-ops-glance') {
    const tab = parseOpsTcTab(new URLSearchParams(
      search.startsWith('?') ? search.slice(1) : search,
    ).get('tab'));
    const tabTitle = GLANCE_TAB_TITLES[tab] || 'TC Ops';
    return {
      title: tabTitle,
      currentPage: tabTitle,
      breadcrumbs: [HOME, SOC, { label: tabTitle }],
    };
  }

  if (label) {
    return {
      title: label,
      currentPage: label,
      breadcrumbs: [HOME, SOC, { label }],
    };
  }

  return {
    title: 'TC Ops',
    currentPage: 'TC Ops',
    breadcrumbs: [HOME, SOC, { label: 'TC Ops' }],
  };
}
