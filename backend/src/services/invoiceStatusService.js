import { isDbConfigured } from '../config.js';
import {
  dbCreateInvoiceStatus,
  dbGetInvoiceStatus,
  dbListInvoiceStatuses,
  dbUpdateInvoiceStatus,
  dbUpdateInvoiceStatusStatus,
} from './invoiceStatusDb.js';

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    name: 'Paid',
    status: 1,
    isActive: true,
  },
];

export async function listInvoiceStatuses() {
  if (!isDbConfigured()) {
    return { records: MOCK_RECORDS, recordsTotal: MOCK_RECORDS.length };
  }
  return dbListInvoiceStatuses();
}

export async function getInvoiceStatus(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetInvoiceStatus(id);
}

export async function updateInvoiceStatusStatus(id, currentStatus) {
  if (!isDbConfigured()) {
    return { msg: 2, status: Number(currentStatus) === 1 ? 2 : 1 };
  }
  return dbUpdateInvoiceStatusStatus(id, currentStatus);
}

export async function createInvoiceStatus(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateInvoiceStatus(payload);
}

export async function updateInvoiceStatus(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateInvoiceStatus(id, payload);
}
