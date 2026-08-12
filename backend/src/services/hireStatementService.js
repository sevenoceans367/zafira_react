import { isDbConfigured } from '../config.js';
import {
  dbDeleteHireStatement,
  dbGetHireStatementForm,
  dbReceiveHireStatementPayment,
  dbReopenHireStatement,
  dbSaveHireStatement,
} from './hireStatementDb.js';
import { generateHireStatementPdf as buildHireStatementPdf } from './hireStatementPdfService.js';

function requireDb() {
  if (!isDbConfigured()) {
    const error = new Error('Database is not configured.');
    error.status = 503;
    throw error;
  }
}

export async function getHireStatementForm(params = {}) {
  requireDb();
  return dbGetHireStatementForm(params);
}

export async function saveHireStatement(payload = {}, options = {}) {
  requireDb();
  return dbSaveHireStatement(payload, options);
}

export async function receiveHireStatementPayment(invoiceId, body = {}, options = {}) {
  requireDb();
  return dbReceiveHireStatementPayment(invoiceId, body, options.userId);
}

export async function reopenHireStatement(invoiceId) {
  requireDb();
  return dbReopenHireStatement(invoiceId);
}

export async function deleteHireStatement(invoiceId) {
  requireDb();
  return dbDeleteHireStatement(invoiceId);
}

export async function generateHireStatementPdf(invoiceId) {
  requireDb();
  return buildHireStatementPdf(invoiceId);
}
