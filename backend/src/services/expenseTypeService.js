import { isDbConfigured } from '../config.js';
import {
  dbCreateExpenseType,
  dbGetExpenseType,
  dbListExpenseTypes,
  dbUpdateExpenseType,
  dbUpdateExpenseTypeStatus,
} from './expenseTypeDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Port Charges',
    description: 'Port-related expenses',
    status: 1,
    isActive: true,
  },
];

export async function listExpenseTypes() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListExpenseTypes();
}

export async function getExpenseType(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetExpenseType(id);
}

export async function updateExpenseTypeStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateExpenseTypeStatus(id, currentStatus);
}

export async function createExpenseType(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateExpenseType(payload);
}

export async function updateExpenseType(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateExpenseType(id, payload);
}
