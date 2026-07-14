import { isDbConfigured } from '../config.js';
import {
  dbCreatePcctf,
  dbGetPcctf,
  dbGetPcctfLookups,
  dbListPcctf,
  dbUpdatePcctf,
  dbUpdatePcctfStatus,
} from './pcctfDb.js';

const MOCK_LOOKUPS = {
  businessTypes: [
    { id: 1, name: 'Gas' },
    { id: 2, name: 'Tanker' },
    { id: 3, name: 'Dry Cargo' },
  ],
  vesselCategories: [
    { id: 1, name: 'Neopanamax' },
    { id: 2, name: 'Panamax' },
  ],
};

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    businessTypeId: '2',
    businessTypeName: 'Tanker',
    vesselCategoryId: '1',
    vesselCategoryName: 'Neopanamax',
    rate: '5.5',
    status: 1,
    isActive: true,
  },
];

export async function getPcctfLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetPcctfLookups();
}

export async function listPcctf() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListPcctf();
}

export async function getPcctf(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetPcctf(id);
}

export async function updatePcctfStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdatePcctfStatus(id, currentStatus);
}

export async function createPcctf(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreatePcctf(payload);
}

export async function updatePcctf(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdatePcctf(id, payload);
}
