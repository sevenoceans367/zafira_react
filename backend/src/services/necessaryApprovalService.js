import { isDbConfigured } from '../config.js';
import {
  dbCreateNecessaryApproval,
  dbGetNecessaryApproval,
  dbListNecessaryApprovals,
  dbUpdateNecessaryApproval,
  dbUpdateNecessaryApprovalStatus,
} from './necessaryApprovalDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Class Society',
    description: 'Required class society approval',
    status: 1,
    isActive: true,
  },
];

export async function listNecessaryApprovals() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListNecessaryApprovals();
}

export async function getNecessaryApproval(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetNecessaryApproval(id);
}

export async function updateNecessaryApprovalStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateNecessaryApprovalStatus(id, currentStatus);
}

export async function createNecessaryApproval(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateNecessaryApproval(payload);
}

export async function updateNecessaryApproval(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateNecessaryApproval(id, payload);
}
