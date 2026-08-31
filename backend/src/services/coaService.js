import { isDbConfigured } from '../config.js';
import {
  dbCancelCoa,
  dbCreateCargoRelet,
  dbCreateCoa,
  dbDeleteCargoRelet,
  dbGetCargoRelet,
  dbGetCoa,
  dbGetCoaLookups,
  dbGetCoaNominations,
  dbListCargoRelets,
  dbListCoaOpsVoyages,
  dbListRunningCoas,
  dbMoveVoyageToPostOps,
  dbSaveMonthlyRemarks,
  dbUpdateCargoRelet,
  dbUpdateCoa,
} from './coaDb.js';

const MOCK_LOOKUPS = {
  nextCoaId: 'COA-001-2026',
  messageNo: '1',
  currencies: [{ id: 'USD', name: 'USD' }, { id: 'EURO', name: 'EURO' }],
  vesselSubstitutes: [{ id: '1', name: 'Yes' }, { id: '2', name: 'No' }],
  routes: [{ id: '1', name: 'Asia-Europe' }],
  loadOptions: [{ id: '1', name: 'FOB' }],
  vesselTypes: [{ id: '1', name: 'Aframax', businessTypeId: '2' }],
  cargos: [
    { id: '1', name: 'Crude Oil', materialTypeId: '2' },
    { id: '2', name: 'Gasoil', materialTypeId: '2' },
    { id: '3', name: 'Iron Ore', materialTypeId: '3' },
  ],
  charterers: [
    { id: 'C001', name: 'Steel Corp (C001)' },
    { id: 'C002', name: 'Trafigura Pte Ltd (C002)' },
  ],
  owners: [
    { id: 'O001', name: 'Owner Co (O001)' },
    { id: 'O002', name: 'Seven Oceans Shipping (O002)' },
  ],
  brokers: [
    { id: 'B001', name: 'Broker Co (B001)' },
    { id: 'B002', name: 'Braemar (B002)' },
  ],
  vessels: [{ id: '100', name: 'Atlantic Star', businessTypeId: '2' }],
};

const MOCK_RUNNING = {
  records: [
    {
      index: 1,
      coaId: 1,
      coaRoute: 'Asia-Europe',
      coaIdentity: 'COA-001',
      coaNo: '2026/01',
      coaDate: '01-01-2026',
      vesselType: 'Capesize',
      charterer: 'Steel Corp(C001)',
      cargo: 'Iron Ore(IO01)',
      minQty: '500000',
      duration: '12 months',
      totalShipments: '10',
      shipmentsPerformed: 3,
      balanceCargo: '350000.00',
      status: 'Active',
      updateStatus: 1,
      canCancel: false,
      cancelRemarks: '',
    },
  ],
  recordsTotal: 1,
  page: 1,
  pageSize: 10,
};

const MOCK_RELETS = {
  records: [
    {
      index: 1,
      fcaId: 11,
      coaId: 1,
      coaIdentity: 'COA-001',
      coaNo: '2026/01',
      reletNo: 'CR-001',
      coaDate: '01-01-2026',
      cargoQty: '55000',
      ports: 'Singapore / Rotterdam',
      freightInPerMt: '12.50',
      freightInAmt: '687500.00',
      foSurcharge: '2500.00',
      freightOutPerMt: '11.00',
      freightOutAmt: '605000.00',
      profit: '80000.00',
      vesselName: 'Atlantic Star',
      currency: 'USD',
      fixed: false,
      updateStatus: 1,
      canDelete: true,
    },
  ],
  recordsTotal: 1,
  page: 1,
  pageSize: 10,
};

const MOCK_OPS = {
  records: [
    {
      index: 1,
      comId: 501,
      fcaId: 901,
      coaId: 1,
      coaIdentity: 'COA-001',
      coaNo: '2026/01',
      voyageNo: 'V-501',
      vesselName: 'Atlantic Star',
      vesselType: 'Capesize',
      operator: 'J. Tan',
      charterer: 'Steel Corp',
      cargo: 'Iron Ore(IO01)',
      cpDate: '15-03-2026',
      ports: 'Singapore / Rotterdam',
      duration: '42',
      cargoQty: '65000',
      worksheet: '26-006',
      alert: null,
      tce: '48500',
      profitLoss: '306600',
      message: 'NOM-501',
      status: 'In Ops',
      statusCode: 1,
      canMoveToPostOps: true,
    },
  ],
  recordsTotal: 1,
  page: 1,
  pageSize: 10,
};

/** In-memory Direct Fixtures until a DB table exists (no PHP predecessor). */
let nextDirectFixtureId = 2;
const DIRECT_FIXTURES = [
  {
    fcaId: 1,
    fixtureNo: 'DF-2026-0001',
    businessTypeId: '2',
    vesselImoId: '100',
    vesselName: 'Atlantic Star',
    vesselType: 'Aframax',
    transDate: '10-03-2026',
    cargoName: 'Crude Oil',
    cargoQty: '80000',
    freightUsd: '12.50',
    bafUsd: '0.05',
    foPrice: '450',
    addCom: '1.25',
    brokerage: '1.25',
    demRate: '',
    bunkerSurchargePerMt: '22.50',
    effectiveFrt: '35.00',
    grossRevenue: '2800000.00',
    ttlComm: '70000.00',
    nettRevenue: '2730000.00',
    paymentClause: '',
    bunkerClause: '',
    loadportAgent: '',
    disportAgent: '',
    minTerm: '',
    parties: [{ charterer: 'C001', owner: 'O001', broker: 'B001' }],
    loadPorts: [{ portId: '', portName: 'Fujairah', comments: '' }],
    dischargePorts: [{ portId: '', portName: 'Singapore', comments: '' }],
    ports: 'Fujairah / Singapore',
    charterer: 'Steel Corp ( C001 )',
    status: 'ops',
    sentToOps: true,
  },
];

function portsLabel(loadPorts = [], dischargePorts = []) {
  const lp = loadPorts.map((row) => row.portName).filter(Boolean).join(', ');
  const dp = dischargePorts.map((row) => row.portName).filter(Boolean).join(', ');
  if (lp && dp) return `${lp} / ${dp}`;
  return lp || dp || '';
}

function toDirectFixtureListRow(row, index) {
  return {
    index: index + 1,
    fcaId: row.fcaId,
    fixtureNo: row.fixtureNo,
    coaDate: row.transDate,
    vesselName: row.vesselName || '',
    vesselType: row.vesselType || '',
    charterer: row.charterer
      || row.parties?.[0]?.charterer
      || '',
    cargo: row.cargoName || '',
    cargoQty: row.cargoQty || '',
    ports: row.ports || portsLabel(row.loadPorts, row.dischargePorts),
    freightUsd: row.freightUsd || '',
    grossRevenue: row.grossRevenue || '',
    nettRevenue: row.nettRevenue || '',
    status: row.status === 'closed' ? 'Closed' : 'Active',
    statusCode: row.status === 'closed' ? 'closed' : 'ops',
    sentToOps: Boolean(row.sentToOps),
    canComplete: row.status !== 'closed' && Boolean(row.sentToOps),
    businessTypeId: row.businessTypeId || '',
  };
}

function filterDirectFixtures(params = {}) {
  const search = String(params.search || '').trim().toLowerCase();
  const selBType = params.selBType ? String(params.selBType) : '';
  const status = params.status ? String(params.status) : '';
  return DIRECT_FIXTURES.filter((row) => {
    // Soft business-type filter: keep rows that match, or rows with no type set.
    if (selBType && row.businessTypeId && String(row.businessTypeId) !== selBType) return false;
    if (status === 'ops' || status === '1') {
      if (row.status === 'closed' || !row.sentToOps) return false;
    } else if (status === 'history' || status === 'closed') {
      if (row.status !== 'closed') return false;
    } else if (status === 'draft') {
      if (row.sentToOps) return false;
    }
    if (!search) return true;
    const hay = [
      row.fixtureNo,
      row.vesselName,
      row.cargoName,
      row.charterer,
      row.ports,
    ].join(' ').toLowerCase();
    return hay.includes(search);
  });
}

function ensureDb() {
  if (!isDbConfigured()) {
    // mock mode allowed
  }
}

export async function getCoaLookups() {
  ensureDb();
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetCoaLookups();
}

export async function listRunningCoas(params) {
  if (!isDbConfigured()) return { ...MOCK_RUNNING, ...params, page: params.page || 1 };
  return dbListRunningCoas(params);
}

export async function getCoa(coaId) {
  if (!isDbConfigured()) {
    return {
      coaId: 1,
      coaIdentity: 'COA-001',
      coaNo: '2026/01',
      coaDate: '01-01-2026',
      charterer: 'C001',
      owner: 'O001',
      coaRoute: '1',
      totalShipments: '10',
      broker: 'B001',
      vesselType: '1',
      loadOptions: '1',
      cargo: '1',
      tolerance: '10%',
      coaNotice: '5',
      minGuaranteedQty: '500000',
      lpEtaNotices: '72',
      vesselSubstitute: '1',
      duration: '12 months',
      startDate: '01-01-2026',
      endDate: '31-12-2026',
      freightDetails: 'As per COA',
      lpDetails: '',
      dpDetails: '',
      demmLaytime: '',
      remarks: '',
      updateStatus: '1',
      attachment: '',
      attachmentName: '',
      currency: 'USD',
      businessTypeId: '3',
      foPrice: '',
      bafAmt: '',
      status: 1,
      cancelRemarks: '',
      exclusions: [],
      monthlyRemarks: [],
    };
  }
  return dbGetCoa(coaId);
}

export async function createCoa(payload) {
  if (!isDbConfigured()) return { msg: 0, coaId: 1 };
  return dbCreateCoa(payload);
}

export async function updateCoa(coaId, payload) {
  if (!isDbConfigured()) return { msg: 0, coaId: Number(coaId) };
  return dbUpdateCoa(coaId, payload);
}

export async function cancelCoa(coaId, remarks) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCancelCoa(coaId, remarks);
}

export async function saveMonthlyRemarks(coaId, remarks) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbSaveMonthlyRemarks(coaId, remarks);
}

export async function getCoaNominations(coaId) {
  if (!isDbConfigured()) {
    return {
      coaLabel: 'COA-001 / 2026/01',
      currency: 'USD',
      voyages: MOCK_OPS.records.map((row) => ({
        index: row.index,
        comId: row.comId,
        fcaId: row.fcaId,
        vesselName: row.vesselName,
        vesselType: row.vesselType,
        coaNo: row.coaNo,
        voyageNo: row.voyageNo,
        cpDate: row.cpDate,
        dwt: '',
        lpdp: row.ports,
        duration: row.duration,
        cargoQty: row.cargoQty,
        tce: row.tce,
        hire: '',
        profitLoss: row.profitLoss,
        message: row.message,
      })),
      relets: MOCK_RELETS.records.map((row) => ({
        index: row.index,
        fcaId: row.fcaId,
        coaNo: row.coaNo,
        reletNo: row.reletNo,
        date: row.coaDate,
        cargoQty: row.cargoQty,
        lpdp: row.ports,
        freightInPerMt: row.freightInPerMt,
        freightInAmt: row.freightInAmt,
        foSurcharge: row.foSurcharge,
        freightOutPerMt: row.freightOutPerMt,
        freightOutAmt: row.freightOutAmt,
        profit: row.profit,
        fixed: row.fixed,
      })),
    };
  }
  return dbGetCoaNominations(coaId);
}

export async function listCargoRelets(params) {
  if (!isDbConfigured()) return { ...MOCK_RELETS, page: params.page || 1 };
  return dbListCargoRelets(params);
}

export async function getCargoRelet(fcaId) {
  if (!isDbConfigured()) {
    return {
      fcaId: Number(fcaId) || 11,
      coaId: '1',
      openCargoId: '',
      updateStatus: '1',
      vesselImoId: '100',
      transDate: '01-02-2026',
      reletNo: 'CR-001',
      reletName: 'Sample Relet',
      vesselType: 'Capesize',
      cargoQty: '55000',
      freightUsd: '12.50',
      bafUsd: '0.45',
      freightFrom: '01-02-2026',
      freightTo: '28-02-2026',
      addCom: '1.25',
      brokerage: '1.25',
      demRate: '',
      desRate: '',
      contractFoPrice: '',
      currentFoPrice: '',
      freightUsdOut: '11.00',
      bafUsdOut: '0.40',
      freightFromOut: '01-02-2026',
      freightToOut: '28-02-2026',
      addComOut: '1.25',
      brokerageOut: '1.25',
      demRateOut: '',
      desRateOut: '',
      paymentClause: '',
      bunkerClause: '',
      paymentClauseOut: '',
      bunkerClauseOut: '',
      freightAmt: '687500.00',
      bunkerSurchargeAmt: '2500.00',
      demmurageAmt: '',
      despatchAmt: '',
      addCommAmt: '',
      brokerageAmt: '',
      totalAmt: '690000.00',
      profit: '80000.00',
      freightAmtOut: '605000.00',
      bunkerSurchargeAmtOut: '',
      demmurageAmtOut: '',
      despatchAmtOut: '',
      addCommAmtOut: '',
      brokerageAmtOut: '',
      totalAmtOut: '605000.00',
      coaRef: '',
      loadportAgent: '',
      loadportRemarks: '',
      disportAgent: '',
      disportRemarks: '',
      notices: '',
      dA: '',
      extraInsurance: '',
      minTerm: '',
      spclComments: '',
      nomProc: '',
      coaRefOut: '',
      loadportAgentOut: '',
      loadportRemarksOut: '',
      disportAgentOut: '',
      disportRemarksOut: '',
      noticesOut: '',
      dAOut: '',
      extraInsuranceOut: '',
      minTermOut: '',
      spclCommentsOut: '',
      nomProcOut: '',
      businessTypeId: '3',
      fixed: false,
      partiesIn: [{ charterer: 'C001', owner: 'O001', broker: 'B001' }],
      partiesOut: [{ charterer: 'C002', owner: 'O001', broker: 'B001' }],
      loadPortsIn: [{ portId: '', comments: '' }],
      dischargePortsIn: [{ portId: '', comments: '' }],
      loadPortsOut: [{ portId: '', comments: '' }],
      dischargePortsOut: [{ portId: '', comments: '' }],
    };
  }
  return dbGetCargoRelet(fcaId);
}

export async function createCargoRelet(payload) {
  if (!isDbConfigured()) return { msg: 0, fcaId: 11 };
  return dbCreateCargoRelet(payload);
}

export async function updateCargoRelet(fcaId, payload) {
  if (!isDbConfigured()) return { msg: 0, fcaId: Number(fcaId) };
  return dbUpdateCargoRelet(fcaId, payload);
}

export async function deleteCargoRelet(fcaId) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbDeleteCargoRelet(fcaId);
}

export async function listCoaOpsVoyages(params) {
  if (!isDbConfigured()) {
    const statusCode = String(params.status) === '2' ? 2 : 1;
    return {
      ...MOCK_OPS,
      page: params.page || 1,
      records: MOCK_OPS.records.map((row) => ({
        ...row,
        status: statusCode === 1 ? 'In Ops' : 'Post Ops',
        statusCode,
        canMoveToPostOps: statusCode === 1,
      })),
    };
  }
  return dbListCoaOpsVoyages(params);
}

export async function moveVoyageToPostOps(comId) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbMoveVoyageToPostOps(comId);
}

export async function listDirectFixtures(params = {}) {
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 10;
  const filtered = filterDirectFixtures(params);
  const start = (page - 1) * pageSize;
  const records = filtered.slice(start, start + pageSize).map(toDirectFixtureListRow);
  return {
    records,
    recordsTotal: filtered.length,
    page,
    pageSize,
  };
}

export async function getDirectFixture(fcaId) {
  const row = DIRECT_FIXTURES.find((item) => String(item.fcaId) === String(fcaId));
  if (!row) return null;
  return { ...row };
}

export async function createDirectFixture(payload = {}) {
  const year = new Date().getFullYear();
  const seq = String(nextDirectFixtureId).padStart(4, '0');
  const fcaId = nextDirectFixtureId;
  nextDirectFixtureId += 1;
  const sendToOps = Boolean(payload.sendToOps);
  const loadPorts = Array.isArray(payload.loadPorts) ? payload.loadPorts : [];
  const dischargePorts = Array.isArray(payload.dischargePorts) ? payload.dischargePorts : [];
  const parties = Array.isArray(payload.parties) ? payload.parties : [];
  const row = {
    fcaId,
    fixtureNo: payload.fixtureNo || `DF-${year}-${seq}`,
    businessTypeId: String(payload.businessTypeId || '2'),
    vesselImoId: payload.vesselImoId || '',
    vesselName: payload.vesselName || '',
    vesselType: payload.vesselType || '',
    transDate: payload.transDate || '',
    cargoName: payload.cargoName || '',
    cargoQty: payload.cargoQty || '',
    freightUsd: payload.freightUsd || '',
    bafUsd: payload.bafUsd || '',
    foPrice: payload.foPrice || '',
    addCom: payload.addCom || '',
    brokerage: payload.brokerage || '',
    demRate: payload.demRate || '',
    bunkerSurchargePerMt: payload.bunkerSurchargePerMt || '',
    effectiveFrt: payload.effectiveFrt || '',
    grossRevenue: payload.grossRevenue || '',
    ttlComm: payload.ttlComm || '',
    nettRevenue: payload.nettRevenue || '',
    paymentClause: payload.paymentClause || '',
    bunkerClause: payload.bunkerClause || '',
    loadportAgent: payload.loadportAgent || '',
    disportAgent: payload.disportAgent || '',
    minTerm: payload.minTerm || '',
    parties,
    loadPorts,
    dischargePorts,
    ports: portsLabel(loadPorts, dischargePorts),
    charterer: payload.charterer || parties[0]?.charterer || '',
    status: sendToOps ? 'ops' : 'draft',
    sentToOps: sendToOps,
  };
  DIRECT_FIXTURES.unshift(row);
  return { msg: 0, fcaId, fixtureNo: row.fixtureNo };
}

export async function updateDirectFixture(fcaId, payload = {}) {
  const index = DIRECT_FIXTURES.findIndex((item) => String(item.fcaId) === String(fcaId));
  if (index < 0) {
    const error = new Error('Direct fixture not found.');
    error.status = 404;
    throw error;
  }
  const current = DIRECT_FIXTURES[index];
  const sendToOps = payload.sendToOps != null ? Boolean(payload.sendToOps) : current.sentToOps;
  const loadPorts = Array.isArray(payload.loadPorts) ? payload.loadPorts : current.loadPorts;
  const dischargePorts = Array.isArray(payload.dischargePorts)
    ? payload.dischargePorts
    : current.dischargePorts;
  const parties = Array.isArray(payload.parties) ? payload.parties : current.parties;
  const next = {
    ...current,
    ...payload,
    fcaId: current.fcaId,
    fixtureNo: current.fixtureNo,
    parties,
    loadPorts,
    dischargePorts,
    ports: portsLabel(loadPorts, dischargePorts),
    charterer: payload.charterer || parties[0]?.charterer || current.charterer,
    sentToOps: sendToOps || current.sentToOps,
    status: payload.status === 'closed'
      ? 'closed'
      : (sendToOps || current.sentToOps ? 'ops' : 'draft'),
  };
  DIRECT_FIXTURES[index] = next;
  return { msg: 0, fcaId: next.fcaId, fixtureNo: next.fixtureNo };
}

export async function completeDirectFixture(fcaId) {
  return updateDirectFixture(fcaId, { status: 'closed', sendToOps: true });
}
