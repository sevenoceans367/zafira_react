import { isDbConfigured } from '../config.js';
import {
  dbCreateAgencyFeeRecord,
  dbGetAgencyFeeRecord,
  dbGetAgencyFeeRecordLookups,
  dbListAgencyFeeRecords,
  dbSearchMasterPorts,
  dbUpdateAgencyFeeRecord,
  dbUpdateAgencyFeeRecordStatus,
} from './agencyFeeRecordDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    agentId: 'SO01',
    agentName: 'Seven Oceans',
    portId: '101',
    portName: 'Singapore (SG)',
    date: '07-Jul-2026',
    dateValue: '2026-07-07',
    fee: '1500',
    sundries: '250',
    vendorTypeId: '1',
    currencyId: 'USD',
    status: 1,
    isActive: true,
  },
];

const MOCK_LOOKUPS = {
  vendorTypes: [{ id: '1', name: 'Agent' }],
  agents: [{ id: 'SO01', name: 'Seven Oceans ( SO01 )' }],
  currencies: [
    { id: 'USD', name: 'United States Dollar (USD)' },
    { id: 'EUR', name: 'Euro (EUR)' },
  ],
};

export async function getAgencyFeeRecordLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetAgencyFeeRecordLookups();
}

export async function listAgencyFeeRecords() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListAgencyFeeRecords();
}

export async function getAgencyFeeRecord(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetAgencyFeeRecord(id);
}

export async function updateAgencyFeeRecordStatus(id, currentStatus) {
  if (!isDbConfigured()) return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  return dbUpdateAgencyFeeRecordStatus(id, currentStatus);
}

export async function createAgencyFeeRecord(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateAgencyFeeRecord(payload);
}

export async function updateAgencyFeeRecord(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateAgencyFeeRecord(id, payload);
}

export async function searchMasterPorts(query) {
  if (!isDbConfigured()) {
    const term = String(query || '').toLowerCase();
    return [
      { id: '101', name: 'Singapore (SG)' },
      { id: '102', name: 'Dubai (AE)' },
    ].filter((row) => row.name.toLowerCase().includes(term));
  }
  return dbSearchMasterPorts(query);
}
