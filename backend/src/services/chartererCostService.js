import { isDbConfigured } from '../config.js';
import {
  dbCreateChartererCost,
  dbGetChartererCost,
  dbListChartererCosts,
  dbUpdateChartererCost,
  dbUpdateChartererCostStatus,
} from './chartererCostDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Demurrage',
    status: 1,
    isActive: true,
  },
];

export async function listChartererCosts() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListChartererCosts();
}

export async function getChartererCost(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetChartererCost(id);
}

export async function updateChartererCostStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateChartererCostStatus(id, currentStatus);
}

export async function createChartererCost(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateChartererCost(payload);
}

export async function updateChartererCost(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateChartererCost(id, payload);
}
