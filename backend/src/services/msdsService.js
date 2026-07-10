import { isDbConfigured } from '../config.js';
import {
  dbCreateMsds,
  dbDeleteMsds,
  dbGetMsds,
  dbGetMsdsLookups,
  dbListMsds,
  dbUpdateMsds,
} from './msdsDb.js';

const MOCK_LOOKUPS = {
  cargos: [{ id: '1', name: 'Crude Oil' }],
  shippers: [{ id: '1', name: 'Demo Shipper ( SHIP )' }],
};

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    materialId: '1',
    cargoName: 'Crude Oil',
    portId: '1',
    portName: 'Singapore (SG)',
    vendorId: '1',
    shipperName: 'Demo Shipper ( SHIP )',
    remarks: 'Sample MSDS',
    upload: '',
    attachments: [],
    status: 1,
  },
];

export async function getMsdsLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetMsdsLookups();
}

export async function listMsds() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListMsds();
}

export async function getMsds(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetMsds(id);
}

export async function createMsds(payload, upload = '') {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateMsds(payload, upload);
}

export async function updateMsds(id, payload, upload = '') {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateMsds(id, payload, upload);
}

export async function deleteMsds(id) {
  if (!isDbConfigured()) return { msg: 2 };
  return dbDeleteMsds(id);
}
