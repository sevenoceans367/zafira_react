import { isDbConfigured } from '../config.js';
import {
  dbCreateLoadOption,
  dbGetLoadOption,
  dbListLoadOptions,
  dbUpdateLoadOption,
  dbUpdateLoadOptionStatus,
} from './loadOptionDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'FOB',
    status: 1,
    isActive: true,
  },
];

export async function listLoadOptions() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListLoadOptions();
}

export async function getLoadOption(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetLoadOption(id);
}

export async function updateLoadOptionStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateLoadOptionStatus(id, currentStatus);
}

export async function createLoadOption(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateLoadOption(payload);
}

export async function updateLoadOption(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateLoadOption(id, payload);
}
