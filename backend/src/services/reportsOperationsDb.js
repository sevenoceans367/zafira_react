import { appContext, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY, parsePeriodDate } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function safeDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted.startsWith('01-01-1970')) return '';
  return formatted;
}

function estimateTypeFilter(selBType, alias = 'm') {
  const value = String(selBType || '').trim();
  if (!value) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.ESTIMATE_TYPE = ? `, params: [value] };
}

function coaSpotClause(selCOASpot) {
  if (String(selCOASpot) === '2') return 'AND c.COAAID IS NOT NULL';
  if (String(selCOASpot) === '1') return 'AND c.COAAID IS NULL';
  return '';
}

async function loginName(pool, loginId) {
  if (!loginId) return '';
  const [[row]] = await pool.query(
    'SELECT CONTACT_PERSON FROM login WHERE LOGINID = ? LIMIT 1',
    [loginId],
  );
  return row?.CONTACT_PERSON || '';
}

async function vendorName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    'SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1',
    [code],
  );
  return row?.NAME || '';
}

async function cargoName(pool, cargoId) {
  if (!cargoId) return '';
  const ids = String(cargoId).split(',').map((x) => x.trim()).filter(Boolean);
  if (!ids.length) return '';
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT MATERIAL_TYPE FROM cargo_master WHERE MATERIALID IN (${placeholders})`,
    ids,
  );
  return rows.map((r) => r.MATERIAL_TYPE).filter(Boolean).join(', ');
}

async function portsForFca(pool, fcaId) {
  const [rows] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY
     FROM freight_cost_estimete_slave1 WHERE FCAID = ?`,
    [fcaId],
  );
  const loadIds = [];
  const discIds = [];
  rows.forEach((row) => {
    if (Number(row.LOAD_PORT_QTY) > 0 && row.FROM_PORT) loadIds.push(row.FROM_PORT);
    if (Number(row.DISC_PORT_QTY) > 0 && row.TO_PORT) discIds.push(row.TO_PORT);
  });
  const resolve = async (ids) => {
    if (!ids.length) return '';
    const placeholders = ids.map(() => '?').join(',');
    const [ports] = await pool.query(
      `SELECT PortId, PortName FROM port_master WHERE PortId IN (${placeholders})`,
      ids,
    );
    const map = new Map(ports.map((p) => [String(p.PortId), String(p.PortName || '').split(' / ')[0]]));
    return ids.map((id) => map.get(String(id)) || '').filter(Boolean).join(', ');
  };
  return { loadPort: await resolve(loadIds), dischargePort: await resolve(discIds) };
}

async function companyName(pool) {
  const [[row]] = await pool.query(
    'SELECT COMPANY_NAME FROM company_master WHERE COMPANYID = ? LIMIT 1',
    [COMPANY_ID],
  );
  return row?.COMPANY_NAME || '';
}

async function listFixedVoyages(pool, {
  from,
  to,
  year,
  selBType,
  selCOASpot,
  vesselImoId,
} = {}) {
  const typeFilter = estimateTypeFilter(selBType);
  const params = [MODULE_ID, COMPANY_ID, ...typeFilter.params];
  let dateSql = '';
  if (from && to) {
    dateSql = ' AND m.TRANS_DATE >= ? AND m.TRANS_DATE <= ? ';
    params.push(from, to);
  } else if (year) {
    dateSql = ' AND YEAR(COALESCE(m.ADD_ON_DATE, m.TRANS_DATE)) = ? ';
    params.push(year);
  }
  let vesselSql = '';
  if (vesselImoId) {
    vesselSql = ' AND m.VESSEL_IMO_ID = ? ';
    params.push(vesselImoId);
  }

  const [rows] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, c.USERID, c.OPERATOR, c.COAAID, c.STATUS,
            m.FCAID, m.VESSEL_IMO_ID, m.TRANS_DATE, m.CP_DATE, m.VOYAGE_NO, m.VOYAGE_NAME,
            m.DWT_SUMMER, m.ESTIMATE_TYPE, m.QTY_TYPE_RADIO, m.FGFF_VENDORID, m.SHIPPER,
            m.CARGO_ID, m.ACTUAL_PL, m.QUANTITY, m.GAS_QUANTITY, m.TANK_QUANTITY,
            m.DEAD_PREIGHT_ADJ, m.DEAD_PREIGHT_ADJ_PRMT, m.DEMURRAGEBROKCOM, m.COA_SPOT,
            v.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2, 3, 4)
       ${typeFilter.sql}
       ${coaSpotClause(selCOASpot)}
       ${dateSql}
       ${vesselSql}
     GROUP BY c.COMID
     ORDER BY m.TRANS_DATE DESC`,
    params,
  );
  return rows;
}

async function chartererForMaster(pool, master) {
  if (Number(master.ESTIMATE_TYPE) === 3 && Number(master.QTY_TYPE_RADIO) === 2) {
    const [rows] = await pool.query(
      `SELECT v.NAME AS name
       FROM freight_cost_estimete_slave7 s
       LEFT JOIN vendor_master v ON v.CODE = s.QTY_VENDORID
       WHERE s.FCAID = ?
       GROUP BY s.QTY_VENDORID`,
      [master.FCAID],
    );
    return rows.map((r) => r.name).filter(Boolean).join(',');
  }
  return vendorName(pool, master.FGFF_VENDORID);
}

export async function dbOpsFilterExtras() {
  const pool = getPool();
  let ports = [];
  let vendors = [];
  let vessels = [];
  try {
    const [portRows] = await pool.query(
      `SELECT PortId AS id, PortName AS name
       FROM port_master
       WHERE PortName IS NOT NULL AND PortName != ''
       ORDER BY PortName ASC
       LIMIT 500`,
    );
    ports = portRows.map((p) => ({
      id: String(p.id),
      name: String(p.name || '').split(' / ')[0],
    }));
  } catch {
    ports = [];
  }
  try {
    const [vendorRows] = await pool.query(
      `SELECT CODE AS id, NAME AS name
       FROM vendor_master
       WHERE NAME IS NOT NULL AND NAME != ''
       ORDER BY NAME ASC
       LIMIT 500`,
    );
    vendors = vendorRows.map((v) => ({ id: String(v.id), name: v.name }));
  } catch {
    vendors = [];
  }
  try {
    const [vesselRows] = await pool.query(
      `SELECT VESSEL_IMO_ID AS id, VESSEL_NAME AS name
       FROM vessel_imo_master
       WHERE MCOMPANYID = ?
       ORDER BY VESSEL_NAME ASC
       LIMIT 500`,
      [COMPANY_ID],
    );
    vessels = vesselRows.map((v) => ({ id: String(v.id), name: v.name }));
  } catch {
    vessels = [];
  }
  return {
    ports,
    vendors,
    vessels,
    costTypes: [
      { id: 'Load Port Costs', name: 'Load Port Costs' },
      { id: 'Discharge Port Costs', name: 'Discharge Port Costs' },
      { id: 'Transit Port Costs', name: 'Transit Port Costs' },
    ],
  };
}

export async function dbVoyageDetailsReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const owner = await companyName(pool);
  const rows = await listFixedVoyages(pool, {
    from,
    to,
    selBType: filters.selBType,
    selCOASpot: filters.selCOASpot || '1',
  });

  const records = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    records.push({
      id: row.COMID,
      srNo: i + 1,
      voyageId: row.MESSAGE || '',
      vesselName: row.VESSEL_NAME || '',
      cpic: await loginName(pool, row.USERID),
      opsPic: await loginName(pool, row.OPERATOR),
      dwt: row.DWT_SUMMER ?? '',
      cpDate: safeDate(row.TRANS_DATE || row.CP_DATE),
      ownerName: owner,
      charterer: await chartererForMaster(pool, row),
      fixtureDate: safeDate(row.TRANS_DATE),
      voyageNo: row.VOYAGE_NO || '',
      pl: row.ACTUAL_PL ?? '',
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbAgentListReport(filters = {}) {
  const pool = getPool();
  const selPort = String(filters.selPort || '').trim();
  const rows = await listFixedVoyages(pool, {});
  const records = [];
  let srNo = 0;
  for (const row of rows) {
    const ports = await portsForFca(pool, row.FCAID);
    const portNames = [ports.loadPort, ports.dischargePort].filter(Boolean).join(', ');
    if (selPort) {
      const [[port]] = await pool.query(
        'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
        [selPort],
      );
      const short = String(port?.PortName || '').split(' / ')[0];
      if (!portNames.includes(short)) continue;
    }
    let agent = '';
    try {
      const [[agency]] = await pool.query(
        `SELECT v.NAME AS name
         FROM generate_agency_letter g
         LEFT JOIN vendor_master v ON v.CODE = g.VENDORID
         WHERE g.COMID = ? AND g.STATUS = 2
         ORDER BY g.GEN_AGENCY_ID DESC LIMIT 1`,
        [row.COMID],
      );
      agent = agency?.name || '';
    } catch {
      agent = '';
    }
    srNo += 1;
    records.push({
      id: `${row.COMID}-${srNo}`,
      srNo,
      voyageName: row.VOYAGE_NAME || row.VOYAGE_NO || '',
      cpDate: safeDate(row.TRANS_DATE),
      vesselName: row.VESSEL_NAME || '',
      port: portNames,
      cargo: await cargoName(pool, row.CARGO_ID),
      agent,
      shipper: await vendorName(pool, row.SHIPPER),
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbBunkerConsumptionReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const rows = await listFixedVoyages(pool, {
    from,
    to,
    selBType: filters.selBType,
    selCOASpot: filters.selCOASpot,
    vesselImoId: filters.selVessel,
  });
  const records = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let bunkerSummary = '';
    try {
      const [bunkers] = await pool.query(
        `SELECT BUNKERID, QTY, IDENTIFY FROM freight_cost_estimete_slave8 WHERE FCAID = ?`,
        [row.FCAID],
      );
      bunkerSummary = bunkers
        .map((b) => `${b.IDENTIFY || ''}:${b.BUNKERID || ''}=${b.QTY ?? ''}`)
        .join('; ');
    } catch {
      bunkerSummary = '';
    }
    records.push({
      id: row.COMID,
      srNo: i + 1,
      nomId: row.MESSAGE || '',
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.TRANS_DATE),
      bunkerSummary,
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbDailyPositionReport(filters = {}) {
  const pool = getPool();
  const voyageType = String(filters.selVoyageType || 'VC').toUpperCase();
  const typeFilter = estimateTypeFilter(filters.selBType);
  const coa = voyageType === 'COA' ? '2' : '1';
  const rows = await listFixedVoyages(pool, {
    selBType: filters.selBType,
    selCOASpot: coa,
    year: filters.selYear || String(new Date().getFullYear()),
  });
  void typeFilter;
  const records = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const ports = await portsForFca(pool, row.FCAID);
    records.push({
      id: row.COMID,
      srNo: i + 1,
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.TRANS_DATE),
      loadPort: ports.loadPort,
      dischargePort: ports.dischargePort,
      charterer: await chartererForMaster(pool, row),
      status: row.STATUS ?? '',
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbDeadFreightSummary(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const removeZeros = String(filters.chk || '') === '1';
  const rows = await listFixedVoyages(pool, {
    from,
    to,
    selBType: filters.selBType,
  });
  const records = [];
  let srNo = 0;
  for (const row of rows) {
    const qty = Number(row.DEAD_PREIGHT_ADJ_PRMT) || 0;
    const amt = Number(row.DEAD_PREIGHT_ADJ) || 0;
    if (removeZeros && !qty && !amt) continue;
    const ports = await portsForFca(pool, row.FCAID);
    srNo += 1;
    records.push({
      id: row.COMID,
      srNo,
      nomId: row.MESSAGE || '',
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      coaSpot: row.COAAID ? 'COA' : 'Spot',
      cpDate: safeDate(row.TRANS_DATE),
      shipper: await vendorName(pool, row.SHIPPER),
      charterer: await chartererForMaster(pool, row),
      loadPort: ports.loadPort,
      dischargePort: ports.dischargePort,
      contractQty: row.QUANTITY || row.TANK_QUANTITY || row.GAS_QUANTITY || '',
      deadFreightQty: qty || '',
      deadFreightAmt: amt || '',
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbDemurrageSummary(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const removeZeros = String(filters.chk || '') === '1';
  const rows = await listFixedVoyages(pool, {
    from,
    to,
    selBType: filters.selBType,
    selCOASpot: filters.selCOASpot,
  });
  const records = [];
  let srNo = 0;
  for (const row of rows) {
    const demAmt = Number(row.DEMURRAGEBROKCOM) || 0;
    if (removeZeros && !demAmt) continue;
    const ports = await portsForFca(pool, row.FCAID);
    srNo += 1;
    records.push({
      id: row.COMID,
      srNo,
      nomId: row.MESSAGE || '',
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.TRANS_DATE),
      charterer: await chartererForMaster(pool, row),
      loadPort: ports.loadPort,
      dischargePort: ports.dischargePort,
      demurrageAmt: demAmt ? demAmt.toFixed(2) : '',
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbHeadwiseExpenseReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const rows = await listFixedVoyages(pool, {
    from,
    to,
    selBType: filters.selBType,
    selCOASpot: filters.selCOASpot,
  });
  const records = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let bunker = 0;
    let portCost = 0;
    try {
      const [[b]] = await pool.query(
        'SELECT BUNKER_EXPENSES, PORT_EXPENSES FROM freight_cost_estimete_master WHERE FCAID = ? LIMIT 1',
        [row.FCAID],
      );
      bunker = Number(b?.BUNKER_EXPENSES) || 0;
      portCost = Number(b?.PORT_EXPENSES) || 0;
    } catch {
      bunker = 0;
      portCost = 0;
    }
    if (filters.selVendor) {
      const chartererCode = row.FGFF_VENDORID;
      if (String(chartererCode) !== String(filters.selVendor)) continue;
    }
    records.push({
      id: row.COMID,
      srNo: records.length + 1,
      nomId: row.MESSAGE || '',
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.TRANS_DATE),
      charterer: await chartererForMaster(pool, row),
      bunkerExpenses: bunker ? bunker.toFixed(2) : '',
      portExpenses: portCost ? portCost.toFixed(2) : '',
      totalExpenses: (bunker + portCost) ? (bunker + portCost).toFixed(2) : '',
      pl: row.ACTUAL_PL ?? '',
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbPortPerformanceReport(filters = {}) {
  const pool = getPool();
  const selPort = String(filters.selPort || '').trim();
  const rows = await listFixedVoyages(pool, { selBType: filters.selBType });
  const records = [];
  for (const row of rows) {
    const ports = await portsForFca(pool, row.FCAID);
    if (selPort) {
      const [[port]] = await pool.query(
        'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
        [selPort],
      );
      const short = String(port?.PortName || '').split(' / ')[0];
      if (!ports.loadPort.includes(short) && !ports.dischargePort.includes(short)) continue;
    }
    records.push({
      id: `${row.COMID}-${records.length + 1}`,
      srNo: records.length + 1,
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.TRANS_DATE),
      loadPort: ports.loadPort,
      dischargePort: ports.dischargePort,
      cargo: await cargoName(pool, row.CARGO_ID),
      charterer: await chartererForMaster(pool, row),
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbDetailedRegisterReport(filters = {}) {
  return dbVoyageDetailsReport({
    ...filters,
    dateFrom: `01-01-${filters.selYear || new Date().getFullYear()}`,
    dateTo: `31-12-${filters.selYear || new Date().getFullYear()}`,
    selCOASpot: filters.selCOASpot || '1',
  });
}

export async function dbHireExpenseDetailsVc(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const rows = await listFixedVoyages(pool, { from, to });
  const records = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let hireDays = '';
    let hireAmt = '';
    try {
      const [[hire]] = await pool.query(
        `SELECT SUM(HIRE_DAYS) AS days, SUM(HIRE_AMT) AS amt
         FROM freight_cost_estimete_slave17 WHERE FCAID = ?`,
        [row.FCAID],
      );
      hireDays = hire?.days ?? '';
      hireAmt = hire?.amt ?? '';
    } catch {
      hireDays = '';
      hireAmt = '';
    }
    records.push({
      id: row.COMID,
      srNo: i + 1,
      nomId: row.MESSAGE || '',
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.TRANS_DATE),
      hireDays,
      hireAmt,
      pfhsAmount: '',
      lastUpdatedBy: '',
      lastUpdatedAt: '',
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

/* -------------------- Trackers -------------------- */

const TRACKER_CONFIG = {
  'ffi-tracker-vc-out': {
    table: 'ffi_track_master',
    idenColumn: 'Iden',
    idenValue: 'VC',
    fields: {
      ffispostfix: 'POST_FIX',
      lpstatuslaytime: 'LP_STATUS',
      dpstatuslaytime: 'DP_STATUS',
      ffistatus: 'FFI_STATUS',
      FFISentDate: 'FFI_SENT_DATE',
      add_rem: 'ADD_REM',
    },
  },
  'ffi-tracker-vc-in': {
    table: 'ffi_track_master',
    idenColumn: 'Iden',
    idenValue: 'VC',
    fields: {
      ffispostfix: 'POST_FIX',
      lpstatuslaytime: 'LP_STATUS',
      dpstatuslaytime: 'DP_STATUS',
      ffistatus: 'FFI_STATUS',
      FFISentDate: 'FFI_SENT_DATE',
      add_rem: 'ADD_REM',
    },
  },
  'ffi-brokerage-tracker': {
    table: 'brokerage_tracker_master',
    idenColumn: 'IDENTITY',
    idenValue: 'VC',
    fields: {
      laytimefile: 'LAYTIME_FILE',
      status: 'TRACKER_STATUS',
      add_remarks: 'REMARKS',
    },
    ensureTable: true,
  },
  'fhs-brokerage-tracker-vc': {
    table: 'fhs_track_master',
    idenColumn: 'Iden',
    idenValue: 'VC',
    fields: {
      Owners_Status: 'OWN_STAT',
      Bainbridge_Status: 'BB_STAT',
      out_amt_as_per_owner: 'OUT_AS_PER_OWN',
      out_amt_as_per_bb: 'OUT_AS_PER_BB',
      last_rem_date: 'LAST_REM_DATE',
      add_rem: 'ADD_REM',
    },
  },
  'fhs-brokerage-tracker-tc-expense': {
    table: 'fhs_track_master',
    idenColumn: 'Iden',
    idenValue: 'TC_EXPENSE',
    fields: {
      Owners_Status: 'OWN_STAT',
      Bainbridge_Status: 'BB_STAT',
      out_amt_as_per_owner: 'OUT_AS_PER_OWN',
      out_amt_as_per_bb: 'OUT_AS_PER_BB',
      last_rem_date: 'LAST_REM_DATE',
      add_rem: 'ADD_REM',
    },
    source: 'tc',
  },
  'fhs-brokerage-tracker-tc-income': {
    table: 'fhs_track_master',
    idenColumn: 'Iden',
    idenValue: 'TC_INCOME',
    fields: {
      Owners_Status: 'OWN_STAT',
      Bainbridge_Status: 'BB_STAT',
      out_amt_as_per_owner: 'OUT_AS_PER_OWN',
      out_amt_as_per_bb: 'OUT_AS_PER_BB',
      last_rem_date: 'LAST_REM_DATE',
      add_rem: 'ADD_REM',
    },
    source: 'tc',
  },
  'da-tracker-ops-post-ops': {
    table: 'da_tracker_master',
    idenColumn: 'Iden',
    idenValue: 'VC',
    fields: {
      Owners_Status: 'OWN_STAT',
      Bainbridge_Status: 'BB_STAT',
      charterers_agent: 'charterers_agent',
      agency_fees: 'agency_fees',
    },
  },
};

async function ensureBrokerageTable(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS brokerage_tracker_master (
      ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      COMID INT NOT NULL,
      IDENTITY VARCHAR(32) DEFAULT 'VC',
      LAYTIME_FILE VARCHAR(255) DEFAULT NULL,
      TRACKER_STATUS VARCHAR(255) DEFAULT NULL,
      REMARKS TEXT,
      UNIQUE KEY uniq_comid_identity (COMID, IDENTITY)
    )`,
  );
}

async function listTrackerBaseRows(pool, filters = {}, { source = 'vc' } = {}) {
  const year = filters.selYear || String(new Date().getFullYear());
  if (source === 'tc') {
    const typeFilter = estimateTypeFilter(filters.selBType, 'm');
    const [rows] = await pool.query(
      `SELECT c.COMID, c.MESSAGE, m.TC_NO AS VOYAGE_NO, m.CP_DATE1 AS TRANS_DATE,
              v.VESSEL_NAME, vend.NAME AS CHARTERER_NAME
       FROM chartering_estimate_tc_compare c
       INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
       LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       LEFT JOIN vendor_master vend ON vend.CODE = m.SEL_CHARTERER
       WHERE c.MODULEID = ?
         AND c.MCOMPANYID = ?
         AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
         AND m.FIXED = 1
         AND YEAR(COALESCE(m.UPDATE_ON_DATE, m.TC_DATE, m.CP_DATE1)) = ?
         ${typeFilter.sql}
       GROUP BY c.COMID
       ORDER BY m.UPDATE_ON_DATE DESC`,
      [MODULE_ID, COMPANY_ID, year, ...typeFilter.params],
    );
    return rows;
  }
  return listFixedVoyages(pool, {
    year,
    selBType: filters.selBType,
    selCOASpot: '1',
  });
}

export async function dbOpsTrackerReport(reportId, filters = {}) {
  const config = TRACKER_CONFIG[reportId];
  if (!config) {
    const error = new Error(`Unknown tracker: ${reportId}`);
    error.status = 404;
    throw error;
  }
  const pool = getPool();
  if (config.ensureTable) {
    try {
      await ensureBrokerageTable(pool);
    } catch {
      // ignore
    }
  }

  const baseRows = await listTrackerBaseRows(pool, filters, { source: config.source || 'vc' });
  let trackMap = new Map();
  try {
    const [tracks] = await pool.query(
      `SELECT * FROM ${config.table} WHERE ${config.idenColumn} = ?`,
      [config.idenValue],
    );
    trackMap = new Map(tracks.map((t) => [String(t.COMID), t]));
  } catch {
    trackMap = new Map();
  }

  const fieldEntries = Object.entries(config.fields);
  const records = [];
  for (let i = 0; i < baseRows.length; i += 1) {
    const row = baseRows[i];
    const track = trackMap.get(String(row.COMID)) || {};
    const record = {
      id: row.COMID,
      comId: row.COMID,
      srNo: i + 1,
      nomId: row.MESSAGE || '',
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.TRANS_DATE || row.CP_DATE),
      charterer: row.CHARTERER_NAME
        || (config.source === 'tc' ? '' : await chartererForMaster(pool, row)),
      editable: {},
    };
    fieldEntries.forEach(([iden, column]) => {
      let value = track[column] ?? '';
      if (column.toLowerCase().includes('date') && value) value = safeDate(value) || value;
      record.editable[iden] = value == null ? '' : String(value);
      record[iden] = record.editable[iden];
    });
    records.push(record);
  }

  return {
    records,
    recordsTotal: records.length,
    trackerFields: fieldEntries.map(([iden]) => iden),
    isMgmtUser: isMgmtUser(),
  };
}

export async function dbUpdateOpsTrackerField(reportId, { comId, iden, value }) {
  const config = TRACKER_CONFIG[reportId];
  if (!config) {
    const error = new Error(`Unknown tracker: ${reportId}`);
    error.status = 404;
    throw error;
  }
  const column = config.fields[iden];
  if (!column) {
    const error = new Error(`Unknown tracker field: ${iden}`);
    error.status = 400;
    throw error;
  }
  const pool = getPool();
  if (config.ensureTable) await ensureBrokerageTable(pool);

  let writeValue = value ?? '';
  if (String(iden).toLowerCase().includes('date') || column.toLowerCase().includes('date')) {
    const iso = parsePeriodDate(writeValue);
    if (iso) writeValue = iso;
  }

  const [[existing]] = await pool.query(
    `SELECT * FROM ${config.table}
     WHERE COMID = ? AND ${config.idenColumn} = ?
     LIMIT 1`,
    [comId, config.idenValue],
  );

  if (!existing) {
    await pool.query(
      `INSERT INTO ${config.table} (COMID, ${config.idenColumn}, ${column})
       VALUES (?, ?, ?)`,
      [comId, config.idenValue, writeValue],
    );
  } else {
    await pool.query(
      `UPDATE ${config.table}
       SET ${column} = ?, ${config.idenColumn} = ?
       WHERE COMID = ?`,
      [writeValue, config.idenValue, comId],
    );
  }

  return { ok: true, comId, iden, value: writeValue };
}

export { TRACKER_CONFIG };
