import { isDbConfigured } from '../config.js';
import {
  dbCancelGenericInvoice,
  dbListGenericFinanceYears,
  dbListGenericFinances,
  dbReceiveGenericPayment,
  listGenericFinanceBusinessTypes,
  mapGenericFinanceStatus,
} from './genericFinancesDb.js';

const MOCK_ROWS = [
  {
    index: 1,
    invoiceId: 501,
    invoiceNo: 'GF-26001',
    invoiceDate: '12-01-2026',
    invoiceType: 'Agency Fee',
    recordType: 'Invoice',
    vendor: 'Global Agency (GA01)',
    amount: '12500.00',
    netAmount: '12500.00',
    creator: 'Ops User',
    businessTypeId: '2',
    paymentAmount: '',
    paymentDate: '',
    paymentRemarks: '',
    statusCode: 5,
    statusLabel: 'Pending for Payment',
    statusTone: 'danger',
    editHref: 'updateginvoice.php?id=501',
    pdfHref: 'allPdf.php?id=83&im_id=501',
    canEdit: true,
    canCancel: true,
    canReceivePayment: true,
  },
  {
    index: 2,
    invoiceId: 502,
    invoiceNo: 'GF-26002',
    invoiceDate: '18-01-2026',
    invoiceType: 'Survey Fee',
    recordType: 'Payment',
    vendor: 'Seven Oceans (SO01)',
    amount: '8400.50',
    netAmount: '8400.50',
    creator: 'Finance Lead',
    businessTypeId: '2',
    paymentAmount: '8400.50',
    paymentDate: '20-01-2026',
    paymentRemarks: 'Received',
    statusCode: 6,
    statusLabel: 'Paid',
    statusTone: 'success',
    editHref: 'updateginvoice.php?id=502',
    pdfHref: 'allPdf.php?id=83&im_id=502',
    canEdit: true,
    canCancel: true,
    canReceivePayment: false,
  },
];

function filterMockRows(params = {}) {
  const search = String(params.search || '').toLowerCase();
  const businessType = String(params.selBType || '2');
  const year = String(params.selYear || new Date().getFullYear());
  let rows = MOCK_ROWS.filter((row) => {
    if (row.businessTypeId && row.businessTypeId !== businessType) return false;
    const rowYear = String(row.invoiceDate || '').slice(-4);
    if (rowYear && rowYear !== year) return false;
    return true;
  });
  if (search) {
    rows = rows.filter((row) => [
      row.invoiceNo,
      row.invoiceDate,
      row.invoiceType,
      row.recordType,
      row.vendor,
      row.amount,
      row.netAmount,
      row.creator,
      row.statusLabel,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.pageSize) || 50));
  const start = (page - 1) * pageSize;
  return {
    records: rows.slice(start, start + pageSize).map((row, index) => ({
      ...row,
      index: start + index + 1,
    })),
    recordsTotal: rows.length,
    page,
    pageSize,
    selBType: businessType,
    selYear: year,
  };
}

export async function listGenericFinances(params = {}) {
  if (isDbConfigured()) {
    return dbListGenericFinances(params);
  }
  return filterMockRows(params);
}

export async function listGenericFinanceYears() {
  if (isDbConfigured()) {
    return dbListGenericFinanceYears();
  }
  const current = String(new Date().getFullYear());
  return [
    { id: current, name: current },
    { id: String(Number(current) - 1), name: String(Number(current) - 1) },
  ];
}

export function getGenericFinanceBusinessTypes(selectedId = '2') {
  return listGenericFinanceBusinessTypes(selectedId);
}

export async function cancelGenericInvoice(invoiceId) {
  if (isDbConfigured()) {
    return dbCancelGenericInvoice(invoiceId);
  }
  const row = MOCK_ROWS.find((item) => String(item.invoiceId) === String(invoiceId));
  if (!row) throw new Error('Invoice not found or already cancelled.');
  row.statusCode = 99;
  row.statusLabel = 'Cancelled';
  row.statusTone = 'danger';
  row.canEdit = false;
  row.canCancel = false;
  row.canReceivePayment = false;
  row.editHref = '';
  return { msg: 3 };
}

export async function receiveGenericPayment(invoiceId, body = {}) {
  if (isDbConfigured()) {
    return dbReceiveGenericPayment(invoiceId, body);
  }
  const row = MOCK_ROWS.find((item) => String(item.invoiceId) === String(invoiceId));
  if (!row || !row.canReceivePayment) throw new Error('Invoice not found or cancelled.');
  row.paymentAmount = Number(body.amount).toFixed(2);
  row.paymentDate = body.paymentDate || '';
  row.paymentRemarks = body.remarks || '';
  row.canReceivePayment = false;
  row.statusCode = 6;
  row.statusLabel = 'Paid';
  row.statusTone = 'success';
  return { msg: 2 };
}

export { mapGenericFinanceStatus };
