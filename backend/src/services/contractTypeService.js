import { isDbConfigured } from '../config.js';
import {
  dbCreateContractType,
  dbGetContractType,
  dbListContractTypes,
  dbUpdateContractType,
  dbUpdateContractTypeStatus,
} from './contractTypeDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Time Charter',
    description: 'Period time charter',
    status: 1,
    isActive: true,
  },
];

export async function listContractTypes() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListContractTypes();
}

export async function getContractType(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetContractType(id);
}

export async function updateContractTypeStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateContractTypeStatus(id, currentStatus);
}

export async function createContractType(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateContractType(payload);
}

export async function updateContractType(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateContractType(id, payload);
}
