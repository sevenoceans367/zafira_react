import { isDbConfigured } from '../config.js';
import {
  dbDeleteAgencyLetter,
  dbGetAgencyLetterForm,
  dbSaveAgencyLetter,
} from './agencyLetterDb.js';

const MOCK_FORM = {
  comId: '1001',
  costSheetId: '2001',
  nomId: '26-001',
  vesselName: 'ATLANTIC STAR',
  cargoDefault: 'Coal',
  toleranceDefault: '10%',
  agencyNumber: '001',
  lookups: {
    entityTypes: [
      { id: '2', name: 'Agent' },
      { id: '1', name: 'Charterer' },
    ],
    countries: [
      { id: '1', name: 'Singapore' },
      { id: '2', name: 'India' },
    ],
    shipOwners: [
      { id: 'OWN1', name: 'Ocean Owners (OWN1)' },
    ],
    ports: [
      { id: '10', name: 'Singapore' },
      { id: '20', name: 'Mundra' },
    ],
  },
  ports: [
    {
      key: 'LP-10-101',
      tabLabel: 'LP-Singapore',
      portType: 'LP',
      portId: '10',
      portName: 'Singapore',
      randomId: '101',
      agentCode: 'AG001',
      agentName: 'Port Agent (AG001)',
      qty: '50000',
      defaultEntityName: 'Ops Desk',
      defaultEntityEmail: 'agent@example.com',
      etaFixture: '18-01-2026 08:00',
      defaultUsername: 'ZAF/001/101',
      letter: null,
      entities: [{ entity: '2', name: 'Ops Desk', email: 'agent@example.com' }],
      bunkers: [{ bunkerPort: '', grade: '', supplier: '', physical: '', quantity: '' }],
      records: [],
      locked: false,
    },
  ],
};

let mockForm = structuredClone(MOCK_FORM);
let mockNextId = 5001;

export async function getAgencyLetterForm(comId) {
  if (isDbConfigured()) return dbGetAgencyLetterForm(comId);
  if (String(comId) !== String(mockForm.comId)) {
    const error = new Error('Ops voyage not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(mockForm);
}

export async function saveAgencyLetter(payload = {}) {
  if (isDbConfigured()) return dbSaveAgencyLetter(payload);
  const port = mockForm.ports.find((item) => item.key === `${payload.portType}-${payload.portId}-${payload.randomId}`);
  if (!port) {
    const error = new Error('Port tab not found.');
    error.status = 404;
    throw error;
  }
  if (!payload.etaDate1) {
    const error = new Error('Please add ETA Date.');
    error.status = 400;
    throw error;
  }
  if (!payload.countryId) {
    const error = new Error('Please add country for this port.');
    error.status = 400;
    throw error;
  }

  const genAgencyId = payload.genAgencyId || mockNextId++;
  const letter = {
    genAgencyId,
    date: payload.date || '',
    qty: payload.qty || '',
    countryId: String(payload.countryId || ''),
    countryName: mockForm.lookups.countries.find((c) => c.id === String(payload.countryId))?.name || '',
    username: payload.username || port.defaultUsername,
    password: payload.password || '',
    etaDate1: payload.etaDate1 || '',
    masterName: payload.masterName || '',
    cargoDetails: payload.cargoDetails || '',
    tolerance: payload.tolerance || '',
    shipOwner: payload.shipOwner || '',
    etaDate: payload.etaDate || '',
    bunkerSurveyor: payload.bunkerSurveyor || '',
    bunkerSurveyorCom: payload.bunkerSurveyorCom || '',
    status: Number(payload.submitId) === 2 ? 2 : 1,
    vendorId: payload.vendorId || port.agentCode,
  };

  port.letter = letter;
  port.entities = Array.isArray(payload.entities) && payload.entities.length
    ? payload.entities
    : port.entities;
  port.bunkers = Array.isArray(payload.bunkers) && payload.bunkers.length
    ? payload.bunkers
    : port.bunkers;
  port.locked = letter.status === 2;
  port.records = [{
    index: 1,
    genAgencyId,
    countryName: letter.countryName,
    portName: port.portName,
    cargoDetails: letter.cargoDetails,
    agentName: port.agentName,
    date: letter.date,
    username: letter.username,
    password: letter.password,
    portType: port.portType,
    vendorId: letter.vendorId,
    randomId: port.randomId,
    portId: port.portId,
  }];

  return { msg: 0, genAgencyId, submitId: letter.status };
}

export async function deleteAgencyLetter(genAgencyId) {
  if (isDbConfigured()) return dbDeleteAgencyLetter(genAgencyId);
  for (const port of mockForm.ports) {
    const before = port.records.length;
    port.records = port.records.filter((row) => String(row.genAgencyId) !== String(genAgencyId));
    if (port.records.length !== before) {
      if (String(port.letter?.genAgencyId) === String(genAgencyId)) {
        port.letter = null;
        port.locked = false;
      }
      return { msg: 0 };
    }
  }
  const error = new Error('Agency letter not found.');
  error.status = 404;
  throw error;
}

export function __resetAgencyLetterMockForTests() {
  mockForm = structuredClone(MOCK_FORM);
  mockNextId = 5001;
}
