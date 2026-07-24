import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { BUSINESS_TYPES, formatDateDMY } from './estimateListMappers.js';

const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;
const MODULE_ID = process.env.MODULE_ID || appContext.moduleId;

const STATUS_LABELS = {
  0: 'Submit to Edit',
  1: 'Level 1 Approval Pending',
  2: 'Sent for Review To Creator',
  3: 'Level 2 Approval Pending',
  4: 'Sent for Review To Approver 1',
  5: 'Pending for Payment',
  99: 'Cancelled',
};

export function mapGenericFinanceStatus(status) {
  const code = Number(status);
  if (Number.isNaN(code)) {
    return { statusCode: 0, statusLabel: 'Submit to Edit', statusTone: 'info' };
  }
  if (code === 99) {
    return { statusCode: code, statusLabel: 'Cancelled', statusTone: 'danger' };
  }
  const label = STATUS_LABELS[code] || 'Paid';
  let tone = 'success';
  if (code === 0) tone = 'info';
  else if (code === 1 || code === 3 || code === 4) tone = 'warning';
  else if (code === 2 || code === 5) tone = 'danger';
  else if (label === 'Paid') tone = 'success';
  return { statusCode: code, statusLabel: label, statusTone: tone };
}

function formatAmount(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(2);
}

function mapRow(row, index, offset = 0) {
  const status = mapGenericFinanceStatus(row.STATUS);
  const invoiceId = row.INVOICEID;
  const cancelled = status.statusCode === 99;
  const paidAmt = Number(row.P_AMT) || 0;
  return {
    index: offset + index + 1,
    invoiceId,
    invoiceNo: row.INVOICE_NO ?? '',
    invoiceDate: formatDateDMY(row.INVOICE_DATE),
    invoiceType: row.I_TYPE ?? '',
    recordType: row.TYPE === 'payment' ? 'Payment' : 'Invoice',
    vendor: row.VENDOR_NAME || row.VENDOR || '',
    amount: formatAmount(row.AMOUNT),
    netAmount: formatAmount(row.NET_AMOUNT),
    creator: row.CREATOR_NAME ?? '',
    businessTypeId: row.BUSINESSTYPEID != null ? String(row.BUSINESSTYPEID) : '',
    paymentAmount: formatAmount(row.P_AMT),
    paymentDate: formatDateDMY(row.P_DATE),
    paymentRemarks: row.P_REMARKS ?? '',
    ...status,
    editHref: cancelled ? '' : `updateginvoice.php?id=${invoiceId}`,
    pdfHref: `allPdf.php?id=83&im_id=${invoiceId}`,
    canEdit: !cancelled,
    canCancel: !cancelled,
    canReceivePayment: !cancelled && paidAmt <= 0,
  };
}

export async function dbListGenericFinanceYears() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT DISTINCT YEAR(INVOICE_DATE) AS year
     FROM generic_invoice_master
     WHERE INVOICE_DATE IS NOT NULL AND YEAR(INVOICE_DATE) > 0
     ORDER BY year DESC`,
  );
  const years = rows.map((row) => String(row.year)).filter(Boolean);
  const current = String(new Date().getFullYear());
  if (!years.includes(current)) years.unshift(current);
  return years.map((year) => ({ id: year, name: year }));
}

export function listGenericFinanceBusinessTypes(selectedId = '2') {
  return BUSINESS_TYPES.map((type) => ({
    ...type,
    selected: type.id === String(selectedId),
  }));
}

export async function dbListGenericFinances({
  search = '',
  page = 1,
  pageSize = 50,
  selBType = '2',
  selYear = String(new Date().getFullYear()),
} = {}) {
  const pool = getPool();
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(200, Number(pageSize) || 50));
  const offset = (safePage - 1) * safeSize;
  const businessType = String(selBType || '2');
  const year = String(selYear || new Date().getFullYear());

  const conditions = [
    'm.MODULEID = ?',
    'm.MCOMPANYID = ?',
    'm.BUSINESSTYPEID = ?',
    'YEAR(m.INVOICE_DATE) = ?',
  ];
  const params = [MODULE_ID, COMPANY_ID, businessType, year];

  if (search) {
    const like = `%${String(search).trim()}%`;
    conditions.push(`(
      m.INVOICE_NO LIKE ?
      OR DATE_FORMAT(m.INVOICE_DATE, '%d-%m-%Y') LIKE ?
      OR m.I_TYPE LIKE ?
      OR m.TYPE LIKE ?
      OR vm.NAME LIKE ?
      OR m.VENDOR LIKE ?
      OR CAST(IFNULL(m.AMOUNT, 0) AS CHAR) LIKE ?
      OR CAST(IFNULL(m.NET_AMOUNT, 0) AS CHAR) LIKE ?
      OR creator.CONTACT_PERSON LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like, like);
  }

  const where = conditions.join(' AND ');
  const baseFrom = `
    FROM generic_invoice_master m
    LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
    LEFT JOIN login creator ON creator.LOGINID = m.CREATOR
  `;

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total ${baseFrom} WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
        m.INVOICEID,
        m.INVOICE_NO,
        m.INVOICE_DATE,
        m.I_TYPE,
        m.TYPE,
        m.VENDOR,
        vm.NAME AS VENDOR_NAME,
        m.AMOUNT,
        m.NET_AMOUNT,
        m.STATUS,
        m.P_AMT,
        m.P_DATE,
        m.P_REMARKS,
        m.BUSINESSTYPEID,
        creator.CONTACT_PERSON AS CREATOR_NAME
     ${baseFrom}
     WHERE ${where}
     ORDER BY m.INVOICEID DESC
     LIMIT ? OFFSET ?`,
    [...params, safeSize, offset],
  );

  return {
    records: rows.map((row, index) => mapRow(row, index, offset)),
    recordsTotal: Number(countRow?.total) || 0,
    page: safePage,
    pageSize: safeSize,
    selBType: businessType,
    selYear: year,
  };
}

export async function dbCancelGenericInvoice(invoiceId) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE generic_invoice_master
     SET STATUS = 99
     WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS <> 99`,
    [invoiceId, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) throw new Error('Invoice not found or already cancelled.');
  return { msg: 3 };
}

export async function dbReceiveGenericPayment(invoiceId, {
  amount,
  paymentDate,
  remarks = '',
} = {}) {
  const pool = getPool();
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('Payment amount is required.');
  }
  if (!paymentDate) {
    throw new Error('Payment date is required.');
  }

  // Accept dd-mm-yyyy or yyyy-mm-dd
  let sqlDate = String(paymentDate).trim();
  const dmy = sqlDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) sqlDate = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const [result] = await pool.query(
    `UPDATE generic_invoice_master
     SET P_AMT = ?, P_DATE = ?, P_REMARKS = ?, PAYMENT_STATUS = 'payment_received'
     WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS <> 99`,
    [amt, sqlDate, remarks || '', invoiceId, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) throw new Error('Invoice not found or cancelled.');
  return { msg: 2 };
}
