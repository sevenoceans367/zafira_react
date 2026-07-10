import { isDbConfigured } from '../config.js';
import {
  dbCreateLawArbitration,
  dbGetLawArbitration,
  dbListLawArbitrations,
  dbUpdateLawArbitration,
  dbUpdateLawArbitrationStatus,
} from './lawArbitrationDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'English Law / London Arbitration',
    status: 1,
    isActive: true,
  },
];

export async function listLawArbitrations() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListLawArbitrations();
}

export async function getLawArbitration(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetLawArbitration(id);
}

export async function updateLawArbitrationStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateLawArbitrationStatus(id, currentStatus);
}

export async function createLawArbitration(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateLawArbitration(payload);
}

export async function updateLawArbitration(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateLawArbitration(id, payload);
}
