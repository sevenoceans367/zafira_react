import { isDbConfigured } from '../config.js';
import {
  dbCreateScnt,
  dbGetScnt,
  dbGetScntLookups,
  dbListScnt,
  dbUpdateScnt,
  dbUpdateScntStatus,
} from './scntDb.js';

const MOCK = [{ id: 1, index: 1, businessTypeId: '1', businessTypeName: 'Gas', vesselTypeId: '1', vesselTypeName: 'VLGC', fromRange: '0', toRange: '100', percent: '10', status: 1, isActive: true }];

export async function getScntLookups() {
  if (!isDbConfigured()) return { businessTypes: [{ id: 1, name: 'Gas' }], vesselTypes: [{ id: '1', name: 'VLGC', businessTypeId: '1' }] };
  return dbGetScntLookups();
}
export async function listScnt() {
  if (!isDbConfigured()) return { records: MOCK, recordsTotal: MOCK.length };
  return dbListScnt();
}
export async function getScnt(id) {
  if (!isDbConfigured()) return MOCK.find((r) => String(r.id) === String(id)) ?? null;
  return dbGetScnt(id);
}
export async function createScnt(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateScnt(payload);
}
export async function updateScnt(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateScnt(id, payload);
}
export async function updateScntStatus(id, status) {
  if (!isDbConfigured()) return { msg: 2, status: Number(status) === 1 ? 2 : 1 };
  return dbUpdateScntStatus(id, status);
}
