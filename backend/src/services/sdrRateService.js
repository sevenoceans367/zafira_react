import { isDbConfigured } from '../config.js';
import {
  dbCreateSdrRate,
  dbGetSdrRate,
  dbGetSdrRateLookups,
  dbListSdrRates,
  dbUpdateSdrRate,
  dbUpdateSdrRateStatus,
} from './sdrRateDb.js';

const MOCK = [{ id: 1, index: 1, businessTypeId: '1', businessTypeName: 'Gas', scntBracket: '0-100', sdrToUse: '1', sdrRateBallast: '1', sdrRateLadenCrude: '1', sdrRateLadenProducts: '1', status: 1, isActive: true }];

export async function getSdrRateLookups() {
  if (!isDbConfigured()) return { businessTypes: [{ id: 1, name: 'Gas' }] };
  return dbGetSdrRateLookups();
}
export async function listSdrRates() {
  if (!isDbConfigured()) return { records: MOCK, recordsTotal: MOCK.length };
  return dbListSdrRates();
}
export async function getSdrRate(id) {
  if (!isDbConfigured()) return MOCK.find((r) => String(r.id) === String(id)) ?? null;
  return dbGetSdrRate(id);
}
export async function createSdrRate(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateSdrRate(payload);
}
export async function updateSdrRate(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateSdrRate(id, payload);
}
export async function updateSdrRateStatus(id, status) {
  if (!isDbConfigured()) return { msg: 2, status: Number(status) === 1 ? 2 : 1 };
  return dbUpdateSdrRateStatus(id, status);
}
