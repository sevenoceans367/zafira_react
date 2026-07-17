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
  vesselTypes: [{ id: '1', name: 'Capesize', businessTypeId: '3' }],
  cargos: [{ id: '1', name: 'Iron Ore(IO01)' }],
  charterers: [{ id: 'C001', name: 'Steel Corp ( C001 )' }],
  owners: [{ id: 'O001', name: 'Owner Co ( O001 )' }],
  brokers: [{ id: 'B001', name: 'Broker Co ( B001 )' }],
  vessels: [{ id: '100', name: 'Atlantic Star', businessTypeId: '3' }],
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
      cpDate: '15-03-2026',
      ports: 'Singapore / Rotterdam',
      duration: '42',
      cargoQty: '65000',
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
        voyageNo: row.voyageNo,
        cpDate: row.cpDate,
        duration: row.duration,
        tce: row.tce,
        profitLoss: row.profitLoss,
        message: row.message,
      })),
      relets: MOCK_RELETS.records.map((row) => ({
        index: row.index,
        fcaId: row.fcaId,
        reletNo: row.reletNo,
        cargoQty: row.cargoQty,
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
