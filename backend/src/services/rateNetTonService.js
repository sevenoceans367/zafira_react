import { isDbConfigured } from '../config.js';
import {
  dbCreateRateNetTon,
  dbGetRateNetTon,
  dbGetRateNetTonLookups,
  dbListRateNetTons,
  dbUpdateRateNetTon,
  dbUpdateRateNetTonStatus,
} from './rateNetTonDb.js';

const MOCK = [{ id: 1, index: 1, fromPeriod: '2024-01-01', toPeriod: '2024-12-31', periodLabel: '2024-01-01 - 2024-12-31', rate: '1.5', businessTypeId: '1', businessTypeName: 'Gas', status: 1, isActive: true }];

export async function getRateNetTonLookups() {
  if (!isDbConfigured()) return { businessTypes: [{ id: 1, name: 'Gas' }] };
  return dbGetRateNetTonLookups();
}
export async function listRateNetTons() {
  if (!isDbConfigured()) return { records: MOCK, recordsTotal: MOCK.length };
  return dbListRateNetTons();
}
export async function getRateNetTon(id) {
  if (!isDbConfigured()) return MOCK.find((r) => String(r.id) === String(id)) ?? null;
  return dbGetRateNetTon(id);
}
export async function createRateNetTon(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateRateNetTon(payload);
}
export async function updateRateNetTon(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateRateNetTon(id, payload);
}
export async function updateRateNetTonStatus(id, status) {
  if (!isDbConfigured()) return { msg: 2, status: Number(status) === 1 ? 2 : 1 };
  return dbUpdateRateNetTonStatus(id, status);
}
