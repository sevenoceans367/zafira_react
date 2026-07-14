import { isDbConfigured } from '../config.js';
import {
  dbCreateOtherShippingCost,
  dbGetOtherShippingCost,
  dbListOtherShippingCosts,
  dbUpdateOtherShippingCost,
  dbUpdateOtherShippingCostStatus,
} from './otherShippingCostDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Canal Toll',
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

export async function listOtherShippingCosts() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListOtherShippingCosts();
}

export async function getOtherShippingCost(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetOtherShippingCost(id);
}

export async function updateOtherShippingCostStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateOtherShippingCostStatus(id, currentStatus);
}

export async function createOtherShippingCost(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateOtherShippingCost(payload);
}

export async function updateOtherShippingCost(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateOtherShippingCost(id, payload);
}
