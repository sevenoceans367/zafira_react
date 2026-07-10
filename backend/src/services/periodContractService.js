import { isDbConfigured } from '../config.js';
import { dbCreatePeriodContract } from './periodContractCreateDb.js';
import { dbGetPeriodContractList } from './periodContractDb.js';
import {
  dbGetNextPeriodContractId,
  dbGetPeriodContractLookups,
  dbSearchPorts,
} from './periodContractLookupsDb.js';

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

export async function createPeriodContract(payload, attachments = {}) {
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
