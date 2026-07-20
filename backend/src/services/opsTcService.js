import { compareSheetsEnabled, isDbConfigured } from '../config.js';
import {
  dbCreateOpsTcCostSheet,
  dbDeactivateOpsTcEntry,
  dbFinaliseVoyageFixturesTc,
  dbListFinalisedVoyageFixturesTc,
  dbListHistoryAtGlanceTc,
  dbListInOpsAtGlanceTc,
  dbListOpsTcYears,
  dbListPostOpsAtGlanceTc,
  dbListYearUpdationTc,
  dbMoveOpsTcToHistory,
  dbMoveOpsTcToPostOps,
  dbResolveLatestTcOutIdByComId,
  dbUpdateOpsTcOperator,
  dbUpdateTcUpdateOnDate,
} from './opsTcDb.js';
import { listOpsVcOperators } from './opsVcService.js';

let mockRows = [
  {
    index: 1,
    tcOutId: 501,
    comId: 9001,
    vesselName: 'ATLANTIC STAR',
    vesselType: 'Supramax',
    tcNo: 'TC-2401',
    cpDate: '15-01-2026',
    dwt: '55000',
    delPort: 'Singapore',
    reDelPort: 'Mundra',
    tcDays: 45,
    dailyGrossHire: '12500.00',
    totalRev: '562500',
    fixed: false,
    statusLabel: 'Not Fixed',
    operatorId: '',
    operatorName: '',
    canFinalise: true,
  },
  {
    index: 2,
    tcOutId: 502,
    comId: 9002,
    vesselName: 'PACIFIC WIND',
    vesselType: 'Handysize',
    tcNo: 'TC-2402',
    cpDate: '10-01-2026',
    dwt: '38000',
    delPort: 'Rotterdam',
    reDelPort: 'Lagos',
    tcDays: 30,
    dailyGrossHire: '9800.00',
    totalRev: '294000',
    fixed: true,
    statusLabel: 'Finalised',
    operatorId: '1',
    operatorName: 'Ops User',
    canFinalise: false,
  },
];

let mockInOpsRows = [
  {
    index: 1,
    comId: 9101,
    tcOutId: 601,
    message: '26-TC-001',
    tcNo: 'TC-2601',
    businessType: 'Dry Cargo',
    vesselName: 'ATLANTIC STAR',
    vesselType: 'Supramax',
    vesselImoNo: '9123456',
    isPeriod: false,
    charterer: 'Steel Corp',
    cpDate: '15-01-2026',
    delPort: 'Singapore',
    reDelPort: 'Mundra',
    ports: 'Singapore / Mundra',
    hireDays: '45',
    reDelDate: '01-03-2026',
    costSheets: [{ id: 11, name: 'Initial CS' }],
    operatorId: '1',
    operatorName: 'Ops User',
    charteringTeam: 'Zafira',
    status: 1,
    statusLabel: '',
    canDeactivate: true,
    canMoveToPostOps: true,
    canMoveToHistory: false,
    canEditOperator: true,
    canAddCostSheet: true,
    pageContext: 1,
  },
];

let mockPostOpsRows = [
  {
    index: 1,
    comId: 9201,
    tcOutId: 701,
    message: '26-TC-002',
    tcNo: 'TC-2602',
    businessType: 'Dry Cargo',
    vesselName: 'PACIFIC WIND',
    vesselType: 'Handysize',
    vesselImoNo: '9234567',
    isPeriod: false,
    charterer: 'Grain Traders',
    cpDate: '20-01-2026',
    delPort: 'Rotterdam',
    reDelPort: 'Lagos',
    ports: 'Rotterdam / Lagos',
    hireDays: '30',
    reDelDate: '20-02-2026',
    costSheets: [{ id: 21, name: 'Post Ops CS' }],
    operatorId: '2',
    operatorName: 'Ops Lead',
    charteringTeam: 'Zafira',
    status: 2,
    statusLabel: '',
    canDeactivate: true,
    canMoveToPostOps: false,
    canMoveToHistory: true,
    canEditOperator: true,
    canAddCostSheet: true,
    pageContext: 2,
  },
];

let mockHistoryRows = [
  {
    index: 1,
    comId: 9301,
    tcOutId: 801,
    message: '25-TC-099',
    tcNo: 'TC-2599',
    businessType: 'Dry Cargo',
    vesselName: 'NORDIC SPIRIT',
    vesselType: 'Supramax',
    vesselImoNo: '9345678',
    isPeriod: false,
    charterer: 'Steel Corp',
    cpDate: '01-12-2025',
    delPort: 'Singapore',
    reDelPort: 'Mundra',
    ports: 'Singapore / Mundra',
    hireDays: '42',
    reDelDate: '15-01-2026',
    costSheets: [{ id: 31, name: 'Closed CS' }],
    operatorId: '1',
    operatorName: 'Ops User',
    charteringTeam: 'Zafira',
    status: 4,
    statusLabel: 'History',
    canDeactivate: false,
    canMoveToPostOps: false,
    canMoveToHistory: false,
    canEditOperator: false,
    canAddCostSheet: false,
    pageContext: 3,
  },
];

let mockYearRows = [
  {
    index: 1,
    comId: 9401,
    tcOutId: 901,
    tcNo: 'TC-2501',
    vesselName: 'ATLANTIC STAR',
    cpDate: '06-01-2026',
    year: '06-01-2026',
    updateYear: '06-01-2026',
  },
];

const MOCK_YEARS = [
  { id: '2026', name: '2026' },
  { id: '2025', name: '2025' },
];

export function __resetOpsTcMockForTests() {
  mockRows = [
    {
      index: 1,
      tcOutId: 501,
      comId: 9001,
      vesselName: 'ATLANTIC STAR',
      vesselType: 'Supramax',
      tcNo: 'TC-2401',
      cpDate: '15-01-2026',
      dwt: '55000',
      delPort: 'Singapore',
      reDelPort: 'Mundra',
      tcDays: 45,
      dailyGrossHire: '12500.00',
      totalRev: '562500',
      fixed: false,
      statusLabel: 'Not Fixed',
      operatorId: '',
      operatorName: '',
      canFinalise: true,
    },
    {
      index: 2,
      tcOutId: 502,
      comId: 9002,
      vesselName: 'PACIFIC WIND',
      vesselType: 'Handysize',
      tcNo: 'TC-2402',
      cpDate: '10-01-2026',
      dwt: '38000',
      delPort: 'Rotterdam',
      reDelPort: 'Lagos',
      tcDays: 30,
      dailyGrossHire: '9800.00',
      totalRev: '294000',
      fixed: true,
      statusLabel: 'Finalised',
      operatorId: '1',
      operatorName: 'Ops User',
      canFinalise: false,
    },
  ];
  mockInOpsRows = [
    {
      index: 1,
      comId: 9101,
      tcOutId: 601,
      message: '26-TC-001',
      tcNo: 'TC-2601',
      businessType: 'Dry Cargo',
      vesselName: 'ATLANTIC STAR',
      vesselType: 'Supramax',
      vesselImoNo: '9123456',
      isPeriod: false,
      charterer: 'Steel Corp',
      cpDate: '15-01-2026',
      delPort: 'Singapore',
      reDelPort: 'Mundra',
      ports: 'Singapore / Mundra',
      hireDays: '45',
      reDelDate: '01-03-2026',
      costSheets: [{ id: 11, name: 'Initial CS' }],
      operatorId: '1',
      operatorName: 'Ops User',
      charteringTeam: 'Zafira',
      status: 1,
      statusLabel: '',
      canDeactivate: true,
      canMoveToPostOps: true,
      canMoveToHistory: false,
      canEditOperator: true,
      canAddCostSheet: true,
      pageContext: 1,
    },
  ];
  mockPostOpsRows = [
    {
      index: 1,
      comId: 9201,
      tcOutId: 701,
      message: '26-TC-002',
      tcNo: 'TC-2602',
      businessType: 'Dry Cargo',
      vesselName: 'PACIFIC WIND',
      vesselType: 'Handysize',
      vesselImoNo: '9234567',
      isPeriod: false,
      charterer: 'Grain Traders',
      cpDate: '20-01-2026',
      delPort: 'Rotterdam',
      reDelPort: 'Lagos',
      ports: 'Rotterdam / Lagos',
      hireDays: '30',
      reDelDate: '20-02-2026',
      costSheets: [{ id: 21, name: 'Post Ops CS' }],
      operatorId: '2',
      operatorName: 'Ops Lead',
      charteringTeam: 'Zafira',
      status: 2,
      statusLabel: '',
      canDeactivate: true,
      canMoveToPostOps: false,
      canMoveToHistory: true,
      canEditOperator: true,
      canAddCostSheet: true,
      pageContext: 2,
    },
  ];
  mockHistoryRows = [
    {
      index: 1,
      comId: 9301,
      tcOutId: 801,
      message: '25-TC-099',
      tcNo: 'TC-2599',
      businessType: 'Dry Cargo',
      vesselName: 'NORDIC SPIRIT',
      vesselType: 'Supramax',
      vesselImoNo: '9345678',
      isPeriod: false,
      charterer: 'Steel Corp',
      cpDate: '01-12-2025',
      delPort: 'Singapore',
      reDelPort: 'Mundra',
      ports: 'Singapore / Mundra',
      hireDays: '42',
      reDelDate: '15-01-2026',
      costSheets: [{ id: 31, name: 'Closed CS' }],
      operatorId: '1',
      operatorName: 'Ops User',
      charteringTeam: 'Zafira',
      status: 4,
      statusLabel: 'History',
      canDeactivate: false,
      canMoveToPostOps: false,
      canMoveToHistory: false,
      canEditOperator: false,
      canAddCostSheet: false,
      pageContext: 3,
    },
  ];
  mockYearRows = [
    {
      index: 1,
      comId: 9401,
      tcOutId: 901,
      tcNo: 'TC-2501',
      vesselName: 'ATLANTIC STAR',
      cpDate: '06-01-2026',
      year: '06-01-2026',
      updateYear: '06-01-2026',
    },
  ];
}

function findMockGlanceRow(comId) {
  return mockInOpsRows.find((item) => String(item.comId) === String(comId))
    || mockPostOpsRows.find((item) => String(item.comId) === String(comId))
    || mockHistoryRows.find((item) => String(item.comId) === String(comId));
}

function filterMockGlanceRows(rows, params = {}) {
  const search = String(params.search || '').toLowerCase();
  let filtered = [...rows];
  if (search) {
    filtered = filtered.filter((row) => [
      row.message,
      row.tcNo,
      row.vesselName,
      row.operatorName,
      row.comId,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.pageSize) || 50));
  const start = (page - 1) * pageSize;
  const canEditOperator = params.canEditOperator != null ? Boolean(params.canEditOperator) : true;
  return {
    records: filtered.slice(start, start + pageSize).map((row, index) => ({
      ...row,
      index: start + index + 1,
      canEditOperator,
    })),
    recordsTotal: filtered.length,
    canEditOperator,
    canCompareSheets: compareSheetsEnabled(),
  };
}

function filterMockYearRows(params = {}) {
  const search = String(params.search || '').toLowerCase();
  let rows = [...mockYearRows];
  if (search) {
    rows = rows.filter((row) => [
      row.tcNo,
      row.vesselName,
      row.comId,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.pageSize) || 50));
  const start = (page - 1) * pageSize;
  return {
    records: rows.slice(start, start + pageSize).map((row, index) => ({
      ...row,
      index: start + index + 1,
    })),
    recordsTotal: rows.length,
    page,
    pageSize,
  };
}

export async function listFinalisedVoyageFixturesTc(params = {}) {
  if (isDbConfigured()) return dbListFinalisedVoyageFixturesTc(params);

  const search = String(params.search || '').toLowerCase();
  let rows = [...mockRows];
  if (search) {
    rows = rows.filter((row) => [
      row.vesselName,
      row.vesselType,
      row.tcNo,
      row.delPort,
      row.reDelPort,
      row.comId,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }

  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.pageSize) || 50));
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize).map((row, index) => ({
    ...row,
    index: start + index + 1,
  }));

  return {
    records: pageRows,
    recordsTotal: rows.length,
  };
}

export async function listOpsTcOperators() {
  return listOpsVcOperators();
}

export async function listOpsTcYears() {
  if (isDbConfigured()) return dbListOpsTcYears();
  return MOCK_YEARS;
}

export async function listInOpsAtGlanceTc(params = {}) {
  if (isDbConfigured()) return dbListInOpsAtGlanceTc(params);
  return filterMockGlanceRows(mockInOpsRows.filter((row) => row.status === 1), params);
}

export async function listPostOpsAtGlanceTc(params = {}) {
  if (isDbConfigured()) return dbListPostOpsAtGlanceTc(params);
  return filterMockGlanceRows(mockPostOpsRows, params);
}

export async function listHistoryAtGlanceTc(params = {}) {
  if (isDbConfigured()) return dbListHistoryAtGlanceTc(params);
  return filterMockGlanceRows(mockHistoryRows, { ...params, canEditOperator: false });
}

export async function listYearUpdationTc(params = {}) {
  if (isDbConfigured()) return dbListYearUpdationTc(params);
  return filterMockYearRows(params);
}

export async function updateTcUpdateOnDate(comId, updateYear) {
  if (isDbConfigured()) return dbUpdateTcUpdateOnDate(comId, updateYear);
  const row = mockYearRows.find((item) => String(item.comId) === String(comId));
  if (!row) {
    const error = new Error('TC nomination not found.');
    error.status = 404;
    throw error;
  }
  row.updateYear = String(updateYear || '');
  row.year = row.updateYear;
  return { msg: 0, comId: String(comId), updateYear: row.updateYear, year: row.year };
}

export async function updateOpsTcOperator(comId, operatorId) {
  if (isDbConfigured()) return dbUpdateOpsTcOperator(comId, operatorId);
  const row = findMockGlanceRow(comId);
  if (!row) {
    const error = new Error('Ops TC entry not found.');
    error.status = 404;
    throw error;
  }
  const operators = await listOpsTcOperators();
  row.operatorId = String(operatorId || '');
  row.operatorName = operators.find((op) => String(op.id) === String(operatorId))?.name || '';
  return { msg: 0 };
}

export async function moveOpsTcToPostOps(comId) {
  if (isDbConfigured()) return dbMoveOpsTcToPostOps(comId);
  const index = mockInOpsRows.findIndex((item) => String(item.comId) === String(comId) && item.status === 1);
  if (index < 0) {
    const error = new Error('Ops TC entry not found or not in In Ops.');
    error.status = 404;
    throw error;
  }
  const [row] = mockInOpsRows.splice(index, 1);
  row.status = 2;
  row.canMoveToPostOps = false;
  row.canMoveToHistory = true;
  row.pageContext = 2;
  mockPostOpsRows.push(row);
  return { msg: 6 };
}

export async function moveOpsTcToHistory(comId) {
  if (isDbConfigured()) return dbMoveOpsTcToHistory(comId);
  const index = mockPostOpsRows.findIndex((item) => String(item.comId) === String(comId));
  if (index < 0) {
    const error = new Error('Post Ops TC entry not found or already in History.');
    error.status = 404;
    throw error;
  }
  const [row] = mockPostOpsRows.splice(index, 1);
  row.status = 4;
  row.statusLabel = 'History';
  row.canDeactivate = false;
  row.canMoveToHistory = false;
  row.canEditOperator = false;
  row.pageContext = 3;
  mockHistoryRows.push(row);
  return { msg: 3 };
}

export async function deactivateOpsTcEntry(comId) {
  if (isDbConfigured()) return dbDeactivateOpsTcEntry(comId);
  const row = findMockGlanceRow(comId);
  if (!row || row.status === 4) {
    const error = new Error('Ops TC entry not found.');
    error.status = 404;
    throw error;
  }
  mockInOpsRows = mockInOpsRows.filter((item) => String(item.comId) !== String(comId));
  mockPostOpsRows = mockPostOpsRows.filter((item) => String(item.comId) !== String(comId));
  return { msg: 3 };
}

export async function createOpsTcCostSheet(comId, sheetName) {
  if (isDbConfigured()) return dbCreateOpsTcCostSheet(comId, sheetName);
  const row = findMockGlanceRow(comId);
  if (!row) {
    const error = new Error('Ops TC entry not found.');
    error.status = 404;
    throw error;
  }
  const id = (row.costSheets?.length || 0) + 100;
  row.costSheets = [...(row.costSheets || []), { id, name: String(sheetName || '').trim() }];
  return { msg: 4, costSheetId: id };
}

export async function resolveOpsTcFixtureNote(comId) {
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }
  if (isDbConfigured()) return dbResolveLatestTcOutIdByComId(comId);

  const row = findMockGlanceRow(comId);
  if (!row?.tcOutId) {
    const error = new Error('TC fixture note not found for this nomination.');
    error.status = 404;
    throw error;
  }
  return { comId: Number(comId), tcOutId: row.tcOutId };
}

export async function finaliseVoyageFixturesTc(fixtures = []) {
  if (isDbConfigured()) return dbFinaliseVoyageFixturesTc(fixtures);

  if (!Array.isArray(fixtures) || !fixtures.length) {
    const error = new Error('Please select at least one Fixture');
    error.status = 400;
    throw error;
  }

  const operators = await listOpsTcOperators();
  for (const item of fixtures) {
    if (!item?.tcOutId || !item?.comId) {
      const error = new Error('Fixture id and COMID are required.');
      error.status = 400;
      throw error;
    }
    if (!item?.operatorId) {
      const error = new Error('Please select an Operator for each fixture.');
      error.status = 400;
      throw error;
    }

    const row = mockRows.find((entry) => String(entry.tcOutId) === String(item.tcOutId));
    if (!row) {
      const error = new Error(`Fixture ${item.tcOutId} was not found.`);
      error.status = 404;
      throw error;
    }
    if (row.fixed) continue;

    const operator = operators.find((op) => String(op.id) === String(item.operatorId));
    row.fixed = true;
    row.statusLabel = 'Finalised';
    row.canFinalise = false;
    row.operatorId = String(item.operatorId);
    row.operatorName = operator?.name || row.operatorName || '';
  }

  return { msg: 1 };
}
