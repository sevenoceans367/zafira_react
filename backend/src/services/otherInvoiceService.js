import { isDbConfigured } from '../config.js';
import {
  dbCancelOtherInvoice,
  dbDeleteOtherInvoice,
  dbGetBankingDetail,
  dbGetOtherInvoiceForm,
  dbReceiveOtherInvoicePayment,
  dbReopenOtherInvoice,
  dbSaveOtherInvoice,
} from './otherInvoiceDb.js';
import { generateOtherInvoicePdf as buildOtherInvoicePdf } from './otherInvoicePdfService.js';

function requireDb() {
  if (!isDbConfigured()) {
    const error = new Error('Database is not configured.');
    error.status = 503;
    throw error;
  }
}

export async function getOtherInvoiceForm(params = {}) {
  requireDb();
  return dbGetOtherInvoiceForm(params);
}

export async function saveOtherInvoice(payload = {}, options = {}) {
  requireDb();
  return dbSaveOtherInvoice(payload, options);
}

export async function getOtherInvoiceBanking(bdId) {
  requireDb();
  return dbGetBankingDetail(bdId);
}

export async function receiveOtherInvoicePayment(invoiceId, body = {}, options = {}) {
  requireDb();
  return dbReceiveOtherInvoicePayment(invoiceId, body, options.userId);
}

export async function cancelOtherInvoice(invoiceId, options = {}) {
  requireDb();
  return dbCancelOtherInvoice(invoiceId, options.userId);
}

export async function reopenOtherInvoice(invoiceId) {
  requireDb();
  return dbReopenOtherInvoice(invoiceId);
}

export async function deleteOtherInvoice(invoiceId) {
  requireDb();
  return dbDeleteOtherInvoice(invoiceId);
}

export async function generateOtherInvoicePdf(invoiceId) {
  requireDb();
  return buildOtherInvoicePdf(invoiceId);
}
