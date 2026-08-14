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

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value) {
  return toNumber(value).toFixed(2);
}

function formatCpDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

export async function dbListFinalisedVoyageFixturesTc({
  search = '',
  page = 1,
  pageSize = 50,
} = {}) {
  const pool = getPool();
  const [finalRows] = await pool.query(
    `SELECT FINAL_ID
     FROM chartering_estimate_tc_compare
     WHERE MODULEID = ?
       AND MCOMPANYID = ?
       AND FINAL_ID IS NOT NULL
       AND FINAL_ID != ''`,
    [MODULE_ID, COMPANY_ID],
  );

  const finalIds = [...new Set(
    finalRows
      .map((row) => row.FINAL_ID)
      .filter((id) => id != null && String(id).trim() !== ''),
  )];

  if (!finalIds.length) {
    return { records: [], recordsTotal: 0 };
  }

  const placeholders = finalIds.map(() => '?').join(',');
  const params = [MODULE_ID, COMPANY_ID, ...finalIds];
  let searchSql = '';
  const searchValue = String(search || '').trim();
  if (searchValue) {
    searchSql = ` AND (
      vessel_imo_master.VESSEL_NAME LIKE ?
      OR chartering_estimate_tc_master.VESSEL_TYPE LIKE ?
      OR chartering_estimate_tc_master.TC_NO LIKE ?
      OR chartering_estimate_tc_master.DEL_RANGE_PORT LIKE ?
      OR chartering_estimate_tc_master.RE_DEL_RANGE LIKE ?
      OR CAST(chartering_estimate_tc_master.COMID AS CHAR) LIKE ?
    )`;
    const like = `%${searchValue}%`;
    params.push(like, like, like, like, like, like);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM chartering_estimate_tc_master
     INNER JOIN vessel_imo_master
       ON vessel_imo_master.VESSEL_IMO_ID = chartering_estimate_tc_master.VESSEL_IMO_ID
     WHERE chartering_estimate_tc_master.MODULEID = ?
       AND chartering_estimate_tc_master.MCOMPANYID = ?
       AND chartering_estimate_tc_master.TCOUTID IN (${placeholders})
       ${searchSql}`,
    params,
  );
  const recordsTotal = Number(countRows[0]?.total || 0);

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(200, Number(pageSize) || 50));
  const offset = (safePage - 1) * safePageSize;

  const [rows] = await pool.query(
    `SELECT
        chartering_estimate_tc_master.TCOUTID,
        chartering_estimate_tc_master.COMID,
        chartering_estimate_tc_master.VESSEL_TYPE,
        chartering_estimate_tc_master.FIXED,
        chartering_estimate_tc_master.EXCHANGE_RATE,
        vessel_imo_master.VESSEL_NAME,
        vessel_imo_master.VESSEL_IMO_ID,
        chartering_estimate_tc_master.TC_NO,
        chartering_estimate_tc_master.CP_DATE1,
        chartering_estimate_tc_master.DWT_SUMMER_CP,
        chartering_estimate_tc_master.DEL_RANGE_PORT,
        chartering_estimate_tc_master.RE_DEL_RANGE,
        chartering_estimate_tc_master.HIRE_FIX_PER,
        (
          SELECT SUM(TC_DAYS_EST)
          FROM chartering_tc_estimate_slave1
          WHERE chartering_tc_estimate_slave1.TCOUTID = chartering_estimate_tc_master.TCOUTID
        ) AS TC_DAYS_EST,
        (
          SELECT SUM(TOTAL_REV_EST)
          FROM chartering_tc_estimate_slave1
          WHERE chartering_tc_estimate_slave1.TCOUTID = chartering_estimate_tc_master.TCOUTID
        ) AS TOTAL_REV_EST,
        (
          SELECT CONTACT_PERSON
          FROM login
          WHERE login.LOGINID = (
            SELECT OPERATOR
            FROM chartering_estimate_tc_compare
            WHERE chartering_estimate_tc_compare.COMID = chartering_estimate_tc_master.COMID
            LIMIT 1
          )
          LIMIT 1
        ) AS OPERATORNAME,
        (
          SELECT OPERATOR
          FROM chartering_estimate_tc_compare
          WHERE chartering_estimate_tc_compare.COMID = chartering_estimate_tc_master.COMID
          LIMIT 1
        ) AS OPERATOR_ID
     FROM chartering_estimate_tc_master
     INNER JOIN vessel_imo_master
       ON vessel_imo_master.VESSEL_IMO_ID = chartering_estimate_tc_master.VESSEL_IMO_ID
     WHERE chartering_estimate_tc_master.MODULEID = ?
       AND chartering_estimate_tc_master.MCOMPANYID = ?
       AND chartering_estimate_tc_master.TCOUTID IN (${placeholders})
       ${searchSql}
     ORDER BY chartering_estimate_tc_master.TCOUTID DESC
     LIMIT ? OFFSET ?`,
    [...params, safePageSize, offset],
  );

  const records = rows.map((row, index) => {
    const exchangeRate = toNumber(row.EXCHANGE_RATE);
    const rate = exchangeRate > 0 || exchangeRate < 0 ? exchangeRate : 1;
    const fixed = Number(row.FIXED) === 1;
    return {
      index: offset + index + 1,
      tcOutId: row.TCOUTID,
      comId: row.COMID,
      vesselName: row.VESSEL_NAME || '',
      vesselType: row.VESSEL_TYPE || '',
      tcNo: row.TC_NO || '',
      cpDate: formatCpDate(row.CP_DATE1),
      dwt: row.DWT_SUMMER_CP ?? '',
      delPort: row.DEL_RANGE_PORT || '',
      reDelPort: row.RE_DEL_RANGE || '',
      tcDays: row.TC_DAYS_EST ?? '',
      dailyGrossHire: formatMoney(toNumber(row.HIRE_FIX_PER) * rate),
      totalRev: row.TOTAL_REV_EST ?? '',
      fixed,
      statusLabel: fixed ? 'Finalised' : 'Not Fixed',
      operatorId: row.OPERATOR_ID != null ? String(row.OPERATOR_ID) : '',
      operatorName: row.OPERATORNAME || '',
      canFinalise: !fixed,
    };
  });

  return { records, recordsTotal };
}

export async function dbFinaliseVoyageFixturesTc(fixtures = []) {
  if (!Array.isArray(fixtures) || !fixtures.length) {
    const error = new Error('Please select at least one Fixture');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of fixtures) {
      const tcOutId = item?.tcOutId;
      const comId = item?.comId;
      const operatorId = item?.operatorId;
      if (!tcOutId || !comId) {
        const error = new Error('Fixture id and COMID are required.');
        error.status = 400;
        throw error;
      }
      if (!operatorId) {
        const error = new Error('Please select an Operator for each fixture.');
        error.status = 400;
        throw error;
      }

      const [result] = await connection.query(
        `UPDATE chartering_estimate_tc_master
         SET FIXED = '1', FINAL_DATETIME = NOW(), FINAL_STATUS = 1
         WHERE TCOUTID = ?
           AND MODULEID = ?
           AND MCOMPANYID = ?`,
        [tcOutId, MODULE_ID, COMPANY_ID],
      );
      if (!result.affectedRows) {
        const error = new Error(`Fixture ${tcOutId} was not found.`);
        error.status = 404;
        throw error;
      }

      await connection.query(
        `UPDATE chartering_estimate_tc_compare
         SET OPERATOR = ?
         WHERE COMID = ?
           AND MODULEID = ?
           AND MCOMPANYID = ?`,
        [operatorId, comId, MODULE_ID, COMPANY_ID],
      );
    }

    await connection.commit();
    return { msg: 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbListOpsTcYears() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT DISTINCT YEAR(UPDATE_ON_DATE) AS year
     FROM chartering_estimate_tc_master
     WHERE UPDATE_ON_DATE IS NOT NULL AND YEAR(UPDATE_ON_DATE) > 0
     ORDER BY year DESC`,
  );
  const years = rows.map((row) => String(row.year)).filter(Boolean);
  const current = String(new Date().getFullYear());
  if (!years.includes(current)) years.unshift(current);
  return years.map((year) => ({ id: year, name: year }));
}

async function resolveTcHireDays(pool, comId) {
  try {
    const [[invoice]] = await pool.query(
      `SELECT INVOICEID, HIRE_DAYS
       FROM invoice_tchire_master
       WHERE COMID = ?
       ORDER BY INVOICEID DESC
       LIMIT 1`,
      [comId],
    );
    if (!invoice) return '';
    if (invoice.HIRE_DAYS != null && String(invoice.HIRE_DAYS) !== '' && Number(invoice.HIRE_DAYS) !== 0) {
      return invoice.HIRE_DAYS;
    }
    const [[slave]] = await pool.query(
      `SELECT SUM(HIRE_DAYS) AS HIRE_DAYS
       FROM invoice_tchire_hire_salve
       WHERE INV_ID = ?`,
      [invoice.INVOICEID],
    ).catch(() => [[{ HIRE_DAYS: null }]]);
    return slave?.HIRE_DAYS ?? '';
  } catch {
    return '';
  }
}

export async function dbListOpsTcGlance({
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
    : [Number(status)];
  const safeStatuses = statusList.length ? statusList : [1];
  const isHistory = safeStatuses.includes(3) || safeStatuses.includes(4);
  const allowOperatorEdit = canEditOperatorOverride != null
    ? Boolean(canEditOperatorOverride)
    : (!isHistory && isMgmtUser());
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(200, Number(pageSize) || 50));
  const offset = (safePage - 1) * safeSize;

  const conditions = [
    'c.MODULEID = ?',
    'c.MCOMPANYID = ?',
    "c.FINAL_ID IS NOT NULL",
    "c.FINAL_ID != ''",
    'm.FIXED = 1',
    `c.STATUS IN (${safeStatuses.map(() => '?').join(',')})`,
    'm.ESTIMATE_TYPE = ?',
  ];
  const params = [MODULE_ID, COMPANY_ID, ...safeStatuses, businessType];

  if (requireYear && year) {
    conditions.push('YEAR(m.UPDATE_ON_DATE) = ?');
    params.push(year);
  }

  if (search) {
    const like = `%${String(search).trim()}%`;
    conditions.push(`(
      c.MESSAGE LIKE ?
      OR m.TC_NO LIKE ?
      OR vim.VESSEL_NAME LIKE ?
      OR op.CONTACT_PERSON LIKE ?
      OR CAST(c.COMID AS CHAR) LIKE ?
    )`);
    params.push(like, like, like, like, like);
  }

  const where = conditions.join(' AND ');
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN login op ON op.LOGINID = c.OPERATOR
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
        c.COMID,
        c.TCOUTID,
        c.MESSAGE,
        c.STATUS AS OPS_STATUS,
        c.OPERATOR AS OPERATOR_ID,
        op.CONTACT_PERSON AS OPERATOR_NAME,
        m.VESSEL_IMO_ID,
        m.PERIODID,
        m.ESTIMATE_TYPE,
        m.TC_NO,
        m.RE_DEL_DATE,
        m.FINAL_DATETIME,
        m.UPDATE_ON_DATE,
        vim.VESSEL_NAME,
        vim.IMO_NO,
        latest.TCOUTID AS LATEST_TCOUTID,
        latest.VESSEL_TYPE,
        latest.DEL_RANGE_PORT,
        latest.RE_DEL_RANGE,
        latest.CHARTERING_PIC,
        m.CHARTERING_PIC AS MASTER_CHARTERING_PIC,
        first_sheet.TCOUTID AS VIEW_TCOUTID,
        first_sheet.CP_DATE1,
        charterer.NAME AS CHARTERER_NAME
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN login op ON op.LOGINID = c.OPERATOR
     LEFT JOIN (
       SELECT t.COMID, t.TCOUTID, t.VESSEL_TYPE, t.DEL_RANGE_PORT, t.RE_DEL_RANGE, t.CHARTERING_PIC
       FROM chartering_estimate_tc_master t
       INNER JOIN (
         SELECT COMID, MAX(TCOUTID) AS MAX_TCOUTID
         FROM chartering_estimate_tc_master
         GROUP BY COMID
       ) x ON x.MAX_TCOUTID = t.TCOUTID AND x.COMID = t.COMID
     ) latest ON CAST(latest.COMID AS CHAR) = CAST(c.COMID AS CHAR)
     LEFT JOIN (
       SELECT t.COMID, t.TCOUTID, t.CP_DATE1
       FROM chartering_estimate_tc_master t
       INNER JOIN (
         SELECT COMID, MIN(TCOUTID) AS MIN_TCOUTID
         FROM chartering_estimate_tc_master
         GROUP BY COMID
       ) x ON x.MIN_TCOUTID = t.TCOUTID AND x.COMID = t.COMID
     ) first_sheet ON CAST(first_sheet.COMID AS CHAR) = CAST(c.COMID AS CHAR)
     LEFT JOIN vendor_master charterer ON charterer.CODE = m.SEL_CHARTERER
     WHERE ${where}
     ORDER BY DATE(m.FINAL_DATETIME) DESC
     LIMIT ? OFFSET ?`,
    [...params, safeSize, offset],
  );

  const records = [];
  for (const [index, row] of rows.entries()) {
    const [costSheets] = await pool.query(
      `SELECT COST_SHEETID, SHEET_NAME, PROCESS
       FROM cost_sheettc_name_master
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       ORDER BY COST_SHEETID`,
      [row.COMID, MODULE_ID, COMPANY_ID],
    );

    const hireDays = isHistory
      ? await (async () => {
        const [[daysRow]] = await pool.query(
          `SELECT SUM(TC_DAYS_EST) AS total
           FROM chartering_tc_estimate_slave1
           WHERE TCOUTID = ?`,
          [row.TCOUTID],
        ).catch(() => [[{ total: null }]]);
        return daysRow?.total ?? '';
      })()
      : await resolveTcHireDays(pool, row.COMID);
    const rowStatus = Number(row.OPS_STATUS || safeStatuses[0]);
    const viewTcOutId = row.VIEW_TCOUTID || row.TCOUTID || row.LATEST_TCOUTID;

    records.push({
      index: offset + index + 1,
      comId: row.COMID,
      tcOutId: viewTcOutId,
      message: row.MESSAGE ?? '',
      tcNo: row.TC_NO ?? '',
      businessType: BUSINESS_TYPE_NAMES[Number(row.ESTIMATE_TYPE)] || '',
      vesselName: row.VESSEL_NAME ?? '',
      vesselType: row.VESSEL_TYPE ?? '',
      vesselImoNo: row.IMO_NO ?? '',
      isPeriod: Number(row.PERIODID) > 0,
      charterer: row.CHARTERER_NAME ?? '',
      cpDate: formatCpDate(row.CP_DATE1),
      delPort: row.DEL_RANGE_PORT || '',
      reDelPort: row.RE_DEL_RANGE || '',
      ports: [row.DEL_RANGE_PORT, row.RE_DEL_RANGE].filter(Boolean).join(' / '),
      hireDays: hireDays === '' || hireDays == null ? '' : String(hireDays),
      reDelDate: formatCpDate(row.RE_DEL_DATE),
      costSheets: (costSheets || [])
        .filter((sheet) => String(sheet.PROCESS || '') !== 'EST')
        .map((sheet) => ({
          id: sheet.COST_SHEETID,
          name: sheet.SHEET_NAME || `Sheet ${sheet.COST_SHEETID}`,
        })),
      operatorId: row.OPERATOR_ID != null ? String(row.OPERATOR_ID) : '',
      operatorName: row.OPERATOR_NAME ?? '',
      charteringTeam: charteringTeamName(row.CHARTERING_PIC ?? row.MASTER_CHARTERING_PIC),
      status: rowStatus,
      statusLabel: rowStatus === 3 ? 'Deactivated' : (rowStatus === 4 || isHistory ? 'History' : ''),
      canDeactivate: !isHistory,
      canMoveToPostOps: rowStatus === 1,
      canMoveToHistory: rowStatus === 2,
      canEditOperator: allowOperatorEdit,
      canAddCostSheet: true,
      pageContext: isHistory ? 3 : (rowStatus === 2 ? 2 : 1),
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    canEditOperator: allowOperatorEdit,
    canCompareSheets: compareSheetsEnabled(),
  };
}

export async function dbListInOpsAtGlanceTc(params = {}) {
  return dbListOpsTcGlance({ ...params, status: 1 });
}

export async function dbListPostOpsAtGlanceTc(params = {}) {
  return dbListOpsTcGlance({ ...params, status: 2 });
}

export async function dbListHistoryAtGlanceTc(params = {}) {
  return dbListOpsTcGlance({
    ...params,
    status: [3, 4],
    canEditOperator: false,
  });
}

function parseDmyToSqlDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

export async function dbListYearUpdationTc({
  search = '',
  page = 1,
  pageSize = 50,
} = {}) {
  const pool = getPool();
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(200, Number(pageSize) || 50));
  const offset = (safePage - 1) * safeSize;

  const conditions = ['m.SHEET_NO IS NOT NULL'];
  const params = [];

  if (MODULE_ID) {
    conditions.push('m.MODULEID = ?');
    params.push(MODULE_ID);
  }

  if (search) {
    conditions.push(`(
      m.TC_NO LIKE ?
      OR vim.VESSEL_NAME LIKE ?
      OR CAST(m.COMID AS CHAR) LIKE ?
    )`);
    const like = `%${String(search).trim()}%`;
    params.push(like, like, like);
  }

  const where = conditions.join(' AND ');
  const moduleFilter = MODULE_ID ? 'AND MODULEID = ?' : '';
  const moduleParams = MODULE_ID ? [MODULE_ID] : [];

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM (
       SELECT m.TC_NO
       FROM chartering_estimate_tc_master m
       LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       WHERE ${where}
       GROUP BY m.TC_NO
     ) x`,
    params,
  );

  const searchSql = search
    ? `WHERE (
      m.TC_NO LIKE ?
      OR vim.VESSEL_NAME LIKE ?
      OR CAST(m.COMID AS CHAR) LIKE ?
    )`
    : '';
  const searchParams = search
    ? [`%${String(search).trim()}%`, `%${String(search).trim()}%`, `%${String(search).trim()}%`]
    : [];

  const [rows] = await pool.query(
    `SELECT
        m.TCOUTID,
        m.COMID,
        m.TC_NO,
        m.VESSEL_IMO_ID,
        m.TC_DATE,
        m.UPDATE_ON_DATE,
        vim.VESSEL_NAME
     FROM chartering_estimate_tc_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     INNER JOIN (
       SELECT TC_NO, MAX(TCOUTID) AS MAX_TCOUTID
       FROM chartering_estimate_tc_master
       WHERE SHEET_NO IS NOT NULL
         ${moduleFilter}
       GROUP BY TC_NO
     ) latest ON latest.MAX_TCOUTID = m.TCOUTID
     ${searchSql}
     ORDER BY m.TCOUTID DESC
     LIMIT ? OFFSET ?`,
    [...moduleParams, ...searchParams, safeSize, offset],
  );

  return {
    records: rows.map((row, index) => {
      let year = formatDateDMY(row.UPDATE_ON_DATE);
      if (year === '01-01-1970') year = '';
      let cpDate = formatDateDMY(row.TC_DATE);
      if (cpDate === '01-01-1970' || cpDate === '00-00-0000') cpDate = '';
      return {
        index: offset + index + 1,
        tcOutId: row.TCOUTID,
        comId: row.COMID,
        tcNo: row.TC_NO ?? '',
        vesselName: row.VESSEL_NAME ?? '',
        cpDate,
        year,
        updateYear: year,
      };
    }),
    recordsTotal: Number(countRow?.total || 0),
    page: safePage,
    pageSize: safeSize,
  };
}

export async function dbUpdateTcUpdateOnDate(comId, updateYear) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }
  const sqlDate = parseDmyToSqlDate(updateYear);
  if (!sqlDate) {
    const error = new Error('Please enter a valid date (dd-mm-yyyy).');
    error.status = 400;
    throw error;
  }

  const [result] = await pool.query(
    `UPDATE chartering_estimate_tc_master
     SET UPDATE_ON_DATE = ?
     WHERE COMID = ?`,
    [sqlDate, comId],
  );
  if (!result.affectedRows) {
    const error = new Error('TC nomination not found.');
    error.status = 404;
    throw error;
  }
  return {
    msg: 0,
    comId: String(comId),
    updateYear: formatDateDMY(sqlDate),
    year: formatDateDMY(sqlDate),
  };
}

export async function dbUpdateOpsTcOperator(comId, operatorId) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE chartering_estimate_tc_compare
     SET OPERATOR = ?
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
    [operatorId, comId, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) {
    const error = new Error('Ops TC entry not found.');
    error.status = 404;
    throw error;
  }
  return { msg: 0 };
}

export async function dbMoveOpsTcToPostOps(comId) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE chartering_estimate_tc_compare
     SET STATUS = 2
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 1`,
    [comId, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) {
    const error = new Error('Ops TC entry not found or not in In Ops.');
    error.status = 404;
    throw error;
  }
  return { msg: 6 };
}

export async function dbMoveOpsTcToHistory(comId) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE chartering_estimate_tc_compare
     SET STATUS = 4
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 2`,
    [comId, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) {
    const error = new Error('Post Ops TC entry not found or already in History.');
    error.status = 404;
    throw error;
  }
  return { msg: 3 };
}

export async function dbDeactivateOpsTcEntry(comId) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE chartering_estimate_tc_compare
     SET STATUS = 3
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS IN (1, 2)`,
    [comId, MODULE_ID, COMPANY_ID],
  );
  if (!result.affectedRows) {
    const error = new Error('Ops TC entry not found.');
    error.status = 404;
    throw error;
  }
  return { msg: 3 };
}

export async function dbCreateOpsTcCostSheet(comId, sheetName) {
  const name = String(sheetName || '').trim();
  if (!name) {
    const error = new Error('TC Sheet Name is required.');
    error.status = 400;
    throw error;
  }
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO cost_sheettc_name_master (SHEET_NAME, COMID, MODULEID, MCOMPANYID, PROCESS)
     VALUES (?, ?, ?, ?, 'Actual')`,
    [name, comId, MODULE_ID, COMPANY_ID],
  );
  return { msg: 4, costSheetId: result.insertId };
}

/** PHP getLatestCostSheetIDTC — latest TCOUTID for a COMID. */
export async function dbResolveLatestTcOutIdByComId(comId) {
  const pool = getPool();
  const [[latest]] = await pool.query(
    `SELECT TCOUTID
     FROM chartering_estimate_tc_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY TCOUTID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  );
  if (!latest?.TCOUTID) {
    const error = new Error('TC fixture note not found for this nomination.');
    error.status = 404;
    throw error;
  }
  return {
    comId: Number(comId),
    tcOutId: latest.TCOUTID,
  };
}
