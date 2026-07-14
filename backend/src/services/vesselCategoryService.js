import { isDbConfigured } from '../config.js';
import {
  dbCreateVesselCategory,
  dbGetVesselCategory,
  dbListVesselCategories,
  dbUpdateVesselCategory,
  dbUpdateVesselCategoryStatus,
} from './vesselCategoryDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Panamax',
    description: 'Panamax category',
    size: '75000',
    status: 1,
    isActive: true,
  },
];

export async function listVesselCategories() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListVesselCategories();
}

export async function getVesselCategory(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetVesselCategory(id);
}

export async function updateVesselCategoryStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateVesselCategoryStatus(id, currentStatus);
}

export async function createVesselCategory(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateVesselCategory(payload);
}

export async function updateVesselCategory(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateVesselCategory(id, payload);
}
