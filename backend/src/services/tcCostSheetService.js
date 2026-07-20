import { isDbConfigured } from '../config.js';
import { dbGetTcCostSheet, dbSaveTcCostSheet } from './tcCostSheetDb.js';

const MOCK_SHEET = {
  mode: 'create',
  sheetName: '25002_OPS1',
  costSheetId: '11',
  comId: '9101',
  sourceTcOutId: 601,
  tcOutId: null,
  header: {
    tcOutId: 601,
    comId: '9101',
    vesselName: 'ATLANTIC STAR',
    vesselType: 'Supramax',
    flag: 'MH',
    tcDate: '15-01-2026',
    tcNo: 'TC-2601',
    cpDate: '15-01-2026',
    cpType: '1',
    cpTypeName: 'NYPE',
    charterer: 'C1',
    chartererName: 'Steel Corp',
    tripTc: '1',
    period: '',
    noOfTrip: '1',
    periodId: '',
    totalDays: '45',
    totalEarning: '500000.00',
    finalStatus: 0,
    operatorId: '1',
    hireFixPer: '12500',
    addComm: '1.25',
    brokerComm: '1.25',
    exchangeRate: '1',
    cveMonth: '0',
  },
  trips: [
    {
      slave1Id: '',
      randomId: '12345',
      delDate: '15-01-2026 08:00',
      reDelDate: '01-03-2026 08:00',
      tcDays: '45',
      utilisationDays: '45',
      dailyGrossHire: '12500',
      exchangeCurrency: 'USD',
      exchangeRate: '1',
      addCommPct: '1.25',
      addCommAmt: '',
      brokerCommPct: '1.25',
      brokerCommAmt: '',
      nettHire: '',
      nettRev: '',
      lessOffHire: '0',
      cve: '0',
      cveMonth: '0',
      ballastBonus: '0',
      bunkerDiffAmt: '0',
      totalRev: '',
      totalExp: '0',
      voyageEarn: '',
      profitPerDay: '',
      hirePeriods: [
        {
          delDate: '15-01-2026 08:00',
          reDelDate: '01-03-2026 08:00',
          days: '45',
          hireRate: '12500.00',
          amount: '562500.00',
          randomId: '12345',
        },
      ],
      deliveryBunkers: [{ bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' }],
      redeliveryBunkers: [{ bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' }],
      offHires: [],
      otherIncome: [],
      otherExpenses: [],
    },
  ],
  lookups: {
    periodContracts: [],
    bunkers: [],
    expenseTypes: [],
  },
};

export async function getTcCostSheet(comId, costSheetId) {
  if (isDbConfigured()) return dbGetTcCostSheet(comId, costSheetId);
  return {
    ...MOCK_SHEET,
    comId: String(comId),
    costSheetId: String(costSheetId),
    sheetName: MOCK_SHEET.sheetName,
  };
}

export async function saveTcCostSheet(comId, costSheetId, body = {}) {
  if (isDbConfigured()) return dbSaveTcCostSheet(comId, costSheetId, body);
  if (String(MOCK_SHEET.header.finalStatus) === '1') {
    const error = new Error('This cost sheet is closed and cannot be edited.');
    error.status = 400;
    throw error;
  }
  return { msg: 0, tcOutId: 601, costSheetId: String(costSheetId), comId: String(comId) };
}
