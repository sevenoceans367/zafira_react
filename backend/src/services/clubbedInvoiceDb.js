import { appContext, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

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

function blankDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

function normalizeInvType(invType) {
  const raw = str(invType);
  if (!raw) return 'Final';
  if (/^final$/i.test(raw)) return 'Final';
  if (/^interim2$/i.test(raw)) return 'Interim2';
  if (/^provisional$/i.test(raw)) return 'Provisional';
  if (/^interim$/i.test(raw)) return 'Interim';
  return raw;
}

/**
 * Payment-grid freight id CSV:
 * comId, fcaId, vendorId, amount, brokerage, qty, cargoId, agreedLocal, fx, randomId, slaveId
 */
export function parseClubbedFreightId(csv) {
  const parts = String(csv || '').split(',');
  return {
    comId: str(parts[0]),
    fcaId: str(parts[1]),
    vendorId: str(parts[2]),
    amount: parseAmount(parts[3]),
    brokerage: str(parts[4] || '0'),
    quantity: parseAmount(parts[5]),
    cargoId: str(parts[6] || '0') || '0',
    agreedLocal: str(parts[7] || '0'),
    exchangeRate: str(parts[8] || '0'),
    randomId: str(parts[9] || '0') || '0',
    slaveId: str(parts[10] || '0') || '0',
  };
}

async function inactiveUserAlerts(poolOrConn, identify, identifyId) {
  if (!identifyId) return;
  if (identify) {
    await poolOrConn.query(
      `UPDATE alert_master SET SHOW_STATUS = 0 WHERE IDENTIFY = ? AND IDENTIFYID = ?`,
      [identify, identifyId],
    ).catch(() => undefined);
  }
  await poolOrConn.query(
    `UPDATE alert_master SET SHOW_STATUS = 0 WHERE IDENTIFYID = ?`,
    [identifyId],
  ).catch(() => undefined);
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

function vendorAddress(row) {
  if (!row) return '';
  return [
    row.NAME,
    row.STREET_1,
    row.CITY,
    row.COUNTRY,
    row.CITY_POSTAL_CODE,
  ].map(str).filter(Boolean).join(', ');
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
  if (!fcaId) return { loadPorts: '', dischargePorts: '' };
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

async function loadNomination(pool, comId) {
  const [[compare]] = await pool.query(
    `SELECT c.*, m.VOYAGE_NO AS MASTER_VOYAGE_NO, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID,
            m.TRANS_DATE, m.CP_DATE AS MASTER_CP_DATE, m.FCAID AS MASTER_FCAID,
            m.ESTIMATE_TYPE, m.COAID, m.QTY_TYPE_RADIO, m.PERIODID, m.TC_NO,
            m.DTCVENDORID AS MASTER_DTCVENDORID, m.OWNER, m.BL_QTY_FREIGHT, m.QUANTITY,
            m.FREIGHT_GROSS, m.CARGO_RATE, vim.VESSEL_NAME, vim.IMO_NO, vim.FLAG
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = COALESCE(m.VESSEL_IMO_ID, c.VESSEL_IMO_ID)
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);

  if (!compare?.COMID) {
    throw Object.assign(new Error('VC nomination not found.'), { status: 404 });
  }

  const [[latest]] = await pool.query(
    `SELECT FCAID, TRANS_DATE, CP_DATE, VESSEL_IMO_ID, VOYAGE_NO, PERIODID, TC_NO,
            DTCVENDORID, OWNER, ESTIMATE_TYPE, COAID, QTY_TYPE_RADIO
     FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);

  return { compare, latest };
}

async function loadPeriodComIds(pool, comId, periodId) {
  const vcIds = new Set([String(comId)]);
  const tcIds = new Set();
  const fcaIds = [];

  if (!periodId || periodId === '0') {
    const [[row]] = await pool.query(
      `SELECT FCAID FROM freight_cost_estimete_master
       WHERE COMID = ? AND MODULEID = ?
       ORDER BY FCAID DESC LIMIT 1`,
      [comId, MODULE_ID],
    ).catch(() => [[null]]);
    if (row?.FCAID) fcaIds.push(String(row.FCAID));
    return { vcComIds: [...vcIds], tcComIds: [], fcaIds };
  }

  const [vcRows] = await pool.query(
    `SELECT COMID, MAX(FCAID) AS FCAID
     FROM freight_cost_estimete_master
     WHERE PERIODID = ? AND COMID IS NOT NULL
     GROUP BY COMID`,
    [periodId],
  ).catch(() => [[]]);
  for (const row of vcRows || []) {
    if (row.COMID) vcIds.add(String(row.COMID));
    if (row.FCAID) fcaIds.push(String(row.FCAID));
  }

  const [tcRows] = await pool.query(
    `SELECT COMID FROM chartering_estimate_tc_master
     WHERE PERIODID = ? AND COMID IS NOT NULL
     GROUP BY COMID`,
    [periodId],
  ).catch(() => [[]]);
  for (const row of tcRows || []) {
    if (row.COMID) tcIds.add(String(row.COMID));
  }

  return { vcComIds: [...vcIds], tcComIds: [...tcIds], fcaIds };
}

function mapFreightInvoiceRow(row, extras = {}) {
  const status = Number(row.STATUS) || 0;
  return {
    invoiceId: String(row.INVOICEID),
    comId: str(row.COMID),
    status,
    invType: str(row.I_TYPE),
    pType: str(row.P_TYPE),
    invoiceNo: str(row.MESSAGE || row.INVOICE_NO),
    invoiceDate: blankDate(row.DATE || row.INVOICE_DATE),
    dueDate: blankDate(row.DUE_DATE),
    vendorId: str(row.VENDOR),
    vendorName: str(extras.vendorName || row.VENDOR_NAME || row.VENDOR),
    shipOwner: str(row.SHIP_OWNER),
    cargoId: str(row.CARGOID || row.CARGO || ''),
    randomId: str(row.RANDOMID || ''),
    grossFreight: money2(row.GROSS_FREIGHT),
    netAmount: money2(row.NET_AMOUNT),
    netPayable: money2(row.NET_PAYABLE),
    netPayableTax: money2(row.NET_PAYABLE_TAX || row.NET_PAYABLE),
    brokerage: money2(row.BROKERAGE),
    addCom: money2(row.ADDCOM_AMOUNT),
    quantity: money2(row.QUANTITY),
    exchangeRate: str(row.EXCHANGE_RATE || ''),
    exchangeCurrency: str(row.EXCHANGE_CURRENCY || 'USD'),
    paymentStatus: str(row.PAYMENT_STATUS),
    remarks: str(row.REMARKS),
    lastUpdatedBy: str(row.LUPNAME || extras.lastUpdatedBy || ''),
    lastUpdatedAt: row.L_UP_TIME ? String(row.L_UP_TIME) : '',
    pAmt: money2(row.P_AMT),
    pDate: blankDate(row.P_DATE),
    canPdf: true,
    canReopen: Boolean(extras.mgmt) && status >= 5 && status !== 8,
  };
}

function mapHireInvoiceRow(row, extras = {}) {
  const status = Number(row.STATUS) || 0;
  return {
    invoiceId: String(row.INVOICEID),
    comId: str(row.COMID),
    status,
    invType: str(row.INVOICE_TYPE || row.I_TYPE),
    invoiceNo: str(row.INVOICE_NO || row.MESSAGE),
    invoiceDate: blankDate(row.INVOICE_DATE || row.DATE),
    dueDate: blankDate(row.DUE_DATE),
    hireFrom: blankDate(row.HIRE_FROM),
    hireTo: blankDate(row.HIRE_TO),
    hireDays: money2(row.HIRE_DAYS),
    utilisedDays: extras.utilisedDays != null ? money2(extras.utilisedDays) : null,
    finalAmt: money2(row.FINAL_AMT),
    balanceToOwner: money2(row.BALANCE_TO_OWNER),
    exchangeRate: str(row.EXCHANGE_RATE || ''),
    exchangeCurrency: str(row.EXCHANGE_CURRENCY || 'USD'),
    paymentStatus: str(row.PAYMENT_STATUS),
    remarks: str(row.REMARKS),
    lastUpdatedBy: str(row.LUPNAME || extras.lastUpdatedBy || ''),
    lastUpdatedAt: row.L_UP_TIME ? String(row.L_UP_TIME) : '',
    pAmt: money2(row.P_AMT),
    pDate: blankDate(row.P_DATE),
    shipOwner: str(row.SHIP_OWNER),
    canPdf: true,
    canReopen: Boolean(extras.mgmt) && status >= 5 && status !== 8,
  };
}

async function loadEstimateClubCharterers(pool, {
  fcaId,
  vendorId,
  slaveId,
  estimateType,
  isCoa,
}) {
  let rows = [];
  if (Number(estimateType) === 2) {
    const [clubRows] = await pool.query(
      `SELECT SHIPPER_CHARTER AS vendorId, CARGOID AS cargoId, AMOUNT_USD AS amount,
              RANDOMID AS randomId, FCA_SLAVE10ID AS slaveId
       FROM freight_cost_estimete_slave10
       WHERE FCAID = ?
         AND SHIPPER_CHARTER = ?
         AND IFNULL(CARGOID, '') != ''
         AND (? = '' OR ? = '0' OR FCA_SLAVE10ID != ?)
       ORDER BY FCA_SLAVE10ID`,
      [fcaId, vendorId, slaveId || '', slaveId || '', slaveId || ''],
    ).catch(() => [[]]);
    rows = clubRows || [];
  } else if (Number(estimateType) === 3 && isCoa) {
    const [clubRows] = await pool.query(
      `SELECT QTY_VENDORID AS vendorId, CARGO AS cargoId, NET_FREIGHT AS amount,
              RANDOMID AS randomId, FCA_SLAVE7ID AS slaveId
       FROM freight_cost_estimete_slave7
       WHERE FCAID = ?
         AND QTY_VENDORID = ?
         AND IFNULL(CARGO, '') != ''
         AND (? = '' OR ? = '0' OR FCA_SLAVE7ID != ?)
       ORDER BY FCA_SLAVE7ID`,
      [fcaId, vendorId, slaveId || '', slaveId || '', slaveId || ''],
    ).catch(() => [[]]);
    rows = clubRows || [];
  }

  const out = [];
  for (const row of rows) {
    const vId = str(row.vendorId);
    const cId = str(row.cargoId);
    const rId = str(row.randomId || '0');
    out.push({
      vendorId: vId,
      vendorName: await getVendorName(pool, vId),
      cargoId: cId,
      cargoName: await getCargoName(pool, cId),
      amount: money2(row.amount),
      randomId: rId === '0' ? '' : rId,
      slaveId: str(row.slaveId),
      clubbed: false,
    });
  }
  return out;
}

/**
 * Clubbed freight invoice view (PHP view_clubbed_invoice.php).
 */
export async function dbGetClubbedFreightInvoice({
  id,
  name,
  invType,
  voyageNo = '',
  page = '1',
  userId = appContext.userId,
  mgmtUser = isMgmtUser(),
} = {}) {
  const pool = getPool();
  const parsed = parseClubbedFreightId(id);
  const comId = parsed.comId;
  if (!comId) {
    throw Object.assign(new Error('COMID is required (id CSV part 1).'), { status: 400 });
  }
  if (!parsed.vendorId) {
    throw Object.assign(new Error('Vendor is required (id CSV part 3).'), { status: 400 });
  }

  const invoiceType = normalizeInvType(invType);
  const pType = str(name) || 'Final Nett Freight';
  const { compare, latest } = await loadNomination(pool, comId);
  const fcaId = parsed.fcaId || str(latest?.FCAID || compare.MASTER_FCAID || compare.FCAID);
  const vendorId = parsed.vendorId;
  const cargoId = parsed.cargoId && parsed.cargoId !== '0' ? parsed.cargoId : '0';
  const randomId = parsed.randomId && parsed.randomId !== '0' ? parsed.randomId : '0';
  const slaveId = parsed.slaveId && parsed.slaveId !== '0' ? parsed.slaveId : '';

  const vendor = await getVendorRow(pool, vendorId);
  const ports = await getPortNames(pool, fcaId);
  const cargoName = await getCargoName(pool, cargoId);
  const voyage = str(voyageNo)
    || str(compare.MASTER_VOYAGE_NO)
    || str(latest?.VOYAGE_NO)
    || str(compare.MESSAGE);
  const vesselName = str(compare.VESSEL_NAME);
  const cpDate = blankDate(compare.TRANS_DATE || latest?.TRANS_DATE || compare.MASTER_CP_DATE || latest?.CP_DATE);
  const estimateType = Number(latest?.ESTIMATE_TYPE || compare.ESTIMATE_TYPE || 0);
  const isCoa = Boolean(
    latest?.COAID
    || compare.COAID
    || Number(latest?.QTY_TYPE_RADIO) === 2
    || Number(compare.QTY_TYPE_RADIO) === 2,
  );

  const [[draft]] = await pool.query(
    `SELECT m.*,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = m.L_UPDATED_BY) AS LUPNAME,
            vm.NAME AS VENDOR_NAME
     FROM freight_invoice_master m
     LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
     WHERE m.COMID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.VENDOR = ?
       AND m.P_TYPE = ?
       AND m.CARGOID = ?
       AND m.RANDOMID = ?
       AND m.I_TYPE = ?
       AND m.STATUS < 5
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, vendorId, pType, cargoId, randomId, invoiceType],
  ).catch(() => [[null]]);

  const [existingRows] = await pool.query(
    `SELECT m.*,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = m.L_UPDATED_BY) AS LUPNAME,
            vm.NAME AS VENDOR_NAME
     FROM freight_invoice_master m
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
    [comId, MODULE_ID, COMPANY_ID, vendorId, pType, cargoId, randomId],
  ).catch(() => [[]]);

  const [clubbedHostRows] = await pool.query(
    `SELECT m.*,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = m.L_UPDATED_BY) AS LUPNAME,
            vm.NAME AS VENDOR_NAME,
            s.VENDOR AS CLUB_VENDOR, s.CARGO AS CLUB_CARGO, s.RANDOMID AS CLUB_RANDOMID,
            s.QUANTITY AS CLUB_QUANTITY
     FROM freight_invoice_slave1 s
     INNER JOIN freight_invoice_master m ON m.INVOICEID = s.INVOICEID
     LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
     WHERE m.COMID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND s.VENDOR = ?
       AND s.CARGO = ?
       AND s.RANDOMID = ?
     ORDER BY m.INVOICEID DESC`,
    [comId, MODULE_ID, COMPANY_ID, vendorId, cargoId, randomId],
  ).catch(() => [[]]);

  const existingById = new Map();
  for (const row of existingRows || []) {
    existingById.set(String(row.INVOICEID), mapFreightInvoiceRow(row, {
      mgmt: Boolean(mgmtUser),
      vendorName: str(row.VENDOR_NAME),
    }));
  }
  for (const row of clubbedHostRows || []) {
    const key = String(row.INVOICEID);
    if (!existingById.has(key) && Number(row.STATUS) >= 5) {
      existingById.set(key, mapFreightInvoiceRow(row, {
        mgmt: Boolean(mgmtUser),
        vendorName: str(row.VENDOR_NAME),
      }));
    }
  }

  const relatedInvoiceIds = [
    ...(draft ? [String(draft.INVOICEID)] : []),
    ...[...existingById.keys()],
  ];
  const uniqueInvoiceIds = [...new Set(relatedInvoiceIds)];

  let clubbedCharterers = [];
  if (uniqueInvoiceIds.length) {
    const [slaveRows] = await pool.query(
      `SELECT s.INVOICEID, s.VENDOR, s.CARGO, s.RANDOMID, s.QUANTITY,
              m.MESSAGE, m.I_TYPE, m.P_TYPE, m.STATUS, m.NET_PAYABLE, m.NET_PAYABLE_TAX,
              vm.NAME AS VENDOR_NAME
       FROM freight_invoice_slave1 s
       INNER JOIN freight_invoice_master m ON m.INVOICEID = s.INVOICEID
       LEFT JOIN vendor_master vm ON vm.CODE = s.VENDOR
       WHERE s.INVOICEID IN (?)
       ORDER BY s.INVOICEID, s.VENDOR, s.CARGO`,
      [uniqueInvoiceIds],
    ).catch(() => [[]]);

    clubbedCharterers = await Promise.all((slaveRows || []).map(async (row) => ({
      invoiceId: String(row.INVOICEID),
      invoiceNo: str(row.MESSAGE),
      invType: str(row.I_TYPE),
      vendorId: str(row.VENDOR),
      vendorName: str(row.VENDOR_NAME || row.VENDOR),
      cargoId: str(row.CARGO),
      cargoName: await getCargoName(pool, row.CARGO),
      randomId: str(row.RANDOMID),
      quantity: money2(row.QUANTITY),
      amount: money2(row.NET_PAYABLE_TAX || row.NET_PAYABLE),
      status: Number(row.STATUS) || 0,
    })));
  }

  const estimateClub = await loadEstimateClubCharterers(pool, {
    fcaId,
    vendorId,
    slaveId,
    estimateType,
    isCoa,
  });
  const clubbedKeys = new Set(
    clubbedCharterers.map((row) => `${row.vendorId}|${row.cargoId}|${row.randomId || '0'}`),
  );
  const estimateClubCharterers = estimateClub.map((row) => ({
    ...row,
    clubbed: clubbedKeys.has(`${row.vendorId}|${row.cargoId}|${row.randomId || '0'}`),
  }));

  const currentInvoice = draft
    ? mapFreightInvoiceRow(draft, { mgmt: Boolean(mgmtUser), vendorName: str(draft.VENDOR_NAME) })
    : (clubbedHostRows?.[0] && Number(clubbedHostRows[0].STATUS) < 5
      ? mapFreightInvoiceRow(clubbedHostRows[0], {
        mgmt: Boolean(mgmtUser),
        vendorName: str(clubbedHostRows[0].VENDOR_NAME),
      })
      : null);

  const pdfInvoiceId = currentInvoice?.invoiceId
    || [...existingById.values()][0]?.invoiceId
    || '';

  return {
    id: id || '',
    page: String(page || '1'),
    name: pType,
    invType: invoiceType,
    comId,
    fcaId: String(fcaId || ''),
    vendorId,
    vendorName: str(vendor?.NAME),
    vendorAddress: vendorAddress(vendor),
    cargoId: cargoId === '0' ? '' : cargoId,
    cargoName,
    randomId: randomId === '0' ? '' : randomId,
    slaveId,
    voyageNo: voyage,
    vesselName,
    nomMessage: str(compare.MESSAGE),
    cpDate,
    loadPorts: ports.loadPorts,
    dischargePorts: ports.dischargePorts,
    imoNo: str(compare.IMO_NO),
    currency: 'USD',
    auth: {
      isMgmtUser: Boolean(mgmtUser),
      userId: userId || '',
    },
    currentInvoice,
    pdfInvoiceId,
    existingInvoices: [...existingById.values()],
    clubbedCharterers,
    estimateClubCharterers,
  };
}

/**
 * Clubbed hire / Payment Clubbed view (PHP view_clubbed_invoice_hire.php).
 */
export async function dbGetClubbedHireInvoice({
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

  const { compare, latest } = await loadNomination(pool, resolvedComId);
  const fcaId = str(latest?.FCAID || compare.MASTER_FCAID || compare.FCAID);
  const periodId = str(latest?.PERIODID || compare.PERIODID || '');
  const vendorId = str(compare.DTCVENDORID || latest?.DTCVENDORID || latest?.OWNER || compare.MASTER_DTCVENDORID);
  const vendor = await getVendorRow(pool, vendorId);
  const ports = await getPortNames(pool, fcaId);
  const voyage = str(voyageNo)
    || str(compare.MASTER_VOYAGE_NO)
    || str(latest?.VOYAGE_NO)
    || str(compare.MESSAGE);
  const vesselName = str(compare.VESSEL_NAME);
  const cpDate = blankDate(
    compare.MASTER_CP_DATE
    || latest?.CP_DATE
    || compare.TRANS_DATE
    || latest?.TRANS_DATE,
  );
  const tcNo = str(compare.TC_NO || latest?.TC_NO);
  const { vcComIds, fcaIds } = await loadPeriodComIds(pool, resolvedComId, periodId);
  const queryFcaIds = fcaIds.length ? fcaIds : (fcaId ? [fcaId] : []);

  const [[draft]] = await pool.query(
    `SELECT m.*,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = m.L_UPDATED_BY) AS LUPNAME
     FROM invoice_hire_master m
     WHERE m.COMID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.STATUS < 5
     LIMIT 1`,
    [resolvedComId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[null]]);

  const [[latestAny]] = await pool.query(
    `SELECT m.*,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = m.L_UPDATED_BY) AS LUPNAME
     FROM invoice_hire_master m
     WHERE m.COMID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
     ORDER BY m.INVOICEID DESC
     LIMIT 1`,
    [resolvedComId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[null]]);

  const placeholders = vcComIds.map(() => '?').join(', ');
  const [existingRows] = await pool.query(
    `SELECT m.*,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = m.L_UPDATED_BY) AS LUPNAME
     FROM invoice_hire_master m
     WHERE m.COMID IN (${placeholders})
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.STATUS = 5
     ORDER BY m.INVOICE_DATE ASC, m.INVOICEID ASC`,
    [...vcComIds, MODULE_ID, COMPANY_ID],
  ).catch(() => [[]]);

  const utilisedByInvoice = new Map();
  if ((existingRows || []).length) {
    const ids = existingRows.map((row) => row.INVOICEID);
    const [utilRows] = await pool.query(
      `SELECT INVOICEID, SUM(UTILISED_DAYS) AS DAYS
       FROM invoice_hire_slave8
       WHERE INVOICEID IN (?)
       GROUP BY INVOICEID`,
      [ids],
    ).catch(() => [[]]);
    for (const row of utilRows || []) {
      utilisedByInvoice.set(String(row.INVOICEID), row.DAYS);
    }
  }

  const existingInvoices = (existingRows || []).map((row) => mapHireInvoiceRow(row, {
    mgmt: Boolean(mgmtUser),
    utilisedDays: utilisedByInvoice.has(String(row.INVOICEID))
      ? utilisedByInvoice.get(String(row.INVOICEID))
      : null,
  }));

  const invoiceIdsForOrc = [
    ...(draft ? [String(draft.INVOICEID)] : []),
    ...(latestAny && (!draft || String(latestAny.INVOICEID) !== String(draft.INVOICEID))
      ? [String(latestAny.INVOICEID)]
      : []),
    ...existingInvoices.map((row) => row.invoiceId),
  ];
  const uniqueInvoiceIds = [...new Set(invoiceIdsForOrc.filter(Boolean))];

  let clubbedOrcs = [];
  if (uniqueInvoiceIds.length) {
    const [slaveRows] = await pool.query(
      `SELECT s.INVOICEID, s.VENDORID, s.IDENTITYID, s.RANDOMID, s.AMOUNT,
              m.INVOICE_NO, m.INVOICE_TYPE, m.STATUS, m.COMID,
              o.NAME AS COST_NAME, vm.NAME AS VENDOR_NAME
       FROM invoice_hire_slave5 s
       INNER JOIN invoice_hire_master m ON m.INVOICEID = s.INVOICEID
       LEFT JOIN owner_related_cost_master o ON o.OWNER_RCOSTID = s.IDENTITYID
       LEFT JOIN vendor_master vm ON vm.CODE = s.VENDORID
       WHERE s.INVOICEID IN (?)
       ORDER BY s.INVOICEID, s.IDENTITYID`,
      [uniqueInvoiceIds],
    ).catch(() => [[]]);

    clubbedOrcs = (slaveRows || []).map((row) => ({
      invoiceId: String(row.INVOICEID),
      invoiceNo: str(row.INVOICE_NO),
      invType: str(row.INVOICE_TYPE),
      vendorId: str(row.VENDORID),
      vendorName: str(row.VENDOR_NAME || row.VENDORID),
      orcId: str(row.IDENTITYID),
      costName: str(row.COST_NAME || row.IDENTITYID),
      randomId: str(row.RANDOMID),
      amount: money2(row.AMOUNT),
      status: Number(row.STATUS) || 0,
      comId: str(row.COMID),
    }));
  }

  let estimateOrcs = [];
  if (queryFcaIds.length && vendorId) {
    const fcaPlaceholders = queryFcaIds.map(() => '?').join(', ');
    const [orcRows] = await pool.query(
      `SELECT s.IDENTY_ID, s.VENDORID, s.RANDOMID, s.RAW_AMOUNT, o.NAME AS COST_NAME
       FROM freight_cost_estimete_slave3 s
       LEFT JOIN owner_related_cost_master o ON o.OWNER_RCOSTID = s.IDENTY_ID
       WHERE s.FCAID IN (${fcaPlaceholders})
         AND s.VENDORID = ?
         AND s.IDENTIFY = 'ORC'
         AND s.RAW_AMOUNT > 0
       ORDER BY s.FCA_SLAVE3ID`,
      [...queryFcaIds, vendorId],
    ).catch(() => [[]]);

    const clubbedOrcKeys = new Set(
      clubbedOrcs.map((row) => `${row.vendorId}|${row.orcId}|${row.randomId || '0'}`),
    );
    estimateOrcs = (orcRows || []).map((row) => ({
      orcId: str(row.IDENTY_ID),
      costName: str(row.COST_NAME || row.IDENTY_ID),
      vendorId: str(row.VENDORID),
      vendorName: str(vendor?.NAME || row.VENDORID),
      randomId: str(row.RANDOMID),
      amount: money2(row.RAW_AMOUNT),
      clubbed: clubbedOrcKeys.has(`${str(row.VENDORID)}|${str(row.IDENTY_ID)}|${str(row.RANDOMID || '0')}`),
    }));
  }

  const currentInvoice = draft
    ? mapHireInvoiceRow(draft, { mgmt: Boolean(mgmtUser) })
    : (latestAny && Number(latestAny.STATUS) < 5
      ? mapHireInvoiceRow(latestAny, { mgmt: Boolean(mgmtUser) })
      : null);
  const pdfInvoiceId = currentInvoice?.invoiceId
    || latestAny?.INVOICEID
    || existingInvoices[existingInvoices.length - 1]?.invoiceId
    || '';

  return {
    page: String(page || '1'),
    comId: resolvedComId,
    fcaId,
    periodId: periodId && periodId !== '0' ? periodId : '',
    relatedComIds: vcComIds,
    vendorId,
    vendorName: str(vendor?.NAME),
    vendorAddress: vendorAddress(vendor),
    voyageNo: voyage,
    vesselName,
    nomMessage: str(compare.MESSAGE),
    cpDate,
    tcNo,
    loadPorts: ports.loadPorts,
    dischargePorts: ports.dischargePorts,
    currency: 'USD',
    auth: {
      isMgmtUser: Boolean(mgmtUser),
      userId: userId || '',
    },
    currentInvoice,
    latestInvoice: latestAny ? mapHireInvoiceRow(latestAny, { mgmt: Boolean(mgmtUser) }) : null,
    pdfInvoiceId: pdfInvoiceId ? String(pdfInvoiceId) : '',
    existingInvoices,
    clubbedOrcs,
    estimateOrcs,
  };
}

export async function dbReopenClubbedFreightInvoice(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  let result;
  try {
    [result] = await pool.query(
      `UPDATE freight_invoice_master
       SET STATUS = 0, SYNC_STATUS = 0
       WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
  } catch {
    [result] = await pool.query(
      `UPDATE freight_invoice_master
       SET STATUS = 0
       WHERE INVOICEID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [id, MODULE_ID, COMPANY_ID],
    );
  }
  if (!result.affectedRows) {
    throw Object.assign(new Error('Invoice not found.'), { status: 404 });
  }
  await inactiveUserAlerts(pool, 'FREIGHT INVOICE', id);
  return { msg: 0, invoiceId: id };
}

export async function dbReopenClubbedHireInvoice(invoiceId) {
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

export async function dbGetClubbedFreightForPdf(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const [[row]] = await pool.query(
    `SELECT m.*,
            vm.NAME AS VENDOR_NAME, vm.STREET_1, vm.CITY, vm.COUNTRY, vm.CITY_POSTAL_CODE,
            owner.NAME AS OWNER_NAME,
            c.MESSAGE AS NOM_MESSAGE, est.VOYAGE_NO, vim.VESSEL_NAME
     FROM freight_invoice_master m
     LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
     LEFT JOIN vendor_master owner ON owner.CODE = m.SHIP_OWNER
     LEFT JOIN freight_cost_estimate_compare c ON c.COMID = m.COMID AND c.MODULEID = m.MODULEID
     LEFT JOIN freight_cost_estimete_master est ON est.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = COALESCE(est.VESSEL_IMO_ID, c.VESSEL_IMO_ID)
     WHERE m.INVOICEID = ? AND m.MODULEID = ? AND m.MCOMPANYID = ?
     LIMIT 1`,
    [id, MODULE_ID, COMPANY_ID],
  );
  if (!row) {
    throw Object.assign(new Error('Invoice not found.'), { status: 404 });
  }

  const [clubRows] = await pool.query(
    `SELECT s.VENDOR, s.CARGO, s.RANDOMID, s.QUANTITY, vm.NAME AS VENDOR_NAME
     FROM freight_invoice_slave1 s
     LEFT JOIN vendor_master vm ON vm.CODE = s.VENDOR
     WHERE s.INVOICEID = ?`,
    [id],
  ).catch(() => [[]]);

  const [addRows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT FROM freight_invoice_slave WHERE INVOICEID = ? AND IDENTIFY = 'ADD'`,
    [id],
  ).catch(() => [[]]);
  const [subRows] = await pool.query(
    `SELECT DESCRIPTION, AMOUNT FROM freight_invoice_slave WHERE INVOICEID = ? AND IDENTIFY = 'SUB'`,
    [id],
  ).catch(() => [[]]);

  const clubbedCharterers = await Promise.all((clubRows || []).map(async (club) => ({
    vendorId: str(club.VENDOR),
    vendorName: str(club.VENDOR_NAME || club.VENDOR),
    cargoId: str(club.CARGO),
    cargoName: await getCargoName(pool, club.CARGO),
    randomId: str(club.RANDOMID),
    quantity: money2(club.QUANTITY),
  })));

  return {
    invoiceId: String(row.INVOICEID),
    invoiceNo: str(row.MESSAGE),
    invType: str(row.I_TYPE),
    pType: str(row.P_TYPE),
    invoiceDate: blankDate(row.DATE),
    dueDate: blankDate(row.DUE_DATE),
    vendorName: str(row.VENDOR_NAME || row.VENDOR),
    vendorAddress: [row.STREET_1, row.CITY, row.COUNTRY, row.CITY_POSTAL_CODE].map(str).filter(Boolean).join(', '),
    ownerName: str(row.OWNER_NAME || row.SHIP_OWNER),
    voyageNo: str(row.VOYAGE_NO),
    nomMessage: str(row.NOM_MESSAGE),
    vesselName: str(row.VESSEL_NAME),
    currency: str(row.EXCHANGE_CURRENCY) || 'USD',
    grossFreight: money2(row.GROSS_FREIGHT),
    netAmount: money2(row.NET_AMOUNT),
    netPayable: money2(row.NET_PAYABLE),
    netPayableTax: money2(row.NET_PAYABLE_TAX || row.NET_PAYABLE),
    remarks: str(row.REMARKS),
    clubbedCharterers,
    addRows: (addRows || []).map((r) => ({ description: str(r.DESCRIPTION), amount: money2(r.AMOUNT) })),
    subRows: (subRows || []).map((r) => ({ description: str(r.DESCRIPTION), amount: money2(r.AMOUNT) })),
  };
}

export async function dbGetClubbedHireForPdf(invoiceId) {
  const pool = getPool();
  const id = str(invoiceId);
  if (!id) throw Object.assign(new Error('Invoice id is required.'), { status: 400 });

  const [[row]] = await pool.query(
    `SELECT m.*,
            c.MESSAGE AS NOM_MESSAGE, c.DTCVENDORID, est.VOYAGE_NO, est.DTCVENDORID AS MASTER_DTC,
            est.OWNER, est.TC_NO, vim.VESSEL_NAME, vm.NAME AS VENDOR_NAME,
            vm.STREET_1, vm.CITY, vm.COUNTRY, vm.CITY_POSTAL_CODE
     FROM invoice_hire_master m
     LEFT JOIN freight_cost_estimate_compare c ON c.COMID = m.COMID AND c.MODULEID = m.MODULEID
     LEFT JOIN freight_cost_estimete_master est ON est.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = COALESCE(est.VESSEL_IMO_ID, c.VESSEL_IMO_ID)
     LEFT JOIN vendor_master vm ON vm.CODE = COALESCE(c.DTCVENDORID, est.DTCVENDORID, est.OWNER)
     WHERE m.INVOICEID = ? AND m.MODULEID = ? AND m.MCOMPANYID = ?
     LIMIT 1`,
    [id, MODULE_ID, COMPANY_ID],
  );
  if (!row) {
    throw Object.assign(new Error('Hire statement not found.'), { status: 404 });
  }

  const [orcRows] = await pool.query(
    `SELECT s.VENDORID, s.IDENTITYID, s.RANDOMID, s.AMOUNT,
            o.NAME AS COST_NAME, vm.NAME AS VENDOR_NAME
     FROM invoice_hire_slave5 s
     LEFT JOIN owner_related_cost_master o ON o.OWNER_RCOSTID = s.IDENTITYID
     LEFT JOIN vendor_master vm ON vm.CODE = s.VENDORID
     WHERE s.INVOICEID = ?`,
    [id],
  ).catch(() => [[]]);

  const [[utilised]] = await pool.query(
    `SELECT SUM(UTILISED_DAYS) AS DAYS FROM invoice_hire_slave8 WHERE INVOICEID = ?`,
    [id],
  ).catch(() => [[{ DAYS: 0 }]]);

  return {
    invoiceId: String(row.INVOICEID),
    invoiceNo: str(row.INVOICE_NO),
    invType: str(row.INVOICE_TYPE),
    invoiceDate: blankDate(row.INVOICE_DATE),
    dueDate: blankDate(row.DUE_DATE),
    hireFrom: blankDate(row.HIRE_FROM),
    hireTo: blankDate(row.HIRE_TO),
    hireDays: money2(row.HIRE_DAYS),
    utilisedDays: money2(utilised?.DAYS),
    finalAmt: money2(row.FINAL_AMT),
    balanceToOwner: money2(row.BALANCE_TO_OWNER),
    vendorName: str(row.VENDOR_NAME),
    vendorAddress: [row.STREET_1, row.CITY, row.COUNTRY, row.CITY_POSTAL_CODE].map(str).filter(Boolean).join(', '),
    voyageNo: str(row.VOYAGE_NO),
    nomMessage: str(row.NOM_MESSAGE),
    vesselName: str(row.VESSEL_NAME),
    tcNo: str(row.TC_NO),
    currency: str(row.EXCHANGE_CURRENCY) || 'USD',
    remarks: str(row.REMARKS),
    clubbedOrcs: (orcRows || []).map((r) => ({
      vendorId: str(r.VENDORID),
      vendorName: str(r.VENDOR_NAME || r.VENDORID),
      orcId: str(r.IDENTITYID),
      costName: str(r.COST_NAME || r.IDENTITYID),
      randomId: str(r.RANDOMID),
      amount: money2(r.AMOUNT),
    })),
  };
}
