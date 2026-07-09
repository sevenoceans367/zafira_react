import { isDbConfigured } from '../config.js';
import {
  dbGetTankerParticulars,
  dbGetTankerParticularsLookups,
} from './vesselTankerParticularsDb.js';
import { dbUpdateTankerParticulars } from './vesselTankerParticularsUpdateDb.js';
import { TANKER_REQUEST_TO_COLUMN } from './tankerParticularsFieldMap.js';

const MOCK_LOOKUPS = {
  ports: [{ id: '1', name: 'Singapore' }],
  countries: [{ id: '1', name: 'Panama' }],
  classSocieties: [{ id: '5', name: 'DNV' }],
  certificates: [{ id: '1', name: 'Safety Management Certificate' }],
};

function buildEmptyFields() {
  const fields = {
    txtVName: 'ATLANTIC STAR',
    txtIMONumber: '9123456',
    txtTypeOfVessel: 'Aframax',
    selFlag: '1',
    selCLASS_SOC: '5',
  };
  Object.keys(TANKER_REQUEST_TO_COLUMN).forEach((key) => {
    if (fields[key] == null) fields[key] = key.startsWith('rdo') ? '1' : '';
  });
  return fields;
}

const MOCK_DATA = {
  vessel: {
    id: 1001,
    name: 'ATLANTIC STAR',
    imoNo: '9123456',
    flagName: 'Panama',
  },
  updateOnDate: '01-01-2026',
  fields: buildEmptyFields(),
  certificates: [
    {
      id: 1,
      certificateId: '1',
      certificateName: 'Safety Management Certificate',
      dateIssue: '01-01-2024',
      dateLastAnnual: '01-06-2024',
      dateExpiry: '01-01-2029',
      attachments: [],
    },
  ],
  lookups: MOCK_LOOKUPS,
};

export async function getTankerParticularsLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetTankerParticularsLookups();
}

export async function getTankerParticulars(vesselId) {
  if (!isDbConfigured()) {
    return {
      ...MOCK_DATA,
      vessel: { ...MOCK_DATA.vessel, id: Number(vesselId) || MOCK_DATA.vessel.id },
    };
  }
  return dbGetTankerParticulars(vesselId);
}

export async function updateTankerParticulars(vesselId, payload, filesByIndex = {}) {
  if (!isDbConfigured()) {
    return {
      msg: 0,
      vessel: { ...MOCK_DATA.vessel, id: Number(vesselId) || MOCK_DATA.vessel.id },
    };
  }
  await dbUpdateTankerParticulars(vesselId, payload, filesByIndex);
  const data = await dbGetTankerParticulars(vesselId);
  return { msg: 0, ...data };
}
