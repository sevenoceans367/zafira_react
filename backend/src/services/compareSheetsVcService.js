import { isDbConfigured } from '../config.js';
import { dbGetCompareSheetsVc } from './compareSheetsVcDb.js';

const MOCK = {
  comId: '1001',
  header: {
    vesselName: 'ATLANTIC STAR',
    vesselType: 'Supramax',
    flag: 'MH',
    fixtureDate: '15-01-2026',
    voyageNo: 'V-2401',
    voyageName: 'Initial CS',
    dwtSummer: '58000',
    dwtTropical: '59000',
  },
  sheets: [
    { fcaId: '2001', sheetNo: '', name: 'FVF', isFvf: true, isFixture: true },
    { fcaId: '2011', sheetNo: '11', name: 'Initial CS', isFvf: false, isFixture: false },
  ],
  rows: [
    {
      label: 'Final Nett Freight',
      section: 'Revenue',
      link: '',
      values: ['2145000.00', '2150000.00'],
      difference: '5000.00',
      differenceTone: 'positive',
      progressive: 'N/A',
    },
    {
      label: 'P/L',
      section: 'Results',
      link: '',
      values: ['930613.93', '940000.00'],
      difference: '9386.07',
      differenceTone: 'positive',
      progressive: 'N/A',
    },
  ],
  plDifference: '9386.07',
  actualPl: '930613.93',
};

export async function getCompareSheetsVc(comId) {
  if (isDbConfigured()) return dbGetCompareSheetsVc(comId);
  return { ...MOCK, comId: String(comId || MOCK.comId) };
}
