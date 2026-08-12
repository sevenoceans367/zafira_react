import { isDbConfigured } from '../config.js';
import { dbGetVendorBanking } from './genericFinancesDb.js';
import {
  dbDeleteRequestPortCost,
  dbGetRequestPortCostForm,
  dbReceiveRequestPortCostPayment,
  dbReopenRequestPortCost,
  dbSaveRequestPortCost,
} from './requestPortCostDb.js';
import { generateRequestPortCostPdf as buildRequestPortCostPdf } from './requestPortCostPdfService.js';

function requireDb() {
  if (!isDbConfigured()) {
    const error = new Error('Database is not configured.');
    error.status = 503;
    throw error;
  }
}

export async function getRequestPortCostForm(params = {}) {
  requireDb();
  return dbGetRequestPortCostForm(params);
}

export async function saveRequestPortCost(payload = {}, options = {}) {
  requireDb();
  return dbSaveRequestPortCost(payload, options);
}

export async function getRequestPortCostVendorBanking(vendorId) {
  requireDb();
  return dbGetVendorBanking(vendorId);
}

export async function receiveRequestPortCostPayment(reqId, body = {}, options = {}) {
  requireDb();
  return dbReceiveRequestPortCostPayment(reqId, body, options.userId);
}

export async function deleteRequestPortCost(reqId) {
  requireDb();
  return dbDeleteRequestPortCost(reqId);
}

export async function reopenRequestPortCost(reqId) {
  requireDb();
  return dbReopenRequestPortCost(reqId);
}

export async function generateRequestPortCostPdf(reqId) {
  requireDb();
  return buildRequestPortCostPdf(reqId);
}
