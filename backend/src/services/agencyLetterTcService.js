import { isDbConfigured } from '../config.js';
import {
  dbDeleteAgencyLetterTc,
  dbGetAgencyLetterTcForm,
  dbSaveAgencyLetterTc,
} from './agencyLetterTcDb.js';

const MOCK_FORM = {
  comId: '1001',
  tcOutId: '5001',
  tcNo: '25001',
  nomId: '26-TC-001',
  vesselName: 'ATLANTIC STAR',
  mastersNameDefault: 'Capt. Smith',
  draft: null,
  records: [],
  lookups: {
    agents: [
      { id: 'AG001', name: 'Port Agent ( AG001 )', detail: 'Port Agent /att. Ops Desk (agent@example.com)' },
    ],
    shipOwners: [
      { id: 'OWN1', name: 'Ocean Owners ( OWN1 )', detail: 'Ocean Owners, Harbour Road' },
    ],
    ports: [
      { id: '10', name: 'Singapore' },
      { id: '20', name: 'Mundra' },
    ],
    purposes: [
      { id: '1', name: 'Loading' },
      { id: '2', name: 'Discharge' },
    ],
  },
};

let mockForm = structuredClone(MOCK_FORM);
let mockNextId = 9001;

export async function getAgencyLetterTcForm(comId) {
  if (isDbConfigured()) return dbGetAgencyLetterTcForm(comId);
  if (String(comId) !== String(mockForm.comId)) {
    const error = new Error('TC nomination not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(mockForm);
}

export async function saveAgencyLetterTc(payload = {}) {
  if (isDbConfigured()) return dbSaveAgencyLetterTc(payload);

  if (String(payload.comId) !== String(mockForm.comId)) {
    const error = new Error('TC nomination not found.');
    error.status = 404;
    throw error;
  }

  const updateStatus = Number(payload.updateStatus) === 2 ? 2 : 1;
  const agent = mockForm.lookups.agents.find((a) => a.id === String(payload.vendorId));
  const port = mockForm.lookups.ports.find((p) => p.id === String(payload.portOfCall));
  const purpose = mockForm.lookups.purposes.find((p) => p.id === String(payload.purposeOfCall));

  if (mockForm.draft && !payload.genAgencyTcId) {
    return { msg: 1 };
  }

  const genAgencyTcId = payload.genAgencyTcId || String(mockNextId++);
  const record = {
    index: mockForm.records.length + 1,
    genAgencyTcId,
    date: String(payload.date || '').replace(/^(\d{2})-(\d{2})-(\d{4})$/, (_, d, m, y) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d}-${months[Number(m) - 1]}-${y}`;
    }),
    portName: port?.name || '',
    purposeName: purpose?.name || '',
    agentName: agent?.name?.replace(/\s*\([^)]*\)\s*$/, '') || '',
    status: updateStatus,
  };

  mockForm.draft = updateStatus === 1
    ? {
      genAgencyTcId,
      date: payload.date || '',
      vesselName: payload.vesselName || mockForm.vesselName,
      vendorId: String(payload.vendorId || ''),
      portOfCall: String(payload.portOfCall || ''),
      purposeOfCall: String(payload.purposeOfCall || ''),
      mastersName: payload.mastersName || '',
      shipOwner: String(payload.shipOwner || ''),
      mainDescription: payload.mainDescription || '',
      status: 1,
    }
    : null;

  const existingIdx = mockForm.records.findIndex((r) => String(r.genAgencyTcId) === String(genAgencyTcId));
  if (existingIdx >= 0) {
    mockForm.records[existingIdx] = { ...mockForm.records[existingIdx], ...record, index: existingIdx + 1 };
  } else {
    mockForm.records.push(record);
  }
  mockForm.records = mockForm.records.map((row, i) => ({ ...row, index: i + 1 }));

  return { msg: 0, genAgencyTcId, updateStatus };
}

export async function deleteAgencyLetterTc(genAgencyTcId) {
  if (isDbConfigured()) return dbDeleteAgencyLetterTc(genAgencyTcId);
  const before = mockForm.records.length;
  mockForm.records = mockForm.records
    .filter((row) => String(row.genAgencyTcId) !== String(genAgencyTcId))
    .map((row, i) => ({ ...row, index: i + 1 }));
  if (String(mockForm.draft?.genAgencyTcId) === String(genAgencyTcId)) {
    mockForm.draft = null;
  }
  if (mockForm.records.length === before) {
    const error = new Error('Agency letter not found.');
    error.status = 404;
    throw error;
  }
  return { msg: 0 };
}

export function __resetAgencyLetterTcMockForTests() {
  mockForm = structuredClone(MOCK_FORM);
  mockNextId = 9001;
}
