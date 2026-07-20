import { isDbConfigured } from '../config.js';
import { dbGetCompareSheetsTc } from './compareSheetsTcDb.js';

export { generateCompareSheetsTcPdf } from './compareSheetsTcPdfService.js';

const MOCK_COMPARE = {
  comId: '1001',
  header: {
    vesselName: 'ATLANTIC STAR',
    vesselType: 'MR Tanker',
    dwtSummer: '50000',
    fixtureDate: '01-01-2026',
    cpDate: '05-01-2026',
    tcNo: '25001',
  },
  sheets: [
    { tcOutId: '5001', sheetNo: '', name: 'Fixture TC', isFixture: true },
    { tcOutId: '5002', sheetNo: '12', name: '25002_OPS1', isFixture: false },
  ],
  rows: [
    {
      label: 'Daily Gross Hire(USD/Day)',
      section: 'REVENUE',
      link: '',
      values: ['18500.00', '19000.00'],
      difference: '500.00',
      differenceTone: 'positive',
      progressive: 'N/A',
    },
    {
      label: 'P/L',
      section: 'RESULTS',
      link: '',
      values: ['120000.00', '135000.00'],
      difference: '15000.00',
      differenceTone: 'positive',
      progressive: 'N/A',
    },
  ],
  plDifference: '15000.00',
  actualPl: '120000.00',
};

export async function getCompareSheetsTc(comId) {
  if (isDbConfigured()) return dbGetCompareSheetsTc(comId);
  if (String(comId) !== String(MOCK_COMPARE.comId)) {
    const error = new Error('TC nomination not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(MOCK_COMPARE);
}
