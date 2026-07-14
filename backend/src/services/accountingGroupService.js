import { isDbConfigured } from '../config.js';
import {
  dbCreateAccountingGroup,
  dbGetAccountingGroup,
  dbListAccountingGroups,
  dbUpdateAccountingGroup,
  dbUpdateAccountingGroupStatus,
} from './accountingGroupDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Voyage Expenses',
    status: 1,
    isActive: true,
  },
];

export async function listAccountingGroups() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListAccountingGroups();
}

export async function getAccountingGroup(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetAccountingGroup(id);
}

export async function updateAccountingGroupStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateAccountingGroupStatus(id, currentStatus);
}

export async function createAccountingGroup(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateAccountingGroup(payload);
}

export async function updateAccountingGroup(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateAccountingGroup(id, payload);
}
