/** Sample analytics for Commercial Performance redesign visuals.
 *  Clearly demo-only — not from live dashboard APIs.
 *  Numbers aligned with php/SOC_Business_Dashboard_Redesign (1).html
 */

export const DEMO_BADGE = 'Sample data';

export const VC_SPARK = [
  { label: 'Fixed', count: '34', valueLabel: '18.6 mil', marginPct: 22, tone: 'sparkCardNavy', series: [6, 9, 14, 20, 25, 29, 32, 34], color: '#274670' },
  { label: 'In Progress', count: '12', valueLabel: '6.9 mil', marginPct: 18, tone: 'sparkCardOrange', series: [2, 3, 5, 6, 8, 9, 11, 12], color: '#F4652C' },
  { label: 'Completed', count: '61', valueLabel: '31.2 mil', marginPct: 26, tone: 'sparkCardTeal', series: [10, 16, 24, 33, 42, 50, 57, 61], color: '#22B8CF' },
];

export const TC_SPARK = [
  { label: 'Fixed', count: '9', valueLabel: '4.2 mil', marginPct: 19, tone: 'sparkCardNavy', series: [1, 2, 3, 5, 6, 7, 8, 9], color: '#274670' },
  { label: 'In Progress', count: '4', valueLabel: '1.8 mil', marginPct: 15, tone: 'sparkCardOrange', series: [0, 1, 1, 2, 2, 3, 3, 4], color: '#F4652C' },
  { label: 'Completed', count: '15', valueLabel: '7.6 mil', marginPct: 24, tone: 'sparkCardTeal', series: [2, 4, 6, 8, 10, 12, 14, 15], color: '#22B8CF' },
];

export const ALL_KPI = [
  { label: 'Fixed', count: '44', valueLabel: '24.9 mil', marginPct: 21, tone: 'kpiFixed' },
  { label: 'In Progress', count: '19', valueLabel: '22.0 mil', marginPct: 18, tone: 'kpiProgress' },
  { label: 'Completed', count: '76', valueLabel: '38.8 mil', marginPct: 24, tone: 'kpiCompleted' },
];

export const DESK_OFFICE_VC = [
  { n: 'Singapore', v: 23 },
  { n: 'Dubai', v: 7 },
  { n: 'India', v: 9 },
];

export const DESK_OFFICE_TC = [
  { n: 'Singapore', v: 11 },
  { n: 'Dubai', v: 3 },
  { n: 'India', v: 2 },
];

export const VESSEL_TYPE_VC = [
  { n: 'MR', v: 16 },
  { n: 'LR2', v: 14 },
  { n: 'Aframax', v: 9 },
];

export const VESSEL_TYPE_TC = [
  { n: 'Suezmax', v: 7 },
  { n: 'Aframax', v: 6 },
  { n: 'MR', v: 3 },
];

export const VC_VESSEL_SHADES = ['#F4652C', '#C74A1C', '#8B5E3C'];
export const TC_VESSEL_SHADES = ['#0B5E66', '#14919B', '#22B8CF'];
export const OFFICE_SHADES = ['#3B82F6', '#1D6FA5', '#9CC7F5'];
export const PURPLE_SHADES = ['#3E2680', '#6C47FF', '#8A6BFF', '#A98DFF', '#C9B8FF'];
export const OWNER_SHADES = ['#16283F', '#274670', '#3E6094', '#6E93BE', '#A9C3E0'];
export const CHARTERER_SHADES = ['#F4652C', '#E0551F', '#C74A1C', '#A63D1B', '#8B5E3C'];

export const CARGO_OFFICE = [
  { n: 'Singapore', v: 210 },
  { n: 'Dubai', v: 165 },
  { n: 'India', v: 107 },
];

export const CARGO_BREAKDOWN = [
  { n: 'Petroleum Products', v: 220 },
  { n: 'Chemical Products', v: 95 },
  { n: 'Veg Oil', v: 110 },
  { n: 'Crude', v: 57 },
];

export const CARGO_CATEGORY_COLORS = ['#F4652C', '#FBB988', '#C74A1C', '#8B5E3C'];

export const QUARTER_TRADES = [
  { n: 'Q1', v: 18 },
  { n: 'Q2', v: 22 },
  { n: 'Q3', v: 15 },
  { n: 'Q4', v: 9 },
];

export const OWNERS_OPERATOR = [
  { n: 'Aegean Tankers Inc.', v: 2.1 },
  { n: 'Farstad Marine Holdings', v: 1.8 },
  { n: 'Anchor Maritime Holdings', v: 1.4 },
  { n: 'Kalymnos Shipping Co.', v: 1.1 },
  { n: 'Meridian Tanker Owners Ltd', v: 0.9 },
];

export const CHARTERERS = [
  { n: 'Zafira Shipping & Trading', v: 2.4 },
  { n: 'Nordic Tankers AS', v: 1.9 },
  { n: 'Anchor Energy LLC', v: 1.5 },
  { n: 'Orient Bulk Pte Ltd', v: 1.2 },
  { n: 'Meridian Tanker Pool', v: 1.0 },
];

export const OWNERS_TC = [
  { n: 'Farstad Marine Holdings', v: 1.6 },
  { n: 'Meridian Tanker Owners Ltd', v: 1.2 },
  { n: 'Kalymnos Shipping Co.', v: 0.8 },
];

export const CHARTERERS_TC = [
  { n: 'Nordic Tankers AS', v: 3.1 },
  { n: 'Meridian Tanker Pool', v: 2.6 },
  { n: 'Anchor Energy LLC', v: 1.9 },
];

export const FLEET_MIX = { owned: 64, charteredIn: 36 };

export const AVG_HIRE_BY_TYPE = [
  { n: 'Suezmax', v: 26800, c: '#0B5E66' },
  { n: 'Aframax', v: 23450, c: '#14919B' },
  { n: 'MR', v: 18900, c: '#22B8CF' },
];

export const ZONES_VC = [
  { n: 'Singapore / SE Asia', v: 7, c: '#3E2680' },
  { n: 'Persian Gulf', v: 5, c: '#6C47FF' },
  { n: 'Mediterranean', v: 4, c: '#8A6BFF' },
  { n: 'West Africa', v: 3, c: '#A98DFF' },
  { n: 'US Gulf', v: 2, c: '#C9B8FF' },
];

export const ZONES_TC = [
  { n: 'Skaw Passage', v: 3, c: '#3E2680' },
  { n: 'Suez / Red Sea', v: 2, c: '#6C47FF' },
  { n: 'Gulf of Mexico', v: 2, c: '#8A6BFF' },
  { n: 'Shanghai / Ningbo', v: 1, c: '#A98DFF' },
];

export const PERFORMING_VC = [
  { vessel: 'POLYAIGOS', voy: '260003-1', cpDate: '29-05-2026', status: 'sea', statusLabel: 'At Sea', route: 'Singapore – Advario (Sing.)' },
  { vessel: 'POLYAIGOS', voy: '26006', cpDate: '15-04-2026', status: 'loading', statusLabel: 'Loading', route: 'Singapore – PTSC Bien Dong 1' },
  { vessel: 'POLYAIGOS', voy: '26004', cpDate: '25-03-2026', status: 'discharging', statusLabel: 'Discharging', route: 'Advario (Sing.) – Advario (Sing.)' },
  { vessel: 'SLF TRINITY', voy: 'TC-4471', cpDate: '15-04-2026', status: 'sea', statusLabel: 'At Sea', route: 'Rotterdam – Skaw Passage' },
  { vessel: 'POLYAIGOS', voy: '26003', cpDate: '11-02-2026', status: 'bunkering', statusLabel: 'Bunkering', route: 'Off Singapore-East OPL – Advario' },
  { vessel: 'ANTARES', voy: '26014', cpDate: '02-02-2026', status: 'sea', statusLabel: 'At Sea', route: 'Suez – Red Sea Transit' },
  { vessel: 'POLYAIGOS', voy: '26001-10', cpDate: '20-01-2026', status: 'discharging', statusLabel: 'Discharging', route: 'Kukup – Sri Racha' },
];

export const PERFORMING_TC = [
  { tcNo: '25002', vessel: 'POLYAIGOS', cpDate: '06-01-2026', status: 'sea', statusLabel: 'At Sea', route: '10-11-2025 – 31-12-2025' },
  { tcNo: 'TC-4471', vessel: 'SLF TRINITY', cpDate: '22-03-2026', status: 'loading', statusLabel: 'Loading', route: '01-04-2026 – 30-09-2026' },
  { tcNo: 'TC-4488', vessel: 'ANTARES', cpDate: '18-06-2026', status: 'sea', statusLabel: 'At Sea', route: '01-07-2027 – 30-06-2028' },
];

export const COA_PACE = [
  {
    id: 'COA-014-2026',
    no: '014',
    from: 'Singapore',
    to: 'Fujairah',
    charterer: 'Zafira Shipping & Trading',
    qtyLiftedPct: 66,
    timeElapsedPct: 61,
    lifted: '330,000 MT',
    balance: '170,000 MT',
    duration: 'Contract duration elapsed',
  },
  {
    id: 'COA-021-2026',
    no: '021',
    from: 'Ningbo',
    to: 'Shanghai',
    charterer: 'Orient Bulk Pte Ltd',
    qtyLiftedPct: 38,
    timeElapsedPct: 52,
    lifted: '114,000 MT',
    balance: '186,000 MT',
    duration: 'Contract duration elapsed',
  },
];

export const PERIOD_CARDS = [
  {
    id: 'PERIOD-001-2026',
    vessel: 'ANTARES',
    charterer: 'Zafira Shipping & Trading',
    pct: 0,
    performed: 0,
    total: 2251,
    status: 'upcoming',
    note: 'Commences 30-07-2026 — no elapsed days yet.',
  },
  {
    id: 'PERIOD-002-2025',
    vessel: 'SLF TRINITY',
    charterer: 'Nordic Tankers AS',
    pct: 58,
    performed: 210,
    total: 365,
    status: 'onhire',
    note: '155 days remaining on this 12-month period.',
  },
];

export const PIPELINE = [
  { vessel: 'GISELE', days: 18 },
  { vessel: 'SLF TRINITY', days: 45 },
  { vessel: 'KALYMNOS DAWN', days: 75 },
];

export const PERIOD_RECORDS = [
  {
    id: 'PERIOD-002-2025',
    vessel: 'SLF TRINITY',
    charterer: 'Nordic Tankers AS',
    onHireDays: 199,
    onHireEarned: '4.67 mil',
    offHireDays: 11,
    offHireForegone: '0.26 mil',
    reasons: [
      { n: "Charterer's Fault", v: 2, c: '#B8791A' },
      { n: 'Breakdown (Owner)', v: 3, c: '#C22A20' },
      { n: 'Dry-Docking (Scheduled)', v: 6, c: '#8B5E3C' },
    ],
    totalDays: 210,
    dailyRate: 23450,
    receivedDays: 195,
    overdueDays: 15,
    receivedValue: '4.57 mil',
    overdueValue: '0.35 mil',
  },
  {
    id: 'PERIOD-003-2025',
    vessel: 'GISELE',
    charterer: 'Straits Ocean Traders',
    onHireDays: 82,
    onHireEarned: '1.49 mil',
    offHireDays: 3,
    offHireForegone: '0.05 mil',
    reasons: [
      { n: 'Breakdown (Owner)', v: 2, c: '#C22A20' },
      { n: 'Weather / Force Majeure', v: 1, c: '#3B82F6' },
    ],
    totalDays: 85,
    dailyRate: 18200,
    receivedDays: 79,
    overdueDays: 6,
    receivedValue: '1.44 mil',
    overdueValue: '0.11 mil',
  },
];

export const MARK_TO_MARKET = {
  vessel: 'SLF TRINITY',
  contract: 'PERIOD-002-2025',
  charterer: 'Nordic Tankers AS',
  locked: 23450,
  market: 21800,
  favorable: true,
  deltaPct: 7.6,
};

export const TYPE_MIX = [
  { n: 'Spot', v: 107, revenue: 38.1, c: '#F4652C' },
  { n: 'TC', v: 28, revenue: 9.4, c: '#14919B' },
  { n: 'COA', v: 2, revenue: 8.6, c: '#6C47FF' },
  { n: 'Periods', v: 2, revenue: 4.7, c: '#3B82F6' },
];

export const REVENUE_BY_TYPE = [
  { n: 'Spot', v: 38.1, c: '#F4652C' },
  { n: 'TC', v: 9.4, c: '#14919B' },
  { n: 'COA', v: 8.6, c: '#6C47FF' },
  { n: 'Periods', v: 4.7, c: '#3B82F6' },
];

export const REVENUE_DRILL = {
  Spot: [
    { n: 'Singapore', v: 22.5, c: '#F4652C' },
    { n: 'Dubai', v: 6.8, c: '#C74A1C' },
    { n: 'India', v: 8.8, c: '#8B5E3C' },
  ],
  TC: [
    { n: 'Singapore', v: 6.5, c: '#0B5E66' },
    { n: 'Dubai', v: 1.7, c: '#14919B' },
    { n: 'India', v: 1.2, c: '#22B8CF' },
  ],
  COA: [
    { n: 'COA-014-2026', v: 5.5, c: '#6C47FF' },
    { n: 'COA-021-2026', v: 3.1, c: '#8A6BFF' },
  ],
  Periods: [
    { n: 'SLF TRINITY (PERIOD-002-2025)', v: 4.7, c: '#3B82F6' },
    { n: 'ANTARES (PERIOD-001-2026)', v: 0, c: '#9CC7F5' },
  ],
};

export const RECEIVABLE_VS_INVOICED = [
  { n: 'Receivable', v: 14.6, c: '#22B8CF' },
  { n: 'Invoiced', v: 3.2, c: '#0B5E66' },
];

export const REVENUE_QUARTERLY = [
  { n: 'Q1', v: 11.4 },
  { n: 'Q2', v: 15.4 },
];

export const ATTENTION_ITEMS = [
  { title: 'COA-021-2026 — nomination due', meta: 'Shipment 5 of 10 · Orient Bulk Pte Ltd', chip: 'Nomination Due', type: 'COA', color: '#6C47FF', sev: 'soon' },
  { title: 'GISELE — redelivery window opens in 18 days', meta: 'PERIOD-003-2025 · confirm next fixture or extension', chip: 'Urgent', type: 'Periods', color: '#3B82F6', sev: 'urgent' },
  { title: 'SLF TRINITY — 15 days hire overdue', meta: 'PERIOD-002-2025 · $351,750 outstanding', chip: 'Overdue', type: 'Periods', color: '#3B82F6', sev: 'urgent' },
  { title: 'Spot Business — unsettled freight & demurrage', meta: '6 invoices awaiting settlement', chip: 'Review', type: 'Spot', color: '#F4652C', sev: 'review' },
];
