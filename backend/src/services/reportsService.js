import { isDbConfigured, isMgmtUser } from '../config.js';
import { parsePeriodDate } from './estimateListMappers.js';
import {
  dbApprovalStatusReport,
  dbCharteringRegisterReport,
  dbCharteringRegisterTcReport,
  dbDaTrackerChartering,
  dbReportFilterOptions,
  dbSpotFixturesReport,
  dbTcEarningReport,
  dbVesselOpenPositionReport,
  dbVesselTcPerfAgainstBaltic,
  dbVoyageReportFleet,
} from './reportsDb.js';
import {
  dbCargoTonnageReport,
  dbComparisonReport,
  dbComparisonSheets,
  dbPlAtAGlanceTc,
  dbPlAtAGlanceVc,
  dbPlAtAGlanceVcTc,
} from './reportsManagementDb.js';
import {
  dbAgentListReport,
  dbBunkerConsumptionReport,
  dbDailyPositionReport,
  dbDeadFreightSummary,
  dbDemurrageSummary,
  dbDetailedRegisterReport,
  dbHeadwiseExpenseReport,
  dbHireExpenseDetailsVc,
  dbOpsFilterExtras,
  dbOpsTrackerReport,
  dbPortPerformanceReport,
  dbUpdateOpsTrackerField,
  dbVoyageDetailsReport,
  TRACKER_CONFIG,
} from './reportsOperationsDb.js';
import {
  dbAccountsFilterExtras,
  dbAgingPayableReport,
  dbAgingReceivablesReport,
  dbPayableReceivablesReport,
  dbPaymentActionedReport,
  dbProfitabilityReport,
  dbProjectedCashFlowReport,
  dbShipmentRegisterReport,
} from './reportsAccountsDb.js';
import { dbVesselYearlyPerformance } from './reportsGraphicalDb.js';

const MOCK_META = {
  businessTypes: [
    { id: '', name: 'All' },
    { id: '3', name: 'Dry' },
    { id: '2', name: 'Tankers' },
    { id: '1', name: 'Gas' },
  ],
  years: [
    { id: String(new Date().getFullYear()), name: String(new Date().getFullYear()) },
    { id: String(new Date().getFullYear() - 1), name: String(new Date().getFullYear() - 1) },
  ],
  teams: [
    { id: '', name: 'All' },
    { id: '7', name: 'Zafira' },
  ],
  ports: [
    { id: '10', name: 'Singapore' },
    { id: '20', name: 'Mundra' },
  ],
  vendors: [
    { id: 'V001', name: 'Port Agent Co' },
    { id: 'V002', name: 'Demo Vendor' },
  ],
  vessels: [],
  daySelections: [
    { id: '1', name: 'All' },
    { id: '2', name: '0 - 30 Days' },
    { id: '3', name: '30 - 60 Days' },
    { id: '4', name: '60 - 90 Days' },
    { id: '5', name: '> 90 Days' },
  ],
  spotCoaTcOptions: [
    { id: '1', name: 'Spot' },
    { id: '2', name: 'COA' },
    { id: '3', name: 'TC' },
  ],
  amountTypes: [
    { id: '1', name: 'ETA' },
    { id: '2', name: 'ETC/D' },
  ],
  shipmentDateTypes: [
    { id: '1', name: 'BL Date' },
    { id: '2', name: 'Financial Year (CP Date)' },
  ],
  costTypes: [
    { id: 'Load Port Costs', name: 'Load Port Costs' },
    { id: 'Discharge Port Costs', name: 'Discharge Port Costs' },
    { id: 'Transit Port Costs', name: 'Transit Port Costs' },
  ],
  isMgmtUser: isMgmtUser(),
};

function emptyResult() {
  return { records: [], recordsTotal: 0, isMgmtUser: isMgmtUser() };
}

function requireDates(filters, message = 'Please select Date From and Date To.') {
  if (!filters.dateFrom || !filters.dateTo) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
  if (!parsePeriodDate(filters.dateFrom) || !parsePeriodDate(filters.dateTo)) {
    const error = new Error('Invalid date format. Use DD-MM-YYYY.');
    error.status = 400;
    throw error;
  }
}

function requireYear(filters) {
  if (!filters.selYear) {
    const error = new Error('Please select Year.');
    error.status = 400;
    throw error;
  }
}

const HANDLERS = {
  'spot-fixtures-report': async (filters) => {
    requireDates(filters);
    return dbSpotFixturesReport(filters);
  },
  'chartering-register-coa-spot': async (filters) => {
    requireDates(filters);
    return dbCharteringRegisterReport(filters, { detailed: false });
  },
  'chartering-register-detailed-coa-spot': async (filters) => {
    requireDates(filters);
    return dbCharteringRegisterReport(filters, { detailed: true });
  },
  'chartering-register-tcs': async (filters) => {
    requireDates(filters);
    return dbCharteringRegisterTcReport(filters);
  },
  'vessel-open-position-report': (filters) => dbVesselOpenPositionReport(filters),
  'tc-earning-report': async (filters) => {
    requireDates(filters);
    return dbTcEarningReport(filters);
  },
  'vessel-tc-perf-against-baltic': () => dbVesselTcPerfAgainstBaltic(),
  'da-tracker-chartering': async (filters) => {
    requireYear(filters);
    return dbDaTrackerChartering(filters);
  },
  'approval-status-report': () => dbApprovalStatusReport(),
  'voyage-report-fleet': async (filters) => {
    if (!filters.vesselImoNo) {
      const error = new Error('Provide Vessel IMO.');
      error.status = 400;
      throw error;
    }
    return dbVoyageReportFleet(filters);
  },
  'comparison-report': async (filters) => {
    requireYear(filters);
    return dbComparisonReport(filters);
  },
  'pl-at-a-glance-vc': async (filters) => {
    requireYear(filters);
    return dbPlAtAGlanceVc(filters);
  },
  'pl-at-a-glance-tc': async (filters) => {
    requireYear(filters);
    return dbPlAtAGlanceTc(filters, { includeInitial: true });
  },
  'pl-at-a-glance-vc-tc': async (filters) => {
    requireYear(filters);
    return dbPlAtAGlanceVcTc(filters);
  },
  'cargo-tonnage-report': async (filters) => {
    requireDates(filters);
    return dbCargoTonnageReport(filters);
  },
  'voyage-details': async (filters) => {
    requireDates(filters);
    return dbVoyageDetailsReport(filters);
  },
  'agent-list': (filters) => dbAgentListReport(filters),
  'bunker-consumption-report': async (filters) => {
    requireDates(filters);
    return dbBunkerConsumptionReport(filters);
  },
  'daily-position-report': (filters) => dbDailyPositionReport(filters),
  'dead-freight-summary': async (filters) => {
    requireDates(filters);
    return dbDeadFreightSummary(filters);
  },
  'demurrage-summary': async (filters) => {
    requireDates(filters);
    return dbDemurrageSummary(filters);
  },
  'headwise-expense-report': async (filters) => {
    requireDates(filters);
    return dbHeadwiseExpenseReport(filters);
  },
  'port-performance-report': (filters) => dbPortPerformanceReport(filters),
  'detailed-register': async (filters) => {
    requireYear(filters);
    return dbDetailedRegisterReport(filters);
  },
  'hire-expense-details-vc': async (filters) => {
    requireDates(filters);
    return dbHireExpenseDetailsVc(filters);
  },
  'aging-report-payable': (filters) => dbAgingPayableReport(filters),
  'aging-report-receivables': (filters) => dbAgingReceivablesReport(filters),
  'payable-receivables-report': (filters) => dbPayableReceivablesReport(filters),
  'profitability-analysis-coa-spot': async (filters) => {
    requireDates(filters);
    return dbProfitabilityReport(filters);
  },
  'projected-cash-flow-vc': async (filters) => {
    requireDates(filters);
    return dbProjectedCashFlowReport(filters);
  },
  'shipment-register': async (filters) => {
    requireDates(filters);
    return dbShipmentRegisterReport(filters);
  },
  'payment-actioned-report': async (filters) => {
    requireDates(filters);
    return dbPaymentActionedReport(filters);
  },
  'vessel-yearly-performance': (filters) => dbVesselYearlyPerformance(filters),
};

Object.keys(TRACKER_CONFIG).forEach((reportId) => {
  HANDLERS[reportId] = async (filters) => {
    requireYear(filters);
    return dbOpsTrackerReport(reportId, filters);
  };
});

const MOCK_HANDLERS = {
  'spot-fixtures-report': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        nomId: '26-001',
        vesselName: 'ATLANTIC STAR',
        cpDate: '15-01-2026',
        owner: 'Demo Co',
        broker: 'Demo Broker',
        vesselType: 'Supramax',
        contractQty: '50000',
        loadPort: 'Singapore',
        dischargePort: 'Mundra',
        freight: '250000.00',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'chartering-register-coa-spot': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        nomId: '26-001',
        voyage: 'V-2401/Demo',
        vesselName: 'ATLANTIC STAR',
        cpic: 'Charterer User',
        opsPic: 'Ops User',
        dwt: '58000',
        cargoName: 'Coal',
        cpDate: '15-01-2026',
        ownerName: 'Demo Co',
        charterer: 'Steel Corp',
        fixtureDate: '15-01-2026',
        revenue: '250000',
        initialPl: '12000',
        finalPl: '15000',
        remarks: '',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'chartering-register-detailed-coa-spot': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        nomId: '26-001',
        vesselName: 'ATLANTIC STAR',
        cpic: 'Charterer User',
        opsPic: 'Ops User',
        dwt: '58000',
        cpDate: '15-01-2026',
        ownerName: 'Demo Co',
        charterer: 'Steel Corp',
        fixtureDate: '15-01-2026',
        voyageNo: 'V-2401',
        initialPl: '12000',
        finalPl: '15000',
        revenue: '250000',
        remarks: '',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'chartering-register-tcs': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        nomId: 'TC-001',
        tcNo: 'TC-26-01',
        vesselName: 'PACIFIC WIND',
        dwt: '45000',
        cpDate: '10-01-2026',
        charterer: 'Agri Traders',
        ports: 'Rotterdam / Lagos',
        dates: '01-02-2026 / 15-03-2026',
        totalRev: '400000.00',
        otherExp: '50000.00',
        tcInHire: '200000.00',
        totalExp: '250000.00',
        tcEarnings: '150000.00',
        profitPerDay: '3500.00',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'vessel-open-position-report': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        vesselName: 'ATLANTIC STAR',
        vesselType: 'Supramax',
        lastBusiness: 'Voyage',
        lastPort: 'Mundra',
        dateOpen: '20-01-2026',
        lastCargo: 'Coal',
        lastCargoSize: '50000 MT',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'tc-earning-report': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        cpDate: '15-01-2026',
        voyageNo: 'V-2401',
        vesselName: 'ATLANTIC STAR',
        tcDays: 30,
        pl: '45000',
        hirePerDay: '12000',
        tcEarning: '13500.00',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'vessel-tc-perf-against-baltic': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        tcNo: 'TC-26-01',
        cpDate: '10-01-2026',
        vesselName: 'PACIFIC WIND',
        charterer: 'Agri Traders',
        owner: 'Demo Co',
        delDate: '01-02-2026',
        reDelDate: '15-03-2026',
        delPort: 'Rotterdam',
        reDelPort: 'Lagos',
        dailyHire: '12000.00',
        balticRoute: 'P3A_03 - USG/Far East',
        balticDate: '09-01-2026',
        balticValue: '14500',
        tceDiff: '2500.00',
        tceDiffPct: '17.24',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'da-tracker-chartering': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        fixtureNo: '26-001',
        vesselName: 'ATLANTIC STAR',
        cpDate: '15-01-2026',
        chtgPic: 'Charterer User',
        opcPic: 'Ops User',
        cargoType: 'Coal',
        portName: 'Singapore',
        costType: 'Agency',
        portCostVendor: 'Port Agent Co',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'approval-status-report': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        formName: 'Freight Invoice',
        invoiceNo: 'FI-001',
        voyageNo: 'V-2401',
        vendorName: 'Owner Co',
        status: 'Level 1 Approval Pending',
        pendingWith: '',
        editLink: '',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'voyage-report-fleet': () => ({
    records: [
      {
        id: 1,
        index: 1,
        reportTitle: 'Noon Report',
        vesselType: 'Supramax',
        messageNo: 'NR-001',
        vesselName: 'ATLANTIC STAR',
        voyageNo: 'V-2401',
        charterer: 'Steel Corp',
        reportingLt: '15-01-2026 12:00',
        reportingUtc: '15-01-2026 06:30',
        depPort: 'Singapore',
        portOfArrival: '',
        nextPort: 'Mundra',
        etaNextPort: '20-01-2026 08:00',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'comparison-report': () => ({
    records: [
      {
        id: 1001,
        comId: 1001,
        srNo: 1,
        cpDate: '15-01-2026',
        voyageNo: 'V-2401',
        vesselName: 'ATLANTIC STAR',
        cargoQty: 50000,
        tcEarning: '12000',
        pl: '15000',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'pl-at-a-glance-vc': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        voyageNo: 'V-2401',
        vesselName: 'ATLANTIC STAR',
        charterer: 'Steel Corp',
        team1: 'Zafira',
        team2: '',
        pic1: 'Ops User',
        pic2: '',
        pic3: '',
        year: '2026',
        initialPl: '12000',
        finalPl: '15000',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'pl-at-a-glance-tc': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        voyageNo: 'TC-26-01',
        vesselName: 'PACIFIC WIND',
        charterer: 'Agri Traders',
        team: 'Zafira',
        pic1: 'Charterer User',
        pic2: 'Ops User',
        ownerName: 'Demo Co',
        tcEarningsInitial: '140000.00',
        tcEarnings: '150000.00',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'pl-at-a-glance-vc-tc': () => ({
    recordsVc: [
      {
        id: 1,
        srNo: 1,
        voyageNo: 'V-2401',
        vesselName: 'ATLANTIC STAR',
        charterer: 'Steel Corp',
        team1: 'Zafira',
        team2: '',
        pic1: 'Ops User',
        pic2: '',
        pic3: '',
        year: '2026',
        initialPl: '12000',
        finalPl: '15000',
      },
    ],
    recordsTc: [
      {
        id: 2,
        srNo: 1,
        voyageNo: 'TC-26-01',
        vesselName: 'PACIFIC WIND',
        charterer: 'Agri Traders',
        team: 'Zafira',
        pic1: 'Charterer User',
        pic2: 'Ops User',
        ownerName: 'Demo Co',
        tcEarnings: '150000.00',
      },
    ],
    recordsTotal: 2,
    isMgmtUser: isMgmtUser(),
  }),
  'cargo-tonnage-report': () => ({
    records: [
      { id: 1, srNo: 1, cargoName: 'Coal', cargoQty: '125000.00', cargoQtyK: '125.00' },
      { id: 2, srNo: 2, cargoName: 'Grain', cargoQty: '80000.00', cargoQtyK: '80.00' },
    ],
    chart: [
      { label: 'Coal', value: 125 },
      { label: 'Grain', value: 80 },
    ],
    recordsTotal: 2,
    isMgmtUser: isMgmtUser(),
  }),
  'aging-report-payable': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        vendor: 'Port Agent Co',
        coaSpot: 'Spot',
        nomId: '26-001/V-2401',
        vesselName: 'ATLANTIC STAR',
        cpDate: '15-01-2026',
        costType: 'Agency',
        paymentNo: 'PR-001',
        invoiceDate: '20-01-2026',
        paymentDate: '',
        amountInvoiced: '5000.00',
        amountPaid: '0.00',
        difference: '5000.00',
        delayDays: 15,
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'aging-report-receivables': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        client: 'Steel Corp',
        spotCoaTc: 'Spot',
        nomId: '26-001/V-2401',
        vesselName: 'ATLANTIC STAR',
        cpDate: '15-01-2026',
        invoiceType: 'Freight',
        invoiceNo: 'FI-001',
        invoiceDate: '18-01-2026',
        amountInvoiced: '250000.00',
        amountReceived: '100000.00',
        difference: '150000.00',
        delayDays: 20,
        openClosed: 'Open',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'payable-receivables-report': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        client: 'Steel Corp',
        spotCoaTc: 'Spot',
        nomId: '26-001/V-2401',
        vesselName: 'ATLANTIC STAR',
        amountInvoiced: '250000.00',
        amountReceived: '100000.00',
        recvDifference: '150000.00',
        paymentAdvice: '5000.00',
        amountPaid: '2000.00',
        payDifference: '3000.00',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'profitability-analysis-coa-spot': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        nomId: '26-001',
        vesselName: 'ATLANTIC STAR',
        coaSpotVoyage: 'Spot/V-2401',
        cpDate: '15-01-2026',
        status: 'In Ops',
        totalQty: 50000,
        earnings: '250000.00',
        expense: '80000.00',
        netEarnings: '15000.00',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'projected-cash-flow-vc': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        nomId: '26-001',
        materialName: 'Coal',
        vesselName: 'ATLANTIC STAR',
        totalOutstanding: '150000.00',
        payments: '50000.00',
        balanceOutstanding: '100000.00',
        lpDate: '18-01-2026',
        dueDate: '28-01-2026',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'shipment-register': () => ({
    records: [
      {
        id: 1,
        nomId: '26-001',
        vesselName: 'ATLANTIC STAR',
        cpDate: '15-01-2026',
        owner: 'Demo Co',
        broker: 'Demo Broker',
        materialDesc: 'Coal',
        lastUpdatedFreight: '250000.00',
        fromPort: 'Singapore',
        toPort: 'Mundra',
        blDate: '25-01-2026',
        qty: 50000,
        operationalExpenses: '',
        portExpenses: '25000.00',
        bunkerExpenses: '55000.00',
        voyageEarnings: '250000.00',
        dailyEarnings: '12000',
        voyageEarningsDem: '250000.00',
        nettDailyProfit: '12000',
        pl: '15000',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'payment-actioned-report': () => ({
    records: [
      {
        id: 1,
        srNo: 1,
        voyageNo: 'V-2401',
        vesselName: 'ATLANTIC STAR',
        vendorName: 'Port Agent Co',
        paymentType: 'Agency',
        paymentDate: '22-01-2026',
        amount: '5000.00',
      },
    ],
    recordsTotal: 1,
    isMgmtUser: isMgmtUser(),
  }),
  'vessel-yearly-performance': () => ({
    records: [
      {
        id: '2024',
        srNo: 1,
        year: '2024',
        Handymax: 2,
        Kamsarmax: 1,
        Panamax: 0,
        Supramax: 4,
        Ultramax: 1,
        Handysize: 0,
        Capesize: 0,
        Chemical_Oil: 0,
        Oil: 0,
        SDBC: 0,
        total: 8,
      },
      {
        id: '2025',
        srNo: 2,
        year: '2025',
        Handymax: 1,
        Kamsarmax: 2,
        Panamax: 1,
        Supramax: 5,
        Ultramax: 2,
        Handysize: 1,
        Capesize: 0,
        Chemical_Oil: 1,
        Oil: 0,
        SDBC: 0,
        total: 13,
      },
      {
        id: '2026',
        srNo: 3,
        year: '2026 (to date)',
        Handymax: 1,
        Kamsarmax: 0,
        Panamax: 0,
        Supramax: 3,
        Ultramax: 1,
        Handysize: 0,
        Capesize: 0,
        Chemical_Oil: 0,
        Oil: 0,
        SDBC: 0,
        total: 5,
      },
    ],
    chart: [
      {
        year: '2024',
        Handymax: 2,
        Kamsarmax: 1,
        Panamax: 0,
        Supramax: 4,
        Ultramax: 1,
        Handysize: 0,
        Capesize: 0,
        Chemical_Oil: 0,
        Oil: 0,
        SDBC: 0,
        Total: 8,
        toDate: false,
      },
      {
        year: '2025',
        Handymax: 1,
        Kamsarmax: 2,
        Panamax: 1,
        Supramax: 5,
        Ultramax: 2,
        Handysize: 1,
        Capesize: 0,
        Chemical_Oil: 1,
        Oil: 0,
        SDBC: 0,
        Total: 13,
        toDate: false,
      },
      {
        year: '2026',
        Handymax: 1,
        Kamsarmax: 0,
        Panamax: 0,
        Supramax: 3,
        Ultramax: 1,
        Handysize: 0,
        Capesize: 0,
        Chemical_Oil: 0,
        Oil: 0,
        SDBC: 0,
        Total: 5,
        toDate: true,
      },
    ],
    series: [
      { key: 'Handymax', label: 'Handymax' },
      { key: 'Kamsarmax', label: 'Kamsarmax' },
      { key: 'Panamax', label: 'Panamax' },
      { key: 'Supramax', label: 'Supramax' },
      { key: 'Ultramax', label: 'Ultramax' },
      { key: 'Handysize', label: 'Handysize' },
      { key: 'Chemical_Oil', label: 'Chemical/Oil' },
    ],
    recordsTotal: 3,
    isMgmtUser: isMgmtUser(),
  }),
};

export async function getReportFilterOptions() {
  if (!isDbConfigured()) return MOCK_META;
  const base = await dbReportFilterOptions();
  const opsExtras = await dbOpsFilterExtras();
  const accountsExtras = await dbAccountsFilterExtras();
  return { ...base, ...opsExtras, ...accountsExtras };
}

export async function getReport(reportId, filters = {}) {
  const id = String(reportId || '').trim();
  if (!HANDLERS[id]) {
    const error = new Error(`Unknown report: ${id}`);
    error.status = 404;
    throw error;
  }

  if (!isDbConfigured()) {
    const mock = MOCK_HANDLERS[id];
    return mock ? mock(filters) : emptyResult();
  }

  return HANDLERS[id](filters);
}

export async function getComparisonSheets(comId) {
  if (!isDbConfigured()) {
    return {
      comId,
      particulars: {
        vesselName: 'ATLANTIC STAR',
        vesselType: 'Supramax',
        flag: 'MH',
        fixtureDate: '15-01-2026',
        voyageNo: 'V-2401',
        voyageName: 'Demo Voyage',
        dwtSummer: '58000',
        dwtTropical: '59500',
      },
      sheetColumns: [
        { fcaId: 1, label: 'Estimate', index: 0 },
        { fcaId: 2, label: 'Final CS', index: 1 },
      ],
      rows: [
        { parameter: 'Revenue (Freight)', values: ['240000', '250000'], difference: '10000.00' },
        { parameter: 'Actual P & L', values: ['12000', '15000'], difference: '3000.00' },
      ],
      isMgmtUser: isMgmtUser(),
    };
  }
  return dbComparisonSheets(comId);
}

export async function updateOpsTrackerField(reportId, payload) {
  if (!isDbConfigured()) {
    return { ok: true, ...payload };
  }
  return dbUpdateOpsTrackerField(reportId, payload);
}

export function listKnownReportIds() {
  return Object.keys(HANDLERS);
}
