import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const INVOICE_TYPE_NAMES = {
  Interim: 'Interim',
  Interim2: 'Interim-2',
  Final: 'Final',
  Memo: 'Memo',
  Debit: 'Debit Note',
  Credit: 'Credit Note',
  Adjustment: 'Adjustment',
  PFHS: 'PFHS',
  FHS2: 'FHS - 2',
};

function parseAttachments(files, names) {
  const fileList = String(files || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== ' ');
  const nameList = String(names || '')
    .split(',')
    .map((part) => part.trim());
  return fileList.map((file, index) => ({
    file,
    name: nameList[index] || file,
    url: `/attachment/${encodeURIComponent(file)}`,
  }));
}

function invoiceTypeName(type) {
  if (!type) return '';
  return INVOICE_TYPE_NAMES[type] || String(type);
}

async function getCompareMeta(pool, comId) {
  const [[compare]] = await pool.query(
    `SELECT FCAID, MESSAGE
     FROM freight_cost_estimate_compare
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  );
  if (!compare?.FCAID) {
    return { fcaId: null, nomId: '', vesselName: '' };
  }

  const [[sheet]] = await pool.query(
    `SELECT m.ATTACHMENT, m.ATTACHMENT_NAME, m.VESSEL_IMO_ID, vim.VESSEL_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.FCAID = ?
     LIMIT 1`,
    [compare.FCAID],
  );

  return {
    fcaId: String(compare.FCAID),
    nomId: compare.MESSAGE || '',
    vesselName: sheet?.VESSEL_NAME || '',
    vesselAttachments: parseAttachments(sheet?.ATTACHMENT, sheet?.ATTACHMENT_NAME),
  };
}

async function listUploadedDocs(pool, comId) {
  const [rows] = await pool.query(
    `SELECT CPID, FILE_NAME, USER_FILE_NAME, FILE_NAME_1
     FROM cp_pdf_details
     WHERE COMID = ?
     ORDER BY CPID ASC`,
    [comId],
  );
  return (rows || []).map((row) => ({
    id: String(row.CPID),
    fileName: row.USER_FILE_NAME || '',
    storedFiles: row.FILE_NAME || '',
    attachments: parseAttachments(row.FILE_NAME, row.FILE_NAME_1),
  }));
}

async function listInvoiceAttachments(pool, comId) {
  const rows = [];

  const [freight] = await pool.query(
    `SELECT ATTACHMENTS, ATTACHMENTS_NAME, UPLOAD, UPLOAD_NAME, I_TYPE, MESSAGE
     FROM freight_invoice_master
     WHERE STATUS >= 5 AND COMID = ?`,
    [comId],
  );
  for (const row of freight || []) {
    rows.push({
      particular: 'Freight Invoice',
      type: invoiceTypeName(row.I_TYPE),
      number: row.MESSAGE || '',
      groups: [
        { label: 'Invoice', attachments: parseAttachments(row.UPLOAD, row.UPLOAD_NAME) },
        { label: 'Payment Received', attachments: parseAttachments(row.ATTACHMENTS, row.ATTACHMENTS_NAME) },
      ].filter((group) => group.attachments.length),
    });
  }

  const [other] = await pool.query(
    `SELECT ATTACHMENTS, ATTACHMENTS_NAME, UPLOAD, UPLOAD_NAME, I_TYPE, P_TYPE, MESSAGE
     FROM other_invoice_master
     WHERE STATUS >= 5 AND COMID = ?`,
    [comId],
  );
  for (const row of other || []) {
    rows.push({
      particular: row.P_TYPE || 'Other Invoice',
      type: invoiceTypeName(row.I_TYPE),
      number: row.MESSAGE || '',
      groups: [
        { label: 'Invoice', attachments: parseAttachments(row.UPLOAD, row.UPLOAD_NAME) },
        { label: 'Payment Received', attachments: parseAttachments(row.ATTACHMENTS, row.ATTACHMENTS_NAME) },
      ].filter((group) => group.attachments.length),
    });
  }

  const [requests] = await pool.query(
    `SELECT ATTACHMENTS, ATTACHMENTS_NAME, UPLOAD, UPLOAD_NAME, ACCOUNT_TYPE, NAME, PAYMENT_NO
     FROM request_master
     WHERE STATUS >= 5 AND COMID = ?`,
    [comId],
  );
  for (const row of requests || []) {
    rows.push({
      particular: row.NAME || 'Payment Request',
      type: invoiceTypeName(row.ACCOUNT_TYPE),
      number: row.PAYMENT_NO || '',
      groups: [
        { label: 'Payment', attachments: parseAttachments(row.UPLOAD, row.UPLOAD_NAME) },
        { label: 'Payment Actioned', attachments: parseAttachments(row.ATTACHMENTS, row.ATTACHMENTS_NAME) },
      ].filter((group) => group.attachments.length),
    });
  }

  const [hire] = await pool.query(
    `SELECT ATTACHMENTS, ATTACHMENTS_NAME, UPLOAD, UPLOAD_NAME, INVOICE_TYPE, INVOICE_NO
     FROM invoice_hire_master
     WHERE STATUS >= 5 AND COMID = ?`,
    [comId],
  );
  for (const row of hire || []) {
    rows.push({
      particular: 'Hire Statement',
      type: invoiceTypeName(row.INVOICE_TYPE),
      number: row.INVOICE_NO || '',
      groups: [
        { label: 'Hire Statement', attachments: parseAttachments(row.UPLOAD, row.UPLOAD_NAME) },
        { label: 'Payment Actioned', attachments: parseAttachments(row.ATTACHMENTS, row.ATTACHMENTS_NAME) },
      ].filter((group) => group.attachments.length),
    });
  }

  return rows;
}

export async function dbGetOpsDocuments(comId) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const meta = await getCompareMeta(pool, comId);
  const documents = await listUploadedDocs(pool, comId);
  let invoiceAttachments = [];
  try {
    invoiceAttachments = await listInvoiceAttachments(pool, comId);
  } catch {
    invoiceAttachments = [];
  }

  return {
    comId: String(comId),
    fcaId: meta.fcaId || '',
    nomId: meta.nomId || '',
    vesselName: meta.vesselName || '',
    documents,
    vesselAttachments: meta.vesselAttachments || [],
    invoiceAttachments,
  };
}

export async function dbCreateOpsDocument(comId, { fileName, attachment = '', attachmentName = '' }) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }
  const label = String(fileName || '').trim();
  if (!label) {
    const error = new Error('File Name is required.');
    error.status = 400;
    throw error;
  }
  if (!attachment) {
    const error = new Error('Please attach at least one file.');
    error.status = 400;
    throw error;
  }

  const [result] = await pool.query(
    `INSERT INTO cp_pdf_details (COMID, FILE_NAME, USER_FILE_NAME, FILE_NAME_1)
     VALUES (?, ?, ?, ?)`,
    [comId, attachment, label, attachmentName || ''],
  );

  return { msg: 0, id: String(result.insertId) };
}

export async function dbDeleteOpsDocument(comId, storedFiles) {
  const pool = getPool();
  if (!comId || !storedFiles) {
    const error = new Error('COMID and file name are required.');
    error.status = 400;
    throw error;
  }

  const [result] = await pool.query(
    `DELETE FROM cp_pdf_details WHERE COMID = ? AND FILE_NAME = ?`,
    [comId, storedFiles],
  );

  if (!result.affectedRows) {
    const error = new Error('Document not found.');
    error.status = 404;
    throw error;
  }

  return { msg: 6 };
}
