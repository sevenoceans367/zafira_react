import { isDbConfigured } from '../config.js';
import {
  dbCreateEstimatedRatio,
  dbGetEstimatedRatio,
  dbGetEstimatedRatioLookups,
  dbListEstimatedRatios,
  dbUpdateEstimatedRatio,
  dbUpdateEstimatedRatioStatus,
} from './estimatedRatioDb.js';

const MOCK_LOOKUPS = {
  businessTypes: [
    { id: 1, name: 'Gas' },
    { id: 2, name: 'Tanker' },
    { id: 3, name: 'Dry Cargo' },
  ],
  vesselCategories: [{ id: 12, name: 'Regular' }],
};

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    businessTypeId: '2',
    businessTypeName: 'Tanker',
    vesselCategoryId: '12',
    vesselCategoryName: 'Regular',
    dwt: '35000.00',
    percent: '45.00',
    status: 1,
    isActive: true,
  },
];

export async function getEstimatedRatioLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetEstimatedRatioLookups();
}

export async function listEstimatedRatios() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListEstimatedRatios();
}

export async function getEstimatedRatio(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetEstimatedRatio(id);
}

export async function updateEstimatedRatioStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateEstimatedRatioStatus(id, currentStatus);
}

export async function createEstimatedRatio(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateEstimatedRatio(payload);
}

export async function updateEstimatedRatio(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateEstimatedRatio(id, payload);
}
