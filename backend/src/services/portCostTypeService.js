import { isDbConfigured } from '../config.js';
import {
  dbCreatePortCostTypes,
  dbGetPortCostType,
  dbGetPortCostTypeLookups,
  dbListPortCostTypes,
  dbUpdatePortCostType,
  dbUpdatePortCostTypeStatus,
} from './portCostTypeDb.js';

const MOCK_LOOKUPS = {
  countries: [
    { id: 1, name: 'Singapore' },
    { id: 2, name: 'United Arab Emirates' },
  ],
};

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Agency Fee',
    countryIds: ['1'],
    countryNames: 'Singapore',
    status: 1,
    isActive: true,
  },
];

export async function getPortCostTypeLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetPortCostTypeLookups();
}

export async function listPortCostTypes() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListPortCostTypes();
}

export async function getPortCostType(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetPortCostType(id);
}

export async function updatePortCostTypeStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdatePortCostTypeStatus(id, currentStatus);
}

export async function createPortCostTypes(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreatePortCostTypes(payload);
}

export async function updatePortCostType(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdatePortCostType(id, payload);
}
