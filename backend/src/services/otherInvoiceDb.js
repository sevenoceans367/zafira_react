import { appContext, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';
import { dbGetBankingDetail, dbGetVendorBanking } from './genericFinancesDb.js';
import { dbLogRecentWork } from './userAlertsDb.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const APPROVAL_COLS = Object.freeze({
  creator: 'INI_FREIGHT_CHK_CRETR',
  app1: 'INI_FREIGHT_CHK_APP_1',
  app2: 'INI_FREIGHT_CHK_APP_2',
  acc: 'INI_FREIGHT_CHK_ACC',
});

const INV_TYPE_OPTIONS = [
  { id: 'Interim', name: 'Interim' },
  { id: 'Final', name: 'Final' },
];

const CURRENCY_OPTIONS = [
  { id: 'EURO', name: 'EURO' },
  { id: 'USD', name: 'USD' },
  { id: 'AUD', name: 'AUD' },
  { id: 'GBP', name: 'GBP' },
  { id: 'INR', name: 'INR' },
  { id: 'AED', name: 'AED' },
  { id: 'JPY', name: 'JPY' },
  { id: 'SGD', name: 'SGD' },
  { id: 'ZAR', name: 'ZAR' },
];

export { dbGetBankingDetail };

function str(value) {
  if (value == null || value === '') return '';
  return String(value).trim();
}

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function money2(value) {
  return Number(parseAmount(value).toFixed(2));
}

function parseDmyToSqlDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

function blankDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

/**
 * id = comId,fcaId,vendorId,amount,pTypeHint
 * Demurrage LP/DP: pTypeHint = Demurrage/Dispatch(LP|DP)
 * Other Income: pTypeHint = Other Income
 */
export function parseOtherInvoiceId(csv) {
  const parts = String(csv || '').split(',');
  return {
    comId: str(parts[0]),
    fcaId: str(parts[1]),
    vendorId: str(parts[2]),
    amount: parseAmount(parts[3]),
    pTypeHint: str(parts[4]),
  };
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseApprovers(value) {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    if (value.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map((item) => str(item)).filter(Boolean);
      } catch {
        /* fall through */
      }
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function truthyChecked(row) {
  if (row == null) return false;
  if (typeof row === 'object') {
    const v = row.checked ?? row.selected ?? row.chk;
    if (v === true || v === 1 || v === '1' || v === 'true') return true;
    if (v === false || v === 0 || v === '0' || v === 'false') return false;
    return Boolean(row.vendorId || row.VENDORID || row.VENDOR || row.port || row.PORT || row.randomId || row.RANDOMID);
  }
  return false;
}

function isOtherIncomeContext({ name = '', pTypeHint = '' } = {}) {
  return /other\s*income/i.test(pTypeHint) || /other\s*income/i.test(name);
}

function isDemurrageContext({ name = '', portType = '', pTypeHint = '' } = {}) {
  if (isOtherIncomeContext({ name, pTypeHint })) return false;
  const pt = str(portType).toUpperCase();
  if (pt === 'LP' || pt === 'DP') return true;
  return /demurrage/i.test(name) || /demurrage/i.test(pTypeHint);
}

function normalizeInvType(invType) {
  const raw = str(invType);
  if (!raw) return 'Interim';
  if (/^final$/i.test(raw)) return 'Final';
  if (/^interim$/i.test(raw)) return 'Interim';
  return raw;
}

async function getVendorRow(pool, code) {
  if (!code) return null;
  const [[row]] = await pool.query(
    `SELECT CODE, NAME, VENDORID, STREET_1, CITY, COUNTRY, CITY_POSTAL_CODE
     FROM vendor_master
     WHERE CODE = ?
     LIMIT 1`,
    [code],
  ).catch(() => [[null]]);
  return row || null;
}

async function getPortName(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    `SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1`,
    [portId],
  ).catch(() => [[null]]);
  return str(row?.PortName);
}

async function getPortNames(pool, fcaId) {
  const [legs] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
     ORDER BY FCA_SLAVEID`,
    [fcaId],
  ).catch(() => [[]]);

  const load = [];
  const disc = [];
  for (const leg of legs || []) {
    if (Number(leg.LOAD_PORT_QTY) > 0 && leg.FROM_PORT) {
      const name = await getPortName(pool, leg.FROM_PORT);
      if (name) load.push(name);
    }
    if (Number(leg.DISC_PORT_QTY) > 0 && (leg.TO_PORT || leg.FROM_PORT)) {
      const name = await getPortName(pool, leg.TO_PORT || leg.FROM_PORT);
      if (name) disc.push(name);
    }
  }
  return {
    loadPorts: [...new Set(load)].join(', '),
    dischargePorts: [...new Set(disc)].join(', '),
  };
}

async function getFixtureOptions(pool) {
  const [vcRows] = await pool.query(
    `SELECT m.VOYAGE_NO AS fixtureNo, m.VESSEL_IMO_ID AS vesselId, vim.VESSEL_NAME AS vesselName
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.SHEET_NO IS NOT NULL
       AND m.VOYAGE_NO IS NOT NULL
       AND TRIM(m.VOYAGE_NO) != ''
     ORDER BY m.FCAID DESC
     LIMIT 400`,
  ).catch(() => [[]]);

  const [tcRows] = await pool.query(
    `SELECT m.TC_NO AS fixtureNo, m.VESSEL_IMO_ID AS vesselId, vim.VESSEL_NAME AS vesselName
     FROM chartering_estimate_tc_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.SHEET_NO IS NOT NULL
       AND m.TC_NO IS NOT NULL
       AND TRIM(m.TC_NO) != ''
     ORDER BY m.TCOUTID DESC
     LIMIT 200`,
  ).catch(() => [[]]);

  const seen = new Set();
  const fixtures = [];
  const vesselsById = new Map();

  for (const row of [...(tcRows || []), ...(vcRows || [])]) {
    const fixtureNo = str(row.fixtureNo);
    if (!fixtureNo || seen.has(fixtureNo)) continue;
    seen.add(fixtureNo);
    const vesselId = str(row.vesselId);
    const vesselName = str(row.vesselName);
    fixtures.push({
      id: fixtureNo,
      name: fixtureNo,
      vesselId,
      vesselName,
    });
    if (vesselId && !vesselsById.has(vesselId)) {
      vesselsById.set(vesselId, {
        id: vesselId,
        name: vesselName || vesselId,
      });
    }
  }

  return {
    fixtures,
    vessels: [...vesselsById.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function getUserAuthority(pool, userId, col) {
  if (!userId || !col) return 0;
  const [[row]] = await pool.query(
    `SELECT ${col} AS flag
     FROM approval_matrix
     WHERE MCOMPANYID = ? AND LOGINID = ?
     LIMIT 1`,
    [COMPANY_ID, userId],
  ).catch(() => [[null]]);
  return Number(row?.flag) === 1 ? 1 : 0;
}

async function getUsersWithAuthority(pool, col) {
  if (!col) return [];
  const [rows] = await pool.query(
    `SELECT am.LOGINID AS id
     FROM approval_matrix am
     INNER JOIN login l ON l.LOGINID = am.LOGINID
     WHERE am.MCOMPANYID = ? AND am.${col} = 1 AND l.STATUS = 1`,
    [COMPANY_ID],
  ).catch(() => [[]]);
  return (rows || []).map((row) => String(row.id));
}

async function getApproverContext(pool, userId) {
  const cols = APPROVAL_COLS;

  const [approverRows] = await pool.query(
    `SELECT am.LOGINID AS id, l.CONTACT_PERSON AS name
     FROM approval_matrix am
     INNER JOIN login l ON l.LOGINID = am.LOGINID
     WHERE am.MCOMPANYID = ? AND am.${cols.app1} = 1 AND l.STATUS = 1
     ORDER BY l.CONTACT_PERSON`,
    [COMPANY_ID],
  ).catch(() => [[]]);

  const [[matrixCounts]] = await pool.query(
    `SELECT
       SUM(CASE WHEN ${cols.app1} = 1 THEN 1 ELSE 0 END) AS app1,
       SUM(CASE WHEN ${cols.app2} = 1 THEN 1 ELSE 0 END) AS app2
     FROM approval_matrix
     WHERE MCOMPANYID = ?`,
    [COMPANY_ID],
  ).catch(() => [[{ app1: 0, app2: 0 }]]);

  const hasApp1 = Number(matrixCounts?.app1) > 0;
  const hasApp2 = Number(matrixCounts?.app2) > 0;
  let sendForApprovalStatus = 1;
  if (!hasApp1 && !hasApp2) sendForApprovalStatus = 5;
  else if (!hasApp1 && hasApp2) sendForApprovalStatus = 4;

  const [creator, approver1, approver2] = await Promise.all([
    getUserAuthority(pool, userId, cols.creator),
    getUserAuthority(pool, userId, cols.app1),
    getUserAuthority(pool, userId, cols.app2),
  ]);

  return {
    approvers: (approverRows || []).map((row) => ({
      id: String(row.id),
      name: row.name || String(row.id),
    })),
    sendForApprovalStatus,
    hasApp1,
    hasApp2,
    creator: creator === 1,
    approver1: approver1 === 1,
    approver2: approver2 === 1,
  };
}

function computePayable({
  grossAmt,
  clubTotal,
  addTotal,
  subTotal,
  taxApplicable,
  gstVat,
  sgstPercent,
  cgstPercent,
  igstPercent,
  vatPercent,
}) {
  const netPayable = money2(grossAmt + clubTotal + addTotal - subTotal);
  const sgstAmount = money2((netPayable * sgstPercent) / 100);
  const cgstAmount = money2((netPayable * cgstPercent) / 100);
  const igstAmount = money2((netPayable * igstPercent) / 100);
  const vatAmount = money2((netPayable * vatPercent) / 100);

  let netPayableTax = netPayable;
  if (Number(taxApplicable) === 1) {
    if (Number(gstVat) === 1) {
      netPayableTax = money2(netPayable + sgstAmount + cgstAmount + igstAmount);
    } else {
      netPayableTax = money2(netPayable + vatAmount);
    }
  }

  return {
    netPayable,
    netPayableTax,
    sgstAmount,
    cgstAmount,
    igstAmount,
    vatAmount,
  };
}

async function inactiveUserAlerts(poolOrConn, identify, identifyId) {
  if (!identify || !identifyId) return;
  await poolOrConn.query(
    `UPDATE alert_master SET SHOW_STATUS = 0 WHERE IDENTIFY = ? AND IDENTIFYID = ?`,
    [identify, identifyId],
  ).catch(() => undefined);
}

async function saveUserAlerts(poolOrConn, {
  sentBy,
  sentTo,
  redirectTo,
  identify,
  comments,
  identifyId,
}) {
  if (!sentTo || !identifyId) return;
  await poolOrConn.query(
    `INSERT INTO alert_master
       (ADDEDBY, ADDONDATE, SENDTO, REDIRECTTO, SHOW_STATUS, IDENTIFY, COMMENTS, IDENTIFYID, MCOMPANYID)
     VALUES (?, NOW(), ?, ?, 1, ?, ?, ?, ?)`,
    [
      sentBy || appContext.userId,
      sentTo,
      redirectTo || '',
      identify,
      comments || '',
      identifyId,
      COMPANY_ID,
    ],
  ).catch(() => undefined);
}

async function getContactPerson(pool, loginId) {
  if (!loginId) return '';
  const [[row]] = await pool.query(
    `SELECT CONTACT_PERSON FROM login WHERE LOGINID = ? LIMIT 1`,
    [loginId],
  ).catch(() => [[null]]);
  return str(row?.CONTACT_PERSON);
}

async function fireOtherInvoiceAlerts(pool, {
  invoiceId,
  status,
  pType,
  invoiceNo,
  vesselName,
  creatorLoginId,
  approvers,
  userId,
  redirectUrl,
}) {
  await inactiveUserAlerts(pool, 'OTHER INVOICE', invoiceId);
  if (!(Number(status) >= 1) || !invoiceId) return;

  const cols = APPROVAL_COLS;
  const currentUserName = (await getContactPerson(pool, userId)) || 'User';
  const label = `${pType || 'OTHER INVOICE'} (${vesselName || '-'} - ${invoiceNo || ''})`;

  let recipients = [];
  let comments = '';

  if (Number(status) === 1) {
    recipients = approvers.length
      ? approvers
      : await getUsersWithAuthority(pool, cols.app2);
    comments = `${currentUserName} sent ${label} for Level 1 Approval`;
  } else if (Number(status) === 2) {
    recipients = creatorLoginId ? [String(creatorLoginId)] : [];
    comments = `${currentUserName} sent ${label} for Review`;
  } else if (Number(status) === 4) {
    recipients = approvers.length
      ? approvers
      : await getUsersWithAuthority(pool, cols.app1);
    comments = `${currentUserName} sent ${label} for Review`;
  } else if (Number(status) === 3) {
    recipients = await getUsersWithAuthority(pool, cols.app2);
    comments = `${currentUserName} sent ${label} for Level 2 Approval`;
  } else if (Number(status) === 5) {
    recipients = await getUsersWithAuthority(pool, cols.acc);
    comments = `${currentUserName} Approved ${label}`;
  }

  for (const to of recipients) {
    await saveUserAlerts(pool, {
      sentBy: userId,
      sentTo: to,
      redirectTo: redirectUrl,
      identify: 'OTHER INVOICE',
      comments,
      identifyId: invoiceId,
    });
  }
}

async function loadSlaveLineRows(pool, invoiceId) {
  if (!invoiceId) return { addRows: [], subRows: [] };
  const [rows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT, IDENTIFY
     FROM other_invoice_slave
     WHERE INVOICEID = ?`,
    [invoiceId],
  ).catch(() => [[]]);
  const addRows = [];
  const subRows = [];
  for (const row of rows || []) {
    const mapped = {
      description: str(row.DESCRIPTION),
      amount: money2(row.AMOUNT),
    };
    if (String(row.IDENTIFY).toUpperCase() === 'SUB') subRows.push(mapped);
    else addRows.push(mapped);
  }
  return { addRows, subRows };
}

async function loadDemurrageClubRows(pool, {
  comId,
  fcaId,
  vendorId,
  portType,
  randomId,
  portId,
  draftInvoiceId,
}) {
  const [legs] = await pool.query(
    `SELECT *
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
     ORDER BY FCA_SLAVEID`,
    [fcaId],
  ).catch(() => [[]]);

  const currentPortType = str(portType).toUpperCase();
  const currentRandomId = str(randomId);
  const currentPortId = str(portId);
  const out = [];
  let idx = 0;

  for (const leg of legs || []) {
    const legRandomId = str(leg.RANDOMID);
    const fromPort = str(leg.FROM_PORT);
    const toPort = str(leg.TO_PORT);

    const skipLpCurrent = currentPortType === 'LP'
      && currentPortId === fromPort
      && currentRandomId === legRandomId;
    if (
      leg.IS_SHOW_DDCLP == null
      && str(leg.DDCLP_VENDOR) === vendorId
      && !skipLpCurrent
    ) {
      idx += 1;
      const checked = await isDemurrageClubbed(pool, {
        comId,
        vendorId,
        randomId: legRandomId,
        port: 'LP',
        portId: fromPort,
        draftInvoiceId,
      });
      const portName = await getPortName(pool, fromPort);
      out.push({
        id: `lp-${idx}`,
        port: 'LP',
        portId: fromPort,
        portLabel: `Load Port ${portName || fromPort}`,
        randomId: legRandomId,
        vendorId: str(leg.DDCLP_VENDOR),
        amount: money2(leg.DDCLP_NETCOST),
        checked,
      });
    }

    const skipDpCurrent = currentPortType === 'DP'
      && currentPortId === toPort
      && currentRandomId === legRandomId;
    if (
      leg.IS_SHOW_DDCDP == null
      && str(leg.DDCDP_VENDOR) === vendorId
      && !skipDpCurrent
    ) {
      idx += 1;
      const checked = await isDemurrageClubbed(pool, {
        comId,
        vendorId,
        randomId: legRandomId,
        port: 'DP',
        portId: toPort,
        draftInvoiceId,
      });
      const portName = await getPortName(pool, toPort);
      out.push({
        id: `dp-${idx}`,
        port: 'DP',
        portId: toPort,
        portLabel: `Discharge Port ${portName || toPort}`,
        randomId: legRandomId,
        vendorId: str(leg.DDCDP_VENDOR),
        amount: money2(leg.DDCDP_NETCOST),
        checked,
      });
    }
  }

  return out;
}

async function isDemurrageClubbed(pool, {
  comId,
  vendorId,
  randomId,
  port,
  portId,
  draftInvoiceId,
}) {
  if (draftInvoiceId) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM other_invoice_slave1
       WHERE INVOICEID = ?
         AND VENDORID = ?
         AND RANDOMID = ?
         AND PORT = ?
         AND PORTID = ?`,
      [draftInvoiceId, vendorId, randomId || '0', port, portId],
    ).catch(() => [[{ cnt: 0 }]]);
    return Number(row?.cnt) > 0;
  }

  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM other_invoice_slave1 s
     INNER JOIN other_invoice_master m ON m.INVOICEID = s.INVOICEID
     WHERE s.VENDORID = ?
       AND m.COMID = ?
       AND s.RANDOMID = ?
       AND s.PORT = ?
       AND s.PORTID = ?`,
    [vendorId, comId, randomId || '0', port, portId],
  ).catch(() => [[{ cnt: 0 }]]);
  return Number(row?.cnt) > 0;
}

async function loadOtherIncomeClubRows(pool, {
  comId,
  fcaId,
  vendorId,
  randomId,
  draftInvoiceId,
}) {
  const [rows] = await pool.query(
    `SELECT FCA_SLAVE3ID, IDENTY_ID, RAW_AMOUNT, RANDOMID, VENDORID
     FROM freight_cost_estimete_slave3
     WHERE FCAID = ?
       AND IDENTIFY = 'OTHERINCOME'
       AND RAW_AMOUNT > 0
       AND VENDORID = ?
       AND (? = '' OR RANDOMID != ?)
     ORDER BY FCA_SLAVE3ID`,
    [fcaId, vendorId, randomId || '', randomId || ''],
  ).catch(() => [[]]);

  const out = [];
  let idx = 0;
  for (const row of rows || []) {
    idx += 1;
    const rId = str(row.RANDOMID);
    let checked = false;
    if (draftInvoiceId) {
      const [[hit]] = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM other_invoice_slave1
         WHERE INVOICEID = ? AND VENDORID = ? AND RANDOMID = ?`,
        [draftInvoiceId, vendorId, rId],
      ).catch(() => [[{ cnt: 0 }]]);
      checked = Number(hit?.cnt) > 0;
    } else {
      const [[hit]] = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM other_invoice_slave1 s
         INNER JOIN other_invoice_master m ON m.INVOICEID = s.INVOICEID
         WHERE s.VENDORID = ? AND m.COMID = ? AND s.RANDOMID = ?`,
        [vendorId, comId, rId],
      ).catch(() => [[{ cnt: 0 }]]);
      checked = Number(hit?.cnt) > 0;
    }
    out.push({
      id: String(idx),
      slave3Id: str(row.FCA_SLAVE3ID),
      identityId: str(row.IDENTY_ID),
      portLabel: str(row.IDENTY_ID) || `Other Income ${idx}`,
      amount: money2(row.RAW_AMOUNT),
      randomId: rId,
      vendorId: str(row.VENDORID),
      checked,
    });
  }
  return out;
}

function mapDraftInvoice(row, lineRows) {
  return {
    invoiceId: String(row.INVOICEID),
    status: Number(row.STATUS) || 0,
    invType: str(row.I_TYPE) || 'Interim',
    shipOwner: str(row.SHIP_OWNER),
    invoiceNo: str(row.MESSAGE),
    invoiceDate: blankDate(row.DATE),
    dueDate: blankDate(row.DUE_DATE),
    exchangeDate: blankDate(row.EXCHANGE_DATE),
    cpDate: blankDate(row.CPDATE),
    exchangeRate: str(row.EXCHANGE_RATE || ''),
    exchangeCurrency: str(row.EXCHANGE_CURRENCY || 'USD'),
    paymentTerms: str(row.PAYMENT_TERMS),
    remarks: str(row.REMARKS),
    atten: str(row.ATTEN),
    manualVendorName: str(row.MANUAL_VENDOR_NAME),
    grossAmt: str(row.GROSS_AMT || ''),
    taxApplicable: str(row.RDOTAXAPPLICABLE || '2'),
    gstVat: str(row.RDOVATGST || '1'),
    sgstPercent: str(row.SGST_PERCENT || ''),
    cgstPercent: str(row.CGST_PERCENT || ''),
    igstPercent: str(row.IGST_PERCENT || ''),
    vatPercent: str(row.VAT_PERCENT || ''),
    paymentStatus: str(row.PAYMENT_STATUS || 'payment_payable'),
    nob: str(row.NOB || ''),
    upload: str(row.UPLOAD || ''),
    uploadName: str(row.UPLOAD_NAME || ''),
    selApprovers: parseApprovers(row.APPROVERS),
    addRows: lineRows.addRows,
    subRows: lineRows.subRows,
    netPayable: money2(row.NET_PAYABLE),
    netPayableTax: money2(row.NET_PAYABLE_TAX),
  };
}

async function findDraftInvoice(pool, {
  invoiceId,
  comId,
  vendorId,
  pType,
}) {
  if (invoiceId) {
    const [[row]] = await pool.query(
      `SELECT * FROM other_invoice_master WHERE INVOICEID = ? LIMIT 1`,
      [invoiceId],
    ).catch(() => [[null]]);
    return row || null;
  }

  const [[row]] = await pool.query(
    `SELECT * FROM other_invoice_master
     WHERE COMID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
       AND VENDOR = ?
       AND P_TYPE = ?
       AND STATUS < 5
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, vendorId, pType],
  ).catch(() => [[null]]);
  return row || null;
}

async function loadExistingInvoices(pool, {
  comId,
  voyageNo,
  vesselName,
  mgmt,
}) {
  const [rows] = await pool.query(
    `SELECT m.*,
            vm.NAME AS VENDOR_NAME
     FROM other_invoice_master m
     LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
     WHERE m.COMID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.STATUS >= 5
     ORDER BY m.INVOICEID DESC`,
    [comId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[]]);

  return (rows || []).map((row) => {
    const status = Number(row.STATUS) || 0;
    const paid = parseAmount(row.P_AMT);
    return {
      invoiceId: String(row.INVOICEID),
      voyageNo: voyageNo || '',
      vesselName: vesselName || '',
      invoiceType: str(row.P_TYPE || row.I_TYPE),
      invType: str(row.I_TYPE),
      invoiceNo: str(row.MESSAGE),
      chartererName: str(row.VENDOR_NAME || row.VENDOR),
      amount: money2(row.NET_PAYABLE_TAX || row.NET_PAYABLE),
      remarks: str(row.REMARKS),
      status,
      paymentStatus: str(row.PAYMENT_STATUS),
      pAmt: money2(row.P_AMT),
      pDate: blankDate(row.P_DATE),
      canReceivePayment: status === 5 && paid <= 0,
      canCancel: Boolean(mgmt) && status === 5,
      canReopen: Boolean(mgmt) && status >= 5 && status !== 8,
      canDelete: Boolean(mgmt),
      canPdf: true,
    };
  });
}

/**
 * PHP invoice_others.php form context — Demurrage LP/DP + Other Income.
 */
export async function dbGetOtherInvoiceForm({
  id,
  name,
  amountTitle,
  page = '1',
  portType,
  randomId,
  portId,
  voyageNo = '',
  userId = appContext.userId,
  mgmtUser = isMgmtUser(),
} = {}) {
  const pool = getPool();
  const parsed = parseOtherInvoiceId(id);
  const resolvedComId = str(parsed.comId);
  if (!resolvedComId) {
    throw Object.assign(new Error('COMID is required.'), { status: 400 });
  }

  const pType = str(name) || str(parsed.pTypeHint) || 'Other Invoice';
  const otherIncome = isOtherIncomeContext({ name: pType, pTypeHint: parsed.pTypeHint });
  const demurrage = isDemurrageContext({
    name: pType,
    pTypeHint: parsed.pTypeHint,
    portType,
  });

  const [[compare]] = await pool.query(
    `SELECT c.*, m.VOYAGE_NO AS MASTER_VOYAGE_NO, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID,
            m.TRANS_DATE, m.COAID, vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [resolvedComId, MODULE_ID],
  );

  if (!compare?.COMID) {
    throw Object.assign(new Error('VC nomination not found.'), { status: 404 });
  }

  const [[latest]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [resolvedComId, MODULE_ID],
  );
  const fcaId = parsed.fcaId || latest?.FCAID || compare.FCAID;
  const [[master]] = await pool.query(
    `SELECT * FROM freight_cost_estimete_master WHERE FCAID = ? LIMIT 1`,
    [fcaId],
  );

  const vendorId = parsed.vendorId;
  const vendor = await getVendorRow(pool, vendorId);
  const ports = await getPortNames(pool, fcaId);
  const outstandingAmount = money2(parsed.amount);

  const vendorAddressParts = [
    vendor?.NAME,
    vendor?.STREET_1,
    vendor?.CITY,
    vendor?.COUNTRY,
    vendor?.CITY_POSTAL_CODE,
  ].map(str).filter(Boolean);

  const [owners] = await pool.query(
    `SELECT CODE AS id, CONCAT(NAME, ' (', CODE, ')') AS name
     FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID = 11 AND MCOMPANYID = ?
     ORDER BY NAME`,
    [COMPANY_ID],
  ).catch(() => [[]]);

  const [orcOptions] = await pool.query(
    `SELECT OWNER_RCOSTID AS id, NAME AS name
     FROM owner_related_cost_master
     ORDER BY NAME`,
  ).catch(() => [[]]);

  const [bankingDetails] = await pool.query(
    `SELECT BD_ID AS id, CONCAT(NAME, ' - ', BANK) AS name
     FROM banking_details
     WHERE STATUS = 1
     ORDER BY NAME`,
  ).catch(() => [[]]);

  let vendorBanking = [];
  if (vendor?.VENDORID) {
    vendorBanking = await dbGetVendorBanking(vendor.VENDORID).catch(() => []);
  }

  const { fixtures, vessels } = await getFixtureOptions(pool);
  const approval = await getApproverContext(pool, userId);

  let currency = 'USD';
  const coaId = master?.COAID || compare.COAID;
  if (coaId) {
    const [[coa]] = await pool.query(
      `SELECT CURRENCY FROM coa_master WHERE COAID = ? LIMIT 1`,
      [coaId],
    ).catch(() => [[null]]);
    if (coa?.CURRENCY) currency = str(coa.CURRENCY);
  }

  const voyage = str(voyageNo)
    || str(compare.MASTER_VOYAGE_NO)
    || str(master?.VOYAGE_NO)
    || str(compare.MESSAGE);
  const vesselName = str(compare.VESSEL_NAME);
  const cpDate = blankDate(compare.TRANS_DATE || master?.TRANS_DATE);

  const draft = await findDraftInvoice(pool, {
    comId: resolvedComId,
    vendorId,
    pType,
  });
  const draftId = draft?.INVOICEID || null;

  let demurrageClubRows = [];
  let otherIncomeClubRows = [];
  if (otherIncome) {
    otherIncomeClubRows = await loadOtherIncomeClubRows(pool, {
      comId: resolvedComId,
      fcaId,
      vendorId,
      randomId: str(randomId),
      draftInvoiceId: draftId,
    });
  } else if (demurrage) {
    demurrageClubRows = await loadDemurrageClubRows(pool, {
      comId: resolvedComId,
      fcaId,
      vendorId,
      portType,
      randomId: str(randomId),
      portId: str(portId),
      draftInvoiceId: draftId,
    });
  }

  let currentRequest = null;
  if (draft) {
    const lineRows = await loadSlaveLineRows(pool, draft.INVOICEID);
    currentRequest = mapDraftInvoice(draft, lineRows);
  }

  const existingInvoices = await loadExistingInvoices(pool, {
    comId: resolvedComId,
    voyageNo: voyage,
    vesselName,
    mgmt: Boolean(mgmtUser),
  });

  const defaults = {
    shipOwner: currentRequest?.shipOwner || '',
    invType: currentRequest?.invType || 'Interim',
    manualVendorName: currentRequest?.manualVendorName || vendorAddressParts.join(' '),
    atten: currentRequest?.atten || '',
    invoiceNo: currentRequest?.invoiceNo || '',
    invoiceDate: currentRequest?.invoiceDate || '',
    dueDate: currentRequest?.dueDate || '',
    cpDate: currentRequest?.cpDate || cpDate,
    exchangeCurrency: currentRequest?.exchangeCurrency || currency || 'USD',
    exchangeRate: currentRequest?.exchangeRate || '1',
    exchangeDate: currentRequest?.exchangeDate || '',
    paymentTerms: currentRequest?.paymentTerms || '',
    remarks: currentRequest?.remarks || '',
    grossAmt: currentRequest?.grossAmt || (outstandingAmount ? String(outstandingAmount) : ''),
    taxApplicable: currentRequest?.taxApplicable || '2',
    gstVat: currentRequest?.gstVat || '1',
    sgstPercent: currentRequest?.sgstPercent || '',
    cgstPercent: currentRequest?.cgstPercent || '',
    igstPercent: currentRequest?.igstPercent || '',
    vatPercent: currentRequest?.vatPercent || '',
    paymentStatus: currentRequest?.paymentStatus || 'payment_payable',
    nob: currentRequest?.nob || '',
    selApprovers: currentRequest?.selApprovers || [],
    upload: currentRequest?.upload || '',
    uploadName: currentRequest?.uploadName || '',
  };

  return {
    comId: resolvedComId,
    fcaId: String(fcaId || ''),
    invoiceIdCsv: id || '',
    pType,
    pTypeHint: parsed.pTypeHint,
    amountTitle: str(amountTitle) || pType,
    page: String(page || '1'),
    portType: str(portType).toUpperCase(),
    randomId: str(randomId),
    portId: str(portId),
    isOtherIncome: otherIncome,
    isDemurrage: demurrage,
    voyageNo: voyage,
    vesselName,
    vesselImoId: str(compare.MASTER_VESSEL_IMO_ID || master?.VESSEL_IMO_ID),
    cpDate,
    vendorId,
    vendorName: str(vendor?.NAME),
    vendorAddress: vendorAddressParts.join(', '),
    vendorInternalId: vendor?.VENDORID != null ? String(vendor.VENDORID) : '',
    loadPorts: ports.loadPorts,
    dischargePorts: ports.dischargePorts,
    currency,
    outstandingAmount,
    invTypes: INV_TYPE_OPTIONS,
    currencies: CURRENCY_OPTIONS,
    owners: (owners || []).map((row) => ({ id: String(row.id), name: row.name })),
    orcOptions: (orcOptions || []).map((row) => ({
      id: String(row.id),
      name: row.name,
    })),
    fixtures,
    vessels,
    bankingDetails: (bankingDetails || []).map((row) => ({
      id: String(row.id),
      name: row.name,
    })),
    vendorBanking,
    demurrageClubRows,
    otherIncomeClubRows,
    existingInvoices,
    currentRequest,
    currentInvoice: currentRequest,
    approvers: approval.approvers,
    sendForApprovalStatus: approval.sendForApprovalStatus,
    auth: {
      creator: approval.creator,
      approver1: approval.approver1,
      approver2: approval.approver2,
      isMgmtUser: Boolean(mgmtUser),
      sendForApprovalStatus: approval.sendForApprovalStatus,
      hasApp1: approval.hasApp1,
      hasApp2: approval.hasApp2,
    },
    defaults,
  };
}

function parseLineRows(rows) {
  return parseJsonArray(rows)
    .map((row) => ({
      description: str(row.description || row.DESCRIPTION || ''),
      amount: parseAmount(row.amount ?? row.AMOUNT),
    }))
    .filter((row) => row.description || row.amount);
}

function parseDemClubRows(rows) {
  return parseJsonArray(rows)
    .filter((row) => truthyChecked(row) || row.port || row.PORT)
    .map((row) => ({
      port: str(row.port || row.PORT || ''),
      portId: str(row.portId || row.PORTID || ''),
      randomId: str(row.randomId || row.RANDOMID || '0') || '0',
      vendorId: str(row.vendorId || row.VENDORID || ''),
      amount: parseAmount(row.amount ?? row.DEM_AMT),
      checked: truthyChecked(row) || true,
    }))
    .filter((row) => row.port && row.portId && row.checked);
}

function parseOtherIncomeClubSaveRows(rows) {
  return parseJsonArray(rows)
    .filter((row) => truthyChecked(row) || row.randomId || row.RANDOMID)
    .map((row) => ({
      vendorId: str(row.vendorId || row.VENDORID || ''),
      randomId: str(row.randomId || row.RANDOMID || '0') || '0',
      amount: parseAmount(row.amount ?? row.DEM_AMT ?? row.RAW_AMOUNT),
      checked: truthyChecked(row) || true,
    }))
    .filter((row) => row.vendorId && row.checked);
}

async function deleteInvoiceSlaves(conn, invoiceId) {
  await conn.query(`DELETE FROM other_invoice_slave WHERE INVOICEID = ?`, [invoiceId]);
  await conn.query(`DELETE FROM other_invoice_slave1 WHERE INVOICEID = ?`, [invoiceId]);
}

async function insertInvoiceSlaves(conn, invoiceId, {
  addRows,
  subRows,
  demClubRows,
  otherIncomeClubRows,
}) {
  for (const row of addRows) {
    await conn.query(
      `INSERT INTO other_invoice_slave (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY)
       VALUES (?, ?, ?, 'ADD')`,
      [invoiceId, row.description, row.amount],
    );
  }
  for (const row of subRows) {
    await conn.query(
      `INSERT INTO other_invoice_slave (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY)
       VALUES (?, ?, ?, 'SUB')`,
      [invoiceId, row.description, row.amount],
    );
  }
  for (const row of demClubRows) {
    await conn.query(
      `INSERT INTO other_invoice_slave1 (INVOICEID, VENDORID, DEM_AMT, RANDOMID, PORT, PORTID)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoiceId, row.vendorId, row.amount, row.randomId, row.port, row.portId],
    );
  }
  for (const row of otherIncomeClubRows) {
    await conn.query(
      `INSERT INTO other_invoice_slave1 (INVOICEID, VENDORID, DEM_AMT, RANDOMID)
       VALUES (?, ?, ?, ?)`,
      [invoiceId, row.vendorId, row.amount, row.randomId],
    );
  }
}

/**
 * Upsert other_invoice_master + slaves — PHP insertOtherInvoiceDetails.
 */
export async function dbSaveOtherInvoice(payload = {}, { userId = appContext.userId } = {}) {
  const pool = getPool();
  const parsed = parseOtherInvoiceId(payload.id || payload.invoiceIdCsv);
  const comId = str(payload.comId || parsed.comId);
  const fcaId = str(payload.fcaId || parsed.fcaId);
  const vendorId = str(payload.vendorId || parsed.vendorId);
  const invType = normalizeInvType(payload.invType || payload.iType || payload.selIType || 'Interim');
  const pType = str(payload.pType || payload.name) || str(parsed.pTypeHint) || 'Other Invoice';

  if (!comId) throw Object.assign(new Error('COMID is required.'), { status: 400 });
  if (!vendorId) throw Object.assign(new Error('Vendor is required.'), { status: 400 });
  if (!fcaId) throw Object.assign(new Error('Cost sheet (FCAID) is required.'), { status: 400 });

  const shipOwner = str(payload.shipOwner || payload.selFromOwner);
  const invoiceNo = str(payload.invoiceNo || payload.txtDNote);
  const invoiceDate = parseDmyToSqlDate(payload.invoiceDate || payload.txtDate);
  const dueDate = parseDmyToSqlDate(payload.dueDate || payload.txtDueDate);
  const exchangeDate = parseDmyToSqlDate(payload.exchangeDate || payload.txtExchangeDate);
  const cpDate = parseDmyToSqlDate(payload.cpDate || payload.txtCP_Date) || '1970-01-01';
  const grossAmt = parseAmount(payload.grossAmt || payload.txtInvAmount || parsed.amount);

  const addRows = parseLineRows(payload.addRows);
  const subRows = parseLineRows(payload.subRows);
  const demClubRows = parseDemClubRows(payload.demurrageClubRows || payload.demurrageRows);
  const otherIncomeClubRows = parseOtherIncomeClubSaveRows(
    payload.otherIncomeClubRows || payload.otherIncomeRows,
  );

  const clubTotal = money2(
    demClubRows.reduce((sum, row) => sum + row.amount, 0)
    + otherIncomeClubRows.reduce((sum, row) => sum + row.amount, 0),
  );
  const addTotal = addRows.reduce((sum, row) => sum + row.amount, 0);
  const subTotal = subRows.reduce((sum, row) => sum + row.amount, 0);

  const taxApplicable = Number(payload.taxApplicable || payload.rdoTaxApplicable || 2) || 2;
  const gstVat = Number(payload.gstVat || payload.rdoGSTVAT || 1) || 1;
  const sgstPercent = parseAmount(payload.sgstPercent || payload.txtSGST);
  const cgstPercent = parseAmount(payload.cgstPercent || payload.txtCGST);
  const igstPercent = parseAmount(payload.igstPercent || payload.txtIGST);
  const vatPercent = parseAmount(payload.vatPercent || payload.txtVAT);

  const computed = computePayable({
    grossAmt,
    clubTotal,
    addTotal,
    subTotal,
    taxApplicable,
    gstVat,
    sgstPercent,
    cgstPercent,
    igstPercent,
    vatPercent,
  });

  const netPayable = payload.netPayable != null && payload.netPayable !== ''
    ? money2(payload.netPayable || payload.txtNetAmtPayable)
    : computed.netPayable;
  const netPayableTax = payload.netPayableTax != null && payload.netPayableTax !== ''
    ? money2(payload.netPayableTax || payload.txtAmtPayableWithTax)
    : computed.netPayableTax;
  const sgstAmount = payload.sgstAmount != null ? money2(payload.sgstAmount) : computed.sgstAmount;
  const cgstAmount = payload.cgstAmount != null ? money2(payload.cgstAmount) : computed.cgstAmount;
  const igstAmount = payload.igstAmount != null ? money2(payload.igstAmount) : computed.igstAmount;
  const vatAmount = payload.vatAmount != null ? money2(payload.vatAmount) : computed.vatAmount;

  if (!shipOwner) throw Object.assign(new Error('Invoicing Company is required.'), { status: 400 });
  if (!invoiceNo) throw Object.assign(new Error('Invoice Number is required.'), { status: 400 });
  if (!invoiceDate) throw Object.assign(new Error('Invoice Date is required.'), { status: 400 });

  const status = Number(payload.status ?? payload.txtStatus ?? 0);
  if (!Number.isFinite(status) || status < 0) {
    throw Object.assign(new Error('Invalid status.'), { status: 400 });
  }

  let approvers = parseApprovers(payload.selApprovers || payload.approvers);
  if (status === 1 && !approvers.length) {
    throw Object.assign(new Error('Please select Level 1 Approvers first.'), { status: 400 });
  }

  const paymentStatus = str(payload.paymentStatus || payload.payment_status || 'payment_payable')
    || 'payment_payable';
  const nob = str(payload.nob || payload.selNOB);
  const upload = str(payload.upload || payload.UPLOAD || payload.attachment || '');
  const uploadName = str(payload.uploadName || payload.UPLOAD_NAME || payload.attachmentName || '');
  const remarks = str(payload.remarks || payload.description || payload.txtDesc);
  const atten = str(payload.atten || payload.txtAttenName);
  const paymentTerms = str(payload.paymentTerms || payload.txtPaymentTerms);
  const exchangeCurrency = str(payload.exchangeCurrency || payload.selExchangeCurrency || 'USD') || 'USD';
  const exchangeRate = parseAmount(payload.exchangeRate || payload.txtExchangeRate || 1);
  const manualVendorName = str(payload.manualVendorName || payload.txtManualVendorName);

  let existingRow = await findDraftInvoice(pool, {
    invoiceId: str(payload.invoiceId || payload.txtInvoiceid),
    comId,
    vendorId,
    pType,
  });

  if (!existingRow) {
    const draftKey = str(payload.draftInvoiceNo || payload.txtDNote1);
    if (draftKey) {
      const [[byMsg]] = await pool.query(
        `SELECT * FROM other_invoice_master
         WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
           AND VENDOR = ? AND MESSAGE = ? AND P_TYPE = ?
         LIMIT 1`,
        [comId, MODULE_ID, COMPANY_ID, vendorId, draftKey, pType],
      ).catch(() => [[null]]);
      existingRow = byMsg || null;
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let invoiceId;
    let creatorLoginId = userId;

    if (!existingRow) {
      const [result] = await connection.query(
        `INSERT INTO other_invoice_master (
           COMID, MODULEID, MCOMPANYID, DATE, I_TYPE, NOB, STATUS, MESSAGE, VENDOR,
           GROSS_AMT, CPDATE, FCAID, REMARKS, PAYMENT_TERMS, EXCHANGE_CURRENCY, EXCHANGE_RATE,
           NET_PAYABLE, P_TYPE, ATTEN, DUE_DATE, EXCHANGE_DATE, SHIP_OWNER,
           RDOTAXAPPLICABLE, RDOVATGST,
           SGST_PERCENT, CGST_PERCENT, IGST_PERCENT, VAT_PERCENT, NET_PAYABLE_TAX,
           SGST_PERCENT_AMOUNT, CGST_PERCENT_AMOUNT, IGST_PERCENT_AMOUNT, VAT_PERCENT_AMOUNT,
           APPROVERS, CREATOR, UPLOAD, UPLOAD_NAME, PAYMENT_STATUS, MANUAL_VENDOR_NAME
         ) VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?
         )`,
        [
          comId,
          MODULE_ID,
          COMPANY_ID,
          invoiceDate,
          invType,
          nob || null,
          status,
          invoiceNo,
          vendorId,
          grossAmt,
          cpDate,
          fcaId,
          remarks,
          paymentTerms,
          exchangeCurrency,
          exchangeRate,
          netPayable,
          pType,
          atten,
          dueDate || '1970-01-01',
          exchangeDate || '1970-01-01',
          shipOwner,
          taxApplicable,
          gstVat,
          sgstPercent,
          cgstPercent,
          igstPercent,
          vatPercent,
          netPayableTax,
          sgstAmount,
          cgstAmount,
          igstAmount,
          vatAmount,
          approvers.join(','),
          userId,
          upload,
          uploadName,
          paymentStatus,
          manualVendorName,
        ],
      );
      invoiceId = result.insertId;
    } else {
      invoiceId = existingRow.INVOICEID;
      creatorLoginId = existingRow.CREATOR || userId;
      if (!(status === 0 || status === 1)) {
        approvers = parseApprovers(existingRow.APPROVERS);
      }

      await connection.query(
        `UPDATE other_invoice_master SET
           DATE = ?, I_TYPE = ?, NOB = ?, STATUS = ?, MESSAGE = ?, VENDOR = ?,
           GROSS_AMT = ?, CPDATE = ?, FCAID = ?, REMARKS = ?, PAYMENT_TERMS = ?,
           EXCHANGE_CURRENCY = ?, EXCHANGE_RATE = ?, NET_PAYABLE = ?, P_TYPE = ?,
           ATTEN = ?, DUE_DATE = ?, EXCHANGE_DATE = ?, SHIP_OWNER = ?,
           RDOTAXAPPLICABLE = ?, RDOVATGST = ?,
           SGST_PERCENT = ?, CGST_PERCENT = ?, IGST_PERCENT = ?, VAT_PERCENT = ?,
           NET_PAYABLE_TAX = ?,
           SGST_PERCENT_AMOUNT = ?, CGST_PERCENT_AMOUNT = ?, IGST_PERCENT_AMOUNT = ?, VAT_PERCENT_AMOUNT = ?,
           APPROVERS = ?, UPLOAD = ?, UPLOAD_NAME = ?, PAYMENT_STATUS = ?, MANUAL_VENDOR_NAME = ?
         WHERE INVOICEID = ?`,
        [
          invoiceDate,
          invType,
          nob || null,
          status,
          invoiceNo,
          vendorId,
          grossAmt,
          cpDate || existingRow.CPDATE || '1970-01-01',
          fcaId || existingRow.FCAID,
          remarks,
          paymentTerms,
          exchangeCurrency,
          exchangeRate,
          netPayable,
          pType,
          atten,
          dueDate || '1970-01-01',
          exchangeDate || '1970-01-01',
          shipOwner,
          taxApplicable,
          gstVat,
          sgstPercent,
          cgstPercent,
          igstPercent,
          vatPercent,
          netPayableTax,
          sgstAmount,
          cgstAmount,
          igstAmount,
          vatAmount,
          approvers.join(','),
          upload,
          uploadName,
          paymentStatus,
          manualVendorName,
          invoiceId,
        ],
      );

      await deleteInvoiceSlaves(connection, invoiceId);
    }

    await insertInvoiceSlaves(connection, invoiceId, {
      addRows,
      subRows,
      demClubRows,
      otherIncomeClubRows,
    });

    await connection.commit();

    const [[vesselRow]] = await pool.query(
      `SELECT vim.VESSEL_NAME
       FROM freight_cost_estimate_compare c
       LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
       LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       WHERE c.COMID = ? AND c.MODULEID = ?
       LIMIT 1`,
      [comId, MODULE_ID],
    ).catch(() => [[null]]);

    const page = str(payload.page || '1') || '1';
    const redirectUrl = `./invoice_others.php?id=${encodeURIComponent(payload.id || payload.invoiceIdCsv || '')}&page=${encodeURIComponent(page)}&name=${encodeURIComponent(pType)}&amounttitle=${encodeURIComponent(str(payload.amountTitle || ''))}&randomid=${encodeURIComponent(str(payload.randomId || ''))}`;

    await fireOtherInvoiceAlerts(pool, {
      invoiceId,
      status,
      pType,
      invoiceNo,
      vesselName: str(vesselRow?.VESSEL_NAME),
      creatorLoginId,
      approvers,
      userId,
      redirectUrl,
    });
    await dbLogRecentWork(userId, `Other Invoice (${invoiceNo || invoiceId}) saved successfully.`);

    return {
      msg: 0,
      invoiceId,
      comId,
      invType,
      pType,
      status,
      netPayable,
      netPayableTax,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbReceiveOtherInvoicePayment(
  invoiceId,
  {
    amount,
    paymentDate,
    remarks = '',
    upload = '',
    uploadName = '',
  } = {},
  userId = appContext.userId,
) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const total = money2(amount);
  if (!(total > 0)) {
    throw Object.assign(new Error('Payment amount is required.'), { status: 400 });
  }
  const sqlDate = parseDmyToSqlDate(paymentDate);
  if (!sqlDate) {
    throw Object.assign(new Error('Payment date is required.'), { status: 400 });
  }

  const [result] = await pool.query(
    `UPDATE other_invoice_master
     SET P_REMARKS = ?, P_AMT = ?, P_DATE = ?,
         ATTACHMENTS = ?, ATTACHMENTS_NAME = ?, ACC_USER = ?,
         PAYMENT_STATUS = 'payment_payable'
     WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS <> 8`,
    [
      str(remarks),
      total,
      sqlDate,
      str(upload),
      str(uploadName),
      userId,
      id,
      MODULE_ID,
      COMPANY_ID,
    ],
  );
  if (!result.affectedRows) {
    throw Object.assign(new Error('Invoice not found or cancelled.'), { status: 404 });
  }

  await inactiveUserAlerts(pool, 'OTHER INVOICE', id);
  return { msg: 3, invoiceId: id, amount: total };
}

export async function dbCancelOtherInvoice(invoiceId, userId = appContext.userId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT * FROM other_invoice_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) {
      throw Object.assign(new Error('Invoice not found.'), { status: 404 });
    }
    if (Number(row.STATUS) === 8) {
      throw Object.assign(new Error('Invoice already cancelled.'), { status: 400 });
    }

    const [insertResult] = await connection.query(
      `INSERT INTO other_invoice_master (
         COMID, MODULEID, MCOMPANYID, DATE, I_TYPE, PAYMENT_NO, P_TYPE, NOB, STATUS,
         P_REMARKS, P_AMT, P_DATE, MESSAGE, MESSAGE_NO, VENDOR, GROSS_AMT, BROKERAGE,
         CPDATE, FCAID, REMARKS, EXCHANGE_RATE, PAYMENT_TERMS, NET_PAYABLE,
         ATTACHMENTS, ATTACHMENTS_NAME, ATTEN, DUE_DATE, EXCHANGE_DATE, EXCHANGE_CURRENCY,
         SHIP_OWNER, RDOTAXAPPLICABLE, RDOVATGST,
         SGST_PERCENT, CGST_PERCENT, IGST_PERCENT, VAT_PERCENT, NET_PAYABLE_TAX,
         SGST_PERCENT_AMOUNT, CGST_PERCENT_AMOUNT, IGST_PERCENT_AMOUNT, VAT_PERCENT_AMOUNT,
         APPROVERS, CREATOR, UPLOAD, UPLOAD_NAME
       ) VALUES (
         ?, ?, ?, ?, 'Credit', ?, ?, ?, 8,
         ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?, ?
       )`,
      [
        row.COMID, row.MODULEID, row.MCOMPANYID, row.DATE, row.PAYMENT_NO, row.P_TYPE, row.NOB,
        row.P_REMARKS, row.P_AMT, row.P_DATE, row.MESSAGE, row.MESSAGE_NO, row.VENDOR,
        row.GROSS_AMT, row.BROKERAGE, row.CPDATE, row.FCAID, row.REMARKS, row.EXCHANGE_RATE,
        row.PAYMENT_TERMS, row.NET_PAYABLE, row.ATTACHMENTS, row.ATTACHMENTS_NAME, row.ATTEN,
        row.DUE_DATE, row.EXCHANGE_DATE, row.EXCHANGE_CURRENCY, row.SHIP_OWNER,
        row.RDOTAXAPPLICABLE, row.RDOVATGST, row.SGST_PERCENT, row.CGST_PERCENT, row.IGST_PERCENT,
        row.VAT_PERCENT, row.NET_PAYABLE_TAX, row.SGST_PERCENT_AMOUNT, row.CGST_PERCENT_AMOUNT,
        row.IGST_PERCENT_AMOUNT, row.VAT_PERCENT_AMOUNT, row.APPROVERS, row.CREATOR,
        row.UPLOAD, row.UPLOAD_NAME,
      ],
    );

    const creditId = insertResult.insertId;
    const [slaves] = await connection.query(
      `SELECT DESCRIPTION, AMOUNT, IDENTIFY FROM other_invoice_slave WHERE INVOICEID = ?`,
      [id],
    );
    for (const slave of slaves || []) {
      await connection.query(
        `INSERT INTO other_invoice_slave (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY)
         VALUES (?, ?, ?, ?)`,
        [creditId, slave.DESCRIPTION, slave.AMOUNT, slave.IDENTIFY],
      );
    }

    await connection.query(
      `UPDATE other_invoice_master SET STATUS = 8 WHERE INVOICEID = ?`,
      [id],
    );
    await inactiveUserAlerts(connection, 'OTHER INVOICE', id);
    await connection.commit();
    return { msg: 2, invoiceId: id, creditInvoiceId: creditId, comId: row.COMID, userId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbReopenOtherInvoice(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const [result] = await pool.query(
    `UPDATE other_invoice_master
     SET STATUS = 0, PAYMENT_STATUS = ''
     WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
    [id, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) {
    throw Object.assign(new Error('Invoice not found.'), { status: 404 });
  }
  await inactiveUserAlerts(pool, 'OTHER INVOICE', id);
  return { msg: 0, invoiceId: id };
}

export async function dbDeleteOtherInvoice(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `DELETE FROM other_invoice_master WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
    if (!result.affectedRows) {
      throw Object.assign(new Error('Invoice not found.'), { status: 404 });
    }
    await connection.query(`DELETE FROM other_invoice_slave WHERE INVOICEID = ?`, [id]);
    await connection.query(`DELETE FROM other_invoice_slave1 WHERE INVOICEID = ?`, [id]);
    await connection.query(
      `DELETE FROM alert_master WHERE IDENTIFYID = ? AND IDENTIFY = 'OTHER INVOICE'`,
      [id],
    ).catch(() => undefined);
    await connection.commit();
    return { msg: 2, invoiceId: id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbGetOtherInvoiceForPdf(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const [[row]] = await pool.query(
    `SELECT m.*,
            vm.NAME AS VENDOR_NAME,
            vm.STREET_1, vm.CITY, vm.COUNTRY, vm.CITY_POSTAL_CODE,
            owner.NAME AS OWNER_NAME,
            vim.VESSEL_NAME, est.VOYAGE_NO
     FROM other_invoice_master m
     LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
     LEFT JOIN vendor_master owner ON owner.CODE = m.SHIP_OWNER
     LEFT JOIN freight_cost_estimete_master est ON est.FCAID = m.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = est.VESSEL_IMO_ID
     WHERE m.INVOICEID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) {
    throw Object.assign(new Error('Invoice not found.'), { status: 404 });
  }

  const [addRows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT FROM other_invoice_slave WHERE INVOICEID = ? AND IDENTIFY = 'ADD'`,
    [id],
  ).catch(() => [[]]);
  const [subRows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT FROM other_invoice_slave WHERE INVOICEID = ? AND IDENTIFY = 'SUB'`,
    [id],
  ).catch(() => [[]]);
  const [clubRows] = await pool.query(
    `SELECT VENDORID, DEM_AMT, RANDOMID, PORT, PORTID
     FROM other_invoice_slave1
     WHERE INVOICEID = ?`,
    [id],
  ).catch(() => [[]]);

  return {
    invoiceId: String(row.INVOICEID),
    invoiceNo: str(row.MESSAGE),
    invoiceDate: blankDate(row.DATE),
    dueDate: blankDate(row.DUE_DATE),
    cpDate: blankDate(row.CPDATE),
    invType: str(row.I_TYPE),
    pType: str(row.P_TYPE),
    vendorName: str(row.VENDOR_NAME || row.VENDOR),
    vendorAddress: [row.STREET_1, row.CITY, row.COUNTRY, row.CITY_POSTAL_CODE].map(str).filter(Boolean).join(', '),
    ownerName: str(row.OWNER_NAME || row.SHIP_OWNER),
    vesselName: str(row.VESSEL_NAME),
    voyageNo: str(row.VOYAGE_NO),
    currency: str(row.EXCHANGE_CURRENCY || 'USD'),
    grossAmt: money2(row.GROSS_AMT),
    netPayable: money2(row.NET_PAYABLE),
    netPayableTax: money2(row.NET_PAYABLE_TAX),
    sgst: money2(row.SGST_PERCENT_AMOUNT),
    cgst: money2(row.CGST_PERCENT_AMOUNT),
    igst: money2(row.IGST_PERCENT_AMOUNT),
    vat: money2(row.VAT_PERCENT_AMOUNT),
    taxApplicable: Number(row.RDOTAXAPPLICABLE),
    gstVat: Number(row.RDOVATGST),
    remarks: str(row.REMARKS),
    paymentTerms: str(row.PAYMENT_TERMS),
    addRows: (addRows || []).map((r) => ({ description: str(r.DESCRIPTION), amount: money2(r.AMOUNT) })),
    subRows: (subRows || []).map((r) => ({ description: str(r.DESCRIPTION), amount: money2(r.AMOUNT) })),
    clubRows: (clubRows || []).map((r) => ({
      vendorId: str(r.VENDORID),
      amount: money2(r.DEM_AMT),
      randomId: str(r.RANDOMID),
      port: str(r.PORT),
      portId: str(r.PORTID),
    })),
  };
}
