import { isDbConfigured } from '../config.js';
import {
  dbGetTodoList,
  dbInactiveTodoAlert,
  dbSetTodoPaymentStatus,
  dbUpdateTodoAlRem,
} from './todoListDb.js';
import {
  dbSearchTodoVoyageByNumber,
  dbSearchTodoVoyagesByVessel,
} from './todoListVoyageSearchDb.js';

const MOCK_RECORDS = {
  hold: [
    {
      index: 1,
      alertId: 101,
      identify: 'HIRE STATEMENT',
      identifyId: 501,
      comid: 9001,
      vessel: 'ATLANTIC STAR',
      voyageNo: 'S26001',
      formName: 'Hire Statement',
      invoiceNo: 'HS-001',
      payType: 'HOLD',
      holdBy: 'Ops User',
      vendor: 'Seven Oceans (SO01)',
      statusCode: 1,
      statusLabel: 'Level 1 Approval Pending Since 3 Days',
      statusTone: 'danger',
      date: '07-07-2026',
      docsHref: 'documents.php?comid=9001&page=1',
      editHref: 'payment_grid.php?comid=9001&alertid=101',
      alRem: '',
      paymentUnlock: true,
      canHold: false,
      canUnhold: true,
    },
  ],
  payable: [
    {
      index: 1,
      alertId: 201,
      identify: 'FREIGHT INVOICE',
      identifyId: 601,
      comid: 9002,
      vessel: 'PACIFIC DAWN',
      voyageNo: 'S26012',
      formName: 'Final Freight Invoice',
      invoiceNo: 'FI-012',
      payType: 'Payable',
      holdBy: '',
      vendor: 'Global Charter (GC02)',
      statusCode: 5,
      statusLabel: 'Payment Received/Paid Pending Since 1 Days',
      statusTone: 'warning',
      date: '09-07-2026',
      docsHref: 'documents.php?comid=9002&page=1',
      editHref: 'payment_grid.php?comid=9002&alertid=201',
      alRem: '',
      paymentUnlock: true,
      canHold: true,
      canUnhold: false,
    },
  ],
};

function filterMock(records, accountType, search) {
  return records.filter((row) => {
    if (accountType === 'Singapore' && !(row.voyageNo.startsWith('S') || row.voyageNo.startsWith('TS'))) {
      return false;
    }
    if (accountType === 'Dubai' && !(row.voyageNo.startsWith('U') || row.voyageNo.startsWith('TU'))) {
      return false;
    }
    if (!search) return true;
    const haystack = [
      row.vessel, row.voyageNo, row.formName, row.invoiceNo, row.vendor, row.statusLabel,
    ].join(' ').toLowerCase();
    return haystack.includes(String(search).toLowerCase());
  });
}

export async function getTodoList(params = {}) {
  const tab = params.tab === 'payable' ? 'payable' : 'hold';
  if (!isDbConfigured()) {
    const records = filterMock(MOCK_RECORDS[tab], params.accountType, params.search);
    return {
      records,
      recordsTotal: records.length,
      paymentUnlock: true,
      accountType: params.accountType || '',
      mode: tab,
    };
  }
  return dbGetTodoList(params);
}

export async function inactiveTodoAlert(alertId) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbInactiveTodoAlert(alertId);
}

export async function updateTodoAlRem(payload) {
  if (!payload?.identify || !payload?.identifyId) {
    throw new Error('Missing identify details.');
  }
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateTodoAlRem(payload);
}

export async function holdTodoPayment(payload) {
  if (!payload?.identify || !payload?.identifyId) {
    throw new Error('Missing identify details.');
  }
  if (!isDbConfigured()) return { msg: 0 };
  return dbSetTodoPaymentStatus({
    identify: payload.identify,
    identifyId: payload.identifyId,
    status: 'payment_hold',
  });
}

export async function unholdTodoPayment(payload) {
  if (!payload?.identify || !payload?.identifyId) {
    throw new Error('Missing identify details.');
  }
  if (!isDbConfigured()) return { msg: 0 };
  return dbSetTodoPaymentStatus({
    identify: payload.identify,
    identifyId: payload.identifyId,
    status: 'payment_payable',
  });
}

/** PHP options.php?id=126 */
export async function searchTodoVoyageByNumber(payload = {}) {
  if (!isDbConfigured()) {
    return {
      status: 1,
      type: String(payload.voyType || 'VC').toLowerCase() === 'coa' ? 'COA' : String(payload.voyType || 'vc').toLowerCase(),
      voyage: payload.voyageNo || 'S26001',
      year: new Date().getFullYear(),
    };
  }
  return dbSearchTodoVoyageByNumber({
    voyageNo: payload.voyageNo,
    voyType: payload.voyType,
    businessType: payload.businessType,
  });
}

/** PHP options.php?id=153 */
export async function searchTodoVoyagesByVessel(payload = {}) {
  if (!isDbConfigured()) {
    return [{
      status: 1,
      type: 'vc',
      voyage: 'S26001',
      year: new Date().getFullYear(),
      Charterer: 'Mock Charterer',
      CP_DATE: '01-Jan-2026',
    }];
  }
  return dbSearchTodoVoyagesByVessel({
    vesselId: payload.vesselId,
    voyType: payload.voyType,
    businessType: payload.businessType,
  });
}
