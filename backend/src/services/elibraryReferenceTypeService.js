import { isDbConfigured } from '../config.js';
import {
  dbCreateElibraryReferenceType,
  dbGetElibraryReferenceType,
  dbListElibraryReferenceTypes,
  dbUpdateElibraryReferenceType,
  dbUpdateElibraryReferenceTypeStatus,
} from './elibraryReferenceTypeDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Circular',
    status: 1,
    isActive: true,
  },
];

export async function listElibraryReferenceTypes() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListElibraryReferenceTypes();
}

export async function getElibraryReferenceType(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetElibraryReferenceType(id);
}

export async function updateElibraryReferenceTypeStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateElibraryReferenceTypeStatus(id, currentStatus);
}

export async function createElibraryReferenceType(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateElibraryReferenceType(payload);
}

export async function updateElibraryReferenceType(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateElibraryReferenceType(id, payload);
}
