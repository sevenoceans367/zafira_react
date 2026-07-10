import { isDbConfigured } from '../config.js';
import {
  dbCreateVesselPrimary,
  dbGetVesselPrimary,
  dbGetVesselPrimaryLookups,
  dbUpdateVesselPrimary,
} from './vesselPrimaryDb.js';

const MOCK_LOOKUPS = {
  vesselTypesByBusiness: {
    1: [{ id: '1', name: 'LNG Carrier' }],
    2: [{ id: '2', name: 'Aframax' }],
    3: [{ id: '3', name: 'Capesize' }],
  },
  countries: [{ id: '1', name: 'Panama' }, { id: '2', name: 'Marshall Islands' }],
  piVendors: [{ id: '10', name: 'P&I Club (PIC01)' }],
  owners: [{ id: '20', name: 'Seven Oceans (SO01)' }],
  classSocieties: [{ id: '5', name: 'DNV' }],
};

const MOCK_VESSEL = {
  vesselImoId: 1001,
  businessTypeId: '3',
  vesselTypeId: '3',
  imoNo: '9123456',
  vesselName: 'ATLANTIC STAR',
  vesselCode: 'ATL01',
  yearBuilt: '2015',
  flagId: '1',
  dwt: '180000',
  draftM: '18.5',
  loa: '290',
  extBreadth: '45',
  grtNrt: '90000',
  nrt: '52000',
  grain: '195000',
  bale: '185000',
  noh: '9',
  noha: '9',
  hatchSize: '20x20',
  cargoGear: '4x30T',
  craneSize: '30',
  grabSize: '12',
  gasCargoTanks: '',
  gasTankCapacity: '',
  gasCargoPumps: '',
  gasMainCargoPumps: '',
  sizeOfManifolds: '',
  gasSbtCapacity: '',
  tankerCapacity: '',
  noOfGrade: '',
  tankerCargoPump: '',
  tankerSbtCapacity: '',
  tankerPumpMainCap: '',
  piVendorId: '10',
  classSocId: '5',
  ownerVendorId: '20',
  remarks: '',
  attachments: [],
};

export async function getVesselPrimaryLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbGetVesselPrimaryLookups();
}

export async function getVesselPrimary(vesselId) {
  if (!isDbConfigured()) return { ...MOCK_VESSEL, vesselImoId: Number(vesselId) || MOCK_VESSEL.vesselImoId };
  return dbGetVesselPrimary(vesselId);
}

export async function updateVesselPrimary(vesselId, payload) {
  if (!isDbConfigured()) return { ...MOCK_VESSEL, ...payload, vesselImoId: Number(vesselId) };
  return dbUpdateVesselPrimary(vesselId, payload);
}

export async function createVesselPrimary(payload) {
  if (!isDbConfigured()) {
    return {
      ...MOCK_VESSEL,
      ...payload,
      vesselImoId: 9999,
      attachments: [],
    };
  }
  return dbCreateVesselPrimary(payload);
}
