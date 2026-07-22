/**
 * Reports sidebar menu — sections and report pages.
 * Placeholder routes live at `/internal-user/vc/reports/:sectionId/:reportId`.
 * Swap in real page components via `reportsPageRegistry.js` as files arrive.
 */

export const REPORTS_BASE = '/internal-user/vc/reports';

export const REPORTS_SECTIONS = [
  {
    id: 'chartering',
    label: 'Chartering',
    items: [
      { id: 'da-tracker-chartering', label: 'DA Tracker - CHARTERING' },
      { id: 'approval-status-report', label: 'Approval Status Report' },
      { id: 'vessel-tc-perf-against-baltic', label: 'Vessel/TC Perf against Baltic' },
      { id: 'vessel-open-position-report', label: 'Vessel Open Position Report' },
      { id: 'spot-fixtures-report', label: 'Spot Fixtures Report' },
      { id: 'chartering-register-coa-spot', label: 'Chartering Register - COA/SPOT' },
      { id: 'chartering-register-detailed-coa-spot', label: 'Chartering Register - Detailed - COA/SPOT' },
      { id: 'chartering-register-tcs', label: 'Chartering Register - TCs' },
      { id: 'tc-earning-report', label: 'TC Earning Report' },
      { id: 'voyage-report-fleet', label: 'Voyage Report - Fleet' },
    ],
  },
  {
    id: 'management',
    label: 'Management Reports',
    items: [
      { id: 'comparison-report', label: 'Comparison Report' },
      { id: 'pl-at-a-glance-vc', label: 'P & L At a Glance-VC' },
      { id: 'pl-at-a-glance-vc-tc', label: 'P & L At a Glance-VC/TC' },
      { id: 'pl-at-a-glance-tc', label: 'P & L At a Glance-TC' },
      { id: 'cargo-tonnage-report', label: 'Cargo Tonnage Report' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'voyage-details', label: 'Voyage Details' },
      { id: 'agent-list', label: 'Agent List' },
      { id: 'bunker-consumption-report', label: 'Bunker Consumption Report' },
      { id: 'daily-position-report', label: 'Daily Position Report' },
      { id: 'dead-freight-summary', label: 'Dead Freight Summary' },
      { id: 'demurrage-summary', label: 'Demmurage Summary' },
      { id: 'headwise-expense-report', label: 'Headwise Expense Report' },
      { id: 'port-performance-report', label: 'Port Performance Report' },
      { id: 'detailed-register', label: 'Detailed Register' },
      { id: 'ffi-tracker-vc-out', label: 'FFI Tracker (VC OUT)' },
      { id: 'ffi-tracker-vc-in', label: 'FFI Tracker (VC IN)' },
      { id: 'ffi-brokerage-tracker', label: 'FFI Brokerage Tracker' },
      { id: 'fhs-brokerage-tracker-vc', label: 'FHS & Brokerage Tracker (VC)' },
      { id: 'fhs-brokerage-tracker-tc-expense', label: 'FHS & Brokerage Tracker TC Expense' },
      { id: 'fhs-brokerage-tracker-tc-income', label: 'FHS & Brokerage Tracker TC Income' },
      { id: 'da-tracker-ops-post-ops', label: 'DA Tracker - Ops & Post Ops' },
      { id: 'hire-expense-details-vc', label: 'Hire Expense Details(Vc)' },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    items: [
      { id: 'aging-report-payable', label: 'Aging Report (Payable)' },
      { id: 'aging-report-receivables', label: 'Aging Report (Receivables)' },
      { id: 'payable-receivables-report', label: 'Payable & Receivables Report' },
      { id: 'profitability-analysis-coa-spot', label: 'Profitability Analysis - COA/Spot' },
      { id: 'projected-cash-flow-vc', label: 'Projected Cash Flow (VC)' },
      { id: 'shipment-register', label: 'Shipment Register' },
      { id: 'payment-actioned-report', label: 'Payment Actioned Report' },
    ],
  },
  {
    id: 'graphical',
    label: 'Graphical Reports',
    items: [
      { id: 'vessel-yearly-performance', label: 'Vessel Yearly Performance' },
    ],
  },
];

export function reportAppPath(sectionId, reportId) {
  return `${REPORTS_BASE}/${sectionId}/${reportId}`;
}

export function findReport(sectionId, reportId) {
  const section = REPORTS_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return null;
  const item = section.items.find((i) => i.id === reportId);
  if (!item) return null;
  return { section, item };
}

export function getDefaultReportPath() {
  const first = REPORTS_SECTIONS[0]?.items[0];
  if (!first) return REPORTS_BASE;
  return reportAppPath(REPORTS_SECTIONS[0].id, first.id);
}

export function listAllReports() {
  return REPORTS_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      sectionId: section.id,
      sectionLabel: section.label,
      reportId: item.id,
      label: item.label,
      href: reportAppPath(section.id, item.id),
    })),
  );
}
