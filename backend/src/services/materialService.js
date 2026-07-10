import { isDbConfigured } from '../config.js';
import {
  dbCreateMaterial,
  dbGetMaterial,
  dbListMaterials,
  dbUpdateMaterial,
  dbUpdateMaterialStatus,
} from './materialDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    materialName: 'Crude Oil',
    materialTypeId: '2',
    materialTypeLabel: 'Tanker',
    materialCode: 'CRUDE',
    materialCodeDesc: 'Crude Oil',
    materialTypeDesc: '',
    materialGroup: '',
    materialGroupDesc: '',
    stowFacMMt: '',
    stowFacFtMt: '',
    status: 1,
    isActive: true,
  },
];

export async function listMaterials() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListMaterials();
}

export async function getMaterial(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetMaterial(id);
}

export async function updateMaterialStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateMaterialStatus(id, currentStatus);
}

export async function createMaterial(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateMaterial(payload);
}

export async function updateMaterial(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateMaterial(id, payload);
}
