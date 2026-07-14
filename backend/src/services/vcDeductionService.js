import { isDbConfigured } from '../config.js';
import {
  dbCreateVcDeduction,
  dbGetVcDeduction,
  dbListVcDeductions,
  dbUpdateVcDeduction,
  dbUpdateVcDeductionStatus,
} from './vcDeductionDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Address Commission',
    status: 1,
    isActive: true,
  },
];

export async function listVcDeductions() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListVcDeductions();
}

export async function getVcDeduction(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetVcDeduction(id);
}

export async function updateVcDeductionStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateVcDeductionStatus(id, currentStatus);
}

export async function createVcDeduction(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateVcDeduction(payload);
}

export async function updateVcDeduction(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateVcDeduction(id, payload);
}
