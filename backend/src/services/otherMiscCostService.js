import { isDbConfigured } from '../config.js';
import {
  dbCreateOtherMiscCost,
  dbGetOtherMiscCost,
  dbListOtherMiscCosts,
  dbUpdateOtherMiscCost,
  dbUpdateOtherMiscCostStatus,
} from './otherMiscCostDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Misc Fee',
    expenseClassGroup: '',
    expenseClass: '',
    accountingType: '',
    postingType: '',
    conditionType: '',
    partnerNumber: '',
    currencyKey: 'USD',
    taxCode: '',
    status: 1,
    isActive: true,
  },
];

export async function listOtherMiscCosts() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListOtherMiscCosts();
}

export async function getOtherMiscCost(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetOtherMiscCost(id);
}

export async function updateOtherMiscCostStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateOtherMiscCostStatus(id, currentStatus);
}

export async function createOtherMiscCost(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateOtherMiscCost(payload);
}

export async function updateOtherMiscCost(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateOtherMiscCost(id, payload);
}
