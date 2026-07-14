import { isDbConfigured } from '../config.js';
import {
  dbCreateTcDeduction,
  dbGetTcDeduction,
  dbListTcDeductions,
  dbUpdateTcDeduction,
  dbUpdateTcDeductionStatus,
} from './tcDeductionDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Brokerage',
    status: 1,
    isActive: true,
  },
];

export async function listTcDeductions() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListTcDeductions();
}

export async function getTcDeduction(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetTcDeduction(id);
}

export async function updateTcDeductionStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateTcDeductionStatus(id, currentStatus);
}

export async function createTcDeduction(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateTcDeduction(payload);
}

export async function updateTcDeduction(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateTcDeduction(id, payload);
}
