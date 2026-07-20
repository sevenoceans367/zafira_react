import { isDbConfigured } from '../config.js';
import {
  dbDeactivateOpsVcEntry,
  dbListHistoryAtGlance,
  dbListInOpsAtGlance,
  dbListOpsVcOperators,
  dbListOpsVcYears,
  dbListPostOpsAtGlance,
  dbListVoyageReports,
  dbListYearUpdation,
  dbMoveOpsVcToHistory,
  dbMoveOpsVcToPostOps,
  dbUpdateOpsVcOperator,
  dbUpdateYearAddOnDate,
} from './opsVcDb.js';

const MOCK_YEARS = [
  { id: '2026', name: '2026' },
  { id: '2025', name: '2025' },
];

const MOCK_OPERATORS = [
  { id: '1', name: 'Ops User' },
  { id: '2', name: 'Support' },
];

let mockRows = [
  {
    index: 1,
    comId: 1001,
    fcaId: 2001,
    message: '26-001',
    voyageNo: 'V-2401',
    businessType: 'Dry Cargo',
    materialName: 'Coal',
    vesselName: 'ATLANTIC STAR',
    vesselType: 'Supramax',
    vesselImoNo: '9123456',
    isPeriod: false,
    ports: 'LP - Singapore\nDP - Mundra',
    charterer: 'Steel Corp',
    cpDate: '15-01-2026',
    ownBusiness: 'Dry Cargo',
    costSheets: [{ id: 11, name: 'Initial CS' }],
    operatorId: '1',
    operatorName: 'Ops User',
    charteringTeam: 'Zafira',
    lastUpdatedBy: 'Ops User',
    lastUpdatedAt: '15-01-2026 10:30',
    paymentNotReceived: false,
    paymentNotPaid: false,
    canDeactivate: true,
    canMoveToPostOps: true,
    canMoveToHistory: false,
    canEditOperator: true,
    pageContext: 1,
  },
];

let mockPostOpsRows = [
  {
    index: 1,
    comId: 1002,
    fcaId: 2002,
    message: '26-002',
    voyageNo: 'V-2402',
    businessType: 'Dry Cargo',
    materialName: 'Grain',
    vesselName: 'PACIFIC WIND',
    vesselType: 'Handysize',
    vesselImoNo: '9234567',
    isPeriod: false,
    ports: 'LP - Rotterdam\nDP - Lagos',
    charterer: 'Agri Traders',
    cpDate: '10-01-2026',
    ownBusiness: 'Dry Cargo',
    costSheets: [{ id: 21, name: 'Final CS' }],
    operatorId: '1',
    operatorName: 'Ops User',
    charteringTeam: 'Zafira',
    lastUpdatedBy: 'Ops User',
    lastUpdatedAt: '12-01-2026 09:15',
    paymentNotReceived: false,
    paymentNotPaid: false,
    canDeactivate: true,
    canMoveToPostOps: false,
    canMoveToHistory: true,
    canEditOperator: true,
    pageContext: 2,
  },
];

let mockHistoryRows = [
  {
    index: 1,
    comId: 1003,
    fcaId: 2003,
    message: '25-010',
    voyageNo: 'V-2310',
    businessType: 'Dry Cargo',
    materialName: 'Ore',
    vesselName: 'NORTHERN LIGHT',
    vesselType: 'Capesize',
    vesselImoNo: '9345678',
    isPeriod: false,
    ports: 'LP - Tubarao\nDP - Qingdao',
    charterer: 'Steel Mill',
    cpDate: '05-11-2025',
    ownBusiness: 'Dry Cargo',
    costSheets: [{ id: 31, name: 'Closed CS' }],
    operatorId: '2',
    operatorName: 'Support',
    charteringTeam: 'Zafira',
    lastUpdatedBy: 'Support',
    lastUpdatedAt: '20-12-2025 14:00',
    paymentNotReceived: false,
    paymentNotPaid: false,
    status: 4,
    statusLabel: 'History',
    canDeactivate: false,
    canMoveToPostOps: false,
    canMoveToHistory: false,
    canEditOperator: false,
    pageContext: 3,
  },
];

function filterMockRows(rows, params = {}) {
  const year = String(params.selYear || '2026');
  const search = String(params.search || '').toLowerCase();
  const requireYear = params.requireYear !== false;
  let filtered = requireYear
    ? (String(year) === '2026' ? [...rows] : [])
    : [...rows];
  if (search) {
    filtered = filtered.filter((row) => [
      row.message,
      row.voyageNo,
      row.vesselName,
      row.operatorName,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  return {
    records: filtered,
    recordsTotal: filtered.length,
    page: 1,
    pageSize: filtered.length || 50,
    selBType: String(params.selBType || '3'),
    selYear: requireYear ? year : '',
    canEditOperator: params.canEditOperator !== false,
  };
}

export async function listOpsVcYears() {
  if (isDbConfigured()) return dbListOpsVcYears();
  return MOCK_YEARS;
}

export async function listOpsVcOperators() {
  if (isDbConfigured()) return dbListOpsVcOperators();
  return MOCK_OPERATORS;
}

export async function listInOpsAtGlance(params = {}) {
  if (isDbConfigured()) return dbListInOpsAtGlance(params);
  return filterMockRows(mockRows, params);
}

export async function listPostOpsAtGlance(params = {}) {
  if (isDbConfigured()) return dbListPostOpsAtGlance(params);
  return filterMockRows(mockPostOpsRows, params);
}

export async function listHistoryAtGlance(params = {}) {
  if (isDbConfigured()) return dbListHistoryAtGlance(params);
  return filterMockRows(mockHistoryRows, { ...params, requireYear: false, canEditOperator: false });
}

export async function updateOpsVcOperator(comId, operatorId) {
  if (isDbConfigured()) return dbUpdateOpsVcOperator(comId, operatorId);
  const row = mockRows.find((item) => String(item.comId) === String(comId));
  if (!row) {
    const error = new Error('Ops voyage not found.');
    error.status = 404;
    throw error;
  }
  const operator = MOCK_OPERATORS.find((item) => String(item.id) === String(operatorId));
  row.operatorId = String(operatorId || '');
  row.operatorName = operator?.name || '';
  return { msg: 0 };
}

export async function moveOpsVcToPostOps(comId) {
  if (isDbConfigured()) return dbMoveOpsVcToPostOps(comId);
  const row = mockRows.find((item) => String(item.comId) === String(comId));
  const before = mockRows.length;
  mockRows = mockRows.filter((item) => String(item.comId) !== String(comId));
  if (mockRows.length === before) {
    const error = new Error('Ops voyage not found or already in Post Ops.');
    error.status = 404;
    throw error;
  }
  if (row) {
    mockPostOpsRows = [
      ...mockPostOpsRows,
      {
        ...row,
        canMoveToPostOps: false,
        canMoveToHistory: true,
        pageContext: 2,
      },
    ];
  }
  return { msg: 6 };
}

export async function moveOpsVcToHistory(comId) {
  if (isDbConfigured()) return dbMoveOpsVcToHistory(comId);
  const row = mockPostOpsRows.find((item) => String(item.comId) === String(comId));
  const before = mockPostOpsRows.length;
  mockPostOpsRows = mockPostOpsRows.filter((item) => String(item.comId) !== String(comId));
  if (mockPostOpsRows.length === before) {
    const error = new Error('Post Ops voyage not found or already in History.');
    error.status = 404;
    throw error;
  }
  if (row) {
    mockHistoryRows = [
      ...mockHistoryRows,
      {
        ...row,
        status: 4,
        statusLabel: 'History',
        canDeactivate: false,
        canMoveToPostOps: false,
        canMoveToHistory: false,
        canEditOperator: false,
        pageContext: 3,
      },
    ];
  }
  return { msg: 3 };
}

export async function deactivateOpsVcEntry(comId) {
  if (isDbConfigured()) return dbDeactivateOpsVcEntry(comId);
  const beforeIn = mockRows.length;
  const beforePost = mockPostOpsRows.length;
  const fromIn = mockRows.find((item) => String(item.comId) === String(comId));
  const fromPost = mockPostOpsRows.find((item) => String(item.comId) === String(comId));
  mockRows = mockRows.filter((item) => String(item.comId) !== String(comId));
  mockPostOpsRows = mockPostOpsRows.filter((item) => String(item.comId) !== String(comId));
  if (mockRows.length === beforeIn && mockPostOpsRows.length === beforePost) {
    const error = new Error('Ops voyage not found.');
    error.status = 404;
    throw error;
  }
  const row = fromIn || fromPost;
  if (row) {
    mockHistoryRows = [
      ...mockHistoryRows,
      {
        ...row,
        status: 3,
        statusLabel: 'Deactivated',
        canDeactivate: false,
        canMoveToPostOps: false,
        canMoveToHistory: false,
        canEditOperator: false,
        pageContext: 3,
      },
    ];
  }
  return { msg: 6 };
}

let mockYearRows = [
  {
    index: 1,
    fcaId: 2001,
    comId: 1001,
    voyageNo: 'V-2401',
    vesselName: 'ATLANTIC STAR',
    cpDate: '15-01-2026',
    date: '15-01-2026',
    addOnDate: '15-01-2026',
  },
  {
    index: 2,
    fcaId: 2002,
    comId: 1002,
    voyageNo: 'V-2402',
    vesselName: 'PACIFIC WIND',
    cpDate: '10-01-2026',
    date: '10-01-2026',
    addOnDate: '10-01-2026',
  },
];

export async function listYearUpdation(params = {}) {
  if (isDbConfigured()) return dbListYearUpdation(params);
  const search = String(params.search || '').toLowerCase();
  let rows = [...mockYearRows];
  if (search) {
    rows = rows.filter((row) => [
      row.voyageNo,
      row.vesselName,
      row.comId,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  return {
    records: rows,
    recordsTotal: rows.length,
    page: 1,
    pageSize: rows.length || 50,
  };
}

export async function updateYearAddOnDate(comId, addOnDate) {
  if (isDbConfigured()) return dbUpdateYearAddOnDate(comId, addOnDate);
  const row = mockYearRows.find((item) => String(item.comId) === String(comId));
  if (!row) {
    const error = new Error('Voyage not found.');
    error.status = 404;
    throw error;
  }
  const value = String(addOnDate || '').trim();
  if (!/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
    const error = new Error('Please enter a valid Add On Date (dd-mm-yyyy).');
    error.status = 400;
    throw error;
  }
  row.date = value;
  row.addOnDate = value;
  return { msg: 0, comId: String(comId), addOnDate: value };
}

export async function listVoyageReports(params = {}) {
  if (isDbConfigured()) return dbListVoyageReports(params);
  const imo = String(params.vesselImoNo || '').trim();
  if (!imo) {
    const error = new Error('Vessel IMO is required.');
    error.status = 400;
    throw error;
  }
  const row = mockRows.find((item) => String(item.vesselImoNo) === imo)
    || mockRows.find((item) => String(item.comId) === String(params.comId || ''));
  return {
    vesselImoNo: imo,
    comId: String(params.comId || row?.comId || ''),
    vesselName: row?.vesselName || 'ATLANTIC STAR',
    voyageNo: row?.voyageNo || 'V-2401',
    voyageYear: String(params.selYear || new Date().getFullYear()),
    records: [
      {
        index: 1,
        reportType: 'NOON',
        reportTitle: 'Noon Report',
        vesselType: row?.vesselType || 'Supramax',
        messageNo: 'NR-001',
        vesselName: row?.vesselName || 'ATLANTIC STAR',
        voyageNo: row?.voyageNo || 'V-2401',
        charterer: row?.charterer || 'Steel Corp',
        reportingLt: '15-01-2026 12:00',
        timeZone: '+ 05:30',
        reportingUtc: '15-01-2026 06:30',
        draftFore: '8.2',
        draftAft: '8.5',
        depPort: '',
        portOfArrival: '',
        portVisitReasons: '',
        nextPort: 'Mundra',
        etaNextPort: '18-01-2026 08:00',
        vesselCondition: 'Laden',
        weatherDirection: 'NE',
        windForce: '4',
        seaState: '3',
        swellState: '2',
        swellDirection: 'NE',
        latitude: 'N 12 30',
        longitude: 'E 072 10',
        orderedSpeed: '',
        distToGo: '420',
        totalVoyageDist: '',
        observedDist: '240',
        noonHdg: '090',
        stoppage: '0',
        effectiveSteaming: '24',
        observedSpeed: '12.5',
        downtime: '',
        conspMain: 'HSFO - 18 MT',
        conspTankCleaning: '',
        conspGasFreeing: '',
        conspOther: '',
        totalRob: 'HSFO - 420 MT',
        totalConsp: 'HSFO - 18 MT',
        bunkerSupplied: '',
      },
    ],
    recordsTotal: 1,
  };
}

export function __resetOpsVcMockForTests() {
  mockRows = [
    {
      index: 1,
      comId: 1001,
      fcaId: 2001,
      message: '26-001',
      voyageNo: 'V-2401',
      businessType: 'Dry Cargo',
      materialName: 'Coal',
      vesselName: 'ATLANTIC STAR',
      vesselType: 'Supramax',
      vesselImoNo: '9123456',
      isPeriod: false,
      ports: 'LP - Singapore\nDP - Mundra',
      charterer: 'Steel Corp',
      cpDate: '15-01-2026',
      ownBusiness: 'Dry Cargo',
      costSheets: [{ id: 11, name: 'Initial CS' }],
      operatorId: '1',
      operatorName: 'Ops User',
      charteringTeam: 'Zafira',
      lastUpdatedBy: 'Ops User',
      lastUpdatedAt: '15-01-2026 10:30',
      paymentNotReceived: false,
      paymentNotPaid: false,
      canDeactivate: true,
      canMoveToPostOps: true,
      canMoveToHistory: false,
      canEditOperator: true,
      pageContext: 1,
    },
  ];
  mockPostOpsRows = [
    {
      index: 1,
      comId: 1002,
      fcaId: 2002,
      message: '26-002',
      voyageNo: 'V-2402',
      businessType: 'Dry Cargo',
      materialName: 'Grain',
      vesselName: 'PACIFIC WIND',
      vesselType: 'Handysize',
      vesselImoNo: '9234567',
      isPeriod: false,
      ports: 'LP - Rotterdam\nDP - Lagos',
      charterer: 'Agri Traders',
      cpDate: '10-01-2026',
      ownBusiness: 'Dry Cargo',
      costSheets: [{ id: 21, name: 'Final CS' }],
      operatorId: '1',
      operatorName: 'Ops User',
      charteringTeam: 'Zafira',
      lastUpdatedBy: 'Ops User',
      lastUpdatedAt: '12-01-2026 09:15',
      paymentNotReceived: false,
      paymentNotPaid: false,
      canDeactivate: true,
      canMoveToPostOps: false,
      canMoveToHistory: true,
      canEditOperator: true,
      pageContext: 2,
    },
  ];
  mockHistoryRows = [
    {
      index: 1,
      comId: 1003,
      fcaId: 2003,
      message: '25-010',
      voyageNo: 'V-2310',
      businessType: 'Dry Cargo',
      materialName: 'Ore',
      vesselName: 'NORTHERN LIGHT',
      vesselType: 'Capesize',
      vesselImoNo: '9345678',
      isPeriod: false,
      ports: 'LP - Tubarao\nDP - Qingdao',
      charterer: 'Steel Mill',
      cpDate: '05-11-2025',
      ownBusiness: 'Dry Cargo',
      costSheets: [{ id: 31, name: 'Closed CS' }],
      operatorId: '2',
      operatorName: 'Support',
      charteringTeam: 'Zafira',
      lastUpdatedBy: 'Support',
      lastUpdatedAt: '20-12-2025 14:00',
      paymentNotReceived: false,
      paymentNotPaid: false,
      status: 4,
      statusLabel: 'History',
      canDeactivate: false,
      canMoveToPostOps: false,
      canMoveToHistory: false,
      canEditOperator: false,
      pageContext: 3,
    },
  ];
  mockYearRows = [
    {
      index: 1,
      fcaId: 2001,
      comId: 1001,
      voyageNo: 'V-2401',
      vesselName: 'ATLANTIC STAR',
      cpDate: '15-01-2026',
      date: '15-01-2026',
      addOnDate: '15-01-2026',
    },
    {
      index: 2,
      fcaId: 2002,
      comId: 1002,
      voyageNo: 'V-2402',
      vesselName: 'PACIFIC WIND',
      cpDate: '10-01-2026',
      date: '10-01-2026',
      addOnDate: '10-01-2026',
    },
  ];
}
