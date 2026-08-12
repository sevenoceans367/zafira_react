import { appContext, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';
import { dbGetVendorBanking } from './genericFinancesDb.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const APPROVAL_COLS = Object.freeze({
  creator: 'OTHER_PAYMENT_CHK_CRETR',
  app1: 'OTHER_PAYMENT_CHK_APP_1',
  app2: 'OTHER_PAYMENT_CHK_APP_2',
  acc: 'OTHER_PAYMENT_CHK_ACC',
});

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

const ACCOUNT_TYPES = [
  { id: 'Interim', name: 'Interim' },
  { id: 'Final', name: 'Final' },
];

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
 * id = nameId,nameKey,gradeId,vendorId,comId,amount[,port?,fdaRandom?]
 */
export function parseRequestPortCostId(csv) {
  const parts = String(csv || '').split(',');
  return {
    nameId: str(parts[0]),
    nameKey: str(parts[1]),
    gradeId: str(parts[2] || '0') || '0',
    vendorId: str(parts[3]),
    comId: str(parts[4]),
    amount: parseAmount(parts[5]),
    port: str(parts[6] || ''),
    fdaRandom: str(parts[7] || ''),
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

function parseLineRows(rows) {
  return parseJsonArray(rows)
    .map((row) => ({
      orcId: str(row.orcId || row.ORC_ID || ''),
      description: str(row.description || row.DESCRIPTION || ''),
      amount: parseAmount(row.amount ?? row.AMOUNT),
    }))
    .filter((row) => row.description || row.amount || row.orcId);
}

function parseAdjRows(rows) {
  return parseJsonArray(rows)
    .map((row) => ({
      orcId: str(row.orcId || row.ORC_ID || ''),
      fixtureNo: str(row.fixtureNo || row.FIXTURE_NO || ''),
      vessel: str(row.vessel || row.VESSEL || ''),
      description: str(row.description || row.DESCRIPTION || ''),
      amount: parseAmount(row.amount ?? row.AMOUNT),
    }))
    .filter((row) => row.description || row.amount || row.orcId || row.fixtureNo);
}

async function getVendorRow(pool, code) {
  if (!code) return null;
  const [[row]] = await pool.query(
    `SELECT CODE, NAME, VENDORID, STREET_1, CITY, COUNTRY, CITY_POSTAL_CODE, BANKING_DETAILS
     FROM vendor_master
     WHERE CODE = ?
     LIMIT 1`,
    [code],
  ).catch(() => [[null]]);
  return row || null;
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

async function firePaymentAlerts(pool, {
  reqId,
  status,
  costDesc,
  paymentNo,
  vesselName,
  creatorLoginId,
  approvers,
  userId,
  redirectUrl,
}) {
  await inactiveUserAlerts(pool, 'PAYMENT', reqId);
  if (!(Number(status) >= 1) || !reqId) return;

  const cols = APPROVAL_COLS;
  const currentUserName = (await getContactPerson(pool, userId)) || 'User';
  const label = `${costDesc || 'PAYMENT'} PAYMENT (${vesselName || '-'} - ${paymentNo || ''})`;

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
    await pool.query(
      `UPDATE request_master SET SYNC_STATUS = 1 WHERE REQ_ID = ?`,
      [reqId],
    ).catch(() => undefined);
    recipients = await getUsersWithAuthority(pool, cols.acc);
    comments = `${currentUserName} Approved ${label}.`;
  }

  for (const to of recipients) {
    await saveUserAlerts(pool, {
      sentBy: userId,
      sentTo: to,
      redirectTo: redirectUrl,
      identify: 'PAYMENT',
      comments,
      identifyId: reqId,
    });
  }
}

async function loadSlaveRows(pool, reqId) {
  if (!reqId) return { addRows: [], subRows: [] };
  const [rows] = await pool.query(
    `SELECT ORC_ID, DESCRIPTION, AMOUNT, IDENTIFY
     FROM request_master_slave
     WHERE REQ_ID = ?`,
    [reqId],
  ).catch(() => [[]]);
  const addRows = [];
  const subRows = [];
  for (const row of rows || []) {
    const mapped = {
      orcId: str(row.ORC_ID),
      description: str(row.DESCRIPTION),
      amount: money2(row.AMOUNT),
    };
    if (String(row.IDENTIFY).toUpperCase() === 'SUB') subRows.push(mapped);
    else addRows.push(mapped);
  }
  return { addRows, subRows };
}

async function loadAdjRows(pool, reqId) {
  if (!reqId) return { adjAddRows: [], adjSubRows: [] };
  const [rows] = await pool.query(
    `SELECT ORC_ID, FIXTURE_NO, VESSEL, DESCRIPTION, AMOUNT, IDENTIFY
     FROM request_adj_slave
     WHERE REQ_ID = ?`,
    [reqId],
  ).catch(() => [[]]);
  const adjAddRows = [];
  const adjSubRows = [];
  for (const row of rows || []) {
    const mapped = {
      orcId: str(row.ORC_ID),
      fixtureNo: str(row.FIXTURE_NO),
      vessel: str(row.VESSEL),
      description: str(row.DESCRIPTION),
      amount: money2(row.AMOUNT),
    };
    if (String(row.IDENTIFY).toUpperCase() === 'SUB') adjSubRows.push(mapped);
    else adjAddRows.push(mapped);
  }
  return { adjAddRows, adjSubRows };
}

function mapDraftRequest(row, lineRows, adjRows) {
  return {
    reqId: String(row.REQ_ID),
    status: Number(row.STATUS) || 0,
    accountType: str(row.ACCOUNT_TYPE),
    paymentNo: str(row.PAYMENT_NO),
    date: blankDate(row.DATE),
    cpDate: blankDate(row.CP_DATE),
    remarks: str(row.REMARKS),
    ttlOutstandings: money2(row.TTL_OUTSTANDINGS),
    balOutstandings: money2(row.BAL_OUTSTANDINGS),
    reqToPay: money2(row.REQ_TO_PAY),
    invoiceAmt: money2(row.INVOICE_AMT),
    invoiceDate: blankDate(row.INVOICE_DATE),
    netAmt: money2(row.NET_AMT),
    exchangeRate: str(row.EXCHANGE_RATE),
    exchangeDate: blankDate(row.EXCHANGE_DATE),
    exchangeCurrency: str(row.EXCHANGE_CURRENCY) || 'USD',
    bankingId: str(row.VENDOR_SLAVEID),
    paymentStatus: str(row.PAYMENT_STATUS) || 'payment_payable',
    accLCode: str(row.ACC_L_CODE),
    costDesc: str(row.COST_DESC),
    upload: str(row.UPLOAD),
    uploadName: str(row.UPLOAD_NAME),
    pAmt: money2(row.P_AMT),
    pDate: blankDate(row.P_DATE),
    pRemarks: str(row.P_REMARKS),
    pAmtEx: str(row.P_AMT_EX),
    attachments: str(row.ATTACHMENTS),
    attachmentsName: str(row.ATTACHMENTS_NAME),
    selApprovers: parseApprovers(row.APPROVERS),
    creator: str(row.CREATOR),
    rType: str(row.R_TYPE),
    pType: str(row.P_TYPE),
    addRows: lineRows.addRows,
    subRows: lineRows.subRows,
    adjAddRows: adjRows.adjAddRows,
    adjSubRows: adjRows.adjSubRows,
  };
}

async function findDraftRequest(pool, {
  reqId,
  comId,
  nameKey,
  nameId,
  gradeId,
  vendorId,
}) {
  if (reqId) {
    const [[row]] = await pool.query(
      `SELECT * FROM request_master WHERE REQ_ID = ? LIMIT 1`,
      [reqId],
    ).catch(() => [[null]]);
    return row || null;
  }

  const [[row]] = await pool.query(
    `SELECT * FROM request_master
     WHERE COMID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
       AND LOGIN = 'INTERNAL_USER'
       AND NAME = ?
       AND NAME_ID = ?
       AND GRADEID = ?
       AND VENDOR = ?
       AND STATUS < 5
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, nameKey, nameId, gradeId || '0', vendorId],
  ).catch(() => [[null]]);
  return row || null;
}

async function loadExistingRequests(pool, {
  comId,
  nameKey,
  nameId,
  gradeId,
  vendorId,
  voyageNo,
  vesselName,
  costDesc,
  mgmt,
}) {
  const [rows] = await pool.query(
    `SELECT r.*,
            (SELECT a.SOA_NO FROM combined_soa_payable_master a WHERE a.SOAID = r.SOAID LIMIT 1) AS SOA_NO,
            l.CONTACT_PERSON AS CREATOR_NAME,
            vm.NAME AS VENDOR_NAME
     FROM request_master r
     LEFT JOIN login l ON l.LOGINID = r.CREATOR
     LEFT JOIN vendor_master vm ON vm.CODE = r.VENDOR
     WHERE r.COMID = ?
       AND r.MODULEID = ?
       AND r.MCOMPANYID = ?
       AND r.LOGIN = 'INTERNAL_USER'
       AND r.NAME = ?
       AND r.NAME_ID = ?
       AND r.GRADEID = ?
       AND r.VENDOR = ?
       AND r.STATUS >= 5
     ORDER BY r.REQ_ID DESC`,
    [comId, MODULE_ID, COMPANY_ID, nameKey, nameId, gradeId || '0', vendorId],
  ).catch(() => [[]]);

  return (rows || []).map((row) => {
    const hold = str(row.PAYMENT_STATUS) === 'payment_hold';
    return {
      reqId: String(row.REQ_ID),
      status: Number(row.STATUS) || 0,
      fixtureNo: hold ? `${voyageNo || ''}(Accrual)` : (voyageNo || ''),
      vesselName: vesselName || '',
      costType: nameKey,
      costDesc: str(row.COST_DESC) || costDesc,
      soaNo: str(row.SOA_NO),
      accountType: str(row.ACCOUNT_TYPE),
      amount: money2(row.REQ_TO_PAY),
      paymentNo: str(row.PAYMENT_NO),
      date: blankDate(row.DATE),
      vendorName: str(row.VENDOR_NAME || row.VENDOR),
      paymentStatus: str(row.PAYMENT_STATUS),
      pAmt: money2(row.P_AMT),
      pDate: blankDate(row.P_DATE),
      creator: str(row.CREATOR_NAME || row.CREATOR),
      canDelete: Boolean(mgmt),
      canReopen: Boolean(mgmt),
      canReceivePayment: !(parseAmount(row.P_AMT) > 0),
      canPdf: true,
    };
  });
}

async function loadPaidSummary(pool, {
  comId,
  nameKey,
  nameId,
  gradeId,
  vendorId,
  outstandingAmount,
}) {
  const [rows] = await pool.query(
    `SELECT REQ_ID, REQ_TO_PAY, P_AMT
     FROM request_master
     WHERE COMID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
       AND LOGIN = 'INTERNAL_USER'
       AND NAME = ?
       AND NAME_ID = ?
       AND GRADEID = ?
       AND VENDOR = ?
       AND STATUS = 5
       AND P_AMT IS NOT NULL`,
    [comId, MODULE_ID, COMPANY_ID, nameKey, nameId, gradeId || '0', vendorId],
  ).catch(() => [[]]);

  let totalPaid = 0;
  let totalReqToPay = 0;
  for (const row of rows || []) {
    totalPaid += parseAmount(row.P_AMT);
    totalReqToPay += parseAmount(row.REQ_TO_PAY);
  }
  const balance = (rows || []).length
    ? money2(outstandingAmount - totalReqToPay)
    : money2(outstandingAmount);

  return {
    totalPaid: money2(totalPaid),
    balance,
    paidCount: (rows || []).length,
  };
}

async function deleteRequestSlaves(conn, reqId) {
  await conn.query(`DELETE FROM request_master_slave WHERE REQ_ID = ?`, [reqId]);
  await conn.query(`DELETE FROM request_adj_slave WHERE REQ_ID = ?`, [reqId]).catch(() => undefined);
}

async function insertRequestSlaves(conn, reqId, {
  addRows,
  subRows,
  adjAddRows,
  adjSubRows,
}) {
  for (const row of addRows) {
    await conn.query(
      `INSERT INTO request_master_slave (REQ_ID, ORC_ID, DESCRIPTION, AMOUNT, IDENTIFY)
       VALUES (?, ?, ?, ?, 'ADD')`,
      [reqId, row.orcId || null, row.description, row.amount],
    );
  }
  for (const row of subRows) {
    await conn.query(
      `INSERT INTO request_master_slave (REQ_ID, ORC_ID, DESCRIPTION, AMOUNT, IDENTIFY)
       VALUES (?, ?, ?, ?, 'SUB')`,
      [reqId, row.orcId || null, row.description, row.amount],
    );
  }
  for (const row of adjAddRows) {
    await conn.query(
      `INSERT INTO request_adj_slave
         (REQ_ID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, FIXTURE_NO, VESSEL)
       VALUES (?, ?, ?, 'ADD', ?, ?, ?)`,
      [reqId, row.description, row.amount, row.orcId || null, row.fixtureNo || null, row.vessel || null],
    );
  }
  for (const row of adjSubRows) {
    await conn.query(
      `INSERT INTO request_adj_slave
         (REQ_ID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, FIXTURE_NO, VESSEL)
       VALUES (?, ?, ?, 'SUB', ?, ?, ?)`,
      [reqId, row.description, row.amount, row.orcId || null, row.fixtureNo || null, row.vessel || null],
    );
  }
}

/**
 * Form context for Operational Costs (Others) / generic request payment.
 */
export async function dbGetRequestPortCostForm({
  id,
  name,
  page = '1',
  voyageNo = '',
  userId = appContext.userId,
  mgmtUser = isMgmtUser(),
} = {}) {
  const pool = getPool();
  const parsed = parseRequestPortCostId(id);
  const comId = parsed.comId;
  if (!comId) {
    throw Object.assign(new Error('COMID is required (id CSV part 5).'), { status: 400 });
  }
  if (!parsed.vendorId) {
    throw Object.assign(new Error('Vendor is required (id CSV part 4).'), { status: 400 });
  }

  const costDesc = str(name) || parsed.nameKey;
  const nameKey = parsed.nameKey;
  const nameId = parsed.nameId;
  const gradeId = parsed.gradeId || '0';
  const vendorId = parsed.vendorId;
  const outstandingAmount = money2(parsed.amount);

  const [[compare]] = await pool.query(
    `SELECT c.*, m.VOYAGE_NO AS MASTER_VOYAGE_NO, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID,
            m.TRANS_DATE, m.CP_DATE AS MASTER_CP_DATE,
            vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);

  if (!compare?.COMID) {
    throw Object.assign(new Error('VC nomination not found.'), { status: 404 });
  }

  const [[latest]] = await pool.query(
    `SELECT FCAID, TRANS_DATE, CP_DATE, VESSEL_IMO_ID, VOYAGE_NO
     FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);

  const vendor = await getVendorRow(pool, vendorId);
  const vendorInternalId = vendor?.VENDORID != null ? String(vendor.VENDORID) : '';
  const voyage = str(voyageNo)
    || str(compare.MASTER_VOYAGE_NO)
    || str(latest?.VOYAGE_NO)
    || str(compare.MESSAGE);
  const vesselName = str(compare.VESSEL_NAME);
  const vesselImoId = str(compare.MASTER_VESSEL_IMO_ID || latest?.VESSEL_IMO_ID || compare.VESSEL_IMO_ID);
  const cpDate = blankDate(
    compare.TRANS_DATE
    || latest?.TRANS_DATE
    || compare.MASTER_CP_DATE
    || latest?.CP_DATE
    || compare.CP_DATE,
  );
  const nomMessage = str(compare.MESSAGE);

  const [orcOptions] = await pool.query(
    `SELECT OWNER_RCOSTID AS id, NAME AS name
     FROM owner_related_cost_master
     ORDER BY NAME`,
  ).catch(() => [[]]);

  const [companyBankingDetails] = await pool.query(
    `SELECT BD_ID AS id, CONCAT(NAME, ' - ', BANK) AS name
     FROM banking_details
     WHERE STATUS = 1
     ORDER BY NAME`,
  ).catch(() => [[]]);

  const [accountLedgers] = await pool.query(
    `SELECT CODE AS id, CONCAT(NAME_OF_LEDGER, ' (', CODE, ')') AS name
     FROM account_ledger
     WHERE STATUS = 1
     ORDER BY NAME_OF_LEDGER`,
  ).catch(() => [[]]);

  const { fixtures, vessels } = await getFixtureOptions(pool);
  const approval = await getApproverContext(pool, userId);

  let vendorBanking = [];
  if (vendorInternalId) {
    vendorBanking = await dbGetVendorBanking(vendorInternalId).catch(() => []);
  }

  const draft = await findDraftRequest(pool, {
    comId,
    nameKey,
    nameId,
    gradeId,
    vendorId,
  });

  let currentRequest = null;
  if (draft) {
    const lineRows = await loadSlaveRows(pool, draft.REQ_ID);
    const adjRows = await loadAdjRows(pool, draft.REQ_ID);
    currentRequest = mapDraftRequest(draft, lineRows, adjRows);
  }

  const existingRequests = await loadExistingRequests(pool, {
    comId,
    nameKey,
    nameId,
    gradeId,
    vendorId,
    voyageNo: voyage,
    vesselName,
    costDesc,
    mgmt: Boolean(mgmtUser),
  });

  const paidSummary = await loadPaidSummary(pool, {
    comId,
    nameKey,
    nameId,
    gradeId,
    vendorId,
    outstandingAmount,
  });

  const defaults = {
    accountType: currentRequest?.accountType || 'Final',
    paymentNo: currentRequest?.paymentNo || '',
    date: currentRequest?.date || '',
    cpDate: currentRequest?.cpDate || cpDate,
    remarks: currentRequest?.remarks || '',
    invoiceAmt: currentRequest?.invoiceAmt != null && currentRequest.invoiceAmt !== 0
      ? String(currentRequest.invoiceAmt)
      : String(outstandingAmount),
    invoiceDate: currentRequest?.invoiceDate || '',
    netAmt: currentRequest?.netAmt != null ? String(currentRequest.netAmt) : '',
    reqToPay: currentRequest?.reqToPay != null ? String(currentRequest.reqToPay) : '',
    ttlOutstandings: currentRequest?.ttlOutstandings != null
      ? String(currentRequest.ttlOutstandings)
      : String(outstandingAmount),
    balOutstandings: currentRequest?.balOutstandings != null
      ? String(currentRequest.balOutstandings)
      : String(paidSummary.balance),
    exchangeRate: currentRequest?.exchangeRate || '1',
    exchangeDate: currentRequest?.exchangeDate || '',
    exchangeCurrency: currentRequest?.exchangeCurrency || 'USD',
    bankingId: currentRequest?.bankingId || '',
    paymentStatus: currentRequest?.paymentStatus || 'payment_payable',
    accLCode: currentRequest?.accLCode || '',
    selApprovers: currentRequest?.selApprovers || [],
    upload: currentRequest?.upload || '',
    uploadName: currentRequest?.uploadName || '',
  };

  return {
    id: id || '',
    page: String(page || '1'),
    nameId,
    nameKey,
    gradeId,
    comId,
    vendorId,
    vendorName: str(vendor?.NAME),
    vendorInternalId,
    voyageNo: voyage,
    vesselName,
    vesselImoId,
    nomMessage,
    cpDate,
    costDesc,
    outstandingAmount,
    port: parsed.port,
    accountTypes: ACCOUNT_TYPES,
    currencies: CURRENCY_OPTIONS,
    orcOptions: (orcOptions || []).map((row) => ({
      id: String(row.id),
      name: row.name,
    })),
    fixtures,
    vessels,
    vendorBanking,
    companyBankingDetails: (companyBankingDetails || []).map((row) => ({
      id: String(row.id),
      name: row.name,
    })),
    accountLedgers: (accountLedgers || []).map((row) => ({
      id: String(row.id),
      name: row.name,
    })),
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
    paidSummary,
    existingRequests,
    currentRequest,
    defaults,
  };
}

export async function dbSaveRequestPortCost(payload = {}, { userId = appContext.userId } = {}) {
  const pool = getPool();
  const parsed = parseRequestPortCostId(payload.id || payload.idCsv);
  const comId = str(payload.comId || parsed.comId);
  const nameKey = str(payload.nameKey || parsed.nameKey);
  const nameId = str(payload.nameId || parsed.nameId);
  const gradeId = str(payload.gradeId || payload.grade_id_test || parsed.gradeId || '0') || '0';
  const vendorId = str(payload.vendorId || payload.txtVendor || parsed.vendorId);
  const port = str(payload.port || parsed.port);
  const costDesc = str(payload.costDesc || payload.name || nameKey);

  if (!comId) throw Object.assign(new Error('COMID is required.'), { status: 400 });
  if (!vendorId) throw Object.assign(new Error('Vendor is required.'), { status: 400 });
  if (!nameKey) throw Object.assign(new Error('NAME (nameKey) is required.'), { status: 400 });

  const accountType = str(payload.accountType || payload.selAType || 'Final') || 'Final';
  const paymentNo = str(payload.paymentNo || payload.txtAccNO);
  const dateSql = parseDmyToSqlDate(payload.date || payload.txtDate) || '1970-01-01';
  const cpDateSql = parseDmyToSqlDate(payload.cpDate || payload.txtCP_Date) || '1970-01-01';
  const invoiceDateSql = parseDmyToSqlDate(payload.invoiceDate || payload.txtI_Date) || '1970-01-01';
  const exchangeDateSql = parseDmyToSqlDate(payload.exchangeDate || payload.txtExchangeDate) || '1970-01-01';
  const remarks = str(payload.remarks || payload.txtRemarks);
  const ttlOutstandings = money2(payload.ttlOutstandings ?? payload.txtTtl_Outs ?? parsed.amount);
  const balOutstandings = money2(payload.balOutstandings ?? payload.txtBal_Outs ?? parsed.amount);
  const reqToPay = money2(payload.reqToPay ?? payload.txtROP_3 ?? payload.txtROP);
  const invoiceAmt = money2(payload.invoiceAmt ?? payload.txtV_I_Amt ?? parsed.amount);
  const netAmt = money2(payload.netAmt ?? payload.txtNET);
  const exchangeRate = money2(payload.exchangeRate ?? payload.txtExchangeRate ?? 1);
  const exchangeCurrency = str(payload.exchangeCurrency || payload.selExchangeCurrency || 'USD') || 'USD';
  const bankingId = str(payload.bankingId || payload.selBankingID);
  const paymentStatus = str(payload.paymentStatus || payload.payment_status || 'payment_payable')
    || 'payment_payable';
  const accLCode = str(payload.accLCode || payload.selAccountLedgre);
  const upload = str(payload.upload || payload.UPLOAD || payload.attachment || '');
  const uploadName = str(payload.uploadName || payload.UPLOAD_NAME || payload.attachmentName || '');
  const rType = str(payload.rType || payload.rdoQty);
  const pType = str(payload.pType || payload.txtROP_1);

  const status = Number(payload.status ?? payload.txtStatus ?? 0);
  if (!Number.isFinite(status) || status < 0) {
    throw Object.assign(new Error('Invalid status.'), { status: 400 });
  }

  let approvers = parseApprovers(payload.selApprovers || payload.approvers);
  if (status === 1 && !approvers.length) {
    throw Object.assign(new Error('Please select Level 1 Approvers first.'), { status: 400 });
  }

  const addRows = parseLineRows(payload.addRows);
  const subRows = parseLineRows(payload.subRows);
  const adjAddRows = parseAdjRows(payload.adjAddRows);
  const adjSubRows = parseAdjRows(payload.adjSubRows);

  const [[compare]] = await pool.query(
    `SELECT c.VESSEL_IMO_ID, c.MESSAGE, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID, vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = COALESCE(m.VESSEL_IMO_ID, c.VESSEL_IMO_ID)
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);

  const vesselImoId = str(
    payload.vesselImoId
    || compare?.MASTER_VESSEL_IMO_ID
    || compare?.VESSEL_IMO_ID,
  );
  const vesselName = str(compare?.VESSEL_NAME);

  const vendor = await getVendorRow(pool, vendorId);
  const bankingDetailsText = str(vendor?.BANKING_DETAILS);

  const existing = await findDraftRequest(pool, {
    reqId: str(payload.reqId || payload.txtPaymentID),
    comId,
    nameKey,
    nameId,
    gradeId,
    vendorId,
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let reqId;
    let creatorLoginId = userId;

    if (!existing) {
      const [result] = await connection.query(
        `INSERT INTO request_master (
           COMID, MODULEID, MCOMPANYID, LOGIN, NAME, NAME_ID, GRADEID, VENDOR, PORT,
           ACCOUNT_TYPE, PAYMENT_NO, DATE, REMARKS, TTL_OUTSTANDINGS, BAL_OUTSTANDINGS,
           REQ_TO_PAY, STATUS, CP_DATE, REQUESTED, VESSELID, R_TYPE, P_TYPE,
           INVOICE_AMT, INVOICE_DATE, NET_AMT, UPLOAD, UPLOAD_NAME, APPROVERS, CREATOR,
           EXCHANGE_RATE, EXCHANGE_DATE, EXCHANGE_CURRENCY, BANKING_DETAILS, VENDOR_SLAVEID,
           PAYMENT_STATUS, ACC_L_CODE, COST_DESC
         ) VALUES (
           ?, ?, ?, 'INTERNAL_USER', ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, '0', ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?
         )`,
        [
          comId,
          MODULE_ID,
          COMPANY_ID,
          nameKey,
          nameId,
          gradeId,
          vendorId,
          port,
          accountType,
          paymentNo,
          dateSql,
          remarks,
          ttlOutstandings,
          balOutstandings,
          reqToPay,
          status,
          cpDateSql,
          vesselImoId || null,
          rType || null,
          pType || null,
          invoiceAmt,
          invoiceDateSql,
          netAmt,
          upload,
          uploadName,
          approvers.join(','),
          userId,
          exchangeRate,
          exchangeDateSql,
          exchangeCurrency,
          bankingDetailsText,
          bankingId || null,
          paymentStatus,
          accLCode || null,
          costDesc,
        ],
      );
      reqId = result.insertId;
    } else {
      reqId = existing.REQ_ID;
      creatorLoginId = existing.CREATOR || userId;
      if (!(status === 0 || status === 1)) {
        approvers = parseApprovers(existing.APPROVERS);
      }

      await connection.query(
        `UPDATE request_master SET
           NAME = ?, NAME_ID = ?, GRADEID = ?, VENDOR = ?, PORT = ?,
           ACCOUNT_TYPE = ?, PAYMENT_NO = ?, DATE = ?, REMARKS = ?,
           TTL_OUTSTANDINGS = ?, BAL_OUTSTANDINGS = ?, REQ_TO_PAY = ?, STATUS = ?,
           CP_DATE = ?, REQUESTED = '0', VESSELID = ?, R_TYPE = ?, P_TYPE = ?,
           INVOICE_AMT = ?, INVOICE_DATE = ?, NET_AMT = ?, UPLOAD = ?, UPLOAD_NAME = ?,
           APPROVERS = ?, EXCHANGE_RATE = ?, EXCHANGE_DATE = ?, EXCHANGE_CURRENCY = ?,
           BANKING_DETAILS = ?, VENDOR_SLAVEID = ?, ACC_L_CODE = ?, PAYMENT_STATUS = ?,
           COST_DESC = ?
         WHERE REQ_ID = ?`,
        [
          nameKey,
          nameId,
          gradeId,
          vendorId,
          port,
          accountType,
          paymentNo,
          dateSql,
          remarks,
          ttlOutstandings,
          balOutstandings,
          reqToPay,
          status,
          cpDateSql,
          vesselImoId || existing.VESSELID || null,
          rType || null,
          pType || null,
          invoiceAmt,
          invoiceDateSql,
          netAmt,
          upload,
          uploadName,
          approvers.join(','),
          exchangeRate,
          exchangeDateSql,
          exchangeCurrency,
          bankingDetailsText,
          bankingId || null,
          accLCode || null,
          paymentStatus,
          costDesc,
          reqId,
        ],
      );

      await deleteRequestSlaves(connection, reqId);
    }

    await insertRequestSlaves(connection, reqId, {
      addRows,
      subRows,
      adjAddRows,
      adjSubRows,
    });

    await connection.commit();

    const page = str(payload.page || '1') || '1';
    const idCsv = str(payload.id || payload.idCsv)
      || [nameId, nameKey, gradeId, vendorId, comId, parsed.amount || invoiceAmt].join(',');
    const redirectUrl = `./request_port_cost.php?id=${encodeURIComponent(idCsv)}&page=${encodeURIComponent(page)}&name=${encodeURIComponent(costDesc)}`;

    await firePaymentAlerts(pool, {
      reqId,
      status,
      costDesc,
      paymentNo,
      vesselName,
      creatorLoginId,
      approvers,
      userId,
      redirectUrl,
    });

    return {
      msg: 0,
      reqId,
      comId,
      nameKey,
      costDesc,
      status,
      netAmt,
      reqToPay,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbReceiveRequestPortCostPayment(
  reqId,
  {
    amount,
    paymentDate,
    remarks = '',
    amountEx = '',
    upload = '',
    uploadName = '',
    costDesc = '',
    name = '',
  } = {},
  userId = appContext.userId,
) {
  const pool = getPool();
  const id = str(reqId);
  if (!id) throw Object.assign(new Error('Request id is required.'), { status: 400 });

  const total = money2(amount);
  if (!(total > 0)) {
    throw Object.assign(new Error('Payment amount is required.'), { status: 400 });
  }
  const sqlDate = parseDmyToSqlDate(paymentDate);
  if (!sqlDate) {
    throw Object.assign(new Error('Payment date is required.'), { status: 400 });
  }

  const [result] = await pool.query(
    `UPDATE request_master
     SET P_REMARKS = ?, P_AMT = ?, P_AMT_EX = ?, P_DATE = ?,
         ATTACHMENTS = ?, ATTACHMENTS_NAME = ?, ACC_USER = ?,
         COST_DESC = COALESCE(NULLIF(?, ''), COST_DESC)
     WHERE REQ_ID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
    [
      str(remarks),
      total,
      str(amountEx),
      sqlDate,
      str(upload),
      str(uploadName),
      userId,
      str(costDesc || name),
      id,
      MODULE_ID,
      COMPANY_ID,
    ],
  );
  if (!result.affectedRows) {
    throw Object.assign(new Error('Request not found.'), { status: 404 });
  }

  await inactiveUserAlerts(pool, 'PAYMENT', id);
  return { msg: 3, reqId: id, amount: total };
}

export async function dbDeleteRequestPortCost(reqId) {
  const pool = getPool();
  const id = str(reqId);
  if (!id) throw Object.assign(new Error('Request id is required.'), { status: 400 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT REQ_ID FROM request_master
       WHERE REQ_ID = ? AND MODULEID = ? AND MCOMPANYID = ?
       LIMIT 1`,
      [id, MODULE_ID, COMPANY_ID],
    );
    if (!row) {
      throw Object.assign(new Error('Request not found.'), { status: 404 });
    }

    await connection.query(`DELETE FROM request_master_slave WHERE REQ_ID = ?`, [id]);
    await connection.query(`DELETE FROM request_adj_slave WHERE REQ_ID = ?`, [id]).catch(() => undefined);
    await connection.query(
      `DELETE FROM request_master WHERE REQ_ID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
    await connection.query(
      `DELETE FROM alert_master WHERE IDENTIFYID = ? AND IDENTIFY = 'PAYMENT'`,
      [id],
    ).catch(() => undefined);
    await connection.commit();
    return { msg: 2, reqId: id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbReopenRequestPortCost(reqId) {
  const pool = getPool();
  const id = str(reqId);
  if (!id) throw Object.assign(new Error('Request id is required.'), { status: 400 });

  let result;
  try {
    [result] = await pool.query(
      `UPDATE request_master
       SET STATUS = 0, SYNC_STATUS = 0, PAYMENT_STATUS = ''
       WHERE REQ_ID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
  } catch {
    [result] = await pool.query(
      `UPDATE request_master
       SET STATUS = 0, PAYMENT_STATUS = ''
       WHERE REQ_ID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
  }
  if (!result.affectedRows) {
    throw Object.assign(new Error('Request not found.'), { status: 404 });
  }
  await inactiveUserAlerts(pool, 'PAYMENT', id);
  return { msg: 0, reqId: id };
}

export async function dbGetRequestPortCostForPdf(reqId) {
  const pool = getPool();
  const id = str(reqId);
  if (!id) throw Object.assign(new Error('Request id is required.'), { status: 400 });

  const [[row]] = await pool.query(
    `SELECT r.*,
            vm.NAME AS VENDOR_NAME, vm.STREET_1, vm.CITY, vm.COUNTRY, vm.CITY_POSTAL_CODE,
            vim.VESSEL_NAME, m.VOYAGE_NO, c.MESSAGE AS NOM_MESSAGE
     FROM request_master r
     LEFT JOIN vendor_master vm ON vm.CODE = r.VENDOR
     LEFT JOIN freight_cost_estimate_compare c ON c.COMID = r.COMID AND c.MODULEID = r.MODULEID
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = COALESCE(r.VESSELID, m.VESSEL_IMO_ID)
     WHERE r.REQ_ID = ? AND r.MODULEID = ? AND r.MCOMPANYID = ?
     LIMIT 1`,
    [id, MODULE_ID, COMPANY_ID],
  );
  if (!row) {
    throw Object.assign(new Error('Request not found.'), { status: 404 });
  }

  const [slaves] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID
     FROM request_master_slave
     WHERE REQ_ID = ?
     ORDER BY IDENTIFY, REQ_SLAVEID`,
    [id],
  ).catch(() => [[]]);

  const vendorAddress = [
    row.VENDOR_NAME,
    row.STREET_1,
    row.CITY,
    row.COUNTRY,
    row.CITY_POSTAL_CODE,
  ].map(str).filter(Boolean).join(', ');

  return {
    reqId: String(row.REQ_ID),
    paymentNo: str(row.PAYMENT_NO),
    accountType: str(row.ACCOUNT_TYPE),
    costName: str(row.NAME),
    costDesc: str(row.COST_DESC),
    date: blankDate(row.DATE),
    invoiceDate: blankDate(row.INVOICE_DATE),
    cpDate: blankDate(row.CP_DATE),
    vendorName: str(row.VENDOR_NAME || row.VENDOR),
    vendorAddress,
    voyageNo: str(row.VOYAGE_NO),
    nomMessage: str(row.NOM_MESSAGE),
    vesselName: str(row.VESSEL_NAME),
    currency: str(row.EXCHANGE_CURRENCY) || 'USD',
    exchangeRate: money2(row.EXCHANGE_RATE),
    outstanding: money2(row.TTL_OUTSTANDINGS),
    balance: money2(row.BAL_OUTSTANDINGS),
    invoiceAmt: money2(row.INVOICE_AMT),
    requestedToPay: money2(row.REQ_TO_PAY),
    netAmt: money2(row.NET_AMT),
    remarks: str(row.REMARKS),
    paymentStatus: str(row.PAYMENT_STATUS),
    addRows: (slaves || []).filter((s) => str(s.IDENTIFY) === 'ADD').map((s) => ({
      description: str(s.DESCRIPTION),
      amount: money2(s.AMOUNT),
    })),
    subRows: (slaves || []).filter((s) => str(s.IDENTIFY) === 'SUB').map((s) => ({
      description: str(s.DESCRIPTION),
      amount: money2(s.AMOUNT),
    })),
  };
}
