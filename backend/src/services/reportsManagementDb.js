import { appContext, isDbConfigured, isMgmtUser } from '../config.js';
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

function teamFilter(selTeam, column = 'm.CHARTERING_PIC') {
  const value = String(selTeam || '').trim();
  if (!value) return { sql: '', params: [] };
  return { sql: ` AND ${column} = ? `, params: [value] };
}

async function loginName(pool, loginId) {
  if (!loginId) return '';
  const [[row]] = await pool.query(
    `SELECT CONTACT_PERSON FROM login
     WHERE LOGINID = ? AND STATUS = 1
     LIMIT 1`,
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

function pickFinalSheet(sheets = []) {
  const withSheet = sheets.filter((s) => s.SHEET_NO != null && s.SHEET_NO !== '');
  if (withSheet.length) return withSheet[withSheet.length - 1];
  return sheets[sheets.length - 1] || null;
}

async function plBoundsForCom(pool, comId) {
  const [sheets] = await pool.query(
    `SELECT FCAID, ACTUAL_PL, PROFIT_LOSS, SHEET_NO, REVENUES_FREIGHT, VOYAGE_EARNING,
            BUNKER_EXPENSES, PORT_EXPENSES, DWT_SUMMER, QUANTITY,
            GAS_QUANTITY, TANK_QUANTITY, QTY_TYPE_RADIO, ESTIMATE_TYPE,
            CP_DATE, ETA_DATE, TRANS_DATE, ADD_ON_DATE
     FROM freight_cost_estimete_master
     WHERE COMID = ?
     ORDER BY FCAID ASC`,
    [comId],
  );
  const initial = sheets.find((s) => s.SHEET_NO == null || s.SHEET_NO === '');
  const finalSheet = pickFinalSheet(sheets);
  const revenue = Number(finalSheet?.REVENUES_FREIGHT || finalSheet?.VOYAGE_EARNING) || 0;
  const bunker = Number(finalSheet?.BUNKER_EXPENSES) || 0;
  const port = Number(finalSheet?.PORT_EXPENSES) || 0;
  const pickPl = (sheet) => {
    if (!sheet) return '';
    if (sheet.ACTUAL_PL != null && sheet.ACTUAL_PL !== '') return sheet.ACTUAL_PL;
    if (sheet.PROFIT_LOSS != null && sheet.PROFIT_LOSS !== '') return sheet.PROFIT_LOSS;
    return '';
  };
  const finalPl = pickPl(finalSheet);
  const net = Number(finalPl);
  const expense = bunker + port;
  const costs = expense > 0
    ? expense
    : (Number.isFinite(net) && finalPl !== '' && revenue ? Math.max(0, revenue - net) : expense);
  return {
    initial: pickPl(initial) || pickPl(sheets[0]) || '',
    final: finalPl,
    revenue,
    costs,
    dwt: Number(finalSheet?.DWT_SUMMER) || 0,
    cpDate: finalSheet?.CP_DATE || finalSheet?.TRANS_DATE || finalSheet?.ADD_ON_DATE || null,
    etaDate: finalSheet?.ETA_DATE || null,
    quantityType: finalSheet?.QTY_TYPE_RADIO,
    estimateType: finalSheet?.ESTIMATE_TYPE,
    quantity: finalSheet?.QUANTITY,
    gasQuantity: finalSheet?.GAS_QUANTITY,
    tankQuantity: finalSheet?.TANK_QUANTITY,
    fcaId: finalSheet?.FCAID,
  };
}

function statusLabel(status) {
  const value = Number(status);
  if (value === 1) return 'Estimated';
  if (value === 2 || value === 3 || value === 4) return 'Actual';
  return 'Estimated';
}

function quarterFromDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `q${Math.floor(date.getMonth() / 3) + 1}`;
}

function bizLabel(estimateType) {
  const value = Number(estimateType);
  if (value === 1) return 'Gas';
  if (value === 2) return 'Tanker';
  if (value === 3) return 'Dry Cargo';
  return '';
}

async function cargoQtyForMaster(pool, master) {
  const estimateType = Number(master.ESTIMATE_TYPE);
  if (estimateType === 1) return Number(master.GAS_QUANTITY) || 0;
  if (estimateType === 2) return Number(master.TANK_QUANTITY) || 0;
  if (Number(master.QTY_TYPE_RADIO) === 1) return Number(master.QUANTITY) || 0;
  const [[sum]] = await pool.query(
    'SELECT SUM(QUANTITY) AS sum FROM freight_cost_estimete_slave7 WHERE FCAID = ?',
    [master.FCAID],
  );
  return Number(sum?.sum) || 0;
}

export async function dbComparisonReport(filters = {}) {
  const pool = getPool();
  const year = filters.selYear || String(new Date().getFullYear());

  const [rows] = await pool.query(
    `SELECT c.COMID, m.FCAID, m.TRANS_DATE, m.VOYAGE_NO, m.VESSEL_IMO_ID,
            m.ESTIMATE_TYPE, m.GAS_QUANTITY, m.TANK_QUANTITY, m.QTY_TYPE_RADIO,
            m.QUANTITY, m.DAILY_EARNING, m.ACTUAL_PL, v.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2, 3)
       AND c.COAAID IS NULL
       AND YEAR(m.ADD_ON_DATE) = ?
     ORDER BY m.FINAL_DATETIME DESC`,
    [MODULE_ID, COMPANY_ID, year],
  );

  const records = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    records.push({
      id: row.COMID,
      comId: row.COMID,
      srNo: i + 1,
      cpDate: safeDate(row.TRANS_DATE),
      voyageNo: row.VOYAGE_NO || '',
      vesselName: row.VESSEL_NAME || '',
      cargoQty: await cargoQtyForMaster(pool, row),
      tcEarning: row.DAILY_EARNING ?? '',
      pl: row.ACTUAL_PL ?? '',
    });
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbComparisonSheets(comId) {
  const pool = getPool();
  const id = String(comId || '').trim();
  if (!id) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const [[base]] = await pool.query(
    `SELECT m.FCAID, m.COMID, m.VESSEL_IMO_ID, m.TRANS_DATE, m.VOYAGE_NO, m.VOYAGE_NAME,
            m.DWT_SUMMER, m.DWT_TOPICAL, m.FLAG, v.VESSEL_NAME, v.VESSEL_TYPE,
            (SELECT VesselType FROM vessel_type_master WHERE VesselTypeId = v.VESSEL_TYPE LIMIT 1) AS vesselTypeName
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.COMID = ?
     ORDER BY m.FCAID DESC
     LIMIT 1`,
    [id],
  );

  if (!base) {
    const error = new Error('Nomination not found.');
    error.status = 404;
    throw error;
  }

  const [sheets] = await pool.query(
    `SELECT m.FCAID, m.SHEET_NO, m.ACTUAL_PL, m.REVENUES_FREIGHT, m.DAILY_EARNING,
            m.PROFIT_LOSS, m.BUNKER_EXPENSES, m.PORT_EXPENSES, m.TRANS_DATE,
            (SELECT SHEET_NAME FROM cost_sheet_name_master WHERE COST_SHEETID = m.SHEET_NO LIMIT 1) AS sheetName
     FROM freight_cost_estimete_master m
     WHERE m.COMID = ?
     ORDER BY m.FCAID ASC`,
    [id],
  );

  const sheetColumns = sheets.map((sheet, index) => ({
    fcaId: sheet.FCAID,
    label: sheet.sheetName || (sheet.SHEET_NO ? `Sheet ${sheet.SHEET_NO}` : 'Estimate'),
    index,
  }));

  const metrics = [
    { key: 'revenues', label: 'Revenue (Freight)' },
    { key: 'expenses', label: 'Bunker + Port Expenses' },
    { key: 'dailyEarning', label: 'TC Earning / Day' },
    { key: 'profitLoss', label: 'Profit / Loss' },
    { key: 'actualPl', label: 'Actual P & L' },
  ];

  const rows = metrics.map((metric) => {
    const values = sheets.map((sheet) => {
      if (metric.key === 'expenses') {
        const bunker = Number(sheet.BUNKER_EXPENSES) || 0;
        const port = Number(sheet.PORT_EXPENSES) || 0;
        const total = bunker + port;
        return total ? total.toFixed(2) : '';
      }
      const map = {
        revenues: sheet.REVENUES_FREIGHT,
        dailyEarning: sheet.DAILY_EARNING,
        profitLoss: sheet.PROFIT_LOSS,
        actualPl: sheet.ACTUAL_PL,
      };
      return map[metric.key] ?? '';
    });
    let difference = '';
    if (values.length >= 2) {
      const first = Number(values[0]) || 0;
      const last = Number(values[values.length - 1]) || 0;
      difference = (last - first).toFixed(2);
    }
    return {
      parameter: metric.label,
      values,
      difference,
    };
  });

  return {
    comId: id,
    particulars: {
      vesselName: base.VESSEL_NAME || '',
      vesselType: base.vesselTypeName || '',
      flag: base.FLAG || '',
      fixtureDate: safeDate(base.TRANS_DATE),
      voyageNo: base.VOYAGE_NO || '',
      voyageName: base.VOYAGE_NAME || '',
      dwtSummer: base.DWT_SUMMER ?? '',
      dwtTropical: base.DWT_TOPICAL ?? '',
    },
    sheetColumns,
    rows,
    isMgmtUser: isMgmtUser(),
  };
}

const YEAR_SQL_VC = 'YEAR(COALESCE(m.CP_DATE, m.ADD_ON_DATE, m.TRANS_DATE))';
const YEAR_SQL_TC = 'YEAR(COALESCE(m.CP_DATE1, m.UPDATE_ON_DATE, m.TC_DATE))';

async function mapVcPlRow(pool, row, year, { status, opsStatus }) {
  const hasCom = row.COMID != null && String(row.COMID) !== '' && Number(row.COMID) !== 0;
  const pl = hasCom
    ? await plBoundsForCom(pool, row.COMID)
    : {
      initial: row.PROFIT_LOSS ?? row.ACTUAL_PL ?? '',
      final: row.ACTUAL_PL ?? row.PROFIT_LOSS ?? '',
      revenue: Number(row.REVENUES_FREIGHT || row.VOYAGE_EARNING) || 0,
      costs: (Number(row.BUNKER_EXPENSES) || 0) + (Number(row.PORT_EXPENSES) || 0),
      dwt: Number(row.DWT_SUMMER) || 0,
      cpDate: row.CP_DATE || row.ADD_ON_DATE || row.TRANS_DATE || null,
      etaDate: row.ETA_DATE || null,
      quantityType: row.QTY_TYPE_RADIO,
      estimateType: row.ESTIMATE_TYPE,
      quantity: row.QUANTITY,
      gasQuantity: row.GAS_QUANTITY,
      tankQuantity: row.TANK_QUANTITY,
      fcaId: row.FCAID,
    };
  if (!hasCom && !pl.costs && pl.revenue && pl.final !== '') {
    const net = Number(pl.final);
    if (Number.isFinite(net)) pl.costs = Math.max(0, pl.revenue - net);
  }
  const cargoMaster = {
    FCAID: pl.fcaId || row.FCAID,
    ESTIMATE_TYPE: pl.estimateType ?? row.ESTIMATE_TYPE,
    QTY_TYPE_RADIO: pl.quantityType ?? row.QTY_TYPE_RADIO,
    QUANTITY: pl.quantity ?? row.QUANTITY,
    GAS_QUANTITY: pl.gasQuantity ?? row.GAS_QUANTITY,
    TANK_QUANTITY: pl.tankQuantity ?? row.TANK_QUANTITY,
  };
  const cpSource = pl.cpDate || row.CP_DATE || row.ADD_ON_DATE || row.TRANS_DATE;
  return {
    id: hasCom ? row.COMID : `fca-${row.FCAID}`,
    type: 'spot',
    voyageNo: row.VOYAGE_NO || '',
    vesselName: row.VESSEL_NAME || '',
    charterer: await chartererForMaster(pool, row),
    team1: await loginName(pool, row.CHARTERING_PIC),
    team2: await loginName(pool, row.CHARTERING_TEAM_1),
    pic1: await loginName(pool, row.CHARTERING_PIC_1),
    pic2: await loginName(pool, row.CHARTERING_PIC_2),
    pic3: await loginName(pool, row.CHARTERING_PIC_3),
    chrtPic: await loginName(pool, row.CHARTERING_PIC),
    opsPic: await loginName(pool, row.CHARTERING_PIC_1),
    year: cpSource ? String(new Date(cpSource).getFullYear()) : year,
    q: quarterFromDate(cpSource),
    biz: bizLabel(row.ESTIMATE_TYPE),
    cpDate: safeDate(cpSource),
    eta: safeDate(pl.etaDate || row.ETA_DATE) || '—',
    dwt: pl.dwt || Number(row.DWT_SUMMER) || 0,
    cargoMt: await cargoQtyForMaster(pool, cargoMaster),
    owner: '',
    revenue: pl.revenue,
    costs: pl.costs,
    initialPl: pl.initial,
    finalPl: pl.final,
    status,
    opsStatus,
    source: hasCom ? 'ops' : 'business',
  };
}

export async function dbPlAtAGlanceVc(filters = {}) {
  const pool = getPool();
  const year = filters.selYear || String(new Date().getFullYear());
  const typeFilter = estimateTypeFilter(filters.selBType);
  const team = teamFilter(filters.selTeam);

  const [opsRows] = await pool.query(
    `SELECT c.COMID, c.STATUS AS OPS_STATUS, m.FCAID, m.VOYAGE_NO, m.VESSEL_IMO_ID, m.ESTIMATE_TYPE,
            m.QTY_TYPE_RADIO, m.FGFF_VENDORID, m.ADD_ON_DATE, m.CP_DATE, m.ETA_DATE, m.TRANS_DATE,
            m.QUANTITY, m.GAS_QUANTITY, m.TANK_QUANTITY, m.DWT_SUMMER,
            m.CHARTERING_PIC, m.CHARTERING_PIC_1, m.CHARTERING_PIC_2, m.CHARTERING_PIC_3,
            m.CHARTERING_TEAM_1, v.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2, 3, 4)
       AND ${YEAR_SQL_VC} = ?
       ${typeFilter.sql}
       ${team.sql}
     GROUP BY c.COMID
     ORDER BY COALESCE(m.CP_DATE, m.ADD_ON_DATE, m.TRANS_DATE) DESC`,
    [MODULE_ID, COMPANY_ID, year, ...typeFilter.params, ...team.params],
  );

  const seenCom = new Set(opsRows.map((row) => String(row.COMID)));
  const [businessRows] = await pool.query(
    `SELECT m.COMID, m.FCAID, m.VOYAGE_NO, m.VESSEL_IMO_ID, m.ESTIMATE_TYPE,
            m.QTY_TYPE_RADIO, m.FGFF_VENDORID, m.ADD_ON_DATE, m.CP_DATE, m.ETA_DATE, m.TRANS_DATE,
            m.QUANTITY, m.GAS_QUANTITY, m.TANK_QUANTITY, m.DWT_SUMMER,
            m.ACTUAL_PL, m.PROFIT_LOSS, m.REVENUES_FREIGHT, m.VOYAGE_EARNING,
            m.BUNKER_EXPENSES, m.PORT_EXPENSES,
            m.CHARTERING_PIC, m.CHARTERING_PIC_1, m.CHARTERING_PIC_2, m.CHARTERING_PIC_3,
            m.CHARTERING_TEAM_1, v.VESSEL_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.FIXED = 1
       AND m.COAID IS NULL
       AND (m.SHEET_NO IS NULL OR m.SHEET_NO = '')
       AND ${YEAR_SQL_VC} = ?
       ${typeFilter.sql}
       ${team.sql}
     ORDER BY COALESCE(m.CP_DATE, m.ADD_ON_DATE, m.TRANS_DATE) DESC`,
    [MODULE_ID, COMPANY_ID, year, ...typeFilter.params, ...team.params],
  );

  const records = [];
  for (const row of opsRows) {
    records.push(await mapVcPlRow(pool, row, year, {
      status: statusLabel(row.OPS_STATUS),
      opsStatus: row.OPS_STATUS,
    }));
  }
  for (const row of businessRows) {
    const comKey = row.COMID != null && Number(row.COMID) !== 0 ? String(row.COMID) : '';
    if (comKey && seenCom.has(comKey)) continue;
    records.push(await mapVcPlRow(pool, row, year, {
      status: 'Estimated',
      opsStatus: null,
    }));
  }

  records.forEach((record, index) => {
    record.srNo = index + 1;
  });

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbPlAtAGlanceTc(filters = {}, { includeInitial = false } = {}) {
  const pool = getPool();
  const year = filters.selYear || String(new Date().getFullYear());
  const typeFilter = estimateTypeFilter(filters.selBType, 'm');
  const team = teamFilter(filters.selTeam, 'm.CHARTERING_PIC');
  const [[company]] = await pool.query(
    'SELECT COMPANY_NAME FROM company_master WHERE COMPANYID = ? LIMIT 1',
    [COMPANY_ID],
  );
  const companyName = company?.COMPANY_NAME || '';

  const earningsSelect = `(SELECT VOYAGE_EARN_EST FROM chartering_tc_estimate_slave1 s
             WHERE s.TCOUTID = m.TCOUTID ORDER BY s.TC_SLAVE1ID DESC LIMIT 1) AS TC_EARNINGS`;

  const [opsRows] = await pool.query(
    `SELECT c.COMID, c.STATUS AS OPS_STATUS, m.TCOUTID, m.TC_NO, m.VESSEL_IMO_ID, m.SEL_CHARTERER,
            m.CHARTERING_PIC, m.CHARTERING_PIC_1, m.UPDATE_ON_DATE, m.TC_DATE, m.CP_DATE1,
            m.ESTIMATE_TYPE, m.DWT_SUMMER_CP,
            v.VESSEL_NAME, vend.NAME AS CHARTERER_NAME,
            ${earningsSelect},
            (SELECT VOYAGE_EARN_EST FROM chartering_tc_estimate_slave1 s
             WHERE s.TCOUTID = (
               SELECT TCOUTID FROM chartering_estimate_tc_master
               WHERE COMID = c.COMID AND (SHEET_NO IS NULL OR SHEET_NO = '')
               ORDER BY TCOUTID ASC LIMIT 1
             )
             ORDER BY s.TC_SLAVE1ID DESC LIMIT 1) AS TC_EARNINGS_INITIAL
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN vendor_master vend ON vend.CODE = m.SEL_CHARTERER
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2, 3, 4)
       AND ${YEAR_SQL_TC} = ?
       ${typeFilter.sql}
       ${team.sql}
     GROUP BY c.COMID
     ORDER BY COALESCE(m.CP_DATE1, m.UPDATE_ON_DATE, m.TC_DATE) DESC`,
    [MODULE_ID, COMPANY_ID, year, ...typeFilter.params, ...team.params],
  );

  const seenCom = new Set(
    opsRows
      .map((row) => (row.COMID != null && Number(row.COMID) !== 0 ? String(row.COMID) : ''))
      .filter(Boolean),
  );
  const seenTc = new Set(opsRows.map((row) => String(row.TCOUTID)));

  const [businessRows] = await pool.query(
    `SELECT m.COMID, m.TCOUTID, m.TC_NO, m.VESSEL_IMO_ID, m.SEL_CHARTERER,
            m.CHARTERING_PIC, m.CHARTERING_PIC_1, m.UPDATE_ON_DATE, m.TC_DATE, m.CP_DATE1,
            m.ESTIMATE_TYPE, m.DWT_SUMMER_CP,
            v.VESSEL_NAME, vend.NAME AS CHARTERER_NAME,
            ${earningsSelect}
     FROM chartering_estimate_tc_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN vendor_master vend ON vend.CODE = m.SEL_CHARTERER
     WHERE m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.FIXED = 1
       AND (m.SHEET_NO IS NULL OR m.SHEET_NO = '')
       AND ${YEAR_SQL_TC} = ?
       ${typeFilter.sql}
       ${team.sql}
     ORDER BY COALESCE(m.CP_DATE1, m.UPDATE_ON_DATE, m.TC_DATE) DESC`,
    [MODULE_ID, COMPANY_ID, year, ...typeFilter.params, ...team.params],
  );

  const mapTcRow = async (row, { status, opsStatus, includeInitialRow = false }) => {
    const earnings = row.TC_EARNINGS != null ? Number(row.TC_EARNINGS) : 0;
    const cpSource = row.CP_DATE1 || row.UPDATE_ON_DATE || row.TC_DATE;
    const record = {
      id: row.COMID || row.TCOUTID,
      type: 'tc',
      voyageNo: row.TC_NO || '',
      vesselName: row.VESSEL_NAME || '',
      charterer: row.CHARTERER_NAME || '',
      team: await loginName(pool, row.CHARTERING_PIC),
      pic1: await loginName(pool, row.CHARTERING_PIC),
      pic2: await loginName(pool, row.CHARTERING_PIC_1),
      chrtPic: await loginName(pool, row.CHARTERING_PIC),
      opsPic: await loginName(pool, row.CHARTERING_PIC_1),
      ownerName: companyName,
      owner: companyName,
      year: cpSource ? String(new Date(cpSource).getFullYear()) : year,
      q: quarterFromDate(cpSource),
      biz: bizLabel(row.ESTIMATE_TYPE),
      cpDate: safeDate(cpSource),
      eta: '—',
      dwt: Number(row.DWT_SUMMER_CP) || 0,
      cargoMt: 0,
      revenue: Number.isFinite(earnings) ? Math.max(0, earnings) : 0,
      costs: 0,
      finalPl: Number.isFinite(earnings) ? earnings : 0,
      tcEarnings: row.TC_EARNINGS != null ? Number(row.TC_EARNINGS).toFixed(2) : '',
      status,
      opsStatus,
      source: opsStatus != null ? 'ops' : 'business',
    };
    if (includeInitialRow) {
      record.tcEarningsInitial = row.TC_EARNINGS_INITIAL != null
        ? Number(row.TC_EARNINGS_INITIAL).toFixed(2)
        : '';
    }
    return record;
  };

  const records = [];
  for (const row of opsRows) {
    records.push(await mapTcRow(row, {
      status: statusLabel(row.OPS_STATUS),
      opsStatus: row.OPS_STATUS,
      includeInitialRow: includeInitial,
    }));
  }
  for (const row of businessRows) {
    const comKey = row.COMID != null && Number(row.COMID) !== 0 ? String(row.COMID) : '';
    if (comKey && seenCom.has(comKey)) continue;
    if (seenTc.has(String(row.TCOUTID))) continue;
    records.push(await mapTcRow(row, {
      status: 'Estimated',
      opsStatus: null,
    }));
  }

  records.forEach((record, index) => {
    record.srNo = index + 1;
  });

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbPlAtAGlanceVcTc(filters = {}) {
  const [vc, tc] = await Promise.all([
    dbPlAtAGlanceVc(filters),
    dbPlAtAGlanceTc(filters, { includeInitial: false }),
  ]);
  return {
    recordsVc: vc.records,
    recordsTc: tc.records,
    recordsTotal: vc.recordsTotal + tc.recordsTotal,
    isMgmtUser: isMgmtUser(),
  };
}

export async function dbCargoTonnageReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  if (!from || !to) {
    return { records: [], chart: [], recordsTotal: 0, isMgmtUser: isMgmtUser() };
  }

  const [rows] = await pool.query(
    `SELECT m.FCAID, m.QTY_TYPE_RADIO, m.BL_QTY_FREIGHT, m.CARGO_ID, m.ESTIMATE_TYPE,
            (SELECT MATERIAL_TYPE FROM cargo_master cm
             WHERE cm.MATERIALID = m.CARGO_ID
             LIMIT 1) AS CARGO_NAME
     FROM freight_cost_estimete_master m
     WHERE m.SHEET_NO IS NOT NULL AND m.SHEET_NO != ''
       AND m.TRANS_DATE >= ?
       AND m.TRANS_DATE <= ?
       AND m.MCOMPANYID = ?`,
    [from, to, COMPANY_ID],
  );

  const totals = new Map();

  for (const row of rows) {
    if (Number(row.QTY_TYPE_RADIO) === 1) {
      const name = row.CARGO_NAME || 'Unknown';
      const qty = Number(row.BL_QTY_FREIGHT) || 0;
      const prev = totals.get(name) || 0;
      totals.set(name, prev + qty);
    } else {
      const [parts] = await pool.query(
        `SELECT s.QUANTITY,
                (SELECT MATERIAL_TYPE FROM cargo_master cm
                 WHERE cm.MATERIALID = s.CARGO LIMIT 1) AS CARGO_NAME
         FROM freight_cost_estimete_slave7 s
         WHERE s.FCAID = ?`,
        [row.FCAID],
      );
      parts.forEach((part) => {
        const name = part.CARGO_NAME || 'Unknown';
        const qty = Number(part.QUANTITY) || 0;
        totals.set(name, (totals.get(name) || 0) + qty);
      });
    }
  }

  const records = [...totals.entries()]
    .map(([cargoName, qty], index) => ({
      id: index + 1,
      srNo: index + 1,
      cargoName,
      cargoQty: Number(qty).toFixed(2),
      cargoQtyK: Number(qty / 1000).toFixed(2),
    }))
    .sort((a, b) => Number(b.cargoQty) - Number(a.cargoQty));

  return {
    records,
    chart: records.map((r) => ({
      label: r.cargoName,
      value: Number(r.cargoQtyK) || 0,
    })),
    recordsTotal: records.length,
    isMgmtUser: isMgmtUser(),
  };
}

export function dbManagementFilterExtras() {
  return {
    teams: [
      { id: '', name: 'All' },
      { id: '7', name: 'Zafira' },
    ],
  };
}

export { isDbConfigured };
