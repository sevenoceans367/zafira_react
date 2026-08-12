import { appContext, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';
import { dbGetBankingDetail } from './genericFinancesDb.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const APPROVAL_COLS = Object.freeze({
  interim: {
    creator: 'INI_FREIGHT_CHK_CRETR',
    app1: 'INI_FREIGHT_CHK_APP_1',
    app2: 'INI_FREIGHT_CHK_APP_2',
    acc: 'INI_FREIGHT_CHK_ACC',
  },
  final: {
    creator: 'FINL_FREIGHT_CHK_CRETR',
    app1: 'FINL_FREIGHT_CHK_APP_1',
    app2: 'FINL_FREIGHT_CHK_APP_2',
    acc: 'FINL_FREIGHT_CHK_ACC',
  },
});

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

function parseInvoiceIdCsv(csv) {
  const parts = String(csv || '').split(',');
  return {
    comId: str(parts[0]),
    fcaId: str(parts[1]),
    vendorId: str(parts[2]),
    amount: parseAmount(parts[3]),
    brokerageOrZero: str(parts[4]),
    quantity: parseAmount(parts[5]),
    cargoId: str(parts[6] || '0'),
    agreedLocal: str(parts[7] || '0'),
    exchangeRate: str(parts[8] || '0'),
    randomId: str(parts[9] || '0'),
    slaveId: str(parts[10] || '0'),
  };
}

export function parseVcInFlag(value) {
  return value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true';
}

function invoiceMasterTable(vcIn) {
  return parseVcInFlag(vcIn) ? 'freight_invoice_in_master' : 'freight_invoice_master';
}

function invoiceLineTable(vcIn) {
  return parseVcInFlag(vcIn) ? 'freight_invoice_in_slave' : 'freight_invoice_slave';
}

function invoicePaymentTable(vcIn) {
  return parseVcInFlag(vcIn) ? 'freight_invoice_in_slave1' : 'freight_invoice_slave2';
}

async function resolveInvoiceVcIn(pool, invoiceId, explicit) {
  if (explicit != null && explicit !== '') return parseVcInFlag(explicit);
  const id = str(invoiceId);
  if (!id) return false;
  const [[outRow]] = await pool.query(
    `SELECT INVOICEID FROM freight_invoice_master WHERE INVOICEID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);
  if (outRow) return false;
  const [[inRow]] = await pool.query(
    `SELECT INVOICEID FROM freight_invoice_in_master WHERE INVOICEID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);
  return Boolean(inRow);
}

function normalizeInvType(invType) {
  const raw = str(invType);
  if (!raw) return 'Interim';
  if (/^final$/i.test(raw)) return 'Final';
  if (/^interim2$/i.test(raw)) return 'Interim2';
  if (/^provisional$/i.test(raw)) return 'Provisional';
  if (/^interim$/i.test(raw)) return 'Interim';
  return raw;
}

function isInterimType(invType) {
  return /interim/i.test(String(invType || ''));
}

function approvalColsFor(invType) {
  return isInterimType(invType) ? APPROVAL_COLS.interim : APPROVAL_COLS.final;
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
    return Boolean(row.vendorId || row.VENDORID || row.VENDOR || row.port || row.PORT);
  }
  return false;
}

async function getVendorRow(pool, code) {
  if (!code) return null;
  const [[row]] = await pool.query(
    `SELECT CODE, NAME, STREET_1, CITY, COUNTRY, CITY_POSTAL_CODE
     FROM vendor_master
     WHERE CODE = ?
     LIMIT 1`,
    [code],
  ).catch(() => [[null]]);
  return row || null;
}

async function getVendorName(pool, code) {
  const row = await getVendorRow(pool, code);
  return str(row?.NAME);
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
    `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY, PASSAGE_TYPE
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

async function getCargoName(pool, cargoId) {
  if (!cargoId || cargoId === '0') return '';
  const ids = String(cargoId)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '0');
  if (!ids.length) return '';
  const [rows] = await pool.query(
    `SELECT MATERIAL_CODE_DESC AS name FROM cargo_master WHERE MATERIALID IN (?)`,
    [ids],
  ).catch(() => [[]]);
  return (rows || []).map((row) => row.name).filter(Boolean).join(', ');
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

async function getApproverContext(pool, invType, userId) {
  const cols = approvalColsFor(invType);

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
  grossFreight,
  addTotal,
  subTotal,
  adjAddTotal,
  adjSubTotal,
  demTotal = 0,
  daTotal = 0,
  brokerageAmt,
  addComAmt,
  gstOnBrok,
  taxApplicable,
  gstVat,
  sgstPercent,
  cgstPercent,
  igstPercent,
  vatPercent,
}) {
  const netPayable = money2(
    grossFreight
      + addTotal
      + adjAddTotal
      + demTotal
      - subTotal
      - adjSubTotal
      - brokerageAmt
      - addComAmt
      - gstOnBrok
      - daTotal,
  );

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

async function fireFreightAlerts(pool, {
  invoiceId,
  status,
  invType,
  invoiceNo,
  vesselName,
  creatorLoginId,
  approvers,
  userId,
  redirectUrl,
  vcIn = false,
}) {
  await inactiveUserAlerts(pool, 'FREIGHT INVOICE', invoiceId);
  if (!(Number(status) >= 1) || !invoiceId) return;

  const cols = approvalColsFor(invType);
  const title = parseVcInFlag(vcIn)
    ? (isInterimType(invType) ? 'INITIAL VC-IN INVOICE' : 'FINAL VC-IN INVOICE')
    : (isInterimType(invType) ? 'INITIAL FREIGHT INVOICE' : 'FINAL FREIGHT INVOICE');
  const currentUserName = (await getContactPerson(pool, userId)) || 'User';
  const label = `${title} (${vesselName || '-'} - ${invoiceNo || ''})`;

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
      `UPDATE ${invoiceMasterTable(vcIn)} SET SYNC_STATUS = 1 WHERE INVOICEID = ?`,
      [invoiceId],
    ).catch(() => undefined);
    recipients = await getUsersWithAuthority(pool, cols.acc);
    comments = `${currentUserName} Approved ${label}.`;
  }

  for (const to of recipients) {
    await saveUserAlerts(pool, {
      sentBy: userId,
      sentTo: to,
      redirectTo: redirectUrl,
      identify: parseVcInFlag(vcIn) ? 'FREIGHT PAYMENT' : 'FREIGHT INVOICE',
      comments,
      identifyId: invoiceId,
    });
  }
}

async function getLaytimeDemDesAmount(pool, comId, portId, portType, randomId) {
  const [[row]] = await pool.query(
    `SELECT
       SUM(TTL_DEMURRAGE) AS dem,
       SUM(TTL_DEMURRAGE_MANUAL) AS demManual,
       SUM(TTL_DESPATCH) AS des,
       SUM(TTL_DESPATCH_MANUAL) AS desManual
     FROM laytime_master
     WHERE COMID = ?
       AND PORT = ?
       AND PORTID = ?
       AND RANDOMID = ?
       AND SUBMITID = 5
       AND IFNULL(REVERSIBLE, 0) != 1`,
    [comId, portType, portId, randomId || 0],
  ).catch(() => [[null]]);

  if (!row) return 0;
  const demManual = parseAmount(row.demManual);
  const dem = parseAmount(row.dem);
  const desManual = parseAmount(row.desManual);
  const des = parseAmount(row.des);
  const demValue = demManual !== 0 ? demManual : dem;
  if (demValue !== 0) return money2(demValue);
  const desValue = desManual !== 0 ? desManual : des;
  return money2(-Math.abs(desValue));
}

async function hasOtherDemInvoice(pool, comId, portLabel, portKind) {
  const like = `Demurrage/Dispatch Invoice for ${portKind} ${portLabel}`;
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM other_invoice_master
     WHERE COMID = ? AND P_TYPE LIKE ?`,
    [comId, like],
  ).catch(() => [[{ cnt: 0 }]]);
  return Number(row?.cnt) > 0;
}

async function loadClubCharterers(pool, {
  fcaId,
  vendorId,
  slaveId,
  estimateType,
  isCoa,
  draftInvoiceId,
}) {
  const rows = [];
  if (Number(estimateType) === 2) {
    const [clubRows] = await pool.query(
      `SELECT SHIPPER_CHARTER AS vendorId, CARGOID AS cargoId, AMOUNT_USD AS amount, RANDOMID AS randomId
       FROM freight_cost_estimete_slave10
       WHERE FCAID = ?
         AND SHIPPER_CHARTER = ?
         AND IFNULL(CARGOID, '') != ''
         AND (? = '' OR FCA_SLAVE10ID != ?)
       ORDER BY FCA_SLAVE10ID`,
      [fcaId, vendorId, slaveId || '', slaveId || ''],
    ).catch(() => [[]]);
    rows.push(...(clubRows || []));
  } else if (Number(estimateType) === 3 && isCoa) {
    const [clubRows] = await pool.query(
      `SELECT QTY_VENDORID AS vendorId, CARGO AS cargoId, NET_FREIGHT AS amount, RANDOMID AS randomId
       FROM freight_cost_estimete_slave7
       WHERE FCAID = ?
         AND QTY_VENDORID = ?
         AND IFNULL(CARGO, '') != ''
         AND (? = '' OR FCA_SLAVE7ID != ?)
       ORDER BY FCA_SLAVE7ID`,
      [fcaId, vendorId, slaveId || '', slaveId || ''],
    ).catch(() => [[]]);
    rows.push(...(clubRows || []));
  }

  const checkedSet = new Set();
  if (draftInvoiceId) {
    const [checked] = await pool.query(
      `SELECT VENDOR, CARGO, RANDOMID
       FROM freight_invoice_slave1
       WHERE INVOICEID = ?`,
      [draftInvoiceId],
    ).catch(() => [[]]);
    for (const row of checked || []) {
      checkedSet.add(`${str(row.VENDOR)}|${str(row.CARGO)}|${str(row.RANDOMID)}`);
    }
  }

  const out = [];
  let idx = 0;
  for (const row of rows) {
    idx += 1;
    const vId = str(row.vendorId);
    const cId = str(row.cargoId);
    const rId = str(row.randomId || '0');
    const key = `${vId}|${cId}|${rId}`;
    out.push({
      id: String(idx),
      vendorId: vId,
      vendorName: await getVendorName(pool, vId),
      cargoId: cId,
      cargoName: await getCargoName(pool, cId),
      amount: money2(row.amount),
      randomId: rId === '0' ? '' : rId,
      checked: checkedSet.has(key),
    });
  }
  return out;
}

async function loadDemurrageRows(pool, {
  comId,
  fcaId,
  vendorId,
  draftInvoiceId,
  isCoa,
  quantity,
}) {
  const [legs] = await pool.query(
    `SELECT *
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
     ORDER BY FCA_SLAVEID`,
    [fcaId],
  ).catch(() => [[]]);

  let totalQty = 0;
  let dfQty = 0;
  if (isCoa) {
    const [[tot]] = await pool.query(
      `SELECT (SUM(QUANTITY) + SUM(DF_QUANTITY)) AS TOTAL_QTY
       FROM freight_cost_estimete_slave7
       WHERE FCAID = ? AND IFNULL(CARGO, '') != ''`,
      [fcaId],
    ).catch(() => [[{ TOTAL_QTY: 0 }]]);
    totalQty = parseAmount(tot?.TOTAL_QTY);
    const [[df]] = await pool.query(
      `SELECT DF_QUANTITY AS TOTAL_QTY
       FROM freight_cost_estimete_slave7
       WHERE FCAID = ? AND QTY_VENDORID = ? AND IFNULL(CARGO, '') != ''
       LIMIT 1`,
      [fcaId, vendorId],
    ).catch(() => [[{ TOTAL_QTY: 0 }]]);
    dfQty = parseAmount(df?.TOTAL_QTY);
  }

  const checkedMap = new Map();
  if (draftInvoiceId) {
    const [existing] = await pool.query(
      `SELECT PORT, PORTID, RANDOMID, PRORATE
       FROM freight_invoice_slave3
       WHERE INVOICEID = ?`,
      [draftInvoiceId],
    ).catch(() => [[]]);
    for (const row of existing || []) {
      checkedMap.set(
        `${str(row.PORT)}|${str(row.PORTID)}|${str(row.RANDOMID)}`,
        Number(row.PRORATE) === 1,
      );
    }
  }

  const out = [];
  let idx = 0;

  for (const leg of legs || []) {
    const randomId = str(leg.RANDOMID || '0');

    const maybePush = async ({ port, portId, vendorCol, kind }) => {
      if (!portId) return;
      if (port === 'LP') {
        if (leg.IS_SHOW_DDCLP != null && str(leg.DDCLP_VENDOR) && str(leg.DDCLP_VENDOR) !== str(vendorId)) {
          return;
        }
      }
      if (port === 'DP') {
        if (leg.IS_SHOW_DDCDP != null && str(leg.DDCDP_VENDOR) && str(leg.DDCDP_VENDOR) !== str(vendorId)) {
          return;
        }
      }

      const portLabel = await getPortName(pool, portId);
      if (await hasOtherDemInvoice(pool, comId, portLabel, kind)) return;

      let amount = await getLaytimeDemDesAmount(pool, comId, portId, port, randomId);
      const key = `${port}|${str(portId)}|${randomId}`;
      const prorateChecked = checkedMap.has(key) ? checkedMap.get(key) : false;
      if (isCoa && prorateChecked && totalQty > 0) {
        amount = money2((amount * (quantity + dfQty)) / totalQty);
      }

      idx += 1;
      out.push({
        id: String(idx),
        port,
        portId: str(portId),
        portLabel: `${kind} ${portLabel}`.trim(),
        randomId: randomId === '0' ? '' : randomId,
        vendorId: str(leg[vendorCol] || ''),
        amount,
        prorate: prorateChecked,
        checked: checkedMap.has(key),
        showProrate: Boolean(isCoa),
      });
    };

    await maybePush({
      port: 'LP',
      portId: leg.FROM_PORT,
      vendorCol: 'DDCLP_VENDOR',
      kind: 'Load Port',
    });
    await maybePush({
      port: 'DP',
      portId: leg.TO_PORT,
      vendorCol: 'DDCDP_VENDOR',
      kind: 'Discharge Port',
    });
  }

  return out;
}

async function loadDaRows(pool, {
  comId,
  fcaId,
  draftInvoiceId,
}) {
  const [legs] = await pool.query(
    `SELECT *
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
     ORDER BY FCA_SLAVEID`,
    [fcaId],
  ).catch(() => [[]]);

  const checkedSet = new Set();
  if (draftInvoiceId) {
    const [existing] = await pool.query(
      `SELECT PORT, PORTID, RANDOMID
       FROM freight_invoice_slave_da
       WHERE INVOICEID = ?`,
      [draftInvoiceId],
    ).catch(() => [[]]);
    for (const row of existing || []) {
      checkedSet.add(`${str(row.PORT)}|${str(row.PORTID)}|${str(row.RANDOMID)}`);
    }
  }

  const out = [];
  let idx = 0;

  const pushDa = async ({
    cost,
    port,
    portId,
    vendorId,
    randomId,
    name,
    kindLabel,
  }) => {
    if (!(parseAmount(cost) > 0) || !portId) return;
    const [[paid]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM request_master
       WHERE GRADEID = ?
         AND STATUS = 5
         AND NAME = ?
         AND VENDOR = ?
         AND COMID = ?
         AND P_AMT IS NOT NULL`,
      [portId, name, vendorId || '', comId],
    ).catch(() => [[{ cnt: 0 }]]);

    const portLabel = await getPortName(pool, portId);
    const key = `${port}|${str(portId)}|${str(randomId || '0')}`;
    idx += 1;
    out.push({
      id: String(idx),
      port,
      portId: str(portId),
      portLabel: `${kindLabel} ${portLabel}`.trim(),
      randomId: str(randomId || '') === '0' ? '' : str(randomId || ''),
      vendorId: str(vendorId || ''),
      amount: money2(cost),
      checked: checkedSet.has(key),
      disabled: Number(paid?.cnt) > 0,
    });
  };

  for (const leg of legs || []) {
    await pushDa({
      cost: leg.LOAD_PORT_COST,
      port: 'LP',
      portId: leg.FROM_PORT,
      vendorId: leg.PORT_COSTLP_VENDOR,
      randomId: leg.RANDOMID,
      name: 'Load Port Costs',
      kindLabel: 'Load Port',
    });
    await pushDa({
      cost: leg.DISC_PORT_COST,
      port: 'DP',
      portId: leg.TO_PORT,
      vendorId: leg.PORT_COSTDP_VENDOR,
      randomId: leg.RANDOMID,
      name: 'Discharge Port Costs',
      kindLabel: 'Discharge Port',
    });
    await pushDa({
      cost: leg.TRANSIT_PORT_COST,
      port: 'TP',
      portId: leg.FROM_PORT,
      vendorId: leg.PORT_COSTTP_VENDOR,
      randomId: leg.RANDOMID,
      name: 'Transit Port Costs',
      kindLabel: 'Transit Port',
    });
  }

  return out;
}

async function loadSlaveLineRows(pool, invoiceId, vcIn = false) {
  const [rows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID
     FROM ${invoiceLineTable(vcIn)}
     WHERE INVOICEID = ?`,
    [invoiceId],
  ).catch(() => [[]]);
  const addRows = [];
  const subRows = [];
  for (const row of rows || []) {
    const mapped = {
      orcId: str(row.ORC_ID),
      description: str(row.DESCRIPTION),
      amount: String(parseAmount(row.AMOUNT)),
    };
    if (str(row.IDENTIFY).toUpperCase() === 'SUB') subRows.push(mapped);
    else addRows.push(mapped);
  }
  return { addRows, subRows };
}

async function loadAdjRows(pool, invoiceId) {
  const [rows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, FIXTURE_NO, VESSEL
     FROM freight_invoice_adj_slave
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
      amount: String(parseAmount(row.AMOUNT)),
    };
    if (str(row.IDENTIFY).toUpperCase() === 'SUB') adjSubRows.push(mapped);
    else adjAddRows.push(mapped);
  }
  return { adjAddRows, adjSubRows };
}

function mapDraftInvoice(row, lineRows, adjRows, clubCheckedIds, demCheckedIds, daCheckedIds) {
  return {
    invoiceId: String(row.INVOICEID),
    status: Number(row.STATUS) || 0,
    shipOwner: str(row.SHIP_OWNER),
    invoiceNo: str(row.MESSAGE),
    invoiceDate: formatDateDMY(row.DATE),
    dueDate: formatDateDMY(row.DUE_DATE),
    exchangeDate: formatDateDMY(row.EXCHANGE_DATE),
    exchangeRate: str(row.EXCHANGE_RATE || ''),
    exchangeCurrency: str(row.EXCHANGE_CURRENCY || 'USD'),
    paymentTerms: str(row.PAYMENT_TERMS),
    remarks: str(row.REMARKS),
    atten: str(row.ATTEN),
    blDate: formatDateDMY(row.BL_DATE),
    blNo: str(row.BL_NO),
    flag: str(row.FLAG),
    imoNo: str(row.IMO_NO),
    loadPortName: str(row.LOAD_PORT_NAME),
    dischargePortName: str(row.DISCHARGE_PORT_NAME),
    manualVendorName: str(row.MANUAL_VENDOR_NAME),
    freightRate: str(row.FREIGHT_RATE || ''),
    blQuantity: str(row.QUANTITY || ''),
    grossFreight: str(row.GROSS_FREIGHT || ''),
    brokeragePercent: str(row.BROKERAGE_PERCENT || ''),
    gstOnBrokPercent: str(row.GST_ON_BROK_PERC || ''),
    addComPercent: str(row.ADDCOM || ''),
    taxApplicable: str(row.RDOTAXAPPLICABLE || '2'),
    gstVat: str(row.RDOVATGST || '1'),
    sgstPercent: str(row.SGST_PERCENT || ''),
    cgstPercent: str(row.CGST_PERCENT || ''),
    igstPercent: str(row.IGST_PERCENT || ''),
    vatPercent: str(row.VAT_PERCENT || ''),
    paymentStatus: str(row.PAYMENT_STATUS || 'payment_payable'),
    nob: str(row.NOB || ''),
    cBankCheck: Number(row.c_bank_check) === 1 || Number(row.C_BANK_CHECK) === 1,
    percentThereOff: str(row.TO_1 || ''),
    ffiSettlementDays: row.FFI_SET_DAYS != null ? str(row.FFI_SET_DAYS) : '',
    agreedLocal: str(row.AGREED_GROSS_FREIGHT_LOCAL || ''),
    upload: str(row.UPLOAD || ''),
    uploadName: str(row.UPLOAD_NAME || ''),
    selApprovers: parseApprovers(row.APPROVERS),
    addRows: lineRows.addRows,
    subRows: lineRows.subRows,
    adjAddRows: adjRows.adjAddRows,
    adjSubRows: adjRows.adjSubRows,
    clubCheckedIds,
    demCheckedIds,
    daCheckedIds,
  };
}

async function loadExistingInvoices(pool, {
  comId,
  vendorId,
  pType,
  cargoId,
  randomId,
  voyageNo,
  vesselName,
  mgmt,
  vcIn = false,
}) {
  const inMode = parseVcInFlag(vcIn);
  const [rows] = await pool.query(
    inMode
      ? `SELECT m.*,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = m.L_UPDATED_BY) AS LUPNAME,
            vm.NAME AS VENDOR_NAME
         FROM ${invoiceMasterTable(true)} m
         LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
         WHERE m.COMID = ?
           AND m.MODULEID = ?
           AND m.MCOMPANYID = ?
           AND m.VENDOR = ?
           AND m.STATUS >= 5
         ORDER BY m.INVOICEID DESC`
      : `SELECT m.*,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = m.L_UPDATED_BY) AS LUPNAME,
            vm.NAME AS VENDOR_NAME
         FROM ${invoiceMasterTable(false)} m
         LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
         WHERE m.COMID = ?
           AND m.MODULEID = ?
           AND m.MCOMPANYID = ?
           AND m.VENDOR = ?
           AND m.P_TYPE = ?
           AND m.CARGOID = ?
           AND m.RANDOMID = ?
           AND m.STATUS >= 5
         ORDER BY m.INVOICEID DESC`,
    inMode
      ? [comId, MODULE_ID, COMPANY_ID, vendorId]
      : [comId, MODULE_ID, COMPANY_ID, vendorId, pType, cargoId || '0', randomId || '0'],
  ).catch(() => [[]]);

  return (rows || []).map((row) => {
    const status = Number(row.STATUS) || 0;
    const paid = parseAmount(row.P_AMT);
    return {
      invoiceId: String(row.INVOICEID),
      voyageNo: voyageNo || '',
      vesselName: vesselName || '',
      invoiceType: str(row.I_TYPE),
      invoiceNo: str(row.MESSAGE),
      chartererName: str(row.VENDOR_NAME || row.VENDOR),
      amount: money2(row.NET_PAYABLE_TAX || row.NET_PAYABLE || row.NET_AMOUNT),
      remarks: str(row.REMARKS),
      status,
      lastUpdatedBy: str(row.LUPNAME),
      lastUpdatedAt: row.L_UP_TIME ? formatDateDMY(row.L_UP_TIME) : '',
      canReceivePayment: status === 5 && paid <= 0,
      canCancel: mgmt && status === 5,
      canReopen: mgmt && status >= 5 && status !== 8,
      canDelete: mgmt,
      canPdf: true,
      canPdfAed: str(row.SHIP_OWNER) === 'OB0002',
    };
  });
}

async function findDraftInvoice(pool, {
  invoiceId,
  comId,
  vendorId,
  pType,
  cargoId,
  randomId,
  invType,
  vcIn = false,
}) {
  const master = invoiceMasterTable(vcIn);
  if (invoiceId) {
    const [[row]] = await pool.query(
      `SELECT * FROM ${master} WHERE INVOICEID = ? LIMIT 1`,
      [invoiceId],
    ).catch(() => [[null]]);
    return row || null;
  }

  if (parseVcInFlag(vcIn)) {
    const [[row]] = await pool.query(
      `SELECT * FROM ${master}
       WHERE COMID = ?
         AND MODULEID = ?
         AND MCOMPANYID = ?
         AND VENDOR = ?
         AND STATUS < 5
       ORDER BY INVOICEID DESC
       LIMIT 1`,
      [comId, MODULE_ID, COMPANY_ID, vendorId],
    ).catch(() => [[null]]);
    return row || null;
  }

  const typeClause = isInterimType(invType)
    ? `(I_TYPE = ? OR I_TYPE = 'Interim2')`
    : `(I_TYPE = ? OR I_TYPE = 'Provisional')`;

  const [[row]] = await pool.query(
    `SELECT * FROM ${master}
     WHERE COMID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
       AND VENDOR = ?
       AND P_TYPE = ?
       AND CARGOID = ?
       AND RANDOMID = ?
       AND ${typeClause}
       AND STATUS < 5
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, vendorId, pType, cargoId || '0', randomId || '0', invType],
  ).catch(() => [[null]]);
  return row || null;
}

/**
 * PHP invoice.php form context for Initial/Final freight invoice.
 */
export async function dbGetFreightInvoiceForm({
  comId,
  id,
  name,
  invType,
  voyageNo = '',
  vcIn = false,
  userId = appContext.userId,
  mgmtUser = isMgmtUser(),
} = {}) {
  const pool = getPool();
  const inMode = parseVcInFlag(vcIn);
  const parsed = parseInvoiceIdCsv(id);
  const resolvedComId = str(comId || parsed.comId);
  if (!resolvedComId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const invoiceType = normalizeInvType(invType);
  const pType = str(name) || (inMode ? 'VC In Payment' : 'Final Nett Freight');

  const [[compare]] = await pool.query(
    `SELECT c.*, m.VOYAGE_NO AS MASTER_VOYAGE_NO, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID,
            m.TRANS_DATE, m.QUANTITY AS MASTER_QTY, m.FREIGHT_GROSS, m.BL_QTY_FREIGHT,
            m.CARGO_RATE, m.ESTIMATE_TYPE, m.COAID, m.QTY_TYPE_RADIO,
            vim.VESSEL_NAME, vim.IMO_NO, vim.FLAG
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [resolvedComId, MODULE_ID],
  );

  if (!compare?.COMID) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
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

  const vendorId = parsed.vendorId || str(compare.FGFF_VENDORID || master?.FGFF_VENDORID || master?.LUMP_VENDOR);
  const vendor = await getVendorRow(pool, vendorId);
  const ports = await getPortNames(pool, fcaId);
  const cargoId = parsed.cargoId && parsed.cargoId !== '0'
    ? parsed.cargoId
    : str(master?.CARGOID || '0');
  const cargoName = await getCargoName(pool, cargoId);
  const randomId = parsed.randomId === '0' ? '' : parsed.randomId;
  const slaveId = parsed.slaveId === '0' ? '' : parsed.slaveId;

  const [[flagCountry]] = await pool.query(
    `SELECT COUNTRY_NAME FROM country_master WHERE COUNTRYID = ? LIMIT 1`,
    [compare.FLAG],
  ).catch(() => [[null]]);

  const quantity = parsed.quantity
    || Number(master?.BL_QTY_FREIGHT)
    || Number(master?.QUANTITY)
    || Number(master?.TANK_QUANTITY)
    || 0;
  const freightRate = parseAmount(parsed.agreedLocal)
    || parseAmount(master?.FREIGHT_GROSS)
    || parseAmount(master?.CARGO_RATE)
    || 0;
  const grossFreight = parsed.amount
    || parseAmount(compare.TOTAL_PREIGHT_ADJ)
    || parseAmount(master?.LUMPSUMAMT)
    || 0;

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

  const { fixtures, vessels } = await getFixtureOptions(pool);
  const approval = await getApproverContext(pool, invoiceType, userId);

  const voyage = str(voyageNo)
    || str(compare.MASTER_VOYAGE_NO)
    || str(master?.VOYAGE_NO)
    || str(compare.MESSAGE);

  const vesselName = str(compare.VESSEL_NAME);
  const estimateType = Number(master?.ESTIMATE_TYPE || compare.ESTIMATE_TYPE || 0);
  const isCoa = Boolean(
    master?.COAID
    || compare.COAID
    || compare.COAAID
    || Number(master?.QTY_TYPE_RADIO) === 2
    || Number(compare.QTY_TYPE_RADIO) === 2,
  );

  const draft = await findDraftInvoice(pool, {
    comId: resolvedComId,
    vendorId,
    pType,
    cargoId: cargoId || '0',
    randomId: randomId || '0',
    invType: invoiceType,
    vcIn: inMode,
  });

  const draftId = draft?.INVOICEID || null;
  const clubCharterers = await loadClubCharterers(pool, {
    fcaId,
    vendorId,
    slaveId,
    estimateType,
    isCoa,
    draftInvoiceId: draftId,
  });
  const demurrageRows = await loadDemurrageRows(pool, {
    comId: resolvedComId,
    fcaId,
    vendorId,
    draftInvoiceId: draftId,
    isCoa,
    quantity,
  });
  const daRows = await loadDaRows(pool, {
    comId: resolvedComId,
    fcaId,
    draftInvoiceId: draftId,
  });

  let currentInvoice = null;
  if (draft) {
    const lineRows = await loadSlaveLineRows(pool, draft.INVOICEID, inMode);
    const adjRows = await loadAdjRows(pool, draft.INVOICEID);
    currentInvoice = mapDraftInvoice(
      draft,
      lineRows,
      adjRows,
      clubCharterers.filter((r) => r.checked).map((r) => r.id),
      demurrageRows.filter((r) => r.checked).map((r) => r.id),
      daRows.filter((r) => r.checked).map((r) => r.id),
    );
  }

  const existingInvoices = await loadExistingInvoices(pool, {
    comId: resolvedComId,
    vendorId,
    pType,
    cargoId: cargoId || '0',
    randomId: randomId || '0',
    voyageNo: voyage,
    vesselName,
    mgmt: Boolean(mgmtUser),
    vcIn: inMode,
  });

  const defaults = {
    shipOwner: currentInvoice?.shipOwner || '',
    manualVendorName: currentInvoice?.manualVendorName || vendorAddressParts.join(' '),
    loadPortName: currentInvoice?.loadPortName || ports.loadPorts,
    dischargePortName: currentInvoice?.dischargePortName || ports.dischargePorts,
    blDate: currentInvoice?.blDate || '',
    blNo: currentInvoice?.blNo || '',
    flag: currentInvoice?.flag || str(flagCountry?.COUNTRY_NAME || ''),
    imoNo: currentInvoice?.imoNo || str(compare.IMO_NO || ''),
    blQuantity: currentInvoice?.blQuantity || (quantity ? String(quantity) : ''),
    freightRate: currentInvoice?.freightRate || (freightRate ? String(freightRate) : ''),
    invoiceType,
    atten: currentInvoice?.atten || '',
    invoiceNo: currentInvoice?.invoiceNo || '',
    invoiceDate: currentInvoice?.invoiceDate || '',
    dueDate: currentInvoice?.dueDate || '',
    exchangeCurrency: currentInvoice?.exchangeCurrency || 'USD',
    exchangeRate: currentInvoice?.exchangeRate || str(parsed.exchangeRate || master?.EXCHANGE_RATE || '1'),
    exchangeDate: currentInvoice?.exchangeDate || '',
    paymentTerms: currentInvoice?.paymentTerms || '',
    remarks: currentInvoice?.remarks || '',
    grossFreight: currentInvoice?.grossFreight || (grossFreight ? String(grossFreight) : ''),
    brokeragePercent: currentInvoice?.brokeragePercent || str(compare.BROKERAGE_PER || '0'),
    gstOnBrokPercent: currentInvoice?.gstOnBrokPercent || '0',
    addComPercent: currentInvoice?.addComPercent || '0',
    taxApplicable: currentInvoice?.taxApplicable || '2',
    gstVat: currentInvoice?.gstVat || '1',
    sgstPercent: currentInvoice?.sgstPercent || '',
    cgstPercent: currentInvoice?.cgstPercent || '',
    igstPercent: currentInvoice?.igstPercent || '',
    vatPercent: currentInvoice?.vatPercent || '',
    paymentStatus: currentInvoice?.paymentStatus || 'payment_payable',
    nob: currentInvoice?.nob || '',
    cBankCheck: currentInvoice?.cBankCheck || false,
    percentThereOff: currentInvoice?.percentThereOff || '',
    ffiSettlementDays: currentInvoice?.ffiSettlementDays || '',
    agreedLocal: currentInvoice?.agreedLocal || str(parsed.agreedLocal || ''),
    selApprovers: currentInvoice?.selApprovers || [],
  };

  return {
    comId: resolvedComId,
    fcaId: String(fcaId || ''),
    invoiceIdCsv: id || '',
    invType: invoiceType,
    pType,
    page: '1',
    voyageNo: voyage,
    vesselName,
    vesselImoId: str(compare.MASTER_VESSEL_IMO_ID || master?.VESSEL_IMO_ID),
    cpDate: formatDateDMY(compare.TRANS_DATE || master?.TRANS_DATE),
    cargoId: cargoId === '0' ? '' : cargoId,
    cargoName,
    randomId,
    slaveId,
    vendorId,
    vendorName: str(vendor?.NAME),
    vendorAddress: vendorAddressParts.join(', '),
    loadPorts: ports.loadPorts,
    dischargePorts: ports.dischargePorts,
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
    clubCharterers,
    demurrageRows,
    daRows,
    existingInvoices,
    vcIn: inMode,
    currentInvoice,
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

function parseClubRows(rows) {
  return parseJsonArray(rows)
    .filter((row) => truthyChecked(row) || row.vendorId || row.VENDOR)
    .map((row) => ({
      vendorId: str(row.vendorId || row.VENDOR || row.hddnVendorid || ''),
      cargoId: str(row.cargoId || row.CARGO || row.hddncargoid || '0') || '0',
      randomId: str(row.randomId || row.RANDOMID || row.hddnrandomid || '0') || '0',
      amount: parseAmount(row.amount),
      checked: truthyChecked(row) || true,
    }))
    .filter((row) => row.vendorId && row.checked);
}

function parseDemRows(rows) {
  return parseJsonArray(rows)
    .filter((row) => truthyChecked(row) || row.port || row.PORT)
    .map((row) => ({
      port: str(row.port || row.PORT || ''),
      portId: str(row.portId || row.PORTID || ''),
      randomId: str(row.randomId || row.RANDOMID || '0') || '0',
      vendorId: str(row.vendorId || row.VENDORID || ''),
      amount: parseAmount(row.amount || row.DEM_AMT),
      prorate: row.prorate === true || row.prorate === 1 || row.prorate === '1' ? 1 : 0,
      checked: truthyChecked(row) || true,
    }))
    .filter((row) => row.port && row.portId && row.checked);
}

function parseDaSaveRows(rows) {
  return parseJsonArray(rows)
    .filter((row) => truthyChecked(row) || row.port || row.PORT)
    .map((row) => ({
      port: str(row.port || row.PORT || ''),
      portId: str(row.portId || row.PORTID || ''),
      randomId: str(row.randomId || row.RANDOMID || '0') || '0',
      vendorId: str(row.vendorId || row.VENDORID || ''),
      amount: parseAmount(row.amount || row.P_AMT),
      checked: truthyChecked(row) || true,
      disabled: Boolean(row.disabled),
    }))
    .filter((row) => row.port && row.portId && row.checked && !row.disabled);
}

async function deleteInvoiceSlaves(conn, invoiceId, vcIn = false) {
  await conn.query(`DELETE FROM ${invoiceLineTable(vcIn)} WHERE INVOICEID = ?`, [invoiceId]);
  if (parseVcInFlag(vcIn)) return;
  await conn.query(`DELETE FROM freight_invoice_slave1 WHERE INVOICEID = ?`, [invoiceId]);
  await conn.query(`DELETE FROM freight_invoice_slave3 WHERE INVOICEID = ?`, [invoiceId]);
  await conn.query(`DELETE FROM freight_invoice_adj_slave WHERE INVOICEID = ?`, [invoiceId]);
  await conn.query(
    `DELETE FROM freight_invoice_slave_da WHERE INVOICEID = ?`,
    [invoiceId],
  ).catch(() => undefined);
}

async function insertInvoiceSlaves(conn, invoiceId, {
  addRows,
  subRows,
  adjAddRows,
  adjSubRows,
  clubRows,
  demRows,
  daRows,
  vcIn = false,
}) {
  const lineTable = invoiceLineTable(vcIn);
  for (const row of addRows) {
    await conn.query(
      `INSERT INTO ${lineTable} (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID)
       VALUES (?, ?, ?, 'ADD', ?)`,
      [invoiceId, row.description, row.amount, row.orcId || null],
    ).catch(async () => {
      await conn.query(
        `INSERT INTO ${lineTable} (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY)
         VALUES (?, ?, ?, 'ADD')`,
        [invoiceId, row.description, row.amount],
      );
    });
  }
  for (const row of subRows) {
    await conn.query(
      `INSERT INTO ${lineTable} (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID)
       VALUES (?, ?, ?, 'SUB', ?)`,
      [invoiceId, row.description, row.amount, row.orcId || null],
    ).catch(async () => {
      await conn.query(
        `INSERT INTO ${lineTable} (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY)
         VALUES (?, ?, ?, 'SUB')`,
        [invoiceId, row.description, row.amount],
      );
    });
  }
  if (parseVcInFlag(vcIn)) return;
  for (const row of adjAddRows) {
    await conn.query(
      `INSERT INTO freight_invoice_adj_slave
         (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, FIXTURE_NO, VESSEL)
       VALUES (?, ?, ?, 'ADD', ?, ?, ?)`,
      [invoiceId, row.description, row.amount, row.orcId || null, row.fixtureNo || null, row.vessel || null],
    );
  }
  for (const row of adjSubRows) {
    await conn.query(
      `INSERT INTO freight_invoice_adj_slave
         (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY, ORC_ID, FIXTURE_NO, VESSEL)
       VALUES (?, ?, ?, 'SUB', ?, ?, ?)`,
      [invoiceId, row.description, row.amount, row.orcId || null, row.fixtureNo || null, row.vessel || null],
    );
  }
  for (const row of clubRows) {
    await conn.query(
      `INSERT INTO freight_invoice_slave1 (INVOICEID, VENDOR, CARGO, RANDOMID)
       VALUES (?, ?, ?, ?)`,
      [invoiceId, row.vendorId, row.cargoId, row.randomId],
    );
  }
  for (const row of demRows) {
    await conn.query(
      `INSERT INTO freight_invoice_slave3
         (INVOICEID, VENDORID, DEM_AMT, RANDOMID, PORT, PORTID, PRORATE)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, row.vendorId, row.amount, row.randomId, row.port, row.portId, row.prorate],
    ).catch(async () => {
      await conn.query(
        `INSERT INTO freight_invoice_slave3
           (INVOICEID, VENDORID, DEM_AMT, RANDOMID, PORT, PORTID)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, row.vendorId, row.amount, row.randomId, row.port, row.portId],
      );
    });
  }
  for (const row of daRows) {
    await conn.query(
      `INSERT INTO freight_invoice_slave_da
         (INVOICEID, VENDORID, P_AMT, RANDOMID, PORT, PORTID)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoiceId, row.vendorId, row.amount, row.randomId, row.port, row.portId],
    ).catch(() => undefined);
  }
}

/**
 * Upsert freight invoice (draft / approval continuum) — PHP insertFreightInvoiceDetails.
 */
export async function dbSaveFreightInvoice(payload = {}, { userId = appContext.userId } = {}) {
  const pool = getPool();
  const parsed = parseInvoiceIdCsv(payload.id || payload.invoiceIdCsv);
  const vcIn = parseVcInFlag(payload.vcIn || payload.vc_in);
  const masterTable = invoiceMasterTable(vcIn);
  const comId = str(payload.comId || parsed.comId);
  const fcaId = str(payload.fcaId || parsed.fcaId);
  const vendorId = str(payload.vendorId || parsed.vendorId);
  const invType = normalizeInvType(payload.invType || payload.iType || payload.selIType || 'Interim');
  const pType = str(payload.pType || payload.name) || (vcIn ? 'VC In Payment' : 'Final Nett Freight');

  if (!comId) throw Object.assign(new Error('COMID is required.'), { status: 400 });
  if (!vendorId) throw Object.assign(new Error('Vendor is required.'), { status: 400 });
  if (!fcaId) throw Object.assign(new Error('Cost sheet (FCAID) is required.'), { status: 400 });

  const shipOwner = str(payload.shipOwner || payload.selFromOwner);
  const invoiceNo = str(payload.invoiceNo || payload.txtDNote);
  const invoiceDate = parseDmyToSqlDate(payload.invoiceDate || payload.txtDate);
  const dueDate = parseDmyToSqlDate(payload.dueDate || payload.txtDueDate);
  const exchangeDate = parseDmyToSqlDate(payload.exchangeDate || payload.txtExchangeDate);
  const blDate = parseDmyToSqlDate(payload.blDate || payload.txtBLDate);
  const grossFreight = parseAmount(payload.grossFreight || payload.txtGrossFreight || payload.txtFreightAmt);
  const quantity = parseAmount(payload.blQuantity || payload.quantity || payload.txtQty || parsed.quantity);
  const freightRate = parseAmount(payload.freightRate || payload.txtFrieghtRate || parsed.agreedLocal);
  const brokeragePercent = parseAmount(payload.brokeragePercent || payload.txtBrokerage);
  const brokerageAmt = money2(
    payload.brokerageAmt != null && payload.brokerageAmt !== ''
      ? parseAmount(payload.brokerageAmt || payload.txtBrokerageAmt)
      : (grossFreight * brokeragePercent) / 100,
  );
  const addComPercent = parseAmount(payload.addComPercent || payload.txtAddComm);
  const addComAmt = money2(
    payload.addComAmt != null && payload.addComAmt !== ''
      ? parseAmount(payload.addComAmt || payload.txtAddCommAmt)
      : (grossFreight * addComPercent) / 100,
  );
  const gstOnBrokPercent = parseAmount(payload.gstOnBrokPercent || payload.gst_on_brokage_perc);
  const gstOnBrok = money2(
    payload.gstOnBrok != null && payload.gstOnBrok !== ''
      ? parseAmount(payload.gstOnBrok || payload.gst_on_brokage)
      : (brokerageAmt * gstOnBrokPercent) / 100,
  );

  const addRows = parseLineRows(payload.addRows);
  const subRows = parseLineRows(payload.subRows);
  const adjAddRows = parseAdjRows(payload.adjAddRows);
  const adjSubRows = parseAdjRows(payload.adjSubRows);
  const clubRows = parseClubRows(payload.clubCharterers);
  const demRows = parseDemRows(payload.demurrageRows);
  const daRows = parseDaSaveRows(payload.daRows);

  const addTotal = addRows.reduce((sum, row) => sum + row.amount, 0);
  const subTotal = subRows.reduce((sum, row) => sum + row.amount, 0);
  const adjAddTotal = adjAddRows.reduce((sum, row) => sum + row.amount, 0);
  const adjSubTotal = adjSubRows.reduce((sum, row) => sum + row.amount, 0);
  const demTotal = demRows.reduce((sum, row) => sum + row.amount, 0);
  const daTotal = daRows.reduce((sum, row) => sum + row.amount, 0);

  const taxApplicable = Number(payload.taxApplicable || payload.rdoTaxApplicable || 2) || 2;
  const gstVat = Number(payload.gstVat || payload.rdoGSTVAT || 1) || 1;
  const sgstPercent = parseAmount(payload.sgstPercent || payload.txtSGST);
  const cgstPercent = parseAmount(payload.cgstPercent || payload.txtCGST);
  const igstPercent = parseAmount(payload.igstPercent || payload.txtIGST);
  const vatPercent = parseAmount(payload.vatPercent || payload.txtVAT);

  const computed = computePayable({
    grossFreight,
    addTotal,
    subTotal,
    adjAddTotal,
    adjSubTotal,
    demTotal,
    daTotal,
    brokerageAmt,
    addComAmt,
    gstOnBrok,
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

  const percentThereOff = parseAmount(payload.percentThereOff || payload.txtTO || payload.to_1);
  const finalFreight = payload.finalFreight != null && payload.finalFreight !== ''
    ? money2(payload.finalFreight || payload.txtNetFreight)
    : netPayable;
  const netAmount = payload.netAmount != null && payload.netAmount !== ''
    ? money2(payload.netAmount || payload.txtNet)
    : netPayable;

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

  const cargoId = str(payload.cargoId || parsed.cargoId || '0') || '0';
  const randomId = str(payload.randomId || parsed.randomId || '0') || '0';
  const paymentStatus = str(payload.paymentStatus || payload.payment_status || 'payment_payable')
    || 'payment_payable';
  const nob = str(payload.nob || payload.selNOB);
  const cBankCheck = payload.cBankCheck === true || payload.cBankCheck === 1 || payload.cBankCheck === '1'
    || payload.c_bank_check === true || payload.c_bank_check === 1 || payload.c_bank_check === '1'
    ? 1
    : 0;
  const upload = str(payload.upload || payload.UPLOAD || payload.attachment || '');
  const uploadName = str(payload.uploadName || payload.UPLOAD_NAME || payload.attachmentName || '');
  const setProRate = payload.prorate === true || payload.prorate === 1 || payload.setProRate === 1 ? 1 : 0;

  const existing = await findDraftInvoice(pool, {
    invoiceId: str(payload.invoiceId || payload.txtInvoiceid),
    comId,
    vendorId,
    pType,
    cargoId,
    randomId,
    invType,
    vcIn,
  });

  // Also try PHP MESSAGE=txtDNote1 dedupe when draft key provided
  let existingRow = existing;
  if (!existingRow) {
    const draftKey = str(payload.draftInvoiceNo || payload.txtDNote1);
    if (draftKey) {
      const [[byMsg]] = await pool.query(
        `SELECT * FROM ${masterTable}
         WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
           AND VENDOR = ? AND MESSAGE = ?
         LIMIT 1`,
          [comId, MODULE_ID, COMPANY_ID, vendorId, draftKey],
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
        `INSERT INTO ${masterTable} (
           COMID, MODULEID, MCOMPANYID, DATE, I_TYPE, P_TYPE, NOB, STATUS,
           MESSAGE, VENDOR, GROSS_FREIGHT, BROKERAGE, CPDATE, FCAID,
           FINAL_FREIGHT, TO_1, NET_AMOUNT, REMARKS, QUANTITY, BROKERAGE_PERCENT,
           AGREED_GROSS_FREIGHT_LOCAL, EXCHANGE_RATE, PAYMENT_TERMS,
           ADDCOM, ADDCOM_AMOUNT, NET_PAYABLE, ATTEN, DUE_DATE, EXCHANGE_DATE,
           EXCHANGE_CURRENCY, SHIP_OWNER, CARGOID, RANDOMID,
           RDOTAXAPPLICABLE, RDOVATGST,
           SGST_PERCENT, CGST_PERCENT, IGST_PERCENT, VAT_PERCENT,
           NET_PAYABLE_TAX,
           SGST_PERCENT_AMOUNT, CGST_PERCENT_AMOUNT, IGST_PERCENT_AMOUNT, VAT_PERCENT_AMOUNT,
           APPROVERS, CREATOR, UPLOAD, UPLOAD_NAME,
           BL_DATE, BL_NO, FLAG, IMO_NO, LOAD_PORT_NAME, DISCHARGE_PORT_NAME,
           MANUAL_VENDOR_NAME, FREIGHT_RATE, c_bank_check, PAYMENT_STATUS,
           GST_ON_BROK_PERC, GST_ON_BROK, PRORATE, SYNC_STATUS,
           L_UPDATED_BY, L_UP_TIME
         ) VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?,
           ?, ?, ?, ?,
           ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, NOW()
         )`,
        [
          comId,
          MODULE_ID,
          COMPANY_ID,
          invoiceDate,
          invType,
          pType,
          nob || null,
          status,
          invoiceNo,
          vendorId,
          grossFreight,
          brokerageAmt,
          parseDmyToSqlDate(payload.cpDate) || '1970-01-01',
          fcaId,
          finalFreight,
          percentThereOff,
          netAmount,
          str(payload.remarks || payload.description || payload.txtDesc),
          quantity,
          brokeragePercent,
          parseAmount(payload.agreedLocal || payload.txtFreightAmtLocal || parsed.agreedLocal),
          parseAmount(payload.exchangeRate || payload.txtExchangeRate || parsed.exchangeRate),
          str(payload.paymentTerms || payload.txtPaymentTerms),
          addComPercent,
          addComAmt,
          netPayable,
          str(payload.atten || payload.txtAttenName),
          dueDate || '1970-01-01',
          exchangeDate || '1970-01-01',
          str(payload.exchangeCurrency || payload.selExchangeCurrency || 'USD') || 'USD',
          shipOwner,
          cargoId,
          randomId,
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
          blDate || '1970-01-01',
          str(payload.blNo || payload.txtBLNo),
          str(payload.flag || payload.txtFlag),
          str(payload.imoNo || payload.txtIMONo),
          str(payload.loadPortName || payload.txtLoadPortName),
          str(payload.dischargePortName || payload.txtDischargePortName),
          str(payload.manualVendorName || payload.txtManualVendorName),
          freightRate,
          cBankCheck,
          paymentStatus,
          gstOnBrokPercent,
          gstOnBrok,
          setProRate,
          status === 5 ? 1 : 0,
          userId,
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
        `UPDATE ${masterTable} SET
           DATE = ?, I_TYPE = ?, NOB = ?, STATUS = ?, MESSAGE = ?,
           GROSS_FREIGHT = ?, BROKERAGE = ?, CPDATE = ?, FCAID = ?,
           FINAL_FREIGHT = ?, TO_1 = ?, NET_AMOUNT = ?, REMARKS = ?,
           PAYMENT_TERMS = ?, QUANTITY = ?, BROKERAGE_PERCENT = ?,
           EXCHANGE_CURRENCY = ?, AGREED_GROSS_FREIGHT_LOCAL = ?, EXCHANGE_RATE = ?,
           ADDCOM = ?, ADDCOM_AMOUNT = ?, NET_PAYABLE = ?, P_TYPE = ?, ATTEN = ?,
           DUE_DATE = ?, EXCHANGE_DATE = ?, SHIP_OWNER = ?, CARGOID = ?, RANDOMID = ?,
           RDOTAXAPPLICABLE = ?, RDOVATGST = ?,
           SGST_PERCENT = ?, CGST_PERCENT = ?, IGST_PERCENT = ?, VAT_PERCENT = ?,
           NET_PAYABLE_TAX = ?,
           SGST_PERCENT_AMOUNT = ?, CGST_PERCENT_AMOUNT = ?, IGST_PERCENT_AMOUNT = ?, VAT_PERCENT_AMOUNT = ?,
           APPROVERS = ?, UPLOAD = ?, UPLOAD_NAME = ?,
           BL_DATE = ?, BL_NO = ?, FLAG = ?, IMO_NO = ?,
           LOAD_PORT_NAME = ?, DISCHARGE_PORT_NAME = ?, MANUAL_VENDOR_NAME = ?, FREIGHT_RATE = ?,
           c_bank_check = ?, GST_ON_BROK_PERC = ?, GST_ON_BROK = ?, PRORATE = ?,
           PAYMENT_STATUS = ?, SYNC_STATUS = ?,
           L_UPDATED_BY = ?, L_UP_TIME = NOW()
         WHERE INVOICEID = ?`,
        [
          invoiceDate,
          invType,
          nob || null,
          status,
          invoiceNo,
          grossFreight,
          brokerageAmt,
          parseDmyToSqlDate(payload.cpDate) || existingRow.CPDATE || '1970-01-01',
          fcaId || existingRow.FCAID,
          finalFreight,
          percentThereOff,
          netAmount,
          str(payload.remarks || payload.description || payload.txtDesc),
          str(payload.paymentTerms || payload.txtPaymentTerms),
          quantity,
          brokeragePercent,
          str(payload.exchangeCurrency || payload.selExchangeCurrency || 'USD') || 'USD',
          parseAmount(payload.agreedLocal || payload.txtFreightAmtLocal || parsed.agreedLocal),
          parseAmount(payload.exchangeRate || payload.txtExchangeRate || parsed.exchangeRate),
          addComPercent,
          addComAmt,
          netPayable,
          pType,
          str(payload.atten || payload.txtAttenName),
          dueDate || '1970-01-01',
          exchangeDate || '1970-01-01',
          shipOwner,
          cargoId,
          randomId,
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
          blDate || '1970-01-01',
          str(payload.blNo || payload.txtBLNo),
          str(payload.flag || payload.txtFlag),
          str(payload.imoNo || payload.txtIMONo),
          str(payload.loadPortName || payload.txtLoadPortName),
          str(payload.dischargePortName || payload.txtDischargePortName),
          str(payload.manualVendorName || payload.txtManualVendorName),
          freightRate,
          cBankCheck,
          gstOnBrokPercent,
          gstOnBrok,
          setProRate,
          paymentStatus,
          status === 5 ? 1 : 0,
          userId,
          invoiceId,
        ],
      );

      await deleteInvoiceSlaves(connection, invoiceId, vcIn);
    }

    await insertInvoiceSlaves(connection, invoiceId, {
      addRows,
      subRows,
      adjAddRows,
      adjSubRows,
      clubRows,
      demRows,
      daRows,
      vcIn,
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

    const redirectUrl = `./invoice.php?id=${encodeURIComponent(payload.id || payload.invoiceIdCsv || '')}&page=${encodeURIComponent(payload.page || '1')}&name=${encodeURIComponent(pType)}&invtype=${encodeURIComponent(invType)}`;

    await fireFreightAlerts(pool, {
      invoiceId,
      status,
      invType,
      invoiceNo,
      vesselName: str(vesselRow?.VESSEL_NAME),
      creatorLoginId,
      approvers,
      userId,
      redirectUrl,
      vcIn,
    });

    return {
      msg: 0,
      invoiceId,
      comId,
      invType,
      pType,
      status,
      netPayable,
      netPayableTax,
      vcIn,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** @deprecated use dbSaveFreightInvoice */
export async function dbCreateFreightInvoice(payload = {}, options = {}) {
  return dbSaveFreightInvoice(payload, options);
}

export async function dbReceiveFreightPayment(
  invoiceId,
  {
    amount,
    paymentDate,
    remarks = '',
    paymentRows,
    upload = '',
    uploadName = '',
  } = {},
  userId = appContext.userId,
) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });
  const vcIn = await resolveInvoiceVcIn(pool, id);
  const masterTable = invoiceMasterTable(vcIn);
  const paymentTable = invoicePaymentTable(vcIn);

  const rows = parseJsonArray(paymentRows);
  let total = parseAmount(amount);
  const slaveRows = [];

  if (rows.length) {
    for (const row of rows) {
      const recvDate = parseDmyToSqlDate(row.date || row.paymentDate || row.RECVdDate || row.RECVd_date);
      const recvAmt = parseAmount(row.amount || row.recvdAmount || row.RECVd_amount);
      if (!recvDate || !(recvAmt > 0)) continue;
      slaveRows.push({
        date: recvDate,
        remarks: str(row.remarks || row.recvdRemarks || ''),
        amount: recvAmt,
      });
    }
    if (slaveRows.length) {
      total = money2(slaveRows.reduce((sum, row) => sum + row.amount, 0));
    }
  }

  if (!(total > 0)) {
    throw Object.assign(new Error('Payment amount is required.'), { status: 400 });
  }

  let sqlDate = parseDmyToSqlDate(paymentDate);
  if (!sqlDate && slaveRows[0]) sqlDate = slaveRows[0].date;
  if (!sqlDate) {
    throw Object.assign(new Error('Payment date is required.'), { status: 400 });
  }

  if (!slaveRows.length) {
    slaveRows.push({ date: sqlDate, remarks: str(remarks), amount: total });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE ${masterTable}
       SET P_AMT = ?, P_DATE = ?, P_REMARKS = ?,
           ATTACHMENTS = ?, ATTACHMENTS_NAME = ?, ACC_USER = ?
       WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS <> 8`,
      [
        total,
        sqlDate,
        str(remarks),
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

    await connection.query(`DELETE FROM ${paymentTable} WHERE INVOICEID = ?`, [id]);
    for (const row of slaveRows) {
      await connection.query(
        `INSERT INTO ${paymentTable} (INVOICEID, RECVD_DATE, RECVD_REMARKS, RECVD_AMOUNT)
         VALUES (?, ?, ?, ?)`,
        [id, row.date, row.remarks, row.amount],
      );
    }

    await inactiveUserAlerts(connection, vcIn ? 'FREIGHT PAYMENT' : 'FREIGHT INVOICE', id);
    await connection.commit();
    return { msg: 2, invoiceId: id, amount: total };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbCancelFreightInvoice(invoiceId, userId = appContext.userId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      `SELECT * FROM freight_invoice_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) {
      throw Object.assign(new Error('Invoice not found.'), { status: 404 });
    }
    if (Number(row.STATUS) === 8) {
      throw Object.assign(new Error('Invoice already cancelled.'), { status: 400 });
    }

    const [insertResult] = await connection.query(
      `INSERT INTO freight_invoice_master (
         COMID, MODULEID, MCOMPANYID, DATE, I_TYPE, PAYMENT_NO, P_TYPE, NOB, STATUS,
         P_REMARKS, P_AMT, P_DATE, MESSAGE, MESSAGE_NO, VENDOR, GROSS_FREIGHT, BROKERAGE,
         GRADEID, CPDATE, FCAID, FINAL_FREIGHT, TO_1, NET_AMOUNT, REMARKS, QUANTITY,
         NET_INWORDS, BROKERAGE_PERCENT, AGREED_GROSS_FREIGHT_LOCAL, EXCHANGE_RATE,
         PAYMENT_TERMS, ADDCOM, ADDCOM_AMOUNT, NET_PAYABLE, ATTACHMENTS, ATTACHMENTS_NAME,
         ATTEN, DUE_DATE, EXCHANGE_DATE, EXCHANGE_CURRENCY, SHIP_OWNER, CARGOID, RANDOMID,
         RDOTAXAPPLICABLE, RDOVATGST, SGST_PERCENT, CGST_PERCENT, IGST_PERCENT, VAT_PERCENT,
         NET_PAYABLE_TAX, SGST_PERCENT_AMOUNT, CGST_PERCENT_AMOUNT, IGST_PERCENT_AMOUNT,
         VAT_PERCENT_AMOUNT, APPROVERS, CREATOR, UPLOAD, UPLOAD_NAME,
         BL_DATE, BL_NO, FLAG, IMO_NO, L_UPDATED_BY, L_UP_TIME
       ) VALUES (
         ?, ?, ?, ?, 'Credit', ?, ?, ?, 8,
         ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, NOW()
       )`,
      [
        row.COMID, row.MODULEID, row.MCOMPANYID, row.DATE, row.PAYMENT_NO, row.P_TYPE, row.NOB,
        row.P_REMARKS, row.P_AMT, row.P_DATE, row.MESSAGE, row.MESSAGE_NO, row.VENDOR,
        row.GROSS_FREIGHT, row.BROKERAGE, row.GRADEID, row.CPDATE, row.FCAID, row.FINAL_FREIGHT,
        row.TO_1, row.NET_AMOUNT, row.REMARKS, row.QUANTITY, row.NET_INWORDS, row.BROKERAGE_PERCENT,
        row.AGREED_GROSS_FREIGHT_LOCAL, row.EXCHANGE_RATE, row.PAYMENT_TERMS, row.ADDCOM,
        row.ADDCOM_AMOUNT, row.NET_PAYABLE, row.ATTACHMENTS, row.ATTACHMENTS_NAME, row.ATTEN,
        row.DUE_DATE, row.EXCHANGE_DATE, row.EXCHANGE_CURRENCY, row.SHIP_OWNER, row.CARGOID,
        row.RANDOMID, row.RDOTAXAPPLICABLE, row.RDOVATGST, row.SGST_PERCENT, row.CGST_PERCENT,
        row.IGST_PERCENT, row.VAT_PERCENT, row.NET_PAYABLE_TAX, row.SGST_PERCENT_AMOUNT,
        row.CGST_PERCENT_AMOUNT, row.IGST_PERCENT_AMOUNT, row.VAT_PERCENT_AMOUNT, row.APPROVERS,
        row.CREATOR, row.UPLOAD, row.UPLOAD_NAME, row.BL_DATE, row.BL_NO, row.FLAG, row.IMO_NO,
        userId,
      ],
    );

    const creditId = insertResult.insertId;
    const [slaves] = await connection.query(
      `SELECT DESCRIPTION, AMOUNT, IDENTIFY FROM freight_invoice_slave WHERE INVOICEID = ?`,
      [id],
    );
    for (const slave of slaves || []) {
      await connection.query(
        `INSERT INTO freight_invoice_slave (INVOICEID, DESCRIPTION, AMOUNT, IDENTIFY)
         VALUES (?, ?, ?, ?)`,
        [creditId, slave.DESCRIPTION, slave.AMOUNT, slave.IDENTIFY],
      );
    }

    const [club] = await connection.query(
      `SELECT VENDOR, CARGO, RANDOMID, QUANTITY FROM freight_invoice_slave1 WHERE INVOICEID = ?`,
      [id],
    );
    for (const slave of club || []) {
      await connection.query(
        `INSERT INTO freight_invoice_slave1 (INVOICEID, VENDOR, CARGO, RANDOMID, QUANTITY)
         VALUES (?, ?, ?, ?, ?)`,
        [creditId, slave.VENDOR, slave.CARGO, slave.RANDOMID, slave.QUANTITY],
      );
    }

    await connection.query(
      `UPDATE freight_invoice_master SET STATUS = 8, L_UPDATED_BY = ?, L_UP_TIME = NOW() WHERE INVOICEID = ?`,
      [userId, id],
    );
    await connection.query(`DELETE FROM freight_invoice_slave3 WHERE INVOICEID = ?`, [id]);
    await inactiveUserAlerts(connection, 'FREIGHT INVOICE', id);
    await connection.commit();
    return { msg: 2, invoiceId: id, creditInvoiceId: creditId, comId: row.COMID };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbReopenFreightInvoice(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  const vcIn = await resolveInvoiceVcIn(pool, id);
  let result;
  try {
    [result] = await pool.query(
      `UPDATE ${invoiceMasterTable(vcIn)}
       SET STATUS = 0, SYNC_STATUS = 0, PAYMENT_STATUS = ''
       WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
  } catch {
    [result] = await pool.query(
      `UPDATE ${invoiceMasterTable(vcIn)}
       SET STATUS = 0, PAYMENT_STATUS = ''
       WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
  }
  if (!result.affectedRows) {
    throw Object.assign(new Error('Invoice not found.'), { status: 404 });
  }
  await inactiveUserAlerts(pool, vcIn ? 'FREIGHT PAYMENT' : 'FREIGHT INVOICE', id);
  return { msg: 0, invoiceId: id };
}

export async function dbDeleteFreightInvoice(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const vcIn = await resolveInvoiceVcIn(connection, id);
    const [result] = await connection.query(
      `DELETE FROM ${invoiceMasterTable(vcIn)} WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
    if (!result.affectedRows) {
      throw Object.assign(new Error('Invoice not found.'), { status: 404 });
    }
    await connection.query(`DELETE FROM ${invoiceLineTable(vcIn)} WHERE INVOICEID = ?`, [id]);
    await connection.query(`DELETE FROM ${invoicePaymentTable(vcIn)} WHERE INVOICEID = ?`, [id]).catch(() => undefined);
    if (!vcIn) {
      await connection.query(`DELETE FROM freight_invoice_slave1 WHERE INVOICEID = ?`, [id]);
      await connection.query(`DELETE FROM freight_invoice_slave3 WHERE INVOICEID = ?`, [id]);
      await connection.query(`DELETE FROM freight_invoice_adj_slave WHERE INVOICEID = ?`, [id]).catch(() => undefined);
      await connection.query(`DELETE FROM freight_invoice_slave_da WHERE INVOICEID = ?`, [id]).catch(() => undefined);
    }
    await connection.query(
      `DELETE FROM alert_master WHERE IDENTIFYID = ? AND IDENTIFY IN ('FREIGHT INVOICE', 'FREIGHT PAYMENT')`,
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

export async function dbGetFreightInvoiceForPdf(invoiceId) {
  const pool = getPool();
  const vcIn = await resolveInvoiceVcIn(pool, invoiceId);
  const [[row]] = await pool.query(
    `SELECT m.*,
            vm.NAME AS VENDOR_NAME,
            vm.STREET_1, vm.CITY, vm.COUNTRY, vm.CITY_POSTAL_CODE,
            owner.NAME AS OWNER_NAME
     FROM ${invoiceMasterTable(vcIn)} m
     LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
     LEFT JOIN vendor_master owner ON owner.CODE = m.SHIP_OWNER
     WHERE m.INVOICEID = ?
     LIMIT 1`,
    [invoiceId],
  );
  if (!row) {
    throw Object.assign(new Error('Invoice not found.'), { status: 404 });
  }

  const [addRows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT FROM ${invoiceLineTable(vcIn)} WHERE INVOICEID = ? AND IDENTIFY = 'ADD'`,
    [invoiceId],
  ).catch(() => [[]]);
  const [subRows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT FROM ${invoiceLineTable(vcIn)} WHERE INVOICEID = ? AND IDENTIFY = 'SUB'`,
    [invoiceId],
  ).catch(() => [[]]);

  return {
    invoiceId: String(row.INVOICEID),
    invoiceNo: str(row.MESSAGE),
    invoiceDate: formatDateDMY(row.DATE),
    dueDate: formatDateDMY(row.DUE_DATE),
    invType: str(row.I_TYPE),
    pType: str(row.P_TYPE),
    vendorName: str(row.VENDOR_NAME || row.VENDOR),
    vendorAddress: [row.STREET_1, row.CITY, row.COUNTRY, row.CITY_POSTAL_CODE].map(str).filter(Boolean).join(', '),
    ownerName: str(row.OWNER_NAME || row.SHIP_OWNER),
    currency: str(row.EXCHANGE_CURRENCY || 'USD'),
    grossFreight: money2(row.GROSS_FREIGHT),
    brokerage: money2(row.BROKERAGE),
    addCom: money2(row.ADDCOM_AMOUNT),
    gstOnBrok: money2(row.GST_ON_BROK),
    netPayable: money2(row.NET_PAYABLE),
    netPayableTax: money2(row.NET_PAYABLE_TAX),
    sgst: money2(row.SGST_PERCENT_AMOUNT),
    cgst: money2(row.CGST_PERCENT_AMOUNT),
    igst: money2(row.IGST_PERCENT_AMOUNT),
    vat: money2(row.VAT_PERCENT_AMOUNT),
    taxApplicable: Number(row.RDOTAXAPPLICABLE),
    gstVat: Number(row.RDOVATGST),
    remarks: str(row.REMARKS),
    addRows: (addRows || []).map((r) => ({ description: str(r.DESCRIPTION), amount: money2(r.AMOUNT) })),
    subRows: (subRows || []).map((r) => ({ description: str(r.DESCRIPTION), amount: money2(r.AMOUNT) })),
  };
}
