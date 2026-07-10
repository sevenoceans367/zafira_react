import { isDbConfigured } from '../config.js';
import {
  dbCreateCoaRoute,
  dbGetCoaRoute,
  dbListCoaRoutes,
  dbUpdateCoaRoute,
  dbUpdateCoaRouteStatus,
} from './coaRouteDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'AG–Far East',
    description: 'Arabian Gulf to Far East',
    status: 1,
    isActive: true,
  },
];

export async function listCoaRoutes() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListCoaRoutes();
}

export async function getCoaRoute(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetCoaRoute(id);
}

export async function updateCoaRouteStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateCoaRouteStatus(id, currentStatus);
}

export async function createCoaRoute(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateCoaRoute(payload);
}

export async function updateCoaRoute(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateCoaRoute(id, payload);
}
