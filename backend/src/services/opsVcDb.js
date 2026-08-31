import { appContext, compareSheetsEnabled, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const BUSINESS_TYPE_NAMES = {
  1: 'Gas',
  2: 'Tanker',
  3: 'Dry Cargo',
};

// PHP getCountryName() on CHARTERING_PIC (team id, not a login). Zafira stores 7.
const CHARTERING_TEAM_NAMES = {
  1: 'India',
  2: 'Fareast',
  3: 'Indian Ocean',
  4: 'South East Asia',
  5: 'HANDY & STEEL',
  6: 'ATLANTIC',
  7: 'Zafira',
  8: 'S.E.Asia(Pacific)',
  9: 'BH Cape Holdings',
};

function charteringTeamName(id) {
  if (id == null || String(id).trim() === '' || String(id) === '0') return '';
  return CHARTERING_TEAM_NAMES[Number(id)] || '';
}

let sheetLayoutTableReady = false;

async function ensureSheetLayoutTable(pool) {
  if (sheetLayoutTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ops_vc_cost_sheet_layout (
      COMID INT NOT NULL,
      COST_SHEETID INT NOT NULL,
      PINNED TINYINT(1) NOT NULL DEFAULT 0,
      SORT_ORDER INT NOT NULL DEFAULT 0,
      PRIMARY KEY (COMID, COST_SHEETID),
      INDEX idx_comid_order (COMID, SORT_ORDER)
    )
  `);
  sheetLayoutTableReady = true;
}

export function applyCostSheetLayout(sheets, layoutRows = []) {
  const prefs = new Map(
    (layoutRows || []).map((row) => [String(row.COST_SHEETID ?? row.costSheetId ?? row.id), row]),
  );
  const withMeta = (sheets || []).map((sheet) => {
    const pref = prefs.get(String(sheet.id));
    return {
      ...sheet,
      pinned: Boolean(Number(pref?.PINNED ?? pref?.pinned ?? 0)),
      sortOrder: pref?.SORT_ORDER ?? pref?.sortOrder ?? null,
    };
  });
  withMeta.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const ao = a.sortOrder;
    const bo = b.sortOrder;
    if (ao != null && bo != null && Number(ao) !== Number(bo)) return Number(ao) - Number(bo);
    return Number(b.id) - Number(a.id);
  });
  return withMeta;
}

export async function loadSheetLayouts(pool, comIds) {
  await ensureSheetLayoutTable(pool);
  const ids = [...new Set((comIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
  if (!ids.length) return new Map();
  const [rows] = await pool.query(
    `SELECT COMID, COST_SHEETID, PINNED, SORT_ORDER
     FROM ops_vc_cost_sheet_layout
     WHERE COMID IN (?)`,
    [ids],
  );
  const map = new Map();
  for (const row of rows) {
    const key = String(row.COMID);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

async function loginContactName(pool, loginId) {
  if (loginId == null || String(loginId).trim() === '' || String(loginId) === '0') return '';
  const [[person]] = await pool.query(
    `SELECT COALESCE(NULLIF(CONTACT_PERSON, ''), USERNAME) AS NAME
     FROM login
     WHERE LOGINID = ?
     LIMIT 1`,
    [loginId],
  );
  return person?.NAME || '';
}

async function firstLoginName(pool, ...loginIds) {
  const seen = new Set();
  for (const loginId of loginIds) {
    const key = loginId == null ? '' : String(loginId).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const name = await loginContactName(pool, loginId);
    if (name) return name;
  }
  return '';
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || value.getUTCFullYear() < 1971) return '';
    // mysql DATETIME is timezone-naive; mysql2 exposes it as a UTC Date.
    return `${pad2(value.getUTCDate())}-${pad2(value.getUTCMonth() + 1)}-${value.getUTCFullYear()} ${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
  }
  const str = String(value).trim();
  if (!str || str.startsWith('0000-00-00') || str.startsWith('1970-01-01')) return '';
  if (/^\d{1,2}-\d{1,2}-\d{4}/.test(str)) {
    return str.replace(/:\d{2}$/, '').slice(0, 16);
  }
  const date = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1971) return '';
  return `${pad2(date.getUTCDate())}-${pad2(date.getUTCMonth() + 1)}-${date.getUTCFullYear()} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function firstDateTime(...values) {
  for (const value of values) {
    const formatted = formatDateTime(value);
    if (formatted) return formatted;
  }
  return '';
}

async function getPortShortName(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
    [portId],
  );
  return String(row?.PortName || '').split(' / ')[0] || '';
}

async function resolveCargoNames(pool, cargoId) {
  if (!cargoId) return '';
  const ids = String(cargoId)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return '';
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT MATERIAL_TYPE FROM cargo_master WHERE MATERIALID IN (${placeholders})`,
    ids,
  );
  return rows.map((row) => row.MATERIAL_TYPE).filter(Boolean).join(', ');
}

async function resolveCharterers(pool, sheet) {
  if (!sheet) return '';
  if (Number(sheet.TANKER_RADIO_SINGLE_DIS) === 2) {
    const [rows] = await pool.query(
      `SELECT v.NAME AS NAME
       FROM freight_cost_estimete_slave10 s
       LEFT JOIN vendor_master v ON v.CODE = s.SHIPPER_CHARTER
       WHERE s.FCAID = ?`,
      [sheet.FCAID],
    );
    return rows.map((row) => row.NAME).filter(Boolean).join(', ');
  }

  if (Number(sheet.ESTIMATE_TYPE) === 2) {
    if (Number(sheet.QTY_TYPE_RADIO) === 1 && sheet.LUMP_VENDOR_NAME) {
      return sheet.LUMP_VENDOR_NAME;
    }
    const [rows] = await pool.query(
      `SELECT v.NAME AS NAME
       FROM freight_cost_estimete_slave12 s
       LEFT JOIN vendor_master v ON v.CODE = s.CUSTOMER
       WHERE s.FCAID = ?`,
      [sheet.FCAID],
    );
    return rows.map((row) => row.NAME).filter(Boolean).join(', ');
  }

  if (Number(sheet.QTY_TYPE_RADIO) === 1) {
    return sheet.FGFF_VENDOR_NAME || '';
  }
  const [rows] = await pool.query(
    `SELECT v.NAME AS NAME
     FROM freight_cost_estimete_slave7 s
     LEFT JOIN vendor_master v ON v.CODE = s.QTY_VENDORID
     WHERE s.FCAID = ?`,
    [sheet.FCAID],
  );
  return rows.map((row) => row.NAME).filter(Boolean).join(', ');
}

async function resolvePorts(pool, fcaId) {
  if (!fcaId) return '';
  const [legs] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY, PASSAGE_TYPE
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?`,
    [fcaId],
  );
  const ports = [];
  for (const leg of legs) {
    if (Number(leg.PASSAGE_TYPE) !== 2) continue;
    if (Number(leg.LOAD_PORT_QTY) > 0) {
      const name = await getPortShortName(pool, leg.FROM_PORT);
      if (name) ports.push(`LP - ${name}`);
    }
    if (Number(leg.DISC_PORT_QTY) > 0) {
      const name = await getPortShortName(pool, leg.TO_PORT);
      if (name) ports.push(`DP - ${name}`);
    }
  }
  return ports.join('\n');
}

export async function dbListOpsVcYears() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT DISTINCT YEAR(ADD_ON_DATE) AS year
     FROM freight_cost_estimete_master
     WHERE ADD_ON_DATE IS NOT NULL AND YEAR(ADD_ON_DATE) > 0
     ORDER BY year DESC`,
  );
  const years = rows.map((row) => String(row.year)).filter(Boolean);
  const current = String(new Date().getFullYear());
  if (!years.includes(current)) years.unshift(current);
  return years.map((year) => ({ id: year, name: year }));
}

export async function dbListOpsVcOperators() {
  const pool = getPool();
  // PHP getUserListForOp(): all internal_user / mgmt_user (no STATUS filter).
  const [rows] = await pool.query(
    `SELECT LOGINID AS id, CONTACT_PERSON AS name
     FROM login
     WHERE USER_TYPE IN ('internal_user', 'mgmt_user')
     ORDER BY CONTACT_PERSON`,
  );
  return (rows || []).map((row) => ({
    id: String(row.id),
    name: row.name || String(row.id),
  }));
}

export async function dbListInOpsAtGlance(params = {}) {
  return dbListOpsVcGlance({ ...params, status: 1 });
}

export async function dbListPostOpsAtGlance(params = {}) {
  return dbListOpsVcGlance({ ...params, status: 2 });
}

export async function dbListHistoryAtGlance(params = {}) {
  return dbListOpsVcGlance({ ...params, status: [3, 4], requireYear: false, canEditOperator: false });
}

async function dbListOpsVcGlance({
  selBType = '2',
  selYear = String(new Date().getFullYear()),
  search = '',
  page = 1,
  pageSize = 50,
  status = 1,
  requireYear = true,
  canEditOperator: canEditOperatorOverride,
} = {}) {
  const pool = getPool();
  const businessType = String(selBType || '2');
  const year = String(selYear || new Date().getFullYear());
  const statusList = Array.isArray(status)
    ? status.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [Number(status) === 2 ? 2 : Number(status) === 3 ? 3 : Number(status) === 4 ? 4 : 1];
  const safeStatuses = statusList.length ? statusList : [1];
  const isHistory = safeStatuses.includes(3) || safeStatuses.includes(4);
  // PHP in_ops_at_glance.php: dropdown only when $_SESSION['iutype'] == 'mgmt_user'
  const allowOperatorEdit = canEditOperatorOverride != null
    ? Boolean(canEditOperatorOverride)
    : (!isHistory && isMgmtUser());
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(200, Number(pageSize) || 50));
  const offset = (safePage - 1) * safeSize;

  const conditions = [
    'c.MODULEID = ?',
    'c.MCOMPANYID = ?',
    "c.FINAL_ID != ''",
    'm.FIXED = 1',
    `c.STATUS IN (${safeStatuses.map(() => '?').join(',')})`,
  ];
  const params = [MODULE_ID, COMPANY_ID, ...safeStatuses];

  if (requireYear && year) {
    conditions.push('YEAR(m.ADD_ON_DATE) = ?');
    params.push(year);
  }

  conditions.push('m.ESTIMATE_TYPE = ?', 'c.COAAID IS NULL');
  params.push(businessType);

  if (search) {
    conditions.push(`(
      c.MESSAGE LIKE ?
      OR m.VOYAGE_NO LIKE ?
      OR vim.VESSEL_NAME LIKE ?
      OR op.CONTACT_PERSON LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.join(' AND ');
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN login op ON op.LOGINID = c.OPERATOR
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
        c.COMID,
        c.FCAID,
        c.MESSAGE,
        c.STATUS AS OPS_STATUS,
        c.OPERATOR AS OPERATOR_ID,
        op.CONTACT_PERSON AS OPERATOR_NAME,
        m.VESSEL_IMO_ID,
        m.PERIODID,
        m.SEL_BUSI_TYPE,
        m.ESTIMATE_TYPE,
        m.FINAL_DATETIME,
        vim.VESSEL_NAME,
        vim.IMO_NO,
        latest.VOYAGE_NO,
        latest.VESSEL_TYPE,
        latest.CARGO_ID,
        latest.TRANS_DATE,
        latest.CHARTERING_PIC,
        latest.L_UPDATED_BY AS LATEST_UPDATED_BY,
        latest.L_UP_TIME AS LATEST_UP_TIME,
        latest.ADDED_BY AS LATEST_ADDED_BY,
        latest.ADD_ON_DATE AS LATEST_ADD_ON_DATE,
        latest.ADDED_NAME AS LATEST_ADDED_NAME,
        m.CHARTERING_PIC AS MASTER_CHARTERING_PIC,
        m.L_UPDATED_BY AS MASTER_UPDATED_BY,
        m.L_UP_TIME AS MASTER_UP_TIME,
        m.ADDED_BY AS MASTER_ADDED_BY,
        m.ADD_ON_DATE AS MASTER_ADD_ON_DATE,
        updated.L_UP_TIME,
        updated.L_UPDATED_BY,
        updated.LUPNAME,
        updated.ADDED_BY,
        updated.ADD_ON_DATE,
        updated.ADDED_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN login op ON op.LOGINID = c.OPERATOR
     LEFT JOIN (
       SELECT t.COMID, t.VOYAGE_NO, t.VESSEL_TYPE, t.CARGO_ID, t.TRANS_DATE,
              t.CHARTERING_PIC, t.L_UPDATED_BY, t.L_UP_TIME, t.ADDED_BY, t.ADD_ON_DATE,
              la.CONTACT_PERSON AS ADDED_NAME
       FROM freight_cost_estimete_master t
       LEFT JOIN login la ON la.LOGINID = t.ADDED_BY
       INNER JOIN (
         SELECT COMID, MAX(FCAID) AS MAX_FCAID
         FROM freight_cost_estimete_master
         GROUP BY COMID
       ) x ON x.MAX_FCAID = t.FCAID AND x.COMID = t.COMID
     ) latest ON latest.COMID = c.COMID
     LEFT JOIN (
       SELECT t.COMID, t.L_UP_TIME, t.L_UPDATED_BY, t.ADDED_BY, t.ADD_ON_DATE,
              l.CONTACT_PERSON AS LUPNAME, la.CONTACT_PERSON AS ADDED_NAME
       FROM freight_cost_estimete_master t
       LEFT JOIN login l ON l.LOGINID = t.L_UPDATED_BY
       LEFT JOIN login la ON la.LOGINID = t.ADDED_BY
       INNER JOIN (
         SELECT COMID, MAX(FCAID) AS MAX_FCAID
         FROM freight_cost_estimete_master
         WHERE SHEET_NO IS NOT NULL
         GROUP BY COMID
       ) x ON x.MAX_FCAID = t.FCAID AND x.COMID = t.COMID
     ) updated ON updated.COMID = c.COMID
     WHERE ${where}
     ORDER BY DATE(m.FINAL_DATETIME) DESC, c.COMID DESC
     LIMIT ? OFFSET ?`,
    [...params, safeSize, offset],
  );

  const records = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const [[sheet]] = await pool.query(
      `SELECT FCAID, TANKER_RADIO_SINGLE_DIS, QTY_TYPE_RADIO, ESTIMATE_TYPE,
              CHARTERING_PIC, L_UPDATED_BY, L_UP_TIME, ADDED_BY, ADD_ON_DATE,
              (SELECT COALESCE(NULLIF(CONTACT_PERSON, ''), USERNAME) FROM login
                WHERE login.LOGINID = freight_cost_estimete_master.L_UPDATED_BY
                LIMIT 1) AS LUPNAME,
              (SELECT COALESCE(NULLIF(CONTACT_PERSON, ''), USERNAME) FROM login
                WHERE login.LOGINID = freight_cost_estimete_master.ADDED_BY
                LIMIT 1) AS ADDED_NAME,
              (SELECT NAME FROM vendor_master WHERE vendor_master.CODE = freight_cost_estimete_master.FGFF_VENDORID) AS FGFF_VENDOR_NAME,
              (SELECT NAME FROM vendor_master WHERE vendor_master.CODE = freight_cost_estimete_master.LUMP_VENDOR) AS LUMP_VENDOR_NAME
       FROM freight_cost_estimete_master
       WHERE COMID = ? AND SHEET_NO IS NOT NULL
       ORDER BY FCAID DESC
       LIMIT 1`,
      [row.COMID],
    );

    const sheetFcaId = sheet?.FCAID || row.FCAID;
    // PHP Voyage Financials links → cost_sheet_tci / updatecost_sheet_tci
    // getTCICostSheetID: FCAID where COMID + SHEET_NO = COST_SHEETID
    const [costSheets] = await pool.query(
      `SELECT m.COST_SHEETID, m.SHEET_NAME, e.FCAID, e.ESTIMATE_TYPE
       FROM cost_sheet_name_master m
       LEFT JOIN freight_cost_estimete_master e
         ON e.COMID = m.COMID AND e.SHEET_NO = m.COST_SHEETID
       WHERE m.COMID = ? AND m.MODULEID = ? AND m.MCOMPANYID = ?
       ORDER BY m.COST_SHEETID`,
      [row.COMID, MODULE_ID, COMPANY_ID],
    );

    let paymentNotReceived = false;
    let paymentNotPaid = false;
    try {
      const [[freight]] = await pool.query(
        `SELECT COUNT(*) AS total FROM freight_invoice_master
         WHERE COMID = ? AND (P_AMT IS NULL OR P_AMT = 0)`,
        [row.COMID],
      );
      paymentNotReceived = Number(freight?.total || 0) > 0;
    } catch {
      paymentNotReceived = false;
    }
    try {
      const [[hire]] = await pool.query(
        `SELECT COUNT(*) AS total FROM invoice_hire_master
         WHERE COMID = ? AND (P_AMT IS NULL OR P_AMT = 0)`,
        [row.COMID],
      );
      paymentNotPaid = Number(hire?.total || 0) > 0;
    } catch {
      paymentNotPaid = false;
    }

    // PHP: allow Add ("A") when latest estimate FINAL_STATUS=1 and
    // (no sheets yet OR latest named sheet already has an estimate row).
    const [[latestEst]] = await pool.query(
      `SELECT FCAID, FINAL_STATUS
       FROM freight_cost_estimete_master
       WHERE COMID = ? AND MODULEID = ?
       ORDER BY FCAID DESC
       LIMIT 1`,
      [row.COMID, MODULE_ID],
    );
    const latestSheet = costSheets.length ? costSheets[costSheets.length - 1] : null;
    const latestSheetHasEstimate = !latestSheet || latestSheet.FCAID != null;
    const canAddCostSheet = Number(latestEst?.FINAL_STATUS) === 1 && latestSheetHasEstimate;

    const rowStatus = Number(row.OPS_STATUS || safeStatuses[0]);
    records.push({
      index: offset + index + 1,
      comId: row.COMID,
      fcaId: row.FCAID,
      message: row.MESSAGE ?? '',
      voyageNo: row.VOYAGE_NO ?? '',
      businessType: BUSINESS_TYPE_NAMES[Number(row.ESTIMATE_TYPE)] || '',
      materialName: await resolveCargoNames(pool, row.CARGO_ID),
      vesselName: row.VESSEL_NAME ?? '',
      vesselType: row.VESSEL_TYPE ?? '',
      vesselImoNo: row.IMO_NO ?? '',
      isPeriod: Number(row.PERIODID) > 0,
      ports: await resolvePorts(pool, sheetFcaId),
      charterer: await resolveCharterers(pool, sheet),
      cpDate: formatDateDMY(row.TRANS_DATE),
      ownBusiness: BUSINESS_TYPE_NAMES[Number(row.SEL_BUSI_TYPE)] || '',
      costSheets: costSheets.map((sheetRow) => ({
        id: sheetRow.COST_SHEETID,
        name: sheetRow.SHEET_NAME || `Sheet ${sheetRow.COST_SHEETID}`,
        fcaId: sheetRow.FCAID || null,
        estimateType: sheetRow.ESTIMATE_TYPE != null ? String(sheetRow.ESTIMATE_TYPE) : '',
      })),
      operatorId: row.OPERATOR_ID != null ? String(row.OPERATOR_ID) : '',
      operatorName: row.OPERATOR_NAME ?? '',
      charteringTeam: charteringTeamName(
        sheet?.CHARTERING_PIC ?? row.CHARTERING_PIC ?? row.MASTER_CHARTERING_PIC,
      ),
      lastUpdatedBy: sheet?.LUPNAME
        || row.LUPNAME
        || sheet?.ADDED_NAME
        || row.ADDED_NAME
        || row.LATEST_ADDED_NAME
        || await firstLoginName(
          pool,
          sheet?.L_UPDATED_BY,
          row.L_UPDATED_BY,
          row.LATEST_UPDATED_BY,
          row.MASTER_UPDATED_BY,
          sheet?.ADDED_BY,
          row.ADDED_BY,
          row.LATEST_ADDED_BY,
          row.MASTER_ADDED_BY,
        ),
      lastUpdatedAt: firstDateTime(
        sheet?.L_UP_TIME,
        row.L_UP_TIME,
        row.LATEST_UP_TIME,
        row.MASTER_UP_TIME,
        sheet?.ADD_ON_DATE,
        row.ADD_ON_DATE,
        row.LATEST_ADD_ON_DATE,
        row.MASTER_ADD_ON_DATE,
      ),
      paymentNotReceived,
      paymentNotPaid,
      status: rowStatus,
      statusLabel: rowStatus === 3 ? 'Deactivated' : (rowStatus === 4 || isHistory ? 'History' : ''),
      canDeactivate: !isHistory,
      canMoveToPostOps: rowStatus === 1,
      canMoveToHistory: rowStatus === 2,
      canAddCostSheet: !isHistory && canAddCostSheet,
      canEditOperator: allowOperatorEdit,
      pageContext: isHistory ? 3 : (rowStatus === 2 ? 2 : 1),
    });
  }

  try {
    const layoutByComId = await loadSheetLayouts(pool, records.map((record) => record.comId));
    records.forEach((record) => {
      record.costSheets = applyCostSheetLayout(record.costSheets, layoutByComId.get(String(record.comId)) || []);
    });
  } catch {
    records.forEach((record) => {
      record.costSheets = applyCostSheetLayout(record.costSheets, []);
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page: safePage,
    pageSize: safeSize,
    selBType: businessType,
    selYear: requireYear ? year : '',
    status: isHistory ? 'history' : safeStatuses[0],
    canEditOperator: allowOperatorEdit,
    canCompareSheets: compareSheetsEnabled(),
  };
}

export async function dbUpdateOpsVcOperator(comId, operatorId) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE freight_cost_estimate_compare
     SET OPERATOR = ?
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       AND STATUS IN (1, 2) AND COAAID IS NULL`,
    [operatorId || null, comId, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) {
    const error = new Error('Ops voyage not found.');
    error.status = 404;
    throw error;
  }
  return { msg: 0 };
}

export async function dbMoveOpsVcToPostOps(comId) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE freight_cost_estimate_compare
     SET STATUS = 2
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 1 AND COAAID IS NULL`,
    [comId, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) {
    const error = new Error('Ops voyage not found or already in Post Ops.');
    error.status = 404;
    throw error;
  }
  return { msg: 6 };
}

export async function dbMoveOpsVcToHistory(comId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE freight_cost_estimate_compare
       SET STATUS = 4
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 2 AND COAAID IS NULL`,
      [comId, MODULE_ID, COMPANY_ID],
    );
    if (!result.affectedRows) {
      const error = new Error('Post Ops voyage not found or already in History.');
      error.status = 404;
      throw error;
    }
    await connection.query(
      `UPDATE generate_agency_letter
       SET STATUS = 3
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 2`,
      [comId, MODULE_ID, COMPANY_ID],
    ).catch(() => {});
    await connection.commit();
    return { msg: 3 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbDeactivateOpsVcEntry(comId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE freight_cost_estimate_compare
       SET STATUS = 3
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND COAAID IS NULL`,
      [comId, MODULE_ID, COMPANY_ID],
    );
    if (!result.affectedRows) {
      const error = new Error('Ops voyage not found.');
      error.status = 404;
      throw error;
    }
    await connection.query(
      `UPDATE generate_agency_letter
       SET STATUS = 3
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 2`,
      [comId, MODULE_ID, COMPANY_ID],
    ).catch(() => {});
    await connection.commit();
    return { msg: 6 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function parseDmyToSqlDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function dbListYearUpdation({
  search = '',
  page = 1,
  pageSize = 50,
} = {}) {
  const pool = getPool();
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(200, Number(pageSize) || 50));
  const offset = (safePage - 1) * safeSize;

  const conditions = [
    'm.SHEET_NO IS NOT NULL',
    "NULLIF(TRIM(m.VOYAGE_NO), '') IS NOT NULL",
  ];
  const params = [];

  if (MODULE_ID) {
    conditions.push('m.MODULEID = ?');
    params.push(MODULE_ID);
  }

  if (search) {
    conditions.push(`(
      m.VOYAGE_NO LIKE ?
      OR vim.VESSEL_NAME LIKE ?
      OR CAST(m.COMID AS CHAR) LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = conditions.join(' AND ');

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM (
       SELECT m.VOYAGE_NO
       FROM freight_cost_estimete_master m
       LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       WHERE ${where}
       GROUP BY m.VOYAGE_NO
     ) x`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
        m.FCAID,
        m.COMID,
        m.VOYAGE_NO,
        m.VESSEL_IMO_ID,
        m.TRANS_DATE,
        m.ADD_ON_DATE,
        vim.VESSEL_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     INNER JOIN (
       SELECT VOYAGE_NO, MAX(FCAID) AS MAX_FCAID
       FROM freight_cost_estimete_master
       WHERE SHEET_NO IS NOT NULL
         AND NULLIF(TRIM(VOYAGE_NO), '') IS NOT NULL
         ${MODULE_ID ? 'AND MODULEID = ?' : ''}
       GROUP BY VOYAGE_NO
     ) latest ON latest.MAX_FCAID = m.FCAID
     ${search ? `WHERE (
       m.VOYAGE_NO LIKE ?
       OR vim.VESSEL_NAME LIKE ?
       OR CAST(m.COMID AS CHAR) LIKE ?
     )` : ''}
     ORDER BY m.FCAID DESC
     LIMIT ? OFFSET ?`,
    [
      ...(MODULE_ID ? [MODULE_ID] : []),
      ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []),
      safeSize,
      offset,
    ],
  );

  return {
    records: rows.map((row, index) => {
      let addOnDate = formatDateDMY(row.ADD_ON_DATE);
      if (addOnDate === '01-01-1970') addOnDate = '';
      let cpDate = formatDateDMY(row.TRANS_DATE);
      if (cpDate === '01-01-1970' || cpDate === '00-00-0000') cpDate = '';
      return {
        index: offset + index + 1,
        fcaId: row.FCAID,
        comId: row.COMID,
        voyageNo: row.VOYAGE_NO ?? '',
        vesselName: row.VESSEL_NAME ?? '',
        cpDate,
        date: addOnDate,
        addOnDate,
      };
    }),
    recordsTotal: Number(countRow?.total || 0),
    page: safePage,
    pageSize: safeSize,
  };
}

export async function dbUpdateYearAddOnDate(comId, addOnDate) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }
  const sqlDate = parseDmyToSqlDate(addOnDate);
  if (!sqlDate) {
    const error = new Error('Please enter a valid Add On Date (dd-mm-yyyy).');
    error.status = 400;
    throw error;
  }

  const [result] = await pool.query(
    `UPDATE freight_cost_estimete_master
     SET ADD_ON_DATE = ?
     WHERE COMID = ?`,
    [sqlDate, comId],
  );
  if (!result.affectedRows) {
    const error = new Error('Voyage not found.');
    error.status = 404;
    throw error;
  }
  return {
    msg: 0,
    comId: String(comId),
    addOnDate: formatDateDMY(sqlDate),
  };
}

function blankDate(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes('1970-01-01')) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (
    date.getFullYear() === 1970
    && date.getMonth() === 0
    && date.getDate() === 1
    && date.getHours() === 0
    && date.getMinutes() === 0
  ) {
    return '';
  }
  return formatDateTime(value);
}

function formatLatLong(dir, deg, min) {
  return [dir, deg, min].filter((part) => part != null && String(part).trim() !== '').join(' ');
}

function formatBunkerLines(rows = []) {
  return rows
    .map((row) => {
      const bunker = row.BUNKER || '';
      const qty = row.QUANTITY != null ? `${row.QUANTITY} MT` : '';
      return [bunker, qty].filter(Boolean).join(' - ');
    })
    .filter(Boolean)
    .join('\n');
}

async function loadBunkerByIdentity(pool, table, idColumn, id, identities) {
  const placeholders = identities.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT BUNKER, QUANTITY FROM ${table}
     WHERE ${idColumn} = ? AND IDENTITY IN (${placeholders})`,
    [id, ...identities],
  );
  return formatBunkerLines(rows);
}

async function loadDowntime(pool, slave2Table, slave3Table, idColumn, id, slaveIdColumn) {
  const [rows] = await pool.query(`SELECT * FROM ${slave2Table} WHERE ${idColumn} = ?`, [id]);
  const lines = [];
  for (const row of rows) {
    const [bunkers] = await pool.query(
      `SELECT BUNKER, QUANTITY FROM ${slave3Table}
       WHERE ${idColumn} = ? AND ${slaveIdColumn} = ?`,
      [id, row[slaveIdColumn]],
    );
    lines.push(
      `${row.DOWNTIME_TYPE || ''} - ${blankDate(row.FROM_LT_DATETIME)} To ${blankDate(row.TO_LT_DATETIME)} Bunker Consumed :\n${formatBunkerLines(bunkers)}`,
    );
  }
  return lines.join('\n');
}

function emptyReportFields(overrides = {}) {
  return {
    reportTitle: '',
    vesselType: '',
    messageNo: '',
    vesselName: '',
    voyageNo: '',
    charterer: '',
    reportingLt: '',
    timeZone: '',
    reportingUtc: '',
    draftFore: '',
    draftAft: '',
    depPort: '',
    portOfArrival: '',
    portVisitReasons: '',
    nextPort: '',
    etaNextPort: '',
    vesselCondition: '',
    weatherDirection: '',
    windForce: '',
    seaState: '',
    swellState: '',
    swellDirection: '',
    latitude: '',
    longitude: '',
    orderedSpeed: '',
    distToGo: '',
    totalVoyageDist: '',
    observedDist: '',
    noonHdg: '',
    stoppage: '',
    effectiveSteaming: '',
    observedSpeed: '',
    downtime: '',
    conspMain: '',
    conspTankCleaning: '',
    conspGasFreeing: '',
    conspOther: '',
    totalRob: '',
    totalConsp: '',
    bunkerSupplied: '',
    reportType: '',
    sortAt: 0,
    ...overrides,
  };
}

export async function dbListVoyageReports({ vesselImoNo = '', comId = '' } = {}) {
  const imo = String(vesselImoNo || '').trim();
  if (!imo) {
    const error = new Error('Vessel IMO is required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const records = [];

  let meta = null;
  if (comId) {
    try {
      const [metaRows] = await pool.query(
        `SELECT m.ADD_ON_DATE, m.VOYAGE_NO, vim.VESSEL_NAME, vim.IMO_NO
         FROM freight_cost_estimate_compare c
         INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
         LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
         WHERE c.COMID = ?
         ORDER BY m.FCAID DESC
         LIMIT 1`,
        [comId],
      );
      meta = metaRows?.[0] || null;
    } catch {
      meta = null;
    }
  }

  const [departures] = await pool.query(
    `SELECT * FROM sa_departure_master WHERE IMO_NO = ? ORDER BY REPORTING_DATETIME_LT DESC`,
    [imo],
  );
  for (const row of departures) {
    const [bunkers] = await pool.query(
      `SELECT BUNKER, QUANTITY FROM sa_departure_slave WHERE DEPARTUREID = ?`,
      [row.DEPARTUREID],
    );
    records.push(emptyReportFields({
      reportType: 'DEPARTURE',
      reportTitle: row.REPORT_TITLE ?? '',
      vesselType: row.VESSEL_TYPE ?? '',
      messageNo: row.MESSAGE_NO ?? '',
      vesselName: row.VESSEL_NAME ?? '',
      voyageNo: row.VOYAGE_NO ?? '',
      charterer: row.CHARTERER ?? '',
      reportingLt: blankDate(row.REPORTING_DATETIME_LT),
      timeZone: `${row.PREFIX || ''} ${row.TIME_RELATIVE_UTC || ''}`.trim(),
      reportingUtc: blankDate(row.REPORTING_DATETIME_UTC),
      draftFore: row.DRAFT_FORE ?? '',
      draftAft: row.DRAFT_AFT ?? '',
      depPort: row.PORT_DEPARTED_FROM ?? '',
      nextPort: row.NEXT_PORT ?? '',
      etaNextPort: blankDate(row.ETA_NEXT_PORT),
      vesselCondition: row.VESSEL_CONDITION ?? '',
      weatherDirection: row.WEATHER_DIRECTION ?? '',
      windForce: row.WIND_FORCE ?? '',
      seaState: row.SEA_STATE ?? '',
      swellState: row.SWEEL_STATE ?? '',
      swellDirection: row.SWELL_DIRN ?? '',
      latitude: formatLatLong(row.LATTITUDE, row.LAT_DEG, row.LAT_MIN),
      longitude: formatLatLong(row.LONGITUDE, row.LONG_DEG, row.LONG_MIN),
      orderedSpeed: row.SPEED_TO_NEXT_PORT ?? '',
      distToGo: row.DISTANCE_TO_GO ?? '',
      totalRob: formatBunkerLines(bunkers),
      sortAt: new Date(row.REPORTING_DATETIME_LT || 0).getTime() || 0,
    }));
  }

  const [noons] = await pool.query(
    `SELECT * FROM sa_noon_master WHERE IMO_NO = ? ORDER BY REPORTING_DATETIME_LT DESC`,
    [imo],
  );
  for (const row of noons) {
    records.push(emptyReportFields({
      reportType: 'NOON',
      reportTitle: row.REPORT_TITLE ?? '',
      vesselType: row.VESSEL_TYPE ?? '',
      messageNo: row.MESSAGE_NO ?? '',
      vesselName: row.VESSEL_NAME ?? '',
      voyageNo: row.VOYAGE_NO ?? '',
      charterer: row.CHARTERER ?? '',
      reportingLt: blankDate(row.REPORTING_DATETIME_LT),
      timeZone: `${row.PREFIX || ''} ${row.TIME_RELATIVE_UTC || ''}`.trim(),
      reportingUtc: blankDate(row.REPORTING_DATETIME_UTC),
      draftFore: row.DRAFT_FORE ?? '',
      draftAft: row.DRAFT_AFT ?? '',
      nextPort: row.NEXT_PORT ?? '',
      etaNextPort: blankDate(row.ETA_NEXT_PORT),
      vesselCondition: row.VESSEL_CONDITION ?? '',
      weatherDirection: row.WEATHER_DIRECTION ?? '',
      windForce: row.WIND_FORCE ?? '',
      seaState: row.SEA_STATE ?? '',
      swellState: row.SWEEL_STATE ?? '',
      swellDirection: row.SWELL_DIRN ?? '',
      latitude: formatLatLong(row.LATTITUDE, row.LAT_DEG, row.LAT_MIN),
      longitude: formatLatLong(row.LONGITUDE, row.LONG_DEG, row.LONG_MIN),
      distToGo: row.DISTANCE_TO_GO ?? '',
      observedDist: row.OBSERVED_DIST ?? '',
      noonHdg: row.NOON_HDG ?? '',
      stoppage: row.STOPPAGE ?? '',
      effectiveSteaming: row.EFFECTIVE_STEAMING ?? '',
      observedSpeed: row.OBSERVED_SPEED ?? '',
      downtime: await loadDowntime(pool, 'sa_noon_slave2', 'sa_noon_slave3', 'NOONID', row.NOONID, 'NOON_SLAVEID'),
      conspMain: await loadBunkerByIdentity(pool, 'sa_noon_slave1', 'NOONID', row.NOONID, ['MAINPROP_AE_BUNKER', 'CONSP_MP_AE_BUNKER']),
      conspTankCleaning: await loadBunkerByIdentity(pool, 'sa_noon_slave1', 'NOONID', row.NOONID, ['TANK_CLEANING_BUNKER', 'CONSP_TANK_CLEANING_BUNKER']),
      conspGasFreeing: await loadBunkerByIdentity(pool, 'sa_noon_slave1', 'NOONID', row.NOONID, ['TANK_CLEANING_BUNKER', 'CONSP_TANK_CLEANING_BUNKER']),
      conspOther: await loadBunkerByIdentity(pool, 'sa_noon_slave1', 'NOONID', row.NOONID, ['OT_OTHERS_BUNKER', 'CONSPGC_OTHER_BUNKER']),
      totalRob: await loadBunkerByIdentity(pool, 'sa_noon_slave1', 'NOONID', row.NOONID, ['ROB_BUNKER', 'ROB_TOTAL_BUNKER', 'ROBGC_TOTAL_BUNKER']),
      totalConsp: await loadBunkerByIdentity(pool, 'sa_noon_slave1', 'NOONID', row.NOONID, ['CONSUMPTION_BUNKER', 'CONSP_TOTAL_BUNKER', 'CONSPGC_TOTAL_BUNKER']),
      sortAt: new Date(row.REPORTING_DATETIME_LT || 0).getTime() || 0,
    }));
  }

  const [arrivals] = await pool.query(
    `SELECT * FROM sa_arrival_master WHERE IMO_NO = ? ORDER BY REPORTING_DATETIME_LT DESC`,
    [imo],
  );
  for (const row of arrivals) {
    records.push(emptyReportFields({
      reportType: 'ARRIVAL',
      reportTitle: row.REPORT_TITLE ?? '',
      vesselType: row.VESSEL_TYPE ?? '',
      messageNo: row.MESSAGE_NO ?? '',
      vesselName: row.VESSEL_NAME ?? '',
      voyageNo: row.VOYAGE_NO ?? '',
      reportingLt: blankDate(row.REPORTING_DATETIME_LT),
      timeZone: `${row.PREFIX || ''} ${row.TIME_RELATIVE_UTC || ''}`.trim(),
      reportingUtc: blankDate(row.REPORTING_DATETIME_UTC),
      draftFore: row.DRAFT_FORE ?? '',
      draftAft: row.DRAFT_AFT ?? '',
      portOfArrival: row.PORT_OF_ARRIVAL ?? '',
      portVisitReasons: row.PORT_VISIT_REASON ?? '',
      etaNextPort: blankDate(row.ETA_NEXT_PORT),
      vesselCondition: row.VESSEL_CONDITION ?? '',
      weatherDirection: row.WEATHER_DIRECTION ?? '',
      windForce: row.WIND_FORCE ?? '',
      seaState: row.SEA_STATE ?? '',
      swellState: row.SWEEL_STATE ?? '',
      swellDirection: row.SWELL_DIRN ?? '',
      latitude: formatLatLong(row.LATTITUDE, row.LAT_DEG, row.LAT_MIN),
      longitude: formatLatLong(row.LONGITUDE, row.LONG_DEG, row.LONG_MIN),
      totalVoyageDist: row.VOYAGE_DISTANCE ?? '',
      observedDist: row.OBSERVED_DIST ?? '',
      noonHdg: row.NOON_HDG ?? '',
      stoppage: row.STOPPAGE ?? '',
      effectiveSteaming: row.EFFECTIVE_STEAMING ?? '',
      observedSpeed: row.OBSERVED_SPEED ?? '',
      downtime: await loadDowntime(pool, 'sa_arrival_slave2', 'sa_arrival_slave3', 'ARRIVALID', row.ARRIVALID, 'ARRIVAL_SLAVEID'),
      conspMain: await loadBunkerByIdentity(pool, 'sa_arrival_slave1', 'ARRIVALID', row.ARRIVALID, ['MAINPROP_AE_BUNKER', 'CONSP_MP_AE_BUNKER']),
      conspTankCleaning: await loadBunkerByIdentity(pool, 'sa_arrival_slave1', 'ARRIVALID', row.ARRIVALID, ['TANK_CLEANING_BUNKER', 'CONSP_TANK_CLEANING_BUNKER']),
      conspGasFreeing: await loadBunkerByIdentity(pool, 'sa_arrival_slave1', 'ARRIVALID', row.ARRIVALID, ['TANK_CLEANING_BUNKER', 'CONSP_TANK_CLEANING_BUNKER']),
      conspOther: await loadBunkerByIdentity(pool, 'sa_arrival_slave1', 'ARRIVALID', row.ARRIVALID, ['OT_OTHERS_BUNKER', 'CONSPGC_OTHER_BUNKER']),
      totalRob: await loadBunkerByIdentity(pool, 'sa_arrival_slave1', 'ARRIVALID', row.ARRIVALID, ['ROB_BUNKER', 'ROB_TOTAL_BUNKER', 'ROBGC_TOTAL_BUNKER']),
      totalConsp: await loadBunkerByIdentity(pool, 'sa_arrival_slave1', 'ARRIVALID', row.ARRIVALID, ['CONSUMPTION_BUNKER', 'CONSP_TOTAL_BUNKER', 'CONSPGC_TOTAL_BUNKER']),
      sortAt: new Date(row.REPORTING_DATETIME_LT || 0).getTime() || 0,
    }));
  }

  const [portMessages] = await pool.query(
    `SELECT * FROM sa_portmessage_master WHERE IMO_NO = ? ORDER BY REPORTING_DATETIME_LT DESC`,
    [imo],
  );
  for (const row of portMessages) {
    records.push(emptyReportFields({
      reportType: 'PORTMESSAGE',
      reportTitle: row.REPORT_TITLE ?? '',
      vesselType: row.VESSEL_TYPE ?? '',
      messageNo: row.MESSAGE_NO ?? '',
      vesselName: row.VESSEL_NAME ?? '',
      voyageNo: row.VOYAGE_NO ?? '',
      reportingLt: blankDate(row.REPORTING_DATETIME_LT),
      timeZone: `${row.PREFIX || ''} ${row.TIME_RELATIVE_UTC || ''}`.trim(),
      reportingUtc: blankDate(row.REPORTING_DATETIME_UTC),
      portOfArrival: row.PORT_OF_ARRIVAL ?? '',
      downtime: await loadDowntime(pool, 'sa_portmessage_slave2', 'sa_portmessage_slave3', 'PORTMESSAGEID', row.PORTMESSAGEID, 'PORTMESSAGE_SLAVEID'),
      conspMain: await loadBunkerByIdentity(pool, 'sa_portmessage_slave1', 'PORTMESSAGEID', row.PORTMESSAGEID, ['MAINPROP_AE_BUNKER', 'CONSP_MP_AE_BUNKER']),
      conspTankCleaning: await loadBunkerByIdentity(pool, 'sa_portmessage_slave1', 'PORTMESSAGEID', row.PORTMESSAGEID, ['TANK_CLEANING_BUNKER', 'CONSP_TANK_CLEANING_BUNKER']),
      conspGasFreeing: await loadBunkerByIdentity(pool, 'sa_portmessage_slave1', 'PORTMESSAGEID', row.PORTMESSAGEID, ['TANK_CLEANING_BUNKER', 'CONSP_TANK_CLEANING_BUNKER']),
      conspOther: await loadBunkerByIdentity(pool, 'sa_portmessage_slave1', 'PORTMESSAGEID', row.PORTMESSAGEID, ['OT_OTHERS_BUNKER', 'CONSPGC_OTHER_BUNKER']),
      totalRob: await loadBunkerByIdentity(pool, 'sa_portmessage_slave1', 'PORTMESSAGEID', row.PORTMESSAGEID, ['ROB_BUNKER', 'ROB_TOTAL_BUNKER', 'ROBGC_TOTAL_BUNKER']),
      totalConsp: await loadBunkerByIdentity(pool, 'sa_portmessage_slave1', 'PORTMESSAGEID', row.PORTMESSAGEID, ['CONSUMPTION_BUNKER', 'CONSP_TOTAL_BUNKER', 'CONSPGC_TOTAL_BUNKER']),
      sortAt: new Date(row.REPORTING_DATETIME_LT || 0).getTime() || 0,
    }));
  }

  records.sort((a, b) => Number(b.sortAt || 0) - Number(a.sortAt || 0));
  return {
    vesselImoNo: imo,
    comId: comId || '',
    vesselName: meta?.VESSEL_NAME || records[0]?.vesselName || '',
    voyageNo: meta?.VOYAGE_NO || '',
    voyageYear: meta?.ADD_ON_DATE
      ? String(new Date(meta.ADD_ON_DATE).getFullYear())
      : String(new Date().getFullYear()),
    records: records.map((row, index) => ({
      ...row,
      index: index + 1,
    })),
    recordsTotal: records.length,
  };
}

/** Slave tables copied when seeding a Voyage Financials estimate from FVF / prior sheet. */
const COST_SHEET_SLAVE_TABLES = [
  'freight_cost_estimete_slave1',
  'freight_cost_estimete_slave2',
  'freight_cost_estimete_slave3',
  'freight_cost_estimete_slave4',
  'freight_cost_estimete_slave5',
  'freight_cost_estimete_slave6',
  'freight_cost_estimete_slave7',
  'freight_cost_estimete_slave8',
  'freight_cost_estimete_slave9',
  'freight_cost_estimete_slave10',
  'freight_cost_estimete_slave11',
  'freight_cost_estimete_slave12',
  'freight_cost_estimete_slave13',
  'freight_cost_estimete_slave14',
  'freight_cost_estimete_slave15',
  'freight_cost_estimete_slave16',
  'freight_cost_estimete_slave17',
  'freight_cost_estimete_slave18',
];

async function getInsertableColumns(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND EXTRA NOT LIKE '%auto_increment%'
     ORDER BY ORDINAL_POSITION`,
    [tableName],
  );
  return rows.map((row) => row.COLUMN_NAME);
}

async function copyEstimateSlaveRows(connection, tableName, sourceId, targetId) {
  try {
    const columns = await getInsertableColumns(connection, tableName);
    const dataColumns = columns.filter((column) => column !== 'FCAID');
    if (!dataColumns.length) return;
    const selectCols = dataColumns.map((column) => `\`${column}\``).join(', ');
    const insertCols = ['`FCAID`', ...dataColumns.map((column) => `\`${column}\``)].join(', ');
    await connection.query(
      `INSERT INTO \`${tableName}\` (${insertCols})
       SELECT ?, ${selectCols} FROM \`${tableName}\` WHERE FCAID = ?`,
      [targetId, sourceId],
    );
  } catch {
    // Skip missing optional slave tables.
  }
}

/**
 * PHP updateTCICostSheetDetails creates the SHEET_NO estimate on first save.
 * React opens Update Estimate by FCAID, so seed that row on first open.
 */
async function ensureCostSheetEstimate(pool, comId, costSheetId) {
  const [[existing]] = await pool.query(
    `SELECT FCAID, ESTIMATE_TYPE, FINAL_STATUS, VOYAGE_NO
     FROM freight_cost_estimete_master
     WHERE COMID = ? AND SHEET_NO = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, costSheetId],
  );
  if (existing?.FCAID) return existing;

  // PHP getLatestCostSheetID — latest master for this nomination (FVF or prior VF).
  const [[source]] = await pool.query(
    `SELECT *
     FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  );
  if (!source?.FCAID) {
    const error = new Error('Cost sheet estimate not found for this Voyage Financials entry.');
    error.status = 404;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Re-check inside the transaction to avoid duplicate sheet estimates.
    const [[again]] = await connection.query(
      `SELECT FCAID, ESTIMATE_TYPE, FINAL_STATUS, VOYAGE_NO
       FROM freight_cost_estimete_master
       WHERE COMID = ? AND SHEET_NO = ?
       ORDER BY FCAID DESC
       LIMIT 1
       FOR UPDATE`,
      [comId, costSheetId],
    );
    if (again?.FCAID) {
      await connection.commit();
      return again;
    }

    const columns = await getInsertableColumns(connection, 'freight_cost_estimete_master');
    const dataColumns = columns.filter((column) => column !== 'FCAID');
    const values = dataColumns.map((column) => {
      switch (column) {
        case 'SHEET_NO':
          return costSheetId;
        case 'COMID':
          return comId;
        case 'FIXED':
          return 1;
        case 'FINAL_STATUS':
          return 0;
        case 'FINAL_DATETIME':
          return null;
        case 'ADD_ON_DATE':
          return new Date();
        case 'ADDED_BY':
          return appContext.userId || source.ADDED_BY;
        case 'L_UP_TIME':
          return new Date();
        case 'L_UPDATED_BY':
          return appContext.userId || source.L_UPDATED_BY || source.ADDED_BY;
        default:
          return source[column];
      }
    });

    const insertCols = dataColumns.map((column) => `\`${column}\``).join(', ');
    const placeholders = dataColumns.map(() => '?').join(', ');
    const [insertResult] = await connection.query(
      `INSERT INTO freight_cost_estimete_master (${insertCols}) VALUES (${placeholders})`,
      values,
    );
    const newId = insertResult.insertId;

    for (const table of COST_SHEET_SLAVE_TABLES) {
      await copyEstimateSlaveRows(connection, table, source.FCAID, newId);
    }

    await connection.commit();
    return {
      FCAID: newId,
      ESTIMATE_TYPE: source.ESTIMATE_TYPE,
      FINAL_STATUS: 0,
      VOYAGE_NO: source.VOYAGE_NO,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** PHP getTCICostSheetID + sheet name — open updatecost_sheet_tci. */
export async function dbGetOpsVcCostSheet(comId, costSheetId) {
  const pool = getPool();
  const safeComId = Number(comId);
  const safeSheetId = Number(costSheetId);
  if (!safeComId || !safeSheetId) {
    const error = new Error('COMID and cost sheet id are required.');
    error.status = 400;
    throw error;
  }

  const [[sheet]] = await pool.query(
    `SELECT COST_SHEETID, SHEET_NAME, COMID
     FROM cost_sheet_name_master
     WHERE COST_SHEETID = ? AND COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [safeSheetId, safeComId, MODULE_ID, COMPANY_ID],
  );
  if (!sheet) {
    const error = new Error('Voyage Financials sheet not found.');
    error.status = 404;
    throw error;
  }

  const estimate = await ensureCostSheetEstimate(pool, safeComId, safeSheetId);

  return {
    comId: safeComId,
    costSheetId: safeSheetId,
    sheetName: sheet.SHEET_NAME || `Sheet ${safeSheetId}`,
    fcaId: estimate.FCAID,
    estimateType: estimate.ESTIMATE_TYPE != null ? String(estimate.ESTIMATE_TYPE) : '2',
    voyageNo: estimate.VOYAGE_NO || '',
    finalStatus: Number(estimate.FINAL_STATUS || 0),
  };
}

/** PHP insertActualCostSheetName — Voyage Financials "A" button. */
export async function dbCreateOpsVcCostSheet(comId, sheetName) {
  const name = String(sheetName || '').trim();
  if (!name) {
    const error = new Error('Please fill the file name');
    error.status = 400;
    throw error;
  }
  const safeComId = Number(comId);
  if (!safeComId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const [[latestEst]] = await pool.query(
    `SELECT FCAID, FINAL_STATUS
     FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [safeComId, MODULE_ID],
  );
  const [existingSheets] = await pool.query(
    `SELECT m.COST_SHEETID, e.FCAID
     FROM cost_sheet_name_master m
     LEFT JOIN freight_cost_estimete_master e
       ON e.COMID = m.COMID AND e.SHEET_NO = m.COST_SHEETID
     WHERE m.COMID = ? AND m.MODULEID = ? AND m.MCOMPANYID = ?
     ORDER BY m.COST_SHEETID DESC
     LIMIT 1`,
    [safeComId, MODULE_ID, COMPANY_ID],
  );
  const latestSheet = existingSheets[0];
  const latestSheetHasEstimate = !latestSheet || latestSheet.FCAID != null;
  if (Number(latestEst?.FINAL_STATUS) !== 1 || !latestSheetHasEstimate) {
    const error = new Error('Please make sure the last Voyage Financials is Submit to Close');
    error.status = 400;
    throw error;
  }

  const [result] = await pool.query(
    `INSERT INTO cost_sheet_name_master (SHEET_NAME, COMID, MODULEID, MCOMPANYID, PROCESS)
     VALUES (?, ?, ?, ?, 'Actual')`,
    [name, safeComId, MODULE_ID, COMPANY_ID],
  );
  return { msg: 4, costSheetId: result.insertId, sheetName: name, comId: safeComId };
}

export async function dbUpdateOpsVcCostSheetLayout(comId, sheets = []) {
  const pool = getPool();
  const safeComId = Number(comId);
  if (!Number.isFinite(safeComId) || safeComId <= 0) {
    const error = new Error('Voyage not found.');
    error.status = 404;
    throw error;
  }
  const list = Array.isArray(sheets) ? sheets : [];
  await ensureSheetLayoutTable(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM ops_vc_cost_sheet_layout WHERE COMID = ?`,
      [safeComId],
    );
    for (const [index, sheet] of list.entries()) {
      const sheetId = Number(sheet.id ?? sheet.costSheetId);
      if (!Number.isFinite(sheetId) || sheetId <= 0) continue;
      await connection.query(
        `INSERT INTO ops_vc_cost_sheet_layout (COMID, COST_SHEETID, PINNED, SORT_ORDER)
         VALUES (?, ?, ?, ?)`,
        [safeComId, sheetId, sheet.pinned ? 1 : 0, Number.isFinite(Number(sheet.sortOrder)) ? Number(sheet.sortOrder) : index],
      );
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
  return { msg: 0, comId: safeComId };
}
