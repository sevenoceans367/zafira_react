import { isDbConfigured } from '../config.js';
import {
  dbCreatePortInformation,
  dbGetPortInformation,
  dbGetPortInformationLookups,
  dbGetTerminalsByPort,
  dbListPortInformation,
  dbUpdatePortInformation,
  dbUpdatePortInformationStatus,
} from './portInformationDb.js';

const MOCK_LOOKUPS = {
  cargos: [{ id: '1', name: 'Crude Oil (CRD)' }],
  loaders: [
    { id: '1', name: 'Yes' },
    { id: '2', name: 'No' },
  ],
};

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    portCode: 'SGSIN',
    portName: 'Singapore(SGSIN)',
    cargoId: '1',
    cargoName: 'Crude Oil',
    terminalId: '1',
    terminalName: 'Demo Terminal',
    maxDraft: '12',
    maxLoa: '200',
    maxBeam: '32',
    maxHeight: '40',
    loadingMethod: 'Conveyor',
    loadingRateDay: '10000',
    dischRateDay: '8000',
    loadingRateHr: '0',
    dischRateHr: '0',
    dwt: '50000',
    dcts: '15',
    loader: '1',
    remarks: 'Sample',
    displacement: '60000',
    craneOutReach: '20',
    hatchDimension: '10x10',
    status: 1,
  },
];

export async function getPortInformationLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetPortInformationLookups();
}

export async function getPortInformationTerminals(portIdOrCode) {
  if (!isDbConfigured()) {
    return {
      portCode: 'SGSIN',
      terminals: [{ id: '1', name: 'Demo Terminal' }],
    };
  }
  return dbGetTerminalsByPort(portIdOrCode);
}

export async function listPortInformation() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListPortInformation();
}

export async function getPortInformation(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetPortInformation(id);
}

export async function createPortInformation(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreatePortInformation(payload);
}

export async function updatePortInformation(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdatePortInformation(id, payload);
}

export async function updatePortInformationStatus(id, status) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(status) === 1 ? 2 : 1 };
  }
  return dbUpdatePortInformationStatus(id, status);
}
