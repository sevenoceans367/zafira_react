import { isDbConfigured } from '../config.js';
import {
  dbCreateVesselType,
  dbGetVesselType,
  dbGetVesselTypeLookups,
  dbListVesselTypes,
  dbUpdateVesselType,
} from './vesselTypeDb.js';

const MOCK = [
  {
    id: 1,
    index: 1,
    name: 'VLGC',
    businessTypeId: '1',
    businessTypeName: 'Gas',
    status: 1,
    statusLabel: 'Active',
    isActive: true,
  },
];

export async function getVesselTypeLookups() {
  if (!isDbConfigured()) return { businessTypes: [{ id: 1, name: 'Gas' }] };
  return dbGetVesselTypeLookups();
}

export async function listVesselTypes() {
  if (!isDbConfigured()) return { records: MOCK, recordsTotal: MOCK.length };
  return dbListVesselTypes();
}

export async function getVesselType(id) {
  if (!isDbConfigured()) return MOCK.find((r) => String(r.id) === String(id)) ?? null;
  return dbGetVesselType(id);
}

export async function createVesselType(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateVesselType(payload);
}

export async function updateVesselType(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateVesselType(id, payload);
}
