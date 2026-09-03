import { appPath } from '@bainbridge/shared-routing';

const HOME = { label: 'Home', href: appPath('/') };
const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };
const OPS_VC = { label: 'Spot Ops', href: appPath('/internal-user/vc/ops/in-ops-glance') };

const PAGES = {
  'in-ops-glance': 'Spot Ops',
  'post-ops': 'Spot Post Ops',
  history: 'Voyage History',
  'year-updation': 'Year Updation',
  'voyage-report': 'Voyage Report',
  'agency-letter': 'Generate Voyage Letters',
  'pda-fda': 'PDA/FDA',
  documents: 'Documents',
  'payment-grid': 'Payment / Invoice Grid',
  'freight-invoice': 'Freight Invoice',
  'other-invoice': 'Other Invoice',
  'hire-statement': 'Hire Statement',
  'clubbed-invoice': 'Invoice Clubbed',
  'clubbed-hire': 'Payment Clubbed',
  'request-port-cost': 'Operational Costs Payment',
  sof: 'Statement of Facts',
  checklist: 'Ops Checklist',
  laytime: 'Laytime Calculations',
  bunker: 'Bunker Calculations',
  'soa-report': 'Cashflow',
  'cost-sheet': 'Voyage Financials',
};

const FROM_PAYMENT_GRID = new Set([
  'other-invoice',
  'hire-statement',
  'clubbed-invoice',
  'clubbed-hire',
  'freight-invoice',
  'request-port-cost',
]);

const FROM_IN_OPS = new Set([
  'voyage-report',
  'agency-letter',
  'pda-fda',
  'documents',
  'payment-grid',
  'sof',
  'checklist',
  'laytime',
  'bunker',
  'soa-report',
  'cost-sheet',
]);

function header(title, breadcrumbs) {
  return { title, currentPage: title, breadcrumbs };
}

export function resolveOpsVcHeader(pathname, search = '') {
  if (pathname.startsWith('/internal-user/vc/ops-tc')) return null;
  if (!pathname.startsWith('/internal-user/vc/ops')) return null;

  const match = pathname.match(/^\/internal-user\/vc\/ops\/([^/]+)/);
  let pageId = match?.[1];

  // Hub tabs share /ops/in-ops-glance; map ?tab= to the page title.
  if (pageId === 'in-ops-glance') {
    const tab = new URLSearchParams(
      search.startsWith('?') ? search.slice(1) : search,
    ).get('tab');
    if (tab === 'post-ops' || tab === 'postops' || tab === '2') pageId = 'post-ops';
    else if (tab === 'history' || tab === '3') pageId = 'history';
  }

  const label = PAGES[pageId];
  const inOpsCrumb = {
    label: PAGES['in-ops-glance'],
    href: appPath('/internal-user/vc/ops/in-ops-glance'),
  };
  const paymentGridCrumb = {
    label: PAGES['payment-grid'],
    href: appPath('/internal-user/vc/ops/payment-grid'),
  };

  if (FROM_PAYMENT_GRID.has(pageId) && label) {
    return header(label, [HOME, SOC, OPS_VC, inOpsCrumb, paymentGridCrumb, { label }]);
  }

  if (FROM_IN_OPS.has(pageId) && label) {
    return header(label, [HOME, SOC, OPS_VC, inOpsCrumb, { label }]);
  }

  if (label) {
    return header(label, [HOME, SOC, OPS_VC, { label }]);
  }

  return header('Spot Ops', [HOME, SOC, { label: 'Spot Ops' }]);
}
