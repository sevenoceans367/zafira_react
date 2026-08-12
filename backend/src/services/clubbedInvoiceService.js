import { isDbConfigured } from '../config.js';
import {
  dbGetClubbedFreightInvoice,
  dbGetClubbedHireInvoice,
  dbReopenClubbedFreightInvoice,
  dbReopenClubbedHireInvoice,
} from './clubbedInvoiceDb.js';
import {
  generateClubbedFreightPdf as buildClubbedFreightPdf,
  generateClubbedHirePdf as buildClubbedHirePdf,
} from './clubbedInvoicePdfService.js';

function requireDb() {
  if (!isDbConfigured()) {
    const error = new Error('Database is not configured.');
    error.status = 503;
    throw error;
  }
}

export async function getClubbedFreightInvoice(params = {}) {
  requireDb();
  return dbGetClubbedFreightInvoice(params);
}

export async function getClubbedHireInvoice(params = {}) {
  requireDb();
  return dbGetClubbedHireInvoice(params);
}

export async function reopenClubbedFreightInvoice(invoiceId) {
  requireDb();
  return dbReopenClubbedFreightInvoice(invoiceId);
}

export async function reopenClubbedHireInvoice(invoiceId) {
  requireDb();
  return dbReopenClubbedHireInvoice(invoiceId);
}

export async function generateClubbedFreightPdf(invoiceId) {
  requireDb();
  return buildClubbedFreightPdf(invoiceId);
}

export async function generateClubbedHirePdf(invoiceId) {
  requireDb();
  return buildClubbedHirePdf(invoiceId);
}
