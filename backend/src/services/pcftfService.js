import { isDbConfigured } from '../config.js';
import {
  dbCreatePcftf,
  dbGetPcftf,
  dbGetPcftfLookups,
  dbListPcftf,
  dbUpdatePcftf,
  dbUpdatePcftfStatus,
} from './pcftfDb.js';

const MOCK_LOOKUPS = {
  vesselCategories: [
    { id: 1, name: 'Neopanamax' },
    { id: 2, name: 'Panamax' },
  ],
};

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    vesselCategoryId: '1',
    vesselCategoryName: 'Neopanamax',
    lockUsed: 'Agua Clara',
    fromDwt: '0',
    toDwt: '50000',
    fee: '10000',
    status: 1,
    isActive: true,
  },
];

export async function getPcftfLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetPcftfLookups();
}

export async function listPcftf() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListPcftf();
}

export async function getPcftf(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetPcftf(id);
}

export async function updatePcftfStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdatePcftfStatus(id, currentStatus);
}

export async function createPcftf(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreatePcftf(payload);
}

export async function updatePcftf(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdatePcftf(id, payload);
}
