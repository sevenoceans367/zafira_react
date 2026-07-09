import { isDbConfigured } from '../config.js';
import { dbCompareVessels, dbGetFleetList } from './fleetDb.js';

const MOCK_FLEET = {
  records: [
    {
      index: 1,
      vesselImoId: 1001,
      vesselType: 'Capesize',
      vesselName: 'ATLANTIC STAR',
      businessType: 'Dry Cargo',
      businessTypeId: 3,
      imoNo: '9123456',
      dwt: '180000',
      yearBuilt: '2015',
    },
    {
      index: 2,
      vesselImoId: 1002,
      vesselType: 'Aframax',
      vesselName: 'PACIFIC DAWN',
      businessType: 'Tanker',
      businessTypeId: 2,
      imoNo: '9234567',
      dwt: '115000',
      yearBuilt: '2018',
    },
  ],
  recordsTotal: 2,
  page: 1,
  pageSize: 10,
};

const MOCK_COMPARE = {
  vessels: [
    { id: 1001, name: 'ATLANTIC STAR' },
    { id: 1002, name: 'PACIFIC DAWN' },
  ],
  sections: [
    {
      title: null,
      rows: [
        { label: 'Vessel Type', values: ['Capesize', 'Aframax'] },
        { label: 'DWT (Summer)', values: ['180000', '115000'] },
        { label: 'Draft (Summer)', values: ['18.5', '15.2'] },
        { label: 'TPC', values: ['92', '88'] },
      ],
    },
    {
      title: 'SPEED DATA',
      rows: [
        { label: 'Ballast Speed - Full Speed (Knots)', values: ['14.5', '13.8'] },
        { label: 'Laden Speed - Full Speed (Knots)', values: ['13.2', '12.5'] },
      ],
    },
  ],
};

export async function getFleetList(params) {
  if (!isDbConfigured()) return MOCK_FLEET;
  return dbGetFleetList(params);
}

export async function compareVessels(vesselIds) {
  if (!isDbConfigured()) return MOCK_COMPARE;
  return dbCompareVessels(vesselIds);
}
