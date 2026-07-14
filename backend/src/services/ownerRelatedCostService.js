import { isDbConfigured } from '../config.js';
import {
  dbCreateOwnerRelatedCost,
  dbGetOwnerRelatedCost,
  dbListOwnerRelatedCosts,
  dbUpdateOwnerRelatedCost,
  dbUpdateOwnerRelatedCostStatus,
} from './ownerRelatedCostDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'ILOHC',
    expenseClassGroup: '',
    expenseClass: '',
    accountingType: '',
    postingType: '',
    conditionType: '',
    partnerNumber: '',
    currencyKey: 'USD',
    taxCode: '',
    rdoStatus: 1,
    status: 1,
    isActive: true,
  },
];

export async function listOwnerRelatedCosts() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListOwnerRelatedCosts();
}

export async function getOwnerRelatedCost(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetOwnerRelatedCost(id);
}

export async function updateOwnerRelatedCostStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateOwnerRelatedCostStatus(id, currentStatus);
}

export async function createOwnerRelatedCost(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateOwnerRelatedCost(payload);
}

export async function updateOwnerRelatedCost(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateOwnerRelatedCost(id, payload);
}
