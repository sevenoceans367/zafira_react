import { isDbConfigured } from '../config.js';
import {
  dbCancelFreightInvoice,
  dbDeleteFreightInvoice,
  dbGetBankingDetail,
  dbGetFreightInvoiceForm,
  dbReceiveFreightPayment,
  dbReopenFreightInvoice,
  dbSaveFreightInvoice,
} from './freightInvoiceDb.js';
import { generateFreightInvoicePdf as buildFreightInvoicePdf } from './freightInvoicePdfService.js';

function requireDb() {
  if (!isDbConfigured()) {
    const error = new Error('Database is not configured.');
    error.status = 503;
    throw error;
  }
}

export async function getFreightInvoiceForm(params = {}) {
  requireDb();
  return dbGetFreightInvoiceForm(params);
}

export async function saveFreightInvoice(payload = {}, options = {}) {
  requireDb();
  return dbSaveFreightInvoice(payload, options);
}

/** @deprecated alias for saveFreightInvoice */
export async function createFreightInvoice(payload = {}, options = {}) {
  return saveFreightInvoice(payload, options);
}

export async function getFreightInvoiceBanking(bdId) {
  requireDb();
  return dbGetBankingDetail(bdId);
}

export async function receiveFreightInvoicePayment(invoiceId, body = {}, options = {}) {
  requireDb();
  return dbReceiveFreightPayment(invoiceId, body, options.userId);
}

export async function cancelFreightInvoice(invoiceId, options = {}) {
  requireDb();
  return dbCancelFreightInvoice(invoiceId, options.userId);
}

export async function reopenFreightInvoice(invoiceId) {
  requireDb();
  return dbReopenFreightInvoice(invoiceId);
}

export async function deleteFreightInvoice(invoiceId) {
  requireDb();
  return dbDeleteFreightInvoice(invoiceId);
}

export async function generateFreightInvoicePdf(invoiceId) {
  requireDb();
  return buildFreightInvoicePdf(invoiceId);
}
