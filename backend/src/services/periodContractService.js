import { isDbConfigured } from '../config.js';
import { dbCreatePeriodContract } from './periodContractCreateDb.js';
import { dbGetPeriodContractList, dbGetPeriodLinkedVoyage, dbGetPeriodNominations } from './periodContractDb.js';
import {
  dbGetNextPeriodContractId,
  dbGetPeriodContractLookups,
  dbSearchPorts,
} from './periodContractLookupsDb.js';
import {
  dbGetPeriodContractById,
  dbUpdatePeriodContract,
} from './periodContractUpdateDb.js';

const MOCK_LOOKUPS = {
  contractId: 'PERIOD-001-2026',
  today: '09-07-2026',
  currencies: [
    { id: 'USD', name: 'United States Dollar (USD)' },
    { id: 'EUR', name: 'Euro (EUR)' },
  ],
  periodTypes: [
    { id: '1', name: 'Months' },
    { id: '2', name: 'Days' },
  ],
  bunkers: [
    { id: '1', name: 'VLSFO' },
    { id: '2', name: 'HSFO' },
  ],
  obaVendors: [{ id: 'SO01', name: 'Seven Oceans ( SO01 )' }],
  ownerVendors: [{ id: 'SO01', name: 'Seven Oceans ( SO01 )' }],
  brokerVendors: [{ id: 'BR01', name: 'Sample Broker ( BR01 )' }],
  vesselTypesByBusiness: {
    3: [{ id: '1', name: 'Handysize' }],
  },
  vesselsByBusiness: {
    3: [{ id: '1', name: 'ATLANTIC STAR' }],
  },
};

const MOCK_RECORDS = [
  {
    index: 1,
    periodId: 101,
    contractId: 'PC-2026-001',
    contractNo: 'PER-01/2026',
    contractDate: '01-01-2026',
    vesselName: 'ATLANTIC STAR',
    vesselType: 'Aframax',
    dwt: '105000',
    initialHire: '18500.00',
    ownBusinessAccount: 'Seven Oceans(SO01)',
    reDelMinDate: '01-06-2026',
    reDelMaxDate: '30-06-2026',
    totalDays: '120.00000',
    performedDays: '45',
    balanceDays: '75.00000',
    remarks: 'Sample open period contract.',
    bunkerOpening: 'VLSFO - 450.0000 MT',
    bunkerClosing: 'VLSFO - 320.0000 MT',
    status: 'Saved & Open Period Contract',
    workingCurrency: 'USD',
  },
  {
    index: 2,
    periodId: 102,
    contractId: 'PC-2025-014',
    contractNo: 'PER-14/2025',
    contractDate: '15-11-2025',
    vesselName: 'PACIFIC DAWN',
    vesselType: 'MR',
    dwt: '52000',
    initialHire: '14200.00',
    ownBusinessAccount: 'Global Charter(GC02)',
    reDelMinDate: '10-01-2026',
    reDelMaxDate: '20-01-2026',
    totalDays: '90.00000',
    performedDays: '90',
    balanceDays: '0.00000',
    remarks: 'Closed sample contract.',
    bunkerOpening: 'HSFO - 280.0000 MT',
    bunkerClosing: 'HSFO - 0.0000 MT',
    status: 'Closed Period Contract',
    workingCurrency: 'USD',
  },
];

function mockPeriodStats(records) {
  const open = records.filter((row) => row.status === 'Saved & Open Period Contract');
  const vessels = new Set(open.map((row) => row.vesselName).filter(Boolean));
  return {
    openTrades: open.length,
    vesselsOnSubs: vessels.size,
    tradesInOperations: 0,
    vesselsOnWater: 0,
  };
}

export async function getPeriodContractList(params = {}) {
  if (!isDbConfigured()) {
    const status = params.status === 'closed' ? 'closed' : 'open';
    const records = MOCK_RECORDS.filter((row) => (
      status === 'closed'
        ? row.status === 'Closed Period Contract'
        : row.status === 'Saved & Open Period Contract'
    ));
    return {
      records,
      recordsTotal: records.length,
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      status,
      stats: mockPeriodStats(MOCK_RECORDS),
    };
  }

  return dbGetPeriodContractList(params);
}

export async function getPeriodContractLookups() {
  if (!isDbConfigured()) {
    return MOCK_LOOKUPS;
  }
  return dbGetPeriodContractLookups();
}

export async function searchPeriodContractPorts(query) {
  if (!isDbConfigured()) {
    const term = String(query || '').toLowerCase();
    const ports = [
      { id: '1', name: 'Singapore (SG)' },
      { id: '2', name: 'Rotterdam (NL)' },
    ];
    return ports.filter((port) => port.name.toLowerCase().includes(term));
  }
  return dbSearchPorts(query);
}

function validatePeriodContractPayload(payload) {
  if (!payload?.contractNo) {
    throw new Error('Contract No. is required.');
  }
  if (!payload?.contractDate) {
    throw new Error('Contract Date is required.');
  }
  if (!payload?.ownBusinessAccount) {
    throw new Error('Own Business Account is required.');
  }
  if (!payload?.businessType) {
    throw new Error('Business Type is required.');
  }
  if (!payload?.vesselType) {
    throw new Error('Vessel Type is required.');
  }
  if (!payload?.vesselImoId) {
    throw new Error('Vessel is required.');
  }
  if (!payload?.currency) {
    throw new Error('Working Currency is required.');
  }
  if (!payload?.delPort) {
    throw new Error('Delivery Port is required.');
  }
  if (!payload?.redelRange) {
    throw new Error('Redelivery Range is required.');
  }
}

export async function createPeriodContract(payload, attachments = {}) {
  validatePeriodContractPayload(payload);

  if (!isDbConfigured()) {
    return {
      periodId: 999,
      contractId: payload.contractId || MOCK_LOOKUPS.contractId,
      msg: 0,
    };
  }

  if (!payload.contractId) {
    const next = await dbGetNextPeriodContractId();
    payload.contractId = next.contractId;
  }

  return dbCreatePeriodContract(payload, attachments);
}

export async function getPeriodContractById(periodId) {
  if (!isDbConfigured()) {
    const mock = MOCK_RECORDS.find((row) => String(row.periodId) === String(periodId));
    if (!mock) {
      throw Object.assign(new Error('Period contract not found.'), { status: 404 });
    }
    return {
      periodId: mock.periodId,
      updateStatus: mock.status === 'Closed Period Contract' ? '2' : '1',
      contractId: mock.contractId,
      contractNo: mock.contractNo,
      contractDate: mock.contractDate,
      ownBusinessAccount: 'SO01',
      businessType: '3',
      vesselType: '1',
      vesselImoId: '1',
      currency: mock.workingCurrency || 'USD',
      owner: 'SO01',
      disOwner: '',
      manager: '',
      broker: 'BR01',
      brokerage: '1.25',
      hire: mock.initialHire,
      addComm: '2.5',
      hireRemarks: '',
      laycanStart: mock.contractDate,
      laycanEnd: mock.contractDate,
      delPort: '1',
      delPortLabel: 'Singapore (SG)',
      deliveryDate: mock.contractDate,
      periodType: '1',
      periodMin: '3',
      periodMax: '6',
      aboutDaysMin: '0',
      aboutDaysMax: '0',
      reDelMinDate: mock.reDelMinDate,
      reDelMaxDate: mock.reDelMaxDate,
      reDelPort: '2',
      reDelPortLabel: 'Rotterdam (NL)',
      redelRange: 'Worldwide',
      voyageDaysPerformed: '',
      tradeExclusions: '',
      cargoExclusions: '',
      intermediateHoldCleaning: '',
      remarks: mock.remarks,
      dirtiesAllowed: '',
      dirtiesDone: '',
      dirtiesRemaining: '',
      holdCleaningMaterial: '',
      addnlPremiumHra: '',
      ilohc: '',
      legDetails: '',
      monthDays: '90',
      attachments: [],
      deliveryNotices: [{ notice: '', dateTime: '' }],
      hireRates: [{ hireFrom: '', hireTo: '', hireDays: '', hireRate: mock.initialHire, remarks: '' }],
      deliveryBunkers: [{ gradeId: '', qty: '', date: '', price: '', amount: '' }],
      redeliveryBunkers: [{ gradeId: '', qty: '', date: '', price: '', amount: '' }],
      offHires: [{
        reason: '',
        from: '',
        to: '',
        days: '',
        rate: '',
        amount: '',
        bunkers: [{ gradeId: '', qty: '', price: '', amount: '', ownerAccount: false }],
      }],
    };
  }

  const record = await dbGetPeriodContractById(periodId);
  if (!record) {
    throw Object.assign(new Error('Period contract not found.'), { status: 404 });
  }
  return record;
}

export async function updatePeriodContract(periodId, payload, attachments = {}) {
  validatePeriodContractPayload(payload);

  if (!isDbConfigured()) {
    return {
      periodId: Number(periodId) || 999,
      contractId: payload.contractId || MOCK_LOOKUPS.contractId,
      msg: 0,
    };
  }

  return dbUpdatePeriodContract(periodId, payload, attachments);
}

export async function getPeriodLinkedVoyage(periodId) {
  if (!isDbConfigured()) {
    return {
      type: 'vc',
      id: '1001',
      voyageNo: '260001',
    };
  }

  const voyage = await dbGetPeriodLinkedVoyage(periodId);
  if (!voyage) {
    throw Object.assign(new Error('No fixed voyage found for this period contract.'), { status: 404 });
  }
  return voyage;
}

export async function getPeriodNominations(periodId, { businessType } = {}) {
  if (!isDbConfigured()) {
    return {
      periodId: Number(periodId) || 1,
      contractId: 'PERIOD-001-2026',
      contractNo: 'PER-01/2026',
      workingCurrency: 'USD',
      voyages: [
        {
          index: 1,
          fcaId: '1001',
          comId: '10',
          vesselName: 'ATLANTIC STAR',
          voyageNo: '260001',
          cpDate: '01-01-2026',
          dwt: '105000',
          lpDp: 'Singapore/ Rotterdam',
          duration: '42.00',
          cargoQuantity: '65000',
          netTce: '18500.00',
          profitLoss: '777000.00',
        },
      ],
      tcEstimates: [],
    };
  }

  const data = await dbGetPeriodNominations(periodId, { businessType });
  if (!data) {
    throw Object.assign(new Error('Period contract not found.'), { status: 404 });
  }
  return data;
}
