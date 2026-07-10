import { isDbConfigured } from '../config.js';
import {
  dbCreateElibraryCategory,
  dbGetElibraryCategory,
  dbListElibraryCategories,
  dbUpdateElibraryCategory,
  dbUpdateElibraryCategoryStatus,
} from './elibraryCategoryDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Contracts',
    status: 1,
    isActive: true,
  },
];

export async function listElibraryCategories() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListElibraryCategories();
}

export async function getElibraryCategory(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetElibraryCategory(id);
}

export async function updateElibraryCategoryStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateElibraryCategoryStatus(id, currentStatus);
}

export async function createElibraryCategory(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateElibraryCategory(payload);
}

export async function updateElibraryCategory(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateElibraryCategory(id, payload);
}
