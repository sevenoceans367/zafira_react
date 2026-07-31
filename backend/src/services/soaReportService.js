import { isDbConfigured } from '../config.js';
import { dbGetSoaReport } from './soaReportDb.js';

const MOCK_REPORT = {
  comId: '8',
  fcaId: '100',
  vesselName: 'KALYMNOS DAWN',
  message: 'NOM-001',
  voyageNo: 'V25001',
  cpDate: '15-01-2026',
  currency: 'USD',
  title: 'CONSOLIDATED STATEMENT OF ACCOUNTS - VC/COA',
  receivables: {
    labels: {
      estimated: 'Estimated (USD)',
      colB: 'Invoiced (USD)',
      colC: 'Received (USD)',
      balance: 'Balance (USD)',
    },
    blocks: [
      {
        key: 'freight',
        rows: [
          { isHeader: true, title: 'FREIGHT' },
          {
            cells: ['Qty', '50000', 'Freight Rate', '12.50', ''],
            estimated: '625000.00',
            colB: '',
            colC: '',
            balance: '',
          },
          {
            cells: ['Add Comm.%', '1.25', '', '', ''],
            estimated: '7812.50',
            colB: '7812.50',
            colC: '',
            balance: '',
          },
          {
            cells: ['', '', '', '', ''],
            estimated: '617187.50',
            colB: '600000.00',
            colC: '450000.00',
            balance: '150000.00',
            balanceRed: true,
          },
        ],
      },
      {
        key: 'other-income',
        rows: [
          { isHeader: true, title: 'OTHER INCOME' },
          {
            cells: ['Deadfreight', '', '', '', ''],
            estimated: '5000.00',
            colB: '5000.00',
            colC: '0.00',
            balance: '5000.00',
            balanceRed: true,
          },
        ],
      },
    ],
    totals: {
      estimated: '622187.50',
      colB: '605000.00',
      colC: '450000.00',
      balance: '155000.00',
    },
  },
  payables: {
    labels: {
      estimated: 'Estimated (USD)',
      colB: 'PO Made (USD)',
      colC: 'Paid (USD)',
      balance: 'Balance (USD)',
    },
    blocks: [
      {
        key: 'bunkers',
        rows: [
          { isHeader: true, title: 'BUNKERS' },
          {
            cells: ['Grade', 'VLSFO', 'Qty(MT)', '200', ''],
            estimated: '100000.00',
            colB: '100000.00',
            colC: '50000.00',
            balance: '50000.00',
            balanceRed: true,
          },
        ],
      },
      {
        key: 'hire',
        rows: [
          { isHeader: true, title: 'HIRE COSTS' },
          {
            cells: ['Daily Hire', '15000', 'Days', '30', ''],
            estimated: '450000.00',
            colB: '',
            colC: '',
            balance: '',
          },
          {
            cells: ['Add Comm.%', '1.25', '', '', ''],
            estimated: '5625.00',
            colB: '',
            colC: '',
            balance: '',
          },
          {
            cells: ['', '', '', '', 'Total Hire'],
            estimated: '444375.00',
            colB: '300000.00',
            colC: '200000.00',
            balance: '100000.00',
            balanceRed: true,
          },
        ],
      },
    ],
    totals: {
      estimated: '544375.00',
      colB: '400000.00',
      colC: '250000.00',
      balance: '150000.00',
    },
  },
};

export async function getSoaReport(comId) {
  if (isDbConfigured()) return dbGetSoaReport(comId);
  if (String(comId) !== String(MOCK_REPORT.comId)) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(MOCK_REPORT);
}
