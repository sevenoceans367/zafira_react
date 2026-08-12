import { appContext, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';
import { dbGetVendorBanking } from './genericFinancesDb.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const APPROVAL_COLS = Object.freeze({
  creator: 'HIRE_STSTMENT_CHK_CRETR',
  app1: 'HIRE_STSTMENT_CHK_APP_1',
  app2: 'HIRE_STSTMENT_CHK_APP_2',
  acc: 'HIRE_STSTMENT_CHK_ACC',
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

const INVOICE_TYPES = [
  { id: 'Interim', name: 'Interim' },
  { id: 'Accrual', name: 'Accrual' },
  { id: 'Final', name: 'Final' },
  { id: 'Memo', name: 'Memo' },
  { id: 'Debit Note', name: 'Debit Note' },
  { id: 'Credit Note', name: 'Credit Note' },
  { id: 'Adjustment', name: 'Adjustment' },
  { id: 'PFHS', name: 'PFHS' },
  { id: 'FHS2', name: 'FHS - 2' },
  { id: 'Interim-Period-Final', name: 'Period Interim-Final' },
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

function days5(value) {
  return Number(parseAmount(value).toFixed(5));
}

function parseChk(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on'
    ? 1
    : 0;
}

function parseDmyToSqlDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

function parseDmyDateTimeToSql(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let match = raw.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (match) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = match;
    const year = Number(yyyy);
    if (year < 1971) return null;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (match) {
    const [, yyyy, mm, dd, hh = '00', mi = '00', ss = '00'] = match;
    if (Number(yyyy) < 1971) return null;
    return `${yyyy}-${mm}-${dd} ${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return null;
}

function blankDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

function formatDateTimeDMY(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const dmy = formatDateDMY(value);
    if (!dmy) return '';
    const hh = String(value.getHours()).padStart(2, '0');
    const mi = String(value.getMinutes()).padStart(2, '0');
    return `${dmy} ${hh}:${mi}`;
  }
  const raw = String(value).trim();
  if (!raw || raw.startsWith('0000-00-00') || raw.startsWith('1970-01-01')) return '';
  if (/^0?1[-/]0?1[-/]1970\b/.test(raw)) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, h, mi] = iso;
    if (Number(y) < 1971) return '';
    if (h != null) return `${d}-${m}-${y} ${h}:${mi}`;
    return `${d}-${m}-${y}`;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}/.test(raw)) {
    return raw.length >= 16 ? raw.slice(0, 16) : raw.slice(0, 10);
  }
  return blankDate(value);
}

function sqlDateTimeOrEpoch(value) {
  return parseDmyDateTimeToSql(value) || '1970-01-01 08:00:00';
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
      chkOwnerAcc: parseChk(row.chkOwnerAcc ?? row.CHK_OWNER_ACC),
      periodId: str(row.periodId || row.PERIOD_ID || ''),
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

function parseHireDayRows(rows) {
  return parseJsonArray(rows)
    .map((row) => ({
      randomId: str(row.randomId || row.RANDOMID || ''),
      totalDays: days5(row.totalDays ?? row.HIRE_DAYS ?? row.totalHireDays),
      invoicedDays: days5(row.invoicedDays ?? row.utilisedApproved),
      remainingDays: days5(row.remainingDays ?? row.balDays),
      dailyRate: parseAmount(row.dailyRate ?? row.HIRE_RATE ?? row.hirePerDay),
      hireFrom: str(row.hireFrom || row.HIRE_FROM || ''),
      hireTo: str(row.hireTo || row.HIRE_TO || ''),
      utilisedDays: days5(row.utilisedDays ?? row.UTILISED_DAYS ?? row.invDays),
      hireAmt: money2(row.hireAmt ?? row.HIRE_AMT ?? row.invHire),
    }))
    .filter((row) => row.randomId || row.dailyRate || row.hireFrom || row.hireTo || row.utilisedDays);
}

function parseOffhireRows(rows) {
  return parseJsonArray(rows)
    .map((row) => ({
      reason: str(row.reason || row.OFF_REASON || row.description || ''),
      offFrom: str(row.offFrom || row.OFF_FROM || row.hireFrom || ''),
      offTo: str(row.offTo || row.OFF_TO || row.hireTo || ''),
      percent: parseAmount(row.percent ?? row.OFF_HIRE_PERCENT),
      days: days5(row.days ?? row.OFF_DAYS ?? row.offDays),
      hireRate: parseAmount(row.hireRate ?? row.HIRE_RATE ?? row.rate),
      amount: money2(row.amount ?? row.OFF_HIRE ?? row.offHire),
      periodId: str(row.periodId || row.PERIOD_ID || ''),
    }))
    .filter((row) => row.reason || row.offFrom || row.offTo || row.days || row.amount);
}

async function getVendorRow(pool, code) {
  if (!code) return null;
  const [[row]] = await pool.query(
    `SELECT CODE, NAME, VENDORID, STREET_1, STREET_2, CITY, COUNTRY, CITY_POSTAL_CODE, BANKING_DETAILS
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

async function fireHireAlerts(pool, {
  invoiceId,
  status,
  invoiceNo,
  invoiceType,
  vesselName,
  creatorLoginId,
  approvers,
  userId,
  redirectUrl,
}) {
  await inactiveUserAlerts(pool, 'HIRE STATEMENT', invoiceId);
  if (!(Number(status) >= 1) || !invoiceId) return;
  if (str(invoiceType) === 'PFHS' && Number(status) === 5) return;

  const cols = APPROVAL_COLS;
  const currentUserName = (await getContactPerson(pool, userId)) || 'User';
  const label = `HIRE STATEMENT (${vesselName || '-'} - ${invoiceNo || ''})`;

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
      `UPDATE invoice_hire_master SET SYNC_STATUS = 1 WHERE INVOICEID = ?`,
      [invoiceId],
    ).catch(() => undefined);
    recipients = await getUsersWithAuthority(pool, cols.acc);
    comments = `${currentUserName} Approved ${label}`;
  }

  for (const to of recipients) {
    await saveUserAlerts(pool, {
      sentBy: userId,
      sentTo: to,
      redirectTo: redirectUrl,
      identify: 'HIRE STATEMENT',
      comments,
      identifyId: invoiceId,
    });
  }
}

async function loadSlave1Rows(pool, invoiceId) {
  if (!invoiceId) {
    return { addRows: [], subRows: [], holdRows: [], surveyRows: [] };
  }
  const [rows] = await pool.query(
    `SELECT ORC_ID, DESCRIPTION, AMOUNT, IDENTIFY, PERIOD_ID, CHK_OWNER_ACC
     FROM invoice_hire_slave1
     WHERE INVOICEID = ?`,
    [invoiceId],
  ).catch(() => [[]]);
  const addRows = [];
  const subRows = [];
  const holdRows = [];
  const surveyRows = [];
  for (const row of rows || []) {
    const identify = String(row.IDENTIFY || '').toUpperCase();
    const mapped = {
      orcId: str(row.ORC_ID),
      description: str(row.DESCRIPTION),
      amount: money2(row.AMOUNT),
      periodId: str(row.PERIOD_ID),
      chkOwnerAcc: Number(row.CHK_OWNER_ACC) === 1,
    };
    if (identify === 'SUB') subRows.push(mapped);
    else if (identify === 'HOLD_CLEANING') holdRows.push(mapped);
    else if (identify === 'HIRE_SURVEY') surveyRows.push(mapped);
    else addRows.push(mapped);
  }
  return { addRows, subRows, holdRows, surveyRows };
}

async function loadAdjRows(pool, invoiceId) {
  if (!invoiceId) return { adjAddRows: [], adjSubRows: [] };
  const [rows] = await pool.query(
    `SELECT ORC_ID, FIXTURE_NO, VESSEL, DESCRIPTION, AMOUNT, IDENTIFY
     FROM invoice_hire_adj
     WHERE INVOICEID = ?`,
    [invoiceId],
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

async function loadOffhireRows(pool, invoiceId) {
  if (!invoiceId) return [];
  const [rows] = await pool.query(
    `SELECT OFF_REASON, OFF_FROM, OFF_TO, OFF_HIRE_PERCENT, OFF_DAYS, OFF_HIRE, HIRE_RATE, PERIOD_ID
     FROM invoice_hire_slave6
     WHERE INVOICEID = ?
     ORDER BY INVOICE_SLAVE6ID`,
    [invoiceId],
  ).catch(() => [[]]);
  return (rows || []).map((row) => ({
    reason: str(row.OFF_REASON),
    offFrom: formatDateTimeDMY(row.OFF_FROM),
    offTo: formatDateTimeDMY(row.OFF_TO),
    percent: parseAmount(row.OFF_HIRE_PERCENT),
    days: days5(row.OFF_DAYS),
    hireRate: parseAmount(row.HIRE_RATE),
    amount: money2(row.OFF_HIRE),
    periodId: str(row.PERIOD_ID),
  }));
}

async function loadHireDayDraftMap(pool, invoiceId) {
  const map = new Map();
  if (!invoiceId) return map;
  const [rows] = await pool.query(
    `SELECT RANDOMID, UTILISED_DAYS, HIRE_AMT, HIRE_FROM, HIRE_TO
     FROM invoice_hire_slave8
     WHERE INVOICEID = ?`,
    [invoiceId],
  ).catch(() => [[]]);
  for (const row of rows || []) {
    map.set(str(row.RANDOMID), {
      utilisedDays: days5(row.UTILISED_DAYS),
      hireAmt: money2(row.HIRE_AMT),
      hireFrom: formatDateTimeDMY(row.HIRE_FROM),
      hireTo: formatDateTimeDMY(row.HIRE_TO),
    });
  }
  return map;
}

async function loadApprovedUtilisedDays(pool, comId, randomId) {
  if (!comId || !randomId) return 0;
  const [[row]] = await pool.query(
    `SELECT SUM(s.UTILISED_DAYS) AS DAYS
     FROM invoice_hire_slave8 s
     INNER JOIN invoice_hire_master m ON m.INVOICEID = s.INVOICEID
     WHERE m.COMID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.STATUS = 5
       AND s.RANDOMID = ?`,
    [comId, MODULE_ID, COMPANY_ID, randomId],
  ).catch(() => [[null]]);
  return days5(row?.DAYS);
}

async function loadEstimateHireDays(pool, {
  fcaId,
  comId,
  draftInvoiceId,
  fallbackRate,
}) {
  const [rows] = await pool.query(
    `SELECT RANDOMID, HIRE_DAYS, HIRE_RATE, HIRE_FROM, HIRE_TO
     FROM freight_cost_estimete_slave17
     WHERE FCAID = ?
     ORDER BY RANDOMID`,
    [fcaId],
  ).catch(() => [[]]);

  const draftMap = await loadHireDayDraftMap(pool, draftInvoiceId);
  const result = [];

  for (const row of rows || []) {
    const randomId = str(row.RANDOMID);
    const totalDays = days5(row.HIRE_DAYS);
    const invoicedDays = await loadApprovedUtilisedDays(pool, comId, randomId);
    const remainingDays = days5(Math.max(0, totalDays - invoicedDays));
    const draft = draftMap.get(randomId) || {};
    const dailyRate = parseAmount(row.HIRE_RATE) || parseAmount(fallbackRate);
    const utilisedDays = draft.utilisedDays != null && draft.utilisedDays !== 0
      ? draft.utilisedDays
      : 0;
    result.push({
      randomId,
      totalDays,
      invoicedDays,
      remainingDays,
      dailyRate,
      hireFrom: draft.hireFrom || formatDateTimeDMY(row.HIRE_FROM),
      hireTo: draft.hireTo || '',
      utilisedDays,
      hireAmt: draft.hireAmt || money2(utilisedDays * dailyRate),
    });
  }

  if (!result.length) {
    const randomId = str([...draftMap.keys()][0] || '1');
    const draft = draftMap.get(randomId) || {};
    const dailyRate = parseAmount(fallbackRate);
    result.push({
      randomId,
      totalDays: 0,
      invoicedDays: 0,
      remainingDays: 0,
      dailyRate,
      hireFrom: draft.hireFrom || '',
      hireTo: draft.hireTo || '',
      utilisedDays: draft.utilisedDays || 0,
      hireAmt: draft.hireAmt || 0,
    });
  }

  return result;
}

function mapDraftInvoice(row, lineRows, adjRows, offhireRows, hireDayRows) {
  return {
    invoiceId: String(row.INVOICEID),
    status: Number(row.STATUS) || 0,
    invoiceType: str(row.INVOICE_TYPE),
    invoiceNo: str(row.INVOICE_NO),
    invoiceDate: blankDate(row.INVOICE_DATE),
    exchangeDate: blankDate(row.EXCHANGE_DATE),
    exchangeRate: str(row.EXCHANGE_RATE) || '1',
    exchangeCurrency: str(row.CURRENCY) || 'USD',
    paymentTerms: str(row.PAYMENT_TERMS),
    description: str(row.DESCRIPTION),
    hireFrom: formatDateTimeDMY(row.HIRE_FROM),
    hireTo: formatDateTimeDMY(row.HIRE_TO),
    hireDays: days5(row.HIRE_DAYS),
    hireAmt: money2(row.HIRE_AMT),
    cve: parseAmount(row.CVE),
    cveAmt: money2(row.CVE_AMT),
    cveAmtManual: money2(row.CVE_AMT_MANUAL),
    addCommPer: parseAmount(row.ADD_COMM_PER),
    addCommAmt: money2(row.ADD_COMM_AMT),
    broCommPer: parseAmount(row.BRO_COMM_PER),
    broCommAmt: money2(row.BRO_COMM_AMT),
    offhireDays: days5(row.OFFHIRE_DAYS),
    offhireAmt: money2(row.OFFHIRE_AMT),
    offhireCve: parseAmount(row.OFFHIRE_CVE),
    offhireCveAmt: money2(row.OFFHIRE_CVE_AMT),
    finalAmt: money2(row.FINAL_AMT),
    chkOffhire: Number(row.CHK_OFFHIRE) === 1,
    chkDelivery: Number(row.CHK_DELIVERY) === 1,
    chkRedelivery: Number(row.CHK_REDELIVERY) === 1,
    chkBallastBonus: Number(row.CHK_BALLAST_BONUS) === 1,
    chkOverconsp: Number(row.CHK_OVERCONSP) === 1,
    shipOwner: str(row.SHIP_OWNER),
    fcaId: str(row.FCAID),
    bunkerConsumption: money2(row.BUNKER_CONSUMPTION),
    balanceToOwner: money2(row.BALANCE_TO_OWNER),
    dailyHireRate: parseAmount(row.DAILY_HIRE_RATE),
    upload: str(row.UPLOAD),
    uploadName: str(row.UPLOAD_NAME),
    bankingId: str(row.VENDOR_SLAVEID),
    bankingDetailId: str(row.BANKINGDETAILID),
    paymentStatus: str(row.PAYMENT_STATUS) || 'payment_payable',
    pAmt: money2(row.P_AMT),
    pDate: blankDate(row.P_DATE),
    pRemarks: str(row.P_REMARKS),
    selApprovers: parseApprovers(row.APPROVERS),
    creator: str(row.CREATOR),
    lastUpdatedBy: str(row.L_UPDATED_BY),
    lastUpdatedAt: str(row.L_UP_TIME),
    hireDayRows,
    addRows: lineRows.addRows,
    subRows: lineRows.subRows,
    holdRows: lineRows.holdRows,
    surveyRows: lineRows.surveyRows,
    adjAddRows: adjRows.adjAddRows,
    adjSubRows: adjRows.adjSubRows,
    offhireRows,
  };
}

async function findDraftInvoice(pool, { invoiceId, comId }) {
  if (invoiceId) {
    const [[row]] = await pool.query(
      `SELECT * FROM invoice_hire_master WHERE INVOICEID = ? LIMIT 1`,
      [invoiceId],
    ).catch(() => [[null]]);
    return row || null;
  }
  if (!comId) return null;
  const [[row]] = await pool.query(
    `SELECT * FROM invoice_hire_master
     WHERE COMID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
       AND STATUS < 5
     ORDER BY INVOICEID DESC
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
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
            l.CONTACT_PERSON AS UPDATED_BY_NAME
     FROM invoice_hire_master m
     LEFT JOIN login l ON l.LOGINID = m.L_UPDATED_BY
     WHERE m.COMID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.STATUS >= 5
     ORDER BY m.INVOICE_DATE ASC, m.INVOICEID ASC`,
    [comId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[]]);

  return (rows || []).map((row) => ({
    invoiceId: String(row.INVOICEID),
    status: Number(row.STATUS) || 0,
    fixtureNo: voyageNo || '',
    vesselName: vesselName || '',
    invoiceType: str(row.INVOICE_TYPE),
    invoiceDate: blankDate(row.INVOICE_DATE),
    invoiceNo: str(row.INVOICE_NO),
    hireFrom: formatDateTimeDMY(row.HIRE_FROM),
    hireTo: formatDateTimeDMY(row.HIRE_TO),
    hireDays: days5(row.HIRE_DAYS),
    amount: money2(row.FINAL_AMT || row.BALANCE_TO_OWNER),
    paymentStatus: str(row.PAYMENT_STATUS),
    pAmt: money2(row.P_AMT),
    pDate: blankDate(row.P_DATE),
    upload: str(row.UPLOAD),
    uploadName: str(row.UPLOAD_NAME),
    lastUpdatedBy: str(row.UPDATED_BY_NAME || row.L_UPDATED_BY),
    lastUpdatedAt: str(row.L_UP_TIME),
    canDelete: Boolean(mgmt),
    canReopen: Boolean(mgmt),
    canReceivePayment: !(parseAmount(row.P_AMT) > 0),
    canPdf: true,
  }));
}

async function deleteHireSlaves(conn, invoiceId) {
  await conn.query(`DELETE FROM invoice_hire_slave1 WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
  await conn.query(`DELETE FROM invoice_hire_slave2 WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
  await conn.query(`DELETE FROM invoice_hire_slave4 WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
  await conn.query(`DELETE FROM invoice_hire_slave5 WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
  await conn.query(`DELETE FROM invoice_hire_slave6 WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
  await conn.query(`DELETE FROM invoice_hire_slave61 WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
  await conn.query(`DELETE FROM invoice_hire_slave7 WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
  await conn.query(`DELETE FROM invoice_hire_slave8 WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
  await conn.query(`DELETE FROM invoice_hire_adj WHERE INVOICEID = ?`, [invoiceId]).catch(() => undefined);
}

async function insertHireSlaves(conn, invoiceId, {
  hireDayRows,
  addRows,
  subRows,
  holdRows,
  surveyRows,
  adjAddRows,
  adjSubRows,
  offhireRows,
  chkOffhire,
  periodId,
}) {
  for (const row of hireDayRows) {
    await conn.query(
      `INSERT INTO invoice_hire_slave8
         (INVOICEID, RANDOMID, UTILISED_DAYS, HIRE_AMT, HIRE_FROM, HIRE_TO)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        row.randomId || null,
        row.utilisedDays || 0,
        row.hireAmt || 0,
        sqlDateTimeOrEpoch(row.hireFrom),
        sqlDateTimeOrEpoch(row.hireTo),
      ],
    );
  }

  for (const row of addRows) {
    await conn.query(
      `INSERT INTO invoice_hire_slave1
         (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, PERIOD_ID)
       VALUES (?, ?, ?, 'ADD', ?, ?)`,
      [invoiceId, row.description, row.amount, row.orcId || null, periodId || row.periodId || null],
    );
  }
  for (const row of subRows) {
    await conn.query(
      `INSERT INTO invoice_hire_slave1
         (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, PERIOD_ID)
       VALUES (?, ?, ?, 'SUB', ?, ?)`,
      [invoiceId, row.description, row.amount, row.orcId || null, periodId || row.periodId || null],
    );
  }
  for (const row of holdRows) {
    await conn.query(
      `INSERT INTO invoice_hire_slave1
         (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, PERIOD_ID)
       VALUES (?, ?, ?, 'HOLD_CLEANING', ?)`,
      [invoiceId, row.description, row.amount, periodId || row.periodId || null],
    );
  }
  for (const row of surveyRows) {
    await conn.query(
      `INSERT INTO invoice_hire_slave1
         (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, CHK_OWNER_ACC)
       VALUES (?, ?, ?, 'HIRE_SURVEY', ?)`,
      [invoiceId, row.description, row.amount, row.chkOwnerAcc ? 1 : 0],
    );
  }

  for (const row of adjAddRows) {
    await conn.query(
      `INSERT INTO invoice_hire_adj
         (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, FIXTURE_NO, VESSEL)
       VALUES (?, ?, ?, 'ADD', ?, ?, ?)`,
      [invoiceId, row.description, row.amount, row.orcId || null, row.fixtureNo || null, row.vessel || null],
    );
  }
  for (const row of adjSubRows) {
    await conn.query(
      `INSERT INTO invoice_hire_adj
         (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, FIXTURE_NO, VESSEL)
       VALUES (?, ?, ?, 'SUB', ?, ?, ?)`,
      [invoiceId, row.description, row.amount, row.orcId || null, row.fixtureNo || null, row.vessel || null],
    );
  }

  if (chkOffhire) {
    for (const row of offhireRows) {
      if (!row.reason && !row.days && !row.amount) continue;
      await conn.query(
        `INSERT INTO invoice_hire_slave6
           (INVOICEID, OFF_REASON, OFF_FROM, OFF_TO, OFF_HIRE_PERCENT, OFF_DAYS, OFF_HIRE, HIRE_RATE, PERIOD_ID)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          row.reason,
          sqlDateTimeOrEpoch(row.offFrom),
          sqlDateTimeOrEpoch(row.offTo),
          row.percent || 0,
          row.days || 0,
          row.amount || 0,
          row.hireRate || 0,
          periodId || row.periodId || null,
        ],
      );
    }
  }
}

function computeHireTotals({
  hireDayRows,
  addRows,
  subRows,
  holdRows,
  surveyRows,
  adjAddRows,
  adjSubRows,
  offhireRows,
  cve,
  addCommPer,
  broCommPer,
  chkOffhire,
  chkBallastBonus,
  ballastBonus,
}) {
  const hireDays = days5(hireDayRows.reduce((sum, row) => sum + parseAmount(row.utilisedDays), 0));
  const hireAmt = money2(hireDayRows.reduce((sum, row) => sum + parseAmount(row.hireAmt), 0));
  const cveAmt = money2(((parseAmount(cve) * 12) / 365) * hireDays);
  let grossHire = hireAmt;
  if (chkBallastBonus) grossHire = money2(grossHire + parseAmount(ballastBonus));
  const addCommAmt = money2((grossHire * parseAmount(addCommPer)) / 100);
  const broCommAmt = money2((grossHire * parseAmount(broCommPer)) / 100);
  const addTotal = money2(addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0));
  const subTotal = money2(subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0));
  const holdTotal = money2(holdRows.reduce((sum, row) => sum + parseAmount(row.amount), 0));
  const surveyAdd = money2(
    surveyRows.filter((row) => row.chkOwnerAcc).reduce((sum, row) => sum + parseAmount(row.amount), 0),
  );
  const surveyLess = money2(
    surveyRows.filter((row) => !row.chkOwnerAcc).reduce((sum, row) => sum + parseAmount(row.amount), 0),
  );
  const adjAdd = money2(adjAddRows.reduce((sum, row) => sum + parseAmount(row.amount), 0));
  const adjSub = money2(adjSubRows.reduce((sum, row) => sum + parseAmount(row.amount), 0));
  const offhireDays = chkOffhire
    ? days5(offhireRows.reduce((sum, row) => sum + parseAmount(row.days), 0))
    : 0;
  const offhireAmt = chkOffhire
    ? money2(offhireRows.reduce((sum, row) => sum + parseAmount(row.amount), 0))
    : 0;
  const offhireCveAmt = chkOffhire
    ? money2(((parseAmount(cve) * 12) / 365) * offhireDays)
    : 0;
  const finalAmt = money2(
    grossHire
    + cveAmt
    + addTotal
    + holdTotal
    + surveyAdd
    + adjAdd
    - addCommAmt
    - broCommAmt
    - subTotal
    - surveyLess
    - adjSub
    - offhireAmt,
  );
  return {
    hireDays,
    hireAmt,
    cveAmt,
    addCommAmt,
    broCommAmt,
    offhireDays,
    offhireAmt,
    offhireCveAmt,
    finalAmt,
  };
}

/**
 * Form context for Ops VC Hire Statement (PHP invoice_hire.php).
 */
export async function dbGetHireStatementForm({
  comId,
  page = '1',
  voyageNo = '',
  userId = appContext.userId,
  mgmtUser = isMgmtUser(),
} = {}) {
  const pool = getPool();
  const resolvedComId = str(comId);
  if (!resolvedComId) {
    throw Object.assign(new Error('COMID is required.'), { status: 400 });
  }

  const [[compare]] = await pool.query(
    `SELECT c.*, m.VOYAGE_NO AS MASTER_VOYAGE_NO, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID,
            m.TRANS_DATE, m.CP_DATE AS MASTER_CP_DATE, m.TC_CP_DATE, m.TC_NO,
            m.HIREAGE_PERCENT, m.HIERAGE_CVE, m.HIERAGE_BROKER_PERCENT, m.BALLAST_BONUS,
            m.FINAL_HIERAGE_AMOUNT, m.TC_HIRE_DAYS, m.TOTAL_DAYS, m.PERIODID,
            m.EXPECTED_HIRE, m.EXCHANGE_RATE AS MASTER_EXCHANGE_RATE, m.DTCVENDORID AS MASTER_DTCVENDORID,
            m.FCAID AS MASTER_FCAID, vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = COALESCE(m.VESSEL_IMO_ID, c.VESSEL_IMO_ID)
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [resolvedComId, MODULE_ID],
  ).catch(() => [[null]]);

  if (!compare?.COMID) {
    throw Object.assign(new Error('VC nomination not found.'), { status: 404 });
  }

  const [[latest]] = await pool.query(
    `SELECT FCAID, TRANS_DATE, CP_DATE, TC_CP_DATE, VESSEL_IMO_ID, VOYAGE_NO, TC_NO,
            HIREAGE_PERCENT, HIERAGE_CVE, HIERAGE_BROKER_PERCENT, BALLAST_BONUS,
            FINAL_HIERAGE_AMOUNT, TC_HIRE_DAYS, TOTAL_DAYS, PERIODID, EXPECTED_HIRE,
            EXCHANGE_RATE, DTCVENDORID
     FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [resolvedComId, MODULE_ID],
  ).catch(() => [[null]]);

  const fcaId = str(compare.FCAID || compare.MASTER_FCAID || latest?.FCAID);
  const vendorId = str(compare.DTCVENDORID || compare.MASTER_DTCVENDORID || latest?.DTCVENDORID);
  const vendor = await getVendorRow(pool, vendorId);
  const vendorInternalId = vendor?.VENDORID != null ? String(vendor.VENDORID) : '';
  const voyage = str(voyageNo)
    || str(compare.MASTER_VOYAGE_NO)
    || str(latest?.VOYAGE_NO)
    || str(compare.MESSAGE);
  const vesselName = str(compare.VESSEL_NAME);
  const vesselImoId = str(compare.MASTER_VESSEL_IMO_ID || latest?.VESSEL_IMO_ID || compare.VESSEL_IMO_ID);
  const cpDate = blankDate(
    compare.TC_CP_DATE
    || latest?.TC_CP_DATE
    || compare.TRANS_DATE
    || latest?.TRANS_DATE
    || compare.MASTER_CP_DATE
    || latest?.CP_DATE
    || compare.CP_DATE,
  );
  const nomMessage = str(compare.MESSAGE);
  const tcNo = str(compare.TC_NO || latest?.TC_NO);
  const periodId = str(compare.PERIODID || latest?.PERIODID);
  const dailyHireRate = parseAmount(compare.EXPECTED_HIRE || latest?.EXPECTED_HIRE);
  const cve = parseAmount(compare.HIERAGE_CVE || latest?.HIERAGE_CVE);
  const addCommPer = parseAmount(compare.HIREAGE_PERCENT || latest?.HIREAGE_PERCENT);
  const broCommPer = parseAmount(compare.HIERAGE_BROKER_PERCENT || latest?.HIERAGE_BROKER_PERCENT);
  const ballastBonus = parseAmount(compare.BALLAST_BONUS || latest?.BALLAST_BONUS);
  const finalHireage = parseAmount(compare.FINAL_HIERAGE_AMOUNT || latest?.FINAL_HIERAGE_AMOUNT);
  const estHireDays = parseAmount(compare.TC_HIRE_DAYS || latest?.TC_HIRE_DAYS || compare.TOTAL_DAYS || latest?.TOTAL_DAYS);

  const [orcOptions] = await pool.query(
    `SELECT OWNER_RCOSTID AS id, NAME AS name
     FROM owner_related_cost_master
     ORDER BY NAME`,
  ).catch(() => [[]]);

  const [owners] = await pool.query(
    `SELECT CODE AS id, CONCAT(NAME, ' (', CODE, ')') AS name
     FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID = 11 AND MCOMPANYID = ?
     ORDER BY NAME`,
    [COMPANY_ID],
  ).catch(() => [[]]);

  const [companyBankingDetails] = await pool.query(
    `SELECT BD_ID AS id, CONCAT(NAME, ' - ', BANK) AS name
     FROM banking_details
     WHERE STATUS = 1
     ORDER BY NAME`,
  ).catch(() => [[]]);

  const { fixtures, vessels } = await getFixtureOptions(pool);
  const approval = await getApproverContext(pool, userId);

  let vendorBanking = [];
  if (vendorInternalId) {
    vendorBanking = await dbGetVendorBanking(vendorInternalId).catch(() => []);
  }

  const draft = await findDraftInvoice(pool, { comId: resolvedComId });
  const hireDayRows = await loadEstimateHireDays(pool, {
    fcaId,
    comId: resolvedComId,
    draftInvoiceId: draft?.INVOICEID,
    fallbackRate: dailyHireRate,
  });

  let currentInvoice = null;
  if (draft) {
    const lineRows = await loadSlave1Rows(pool, draft.INVOICEID);
    const adjRows = await loadAdjRows(pool, draft.INVOICEID);
    const offhireRows = await loadOffhireRows(pool, draft.INVOICEID);
    currentInvoice = mapDraftInvoice(draft, lineRows, adjRows, offhireRows, hireDayRows);
  }

  const existingInvoices = await loadExistingInvoices(pool, {
    comId: resolvedComId,
    voyageNo: voyage,
    vesselName,
    mgmt: Boolean(mgmtUser),
  });

  const defaults = {
    invoiceType: currentInvoice?.invoiceType || 'Interim',
    invoiceNo: currentInvoice?.invoiceNo || tcNo || voyage || '',
    invoiceDate: currentInvoice?.invoiceDate || '',
    exchangeRate: currentInvoice?.exchangeRate || str(compare.MASTER_EXCHANGE_RATE || latest?.EXCHANGE_RATE || '1'),
    exchangeDate: currentInvoice?.exchangeDate || '',
    exchangeCurrency: currentInvoice?.exchangeCurrency || 'USD',
    paymentTerms: currentInvoice?.paymentTerms || '',
    description: currentInvoice?.description || '',
    hireFrom: currentInvoice?.hireFrom || hireDayRows[0]?.hireFrom || '',
    hireTo: currentInvoice?.hireTo || hireDayRows[0]?.hireTo || '',
    dailyHireRate: currentInvoice?.dailyHireRate || dailyHireRate || hireDayRows[0]?.dailyRate || 0,
    cve: currentInvoice?.cve != null ? currentInvoice.cve : cve,
    addCommPer: currentInvoice?.addCommPer != null ? currentInvoice.addCommPer : addCommPer,
    broCommPer: currentInvoice?.broCommPer != null ? currentInvoice.broCommPer : broCommPer,
    ballastBonus: ballastBonus,
    finalHireage,
    estHireDays,
    chkOffhire: currentInvoice?.chkOffhire || false,
    chkDelivery: currentInvoice?.chkDelivery || false,
    chkRedelivery: currentInvoice?.chkRedelivery || false,
    chkBallastBonus: currentInvoice?.chkBallastBonus || false,
    chkOverconsp: currentInvoice?.chkOverconsp || false,
    shipOwner: currentInvoice?.shipOwner || '',
    bankingId: currentInvoice?.bankingId || '',
    bankingDetailId: currentInvoice?.bankingDetailId || '',
    paymentStatus: currentInvoice?.paymentStatus || 'payment_payable',
    selApprovers: currentInvoice?.selApprovers || [],
    upload: currentInvoice?.upload || '',
    uploadName: currentInvoice?.uploadName || '',
    hireDayRows: currentInvoice?.hireDayRows || hireDayRows,
  };

  return {
    page: String(page || '1'),
    comId: resolvedComId,
    fcaId,
    periodId,
    vendorId,
    vendorName: str(vendor?.NAME),
    vendorAddress: [
      vendor?.NAME,
      vendor?.STREET_1,
      vendor?.STREET_2,
      vendor?.CITY,
      vendor?.COUNTRY,
      vendor?.CITY_POSTAL_CODE,
    ].map(str).filter(Boolean).join(', '),
    vendorInternalId,
    voyageNo: voyage,
    tcNo,
    vesselName,
    vesselImoId,
    nomMessage,
    cpDate,
    dailyHireRate: defaults.dailyHireRate,
    cve: defaults.cve,
    addCommPer: defaults.addCommPer,
    broCommPer: defaults.broCommPer,
    ballastBonus,
    finalHireage,
    estHireDays,
    invoiceTypes: INVOICE_TYPES,
    currencies: CURRENCY_OPTIONS,
    owners: (owners || []).map((row) => ({ id: String(row.id), name: row.name })),
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
    hireDayRows,
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
    existingInvoices,
    currentInvoice,
    defaults,
  };
}

export async function dbSaveHireStatement(payload = {}, { userId = appContext.userId } = {}) {
  const pool = getPool();
  const comId = str(payload.comId || payload.comid);
  if (!comId) throw Object.assign(new Error('COMID is required.'), { status: 400 });

  const fcaId = str(payload.fcaId || payload.txtFCAID);
  const invoiceType = str(payload.invoiceType || payload.selIType || 'Interim') || 'Interim';
  const invoiceNo = str(payload.invoiceNo || payload.txtInvNo);
  const invoiceDateSql = parseDmyToSqlDate(payload.invoiceDate || payload.txtInvDate);
  const exchangeDateSql = parseDmyToSqlDate(payload.exchangeDate || payload.txtExchangeDate) || '1970-01-01';
  const exchangeRate = money2(payload.exchangeRate ?? payload.txtExchangeRate ?? 1);
  const exchangeCurrency = str(payload.exchangeCurrency || payload.selExchangeCurrency || 'USD') || 'USD';
  const paymentTerms = str(payload.paymentTerms || payload.txtPaymentTerms);
  const description = str(payload.description || payload.txtDesc || payload.remarks);
  const shipOwner = str(payload.shipOwner || payload.selFromOwner);
  const dailyHireRate = parseAmount(payload.dailyHireRate ?? payload.txtHireperDay);
  const cve = parseAmount(payload.cve ?? payload.txtCVEMonth);
  const addCommPer = parseAmount(payload.addCommPer ?? payload.txtAddrCommPer);
  const broCommPer = parseAmount(payload.broCommPer ?? payload.txtBroCommPer);
  const ballastBonus = parseAmount(payload.ballastBonus ?? payload.txtBallastBonus);
  const chkOffhire = parseChk(payload.chkOffhire ?? payload.ChkShowOffHire);
  const chkDelivery = parseChk(payload.chkDelivery ?? payload.ChkDeliveryBunker);
  const chkRedelivery = parseChk(payload.chkRedelivery ?? payload.ChkReDeliveryBunker);
  const chkBallastBonus = parseChk(payload.chkBallastBonus ?? payload.ChkBallastBonus);
  const chkOverconsp = parseChk(payload.chkOverconsp ?? payload.ChkOverConspBunker);
  const bankingId = str(payload.bankingId || payload.selBankingID);
  const bankingDetailId = str(payload.bankingDetailId || payload.selBankingID1);
  const paymentStatus = str(payload.paymentStatus || payload.payment_status || 'payment_payable')
    || 'payment_payable';
  const upload = str(payload.upload || payload.UPLOAD || payload.attachment || '');
  const uploadName = str(payload.uploadName || payload.UPLOAD_NAME || payload.attachmentName || '');
  const periodId = str(payload.periodId || payload.periodID);
  const bunkerConsumption = money2(payload.bunkerConsumption ?? payload.txtOFFHIRE_Bunker);
  const cveAmtManual = money2(payload.cveAmtManual ?? payload.txtCVE_AmtManual);

  const status = Number(payload.status ?? payload.txtStatus ?? 0);
  if (!Number.isFinite(status) || status < 0) {
    throw Object.assign(new Error('Invalid status.'), { status: 400 });
  }

  let approvers = parseApprovers(payload.selApprovers || payload.approvers);
  if (status === 1 && !approvers.length) {
    throw Object.assign(new Error('Please select Level 1 Approvers first.'), { status: 400 });
  }

  if (!shipOwner) throw Object.assign(new Error('Invoicing Company is required.'), { status: 400 });
  if (!invoiceType) throw Object.assign(new Error('Statement Type is required.'), { status: 400 });
  if (!invoiceNo) throw Object.assign(new Error('Hire Statement Number is required.'), { status: 400 });
  if (!invoiceDateSql) throw Object.assign(new Error('Hire Statement Date is required.'), { status: 400 });

  const hireDayRows = parseHireDayRows(payload.hireDayRows);
  const addRows = parseLineRows(payload.addRows);
  const subRows = parseLineRows(payload.subRows);
  const holdRows = parseLineRows(payload.holdRows);
  const surveyRows = parseLineRows(payload.surveyRows);
  const adjAddRows = parseAdjRows(payload.adjAddRows);
  const adjSubRows = parseAdjRows(payload.adjSubRows);
  const offhireRows = chkOffhire ? parseOffhireRows(payload.offhireRows) : [];

  const computed = computeHireTotals({
    hireDayRows,
    addRows,
    subRows,
    holdRows,
    surveyRows,
    adjAddRows,
    adjSubRows,
    offhireRows,
    cve,
    addCommPer,
    broCommPer,
    chkOffhire,
    chkBallastBonus,
    ballastBonus,
  });

  const hireDays = payload.hireDays != null && payload.hireDays !== ''
    ? days5(payload.hireDays ?? payload.txtHireDays)
    : computed.hireDays;
  const hireAmt = payload.hireAmt != null && payload.hireAmt !== ''
    ? money2(payload.hireAmt ?? payload.txtTotalHire)
    : computed.hireAmt;
  const cveAmt = payload.cveAmt != null && payload.cveAmt !== ''
    ? money2(payload.cveAmt ?? payload.txtCVE_Amt)
    : computed.cveAmt;
  const addCommAmt = payload.addCommAmt != null && payload.addCommAmt !== ''
    ? money2(payload.addCommAmt ?? payload.txtAddrCommAmt)
    : computed.addCommAmt;
  const broCommAmt = payload.broCommAmt != null && payload.broCommAmt !== ''
    ? money2(payload.broCommAmt ?? payload.txtBroCommAmt)
    : computed.broCommAmt;
  const offhireDays = payload.offhireDays != null && payload.offhireDays !== ''
    ? days5(payload.offhireDays ?? payload.txtOffHireDays)
    : computed.offhireDays;
  const offhireAmt = payload.offhireAmt != null && payload.offhireAmt !== ''
    ? money2(payload.offhireAmt ?? payload.txtOffHire)
    : computed.offhireAmt;
  const offhireCve = parseAmount(payload.offhireCve ?? payload.txtCVEOffHireMonth ?? cve);
  const offhireCveAmt = payload.offhireCveAmt != null && payload.offhireCveAmt !== ''
    ? money2(payload.offhireCveAmt ?? payload.txtCVEOFFHIRE_Amt)
    : computed.offhireCveAmt;
  const finalAmt = payload.finalAmt != null && payload.finalAmt !== ''
    ? money2(payload.finalAmt ?? payload.txtFinalAmt)
    : computed.finalAmt;
  const balanceToOwner = payload.balanceToOwner != null && payload.balanceToOwner !== ''
    ? money2(payload.balanceToOwner ?? payload.txtBalanceShipOwner)
    : finalAmt;

  const hireFromSql = parseDmyDateTimeToSql(
    payload.hireFrom || payload.txtHireFrom || hireDayRows[0]?.hireFrom,
  );
  const hireToSql = parseDmyDateTimeToSql(
    payload.hireTo || payload.txtHireTo || hireDayRows[hireDayRows.length - 1]?.hireTo,
  );

  const [[compare]] = await pool.query(
    `SELECT c.VESSEL_IMO_ID, c.MESSAGE, c.DTCVENDORID, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID,
            m.DTCVENDORID AS MASTER_DTCVENDORID, vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = COALESCE(m.VESSEL_IMO_ID, c.VESSEL_IMO_ID)
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);

  const vesselName = str(compare?.VESSEL_NAME);
  const vendorId = str(payload.vendorId || compare?.DTCVENDORID || compare?.MASTER_DTCVENDORID);
  const vendor = await getVendorRow(pool, vendorId);
  const bankingDetailsText = str(vendor?.BANKING_DETAILS);

  const existing = await findDraftInvoice(pool, {
    invoiceId: str(payload.invoiceId || payload.txtInID),
    comId,
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let invoiceId;
    let creatorLoginId = userId;

    if (!existing) {
      const [result] = await connection.query(
        `INSERT INTO invoice_hire_master (
           MCOMPANYID, MODULEID, COMID, INVOICE_DATE, STATUS, INVOICE_TYPE, INVOICE_NO,
           EXCHANGE_DATE, EXCHANGE_RATE, CURRENCY, PAYMENT_TERMS, DESCRIPTION,
           HIRE_FROM, HIRE_TO, HIRE_DAYS, HIRE_AMT, CVE, CVE_AMT,
           ADD_COMM_PER, ADD_COMM_AMT, OFFHIRE_DAYS, OFFHIRE_AMT, OFFHIRE_CVE, OFFHIRE_CVE_AMT,
           FINAL_AMT, BRO_COMM_PER, BRO_COMM_AMT, CHK_OFFHIRE, CHK_DELIVERY, CHK_REDELIVERY,
           SHIP_OWNER, FCAID, BUNKER_CONSUMPTION, CHK_BALLAST_BONUS, BALANCE_TO_OWNER,
           APPROVERS, CREATOR, DAILY_HIRE_RATE, UPLOAD, UPLOAD_NAME, CHK_OVERCONSP,
           BANKING_DETAILS, VENDOR_SLAVEID, BANKINGDETAILID, PAYMENT_STATUS, CVE_AMT_MANUAL,
           L_UPDATED_BY, L_UP_TIME, IS_SHOW_TC
         ) VALUES (
           ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, NOW(), 1
         )`,
        [
          COMPANY_ID,
          MODULE_ID,
          comId,
          invoiceDateSql,
          status,
          invoiceType,
          invoiceNo,
          exchangeDateSql,
          exchangeRate,
          exchangeCurrency,
          paymentTerms,
          description,
          hireFromSql || '1970-01-01 08:00:00',
          hireToSql || '1970-01-01 08:00:00',
          hireDays,
          hireAmt,
          cve,
          cveAmt,
          addCommPer,
          addCommAmt,
          offhireDays,
          offhireAmt,
          offhireCve,
          offhireCveAmt,
          finalAmt,
          broCommPer,
          broCommAmt,
          chkOffhire,
          chkDelivery,
          chkRedelivery,
          shipOwner,
          fcaId || null,
          bunkerConsumption,
          chkBallastBonus,
          balanceToOwner,
          approvers.join(','),
          userId,
          dailyHireRate,
          upload,
          uploadName,
          chkOverconsp,
          bankingDetailsText,
          bankingId || null,
          bankingDetailId || null,
          paymentStatus,
          cveAmtManual,
          userId,
        ],
      );
      invoiceId = result.insertId;
    } else {
      invoiceId = existing.INVOICEID;
      creatorLoginId = existing.CREATOR || userId;
      if (!(status === 0 || status === 1)) {
        approvers = parseApprovers(existing.APPROVERS);
      }

      await connection.query(
        `UPDATE invoice_hire_master SET
           COMID = ?, INVOICE_DATE = ?, STATUS = ?, INVOICE_TYPE = ?, INVOICE_NO = ?,
           EXCHANGE_DATE = ?, EXCHANGE_RATE = ?, CURRENCY = ?, PAYMENT_TERMS = ?, DESCRIPTION = ?,
           HIRE_FROM = ?, HIRE_TO = ?, HIRE_DAYS = ?, HIRE_AMT = ?, CVE = ?, CVE_AMT = ?,
           ADD_COMM_PER = ?, ADD_COMM_AMT = ?, OFFHIRE_DAYS = ?, OFFHIRE_AMT = ?,
           OFFHIRE_CVE = ?, OFFHIRE_CVE_AMT = ?, FINAL_AMT = ?, BRO_COMM_PER = ?, BRO_COMM_AMT = ?,
           CHK_OFFHIRE = ?, CHK_DELIVERY = ?, CHK_REDELIVERY = ?, SHIP_OWNER = ?,
           BUNKER_CONSUMPTION = ?, CHK_BALLAST_BONUS = ?, BALANCE_TO_OWNER = ?, APPROVERS = ?,
           DAILY_HIRE_RATE = ?, UPLOAD = ?, UPLOAD_NAME = ?, CHK_OVERCONSP = ?,
           BANKING_DETAILS = ?, VENDOR_SLAVEID = ?, BANKINGDETAILID = ?, PAYMENT_STATUS = ?,
           CVE_AMT_MANUAL = ?, L_UPDATED_BY = ?, L_UP_TIME = NOW(), IS_SHOW_TC = 1
         WHERE INVOICEID = ?`,
        [
          comId,
          invoiceDateSql,
          status,
          invoiceType,
          invoiceNo,
          exchangeDateSql,
          exchangeRate,
          exchangeCurrency,
          paymentTerms,
          description,
          hireFromSql || existing.HIRE_FROM || '1970-01-01 08:00:00',
          hireToSql || existing.HIRE_TO || '1970-01-01 08:00:00',
          hireDays,
          hireAmt,
          cve,
          cveAmt,
          addCommPer,
          addCommAmt,
          offhireDays,
          offhireAmt,
          offhireCve,
          offhireCveAmt,
          finalAmt,
          broCommPer,
          broCommAmt,
          chkOffhire,
          chkDelivery,
          chkRedelivery,
          shipOwner,
          bunkerConsumption,
          chkBallastBonus,
          balanceToOwner,
          approvers.join(','),
          dailyHireRate,
          upload,
          uploadName,
          chkOverconsp,
          bankingDetailsText,
          bankingId || null,
          bankingDetailId || null,
          paymentStatus,
          cveAmtManual,
          userId,
          invoiceId,
        ],
      );

      await deleteHireSlaves(connection, invoiceId);
    }

    await insertHireSlaves(connection, invoiceId, {
      hireDayRows,
      addRows,
      subRows,
      holdRows,
      surveyRows,
      adjAddRows,
      adjSubRows,
      offhireRows,
      chkOffhire,
      periodId,
    });

    await connection.commit();

    const page = str(payload.page || '1') || '1';
    const redirectUrl = `./invoice_hire.php?comid=${encodeURIComponent(comId)}&page=${encodeURIComponent(page)}`;

    await fireHireAlerts(pool, {
      invoiceId,
      status,
      invoiceNo,
      invoiceType,
      vesselName,
      creatorLoginId,
      approvers,
      userId,
      redirectUrl,
    });

    return {
      msg: 0,
      invoiceId,
      comId,
      invoiceType,
      invoiceNo,
      status,
      hireDays,
      hireAmt,
      finalAmt,
      balanceToOwner,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbReceiveHireStatementPayment(
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
    `UPDATE invoice_hire_master
     SET P_REMARKS = ?, P_AMT = ?, P_DATE = ?,
         ATTACHMENTS = ?, ATTACHMENTS_NAME = ?, ACC_USER = ?,
         PAYMENT_STATUS = 'payment_payable'
     WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
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
    throw Object.assign(new Error('Hire statement not found.'), { status: 404 });
  }

  await inactiveUserAlerts(pool, 'HIRE STATEMENT', id);
  return { msg: 3, invoiceId: id, amount: total };
}

export async function dbReopenHireStatement(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  let result;
  try {
    [result] = await pool.query(
      `UPDATE invoice_hire_master
       SET STATUS = 0, SYNC_STATUS = 0
       WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
  } catch {
    [result] = await pool.query(
      `UPDATE invoice_hire_master
       SET STATUS = 0
       WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
  }
  if (!result.affectedRows) {
    throw Object.assign(new Error('Hire statement not found.'), { status: 404 });
  }
  await inactiveUserAlerts(pool, 'HIRE STATEMENT', id);
  return { msg: 0, invoiceId: id };
}

export async function dbDeleteHireStatement(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT INVOICEID FROM invoice_hire_master
       WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?
       LIMIT 1`,
      [id, MODULE_ID, COMPANY_ID],
    );
    if (!row) {
      throw Object.assign(new Error('Hire statement not found.'), { status: 404 });
    }

    await deleteHireSlaves(connection, id);
    await connection.query(
      `DELETE FROM invoice_hire_slave3 WHERE INVOICEID = ?`,
      [id],
    ).catch(() => undefined);
    await connection.query(
      `DELETE FROM invoice_hire_master WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
    await connection.query(
      `DELETE FROM alert_master WHERE IDENTIFYID = ? AND IDENTIFY = 'HIRE STATEMENT'`,
      [id],
    ).catch(() => undefined);
    await connection.commit();
    return { msg: 3, invoiceId: id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbGetHireStatementForPdf(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const [[row]] = await pool.query(
    `SELECT m.*,
            vm.NAME AS VENDOR_NAME, vm.STREET_1, vm.CITY, vm.COUNTRY, vm.CITY_POSTAL_CODE,
            owner.NAME AS OWNER_NAME,
            vim.VESSEL_NAME, est.VOYAGE_NO, c.MESSAGE AS NOM_MESSAGE, c.DTCVENDORID
     FROM invoice_hire_master m
     LEFT JOIN freight_cost_estimate_compare c ON c.COMID = m.COMID AND c.MODULEID = m.MODULEID
     LEFT JOIN freight_cost_estimete_master est ON est.FCAID = COALESCE(m.FCAID, c.FCAID)
     LEFT JOIN vendor_master vm ON vm.CODE = COALESCE(c.DTCVENDORID, est.DTCVENDORID)
     LEFT JOIN vendor_master owner ON owner.CODE = m.SHIP_OWNER
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = COALESCE(est.VESSEL_IMO_ID, c.VESSEL_IMO_ID)
     WHERE m.INVOICEID = ? AND m.MODULEID = ? AND m.MCOMPANYID = ?
     LIMIT 1`,
    [id, MODULE_ID, COMPANY_ID],
  );
  if (!row) {
    throw Object.assign(new Error('Hire statement not found.'), { status: 404 });
  }

  const [hireDays] = await pool.query(
    `SELECT RANDOMID, UTILISED_DAYS, HIRE_AMT, HIRE_FROM, HIRE_TO
     FROM invoice_hire_slave8
     WHERE INVOICEID = ?
     ORDER BY RANDOMID`
    [id],
  ).catch(() => [[]]);

  const lineRows = await loadSlave1Rows(pool, id);
  const adjRows = await loadAdjRows(pool, id);
  const offhireRows = await loadOffhireRows(pool, id);

  const vendorAddress = [
    row.VENDOR_NAME,
    row.STREET_1,
    row.CITY,
    row.COUNTRY,
    row.CITY_POSTAL_CODE,
  ].map(str).filter(Boolean).join(', ');

  return {
    invoiceId: String(row.INVOICEID),
    invoiceNo: str(row.INVOICE_NO),
    invoiceType: str(row.INVOICE_TYPE),
    invoiceDate: blankDate(row.INVOICE_DATE),
    ownerName: str(row.OWNER_NAME || row.SHIP_OWNER),
    vendorName: str(row.VENDOR_NAME || row.DTCVENDORID),
    vendorAddress,
    voyageNo: str(row.VOYAGE_NO),
    nomMessage: str(row.NOM_MESSAGE),
    vesselName: str(row.VESSEL_NAME),
    currency: str(row.CURRENCY) || 'USD',
    exchangeRate: money2(row.EXCHANGE_RATE),
    paymentTerms: str(row.PAYMENT_TERMS),
    description: str(row.DESCRIPTION),
    hireFrom: formatDateTimeDMY(row.HIRE_FROM),
    hireTo: formatDateTimeDMY(row.HIRE_TO),
    hireDays: days5(row.HIRE_DAYS),
    dailyHireRate: parseAmount(row.DAILY_HIRE_RATE),
    hireAmt: money2(row.HIRE_AMT),
    cve: parseAmount(row.CVE),
    cveAmt: money2(row.CVE_AMT),
    addCommPer: parseAmount(row.ADD_COMM_PER),
    addCommAmt: money2(row.ADD_COMM_AMT),
    broCommPer: parseAmount(row.BRO_COMM_PER),
    broCommAmt: money2(row.BRO_COMM_AMT),
    offhireDays: days5(row.OFFHIRE_DAYS),
    offhireAmt: money2(row.OFFHIRE_AMT),
    finalAmt: money2(row.FINAL_AMT),
    balanceToOwner: money2(row.BALANCE_TO_OWNER),
    hireDayRows: (hireDays || []).map((item) => ({
      utilisedDays: days5(item.UTILISED_DAYS),
      hireAmt: money2(item.HIRE_AMT),
      hireFrom: formatDateTimeDMY(item.HIRE_FROM),
      hireTo: formatDateTimeDMY(item.HIRE_TO),
    })),
    addRows: lineRows.addRows,
    subRows: lineRows.subRows,
    holdRows: lineRows.holdRows,
    surveyRows: lineRows.surveyRows,
    adjAddRows: adjRows.adjAddRows,
    adjSubRows: adjRows.adjSubRows,
    offhireRows,
  };
}
