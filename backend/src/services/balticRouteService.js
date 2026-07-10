import { isDbConfigured } from '../config.js';
import {
  dbCreateBalticRoute,
  dbGetBalticRoute,
  dbListBalticRoutes,
  dbUpdateBalticRoute,
  dbUpdateBalticRouteStatus,
} from './balticRouteDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    code: 'C3',
    name: 'Tubarao–Qingdao',
    status: 1,
    isActive: true,
  },
  {
    id: 2,
    index: 2,
    code: 'C5',
    name: 'W Australia–Qingdao',
    status: 1,
    isActive: true,
  },
];

export async function listBalticRoutes() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListBalticRoutes();
}

export async function getBalticRoute(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetBalticRoute(id);
}

export async function updateBalticRouteStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateBalticRouteStatus(id, currentStatus);
}

export async function createBalticRoute(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateBalticRoute(payload);
}

export async function updateBalticRoute(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateBalticRoute(id, payload);
}
