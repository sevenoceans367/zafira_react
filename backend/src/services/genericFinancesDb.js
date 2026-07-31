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

function toSqlDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function parseLineRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const DEFAULT_INVOICE_TYPES = [
  { id: 'Agency Fee', name: 'Agency Fee' },
  { id: 'Survey Fee', name: 'Survey Fee' },
  { id: 'Brokerage', name: 'Brokerage' },
  { id: 'Legal Fee', name: 'Legal Fee' },
  { id: 'Consultancy', name: 'Consultancy' },
  { id: 'Other', name: 'Other' },
];

const CONTRACT_TYPE_OPTIONS = [
  { id: 'Spot', name: 'Spot' },
  { id: 'COA', name: 'COA' },
  { id: 'TC', name: 'TC' },
];

const CURRENCY_OPTIONS = [
  { id: 'USD', name: 'USD' },
  { id: 'EURO', name: 'EURO' },
  { id: 'GBP', name: 'GBP' },
  { id: 'AED', name: 'AED' },
  { id: 'INR', name: 'INR' },
  { id: 'JPY', name: 'JPY' },
];

export async function dbGetGenericInvoiceLookups(userId = appContext.userId) {
  const pool = getPool();

  const [
    [owners],
    [vendors],
    [invoiceTypes],
    [bankingDetails],
    [approver1Rows],
    [approver2Rows],
    [[authRow]],
    [[matrixCounts]],
  ] = await Promise.all([
    pool.query(
      `SELECT CODE AS id, CONCAT(NAME, ' (', CODE, ')') AS name
       FROM vendor_master
       WHERE STATUS = 1 AND VENDOR_TYPEID = 11 AND MCOMPANYID = ?
       ORDER BY NAME`,
      [COMPANY_ID],
    ),
    pool.query(
      `SELECT CODE AS id, VENDORID AS vendorId, CONCAT(NAME, ' (', CODE, ')') AS name
       FROM vendor_master
       WHERE STATUS = 1 AND MCOMPANYID = ?
       ORDER BY NAME`,
      [COMPANY_ID],
    ),
    pool.query(
      `SELECT NAME AS id, NAME AS name
       FROM invoicetype_master
       WHERE STATUS = 1
       ORDER BY NAME`,
    ).catch(() => [[]]),
    pool.query(
      `SELECT BD_ID AS id, CONCAT(NAME, ' - ', BANK) AS name
       FROM banking_details
       WHERE STATUS = 1
       ORDER BY NAME`,
    ).catch(() => [[]]),
    pool.query(
      `SELECT am.LOGINID AS id, l.CONTACT_PERSON AS name
       FROM approval_matrix am
       INNER JOIN login l ON l.LOGINID = am.LOGINID
       WHERE am.MCOMPANYID = ? AND am.GEN_CHK_APP_1 = 1 AND l.STATUS = 1
       ORDER BY l.CONTACT_PERSON`,
      [COMPANY_ID],
    ).catch(() => [[]]),
    pool.query(
      `SELECT am.LOGINID AS id, l.CONTACT_PERSON AS name
       FROM approval_matrix am
       INNER JOIN login l ON l.LOGINID = am.LOGINID
       WHERE am.MCOMPANYID = ? AND am.GEN_CHK_APP_2 = 1 AND l.STATUS = 1
       ORDER BY l.CONTACT_PERSON`,
      [COMPANY_ID],
    ).catch(() => [[]]),
    pool.query(
      `SELECT GEN_CHK_CRETR AS creator, GEN_CHK_APP_1 AS approver1, GEN_CHK_APP_2 AS approver2
       FROM approval_matrix
       WHERE MCOMPANYID = ? AND LOGINID = ?
       LIMIT 1`,
      [COMPANY_ID, userId],
    ).catch(() => [[null]]),
    pool.query(
      `SELECT
         SUM(CASE WHEN GEN_CHK_APP_1 = 1 THEN 1 ELSE 0 END) AS app1,
         SUM(CASE WHEN GEN_CHK_APP_2 = 1 THEN 1 ELSE 0 END) AS app2
       FROM approval_matrix
       WHERE MCOMPANYID = ?`,
      [COMPANY_ID],
    ).catch(() => [[{ app1: 0, app2: 0 }]]),
  ]);

  const hasApp1 = Number(matrixCounts?.app1) > 0;
  const hasApp2 = Number(matrixCounts?.app2) > 0;
  let sendForApprovalStatus = 1;
  if (!hasApp1 && !hasApp2) sendForApprovalStatus = 5;
  else if (!hasApp1 && hasApp2) sendForApprovalStatus = 4;

  const resolvedInvoiceTypes = invoiceTypes.length
    ? invoiceTypes.map((row) => ({ id: String(row.id), name: row.name }))
    : DEFAULT_INVOICE_TYPES;

  return {
    owners: owners.map((row) => ({ id: String(row.id), name: row.name })),
    vendors: vendors.map((row) => ({
      id: String(row.id),
      name: row.name,
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
    })),
    contractTypes: CONTRACT_TYPE_OPTIONS,
    invoiceTypes: resolvedInvoiceTypes,
    businessTypes: listGenericFinanceBusinessTypes('2'),
    currencies: CURRENCY_OPTIONS,
    bankingDetails: bankingDetails.map((row) => ({ id: String(row.id), name: row.name })),
    approvers: approver1Rows.map((row) => ({ id: String(row.id), name: row.name })),
    approversLevel2: approver2Rows.map((row) => ({ id: String(row.id), name: row.name })),
    canCreate: Number(authRow?.creator) === 1 || !authRow,
    sendForApprovalStatus,
    typeOptions: [
      { id: 'invoice', name: 'Invoice' },
      { id: 'payment', name: 'Payment' },
    ],
  };
}

export async function dbGetBankingDetail(bdId) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT BD_ID, NAME, ADDRESS, AC_NO, BANK, B_ADDRESS, BANK_SWIFT_CODE,
            IBAN_NO, FED_ABA, C_BANK_NAME, C_SWIFT_CODE, CORRES_ADDRESS, B_ACNO
     FROM banking_details
     WHERE BD_ID = ?
     LIMIT 1`,
    [bdId],
  );
  if (!row) return null;
  return {
    id: String(row.BD_ID),
    name: row.NAME ?? '',
    address: row.ADDRESS ?? '',
    accountNo: row.AC_NO ?? '',
    bank: row.BANK ?? '',
    bankAddress: row.B_ADDRESS ?? '',
    swiftCode: row.BANK_SWIFT_CODE ?? '',
    ibanNo: row.IBAN_NO ?? '',
    fedAba: row.FED_ABA ?? '',
    correspondentBankName: row.C_BANK_NAME ?? '',
    correspondentBankAddress: row.CORRES_ADDRESS ?? '',
    correspondentAccountNo: row.B_ACNO ?? '',
    correspondentSwiftCode: row.C_SWIFT_CODE ?? '',
  };
}

export async function dbGetVendorBanking(vendorId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT SLAVEID, NAME, ADDRESS, ACCOUNTNO, BANK_NAME, BANK_ADDRESS, SWIFT_CODE,
            IBAN_NO, IBAN_REMARKS, US_CORRES_BANK
     FROM vendor_master_slave
     WHERE VENDORID = ?
     ORDER BY SLAVEID`,
    [vendorId],
  );
  return rows.map((row) => ({
    id: String(row.SLAVEID),
    name: row.BANK_NAME || row.NAME || `Bank ${row.SLAVEID}`,
    address: row.ADDRESS ?? '',
    accountNo: row.ACCOUNTNO ?? '',
    bank: row.BANK_NAME ?? '',
    bankAddress: row.BANK_ADDRESS ?? '',
    swiftCode: row.SWIFT_CODE ?? '',
    ibanNo: row.IBAN_NO ?? '',
    fedAba: row.IBAN_REMARKS ?? '',
    correspondentBankName: row.US_CORRES_BANK ?? '',
    correspondentBankAddress: '',
    correspondentAccountNo: '',
    correspondentSwiftCode: '',
  }));
}

export async function dbCreateGenericInvoice(payload = {}, { userId = appContext.userId } = {}) {
  const pool = getPool();

  const type = String(payload.type || 'invoice').toLowerCase() === 'payment' ? 'payment' : 'invoice';
  const shipOwner = String(payload.selFromOwner || payload.shipOwner || '').trim();
  const vendor = String(payload.selVendor || payload.vendor || '').trim();
  const contractDetails = String(payload.txtContractDetails || payload.contractDetails || '').trim();
  const invoiceType = String(payload.selIType || payload.invoiceType || '').trim();
  const invoiceNo = String(payload.txtInvoiceNo || payload.invoiceNo || '').trim();
  const invoiceDate = toSqlDate(payload.txtInvoiceDate || payload.invoiceDate);
  const dueDate = toSqlDate(payload.txtDueDate || payload.dueDate);
  const currency = String(payload.selExchangeCurrency || payload.exchangeCurrency || 'USD').trim();
  const paymentTerms = String(payload.txtPaymentTerms || payload.paymentTerms || '').trim();
  const description = String(payload.txtDesc || payload.remarks || '').trim();
  const amountDesc = String(payload.txtAmountDesc || payload.amountDesc || '').trim();
  const bankingId = String(payload.selNOB || payload.nob || '').trim();
  const businessTypeId = Number(payload.selBType || payload.businessTypeId || 2) || 2;
  const contractType = String(payload.selContractType || payload.contractType || '').trim();
  const atten = String(payload.txtAttenName || payload.atten || '').trim();
  const paymentStatus = String(payload.payment_status || payload.paymentStatus || '').trim();
  const mainAmount = parseAmount(payload.txtMainAmount || payload.amount);
  const addRows = parseLineRows(payload.addRows).filter(
    (row) => String(row.description || '').trim() || parseAmount(row.amount),
  );
  const subRows = parseLineRows(payload.subRows).filter(
    (row) => String(row.description || '').trim() || parseAmount(row.amount),
  );
  const addTotal = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
  const subTotal = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
  const netAmount = Number((mainAmount + addTotal - subTotal).toFixed(2));

  let status = Number(payload.txtStatus ?? payload.status);
  if (!Number.isFinite(status)) status = 0;
  if (status !== 0) {
    const lookups = await dbGetGenericInvoiceLookups(userId);
    status = Number(lookups.sendForApprovalStatus) || 1;
  }

  const approversRaw = payload.selApprovers || payload.approvers || [];
  const approvers = Array.isArray(approversRaw)
    ? approversRaw.map(String).filter(Boolean)
    : String(approversRaw).split(',').map((v) => v.trim()).filter(Boolean);

  if (status === 1 && !approvers.length) {
    throw new Error('Please select Level 1 Approvers first.');
  }

  const required = [
    [shipOwner, 'Invoicing Company is required.'],
    [vendor, 'Vendor (To) is required.'],
    [contractDetails, 'Contract Details are required.'],
    [amountDesc, 'Amount Description is required.'],
    [mainAmount > 0, 'Main Amount is required.'],
    [invoiceDate, 'Invoice Date is required.'],
    [invoiceType, 'Invoice Type is required.'],
    [invoiceNo, 'Invoice Number is required.'],
    [dueDate, 'Due Date is required.'],
    [currency, 'Working Currency is required.'],
    [paymentTerms, 'Payment Terms are required.'],
    [bankingId, 'Banking Details are required.'],
    [description, 'Description is required.'],
  ];
  for (const [ok, message] of required) {
    if (!ok) throw new Error(message);
  }

  const upload = String(payload.upload || payload.UPLOAD || '').trim();
  const uploadName = String(payload.uploadName || payload.UPLOAD_NAME || '').trim();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO generic_invoice_master (
         MODULEID, MCOMPANYID, INVOICE_DATE, I_TYPE, INVOICE_NO, NOB, STATUS,
         VENDOR, AMOUNT, NET_AMOUNT, REMARKS, PAYMENT_TERMS, ATTEN, DUE_DATE,
         EXCHANGE_CURRENCY, SHIP_OWNER, CONTRACT_DETAILS, CONTRACT_TYPE,
         BUSINESSTYPEID, AMOUNT_DESC, TYPE, CREATOR, APPROVERS, PAYMENT_STATUS,
         UPLOAD, UPLOAD_NAME, ATTACHMENTS, ATTACHMENTS_NAME
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        MODULE_ID,
        COMPANY_ID,
        invoiceDate,
        invoiceType,
        invoiceNo,
        bankingId,
        status,
        vendor,
        mainAmount,
        netAmount,
        description,
        paymentTerms,
        atten,
        dueDate,
        currency,
        shipOwner,
        contractDetails,
        contractType,
        businessTypeId,
        amountDesc,
        type,
        userId,
        approvers.join(','),
        paymentStatus || null,
        upload,
        uploadName,
        upload,
        uploadName,
      ],
    );

    const invoiceId = result.insertId;
    for (const row of addRows) {
      await connection.query(
        `INSERT INTO generic_invoice_slave (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY)
         VALUES (?, ?, ?, 'add')`,
        [invoiceId, String(row.description || '').trim(), parseAmount(row.amount)],
      );
    }
    for (const row of subRows) {
      await connection.query(
        `INSERT INTO generic_invoice_slave (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY)
         VALUES (?, ?, ?, 'sub')`,
        [invoiceId, String(row.description || '').trim(), parseAmount(row.amount)],
      );
    }

    await connection.commit();
    return { msg: 0, invoiceId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
