import { isDbConfigured } from '../config.js';
import {
  dbCreatePortData,
  dbDeletePortData,
  dbGetPortData,
  dbGetPortDataLookups,
  dbListPortData,
  dbUpdatePortData,
} from './portDataDb.js';

const MOCK_LOOKUPS = {
  terminals: [{ id: '1', name: 'Demo Terminal' }],
  cargos: [{ id: '1', name: 'Crude Oil' }],
};

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    portId: '1',
    portName: 'Singapore (SG)',
    terminalId: '1',
    terminalName: 'Demo Terminal',
    materialIds: ['1'],
    materialCodeDesc: 'Crude Oil',
    remarks: 'Sample port data',
    upload: '',
    uploadName: '',
    attachments: [],
    status: 1,
  },
];

export async function getPortDataLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetPortDataLookups();
}

export async function listPortData() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListPortData();
}

export async function getPortData(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetPortData(id);
}

export async function createPortData(payload, upload = '', uploadName = '') {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreatePortData(payload, upload, uploadName);
}

export async function updatePortData(id, payload, upload = '', uploadName = '') {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdatePortData(id, payload, upload, uploadName);
}

export async function deletePortData(id) {
  if (!isDbConfigured()) return { msg: 2 };
  return dbDeletePortData(id);
}
