import { isDbConfigured } from '../config.js';
import {
  dbCreateBunkerGrade,
  dbGetBunkerGrade,
  dbListBunkerGrades,
  dbUpdateBunkerGrade,
  dbUpdateBunkerGradeStatus,
} from './bunkerGradeDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'VLSFO',
    fuelGrade: 'VLSFO',
    bunkerType: 'IFO',
    lcv: '40.2',
    co2Fac: '3.114',
    ch4Fac: '0',
    n2oFac: '0',
    co2Wt: '',
    penalty: '',
    intensity2025: '',
    intensity2026: '',
    intensity2027: '',
    intensity2028: '',
    intensity2029: '',
    ghg2025: '',
    ghg2026: '',
    ghg2027: '',
    ghg2028: '',
    ghg2029: '',
    rate2025: '',
    rate2026: '',
    rate2027: '',
    rate2028: '',
    rate2029: '',
    status: 1,
    isActive: true,
  },
];

export async function listBunkerGrades() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListBunkerGrades();
}

export async function getBunkerGrade(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetBunkerGrade(id);
}

export async function updateBunkerGradeStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateBunkerGradeStatus(id, currentStatus);
}

export async function createBunkerGrade(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateBunkerGrade(payload);
}

export async function updateBunkerGrade(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateBunkerGrade(id, payload);
}
