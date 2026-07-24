import { appContext } from '../config.js';
import { getPool } from '../db.js';

function monthShort(dateValue) {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function collapseStatus(status) {
  const code = Number(status);
  if (code === 1) return 1;
  if (code === 2) return 2;
  if (code === 3 || code === 4) return 3;
  return code || 0;
}

async function resolveVcCharterer(pool, comid, businessType) {
  if (!comid) return '';
  const [[sheet]] = await pool.query(
    `SELECT QTY_TYPE_RADIO, FGFF_VENDORID, LUMP_VENDOR, FCAID
     FROM freight_cost_estimete_master
     WHERE COMID = ? AND SHEET_NO IS NOT NULL
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comid],
  );
  if (!sheet) return '';

  const qtyRadio = Number(sheet.QTY_TYPE_RADIO);
  const isSpot = String(businessType) === '2';

  if (isSpot) {
    if (qtyRadio === 1) {
      const [[vendor]] = await pool.query(
        'SELECT NAME AS name FROM vendor_master WHERE CODE = ? LIMIT 1',
        [sheet.LUMP_VENDOR],
      );
      return vendor?.name || '';
    }
    const [rows] = await pool.query(
      'SELECT CUSTOMER FROM freight_cost_estimete_slave12 WHERE FCAID = ?',
      [sheet.FCAID],
    );
    return rows.map((row) => row.CUSTOMER).filter(Boolean).join(', ');
  }

  if (qtyRadio === 1) {
    const [[vendor]] = await pool.query(
      'SELECT NAME AS name FROM vendor_master WHERE CODE = ? LIMIT 1',
      [sheet.FGFF_VENDORID],
    );
    return vendor?.name || '';
  }

  const [rows] = await pool.query(
    `SELECT (SELECT NAME FROM vendor_master WHERE vendor_master.CODE = freight_cost_estimete_slave7.QTY_VENDORID) AS name
     FROM freight_cost_estimete_slave7
     WHERE FCAID = ?`,
    [sheet.FCAID],
  );
  return rows.map((row) => row.name).filter(Boolean).join(', ');
}

async function searchVcByVoyage(pool, { voyageNo, businessType, coaOnly }) {
  const [rows] = await pool.query(
    `SELECT YEAR(m.ADD_ON_DATE) AS year, c.status AS status
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND m.ESTIMATE_TYPE = ?
       AND m.VOYAGE_NO = ?
       AND m.FINAL_ID IS NOT NULL AND m.FINAL_ID != ''
       AND ${coaOnly ? 'm.COAAID IS NOT NULL' : 'm.COAAID IS NULL'}
     ORDER BY DATE(m.FINAL_DATETIME) DESC
     LIMIT 1`,
    [appContext.moduleId, appContext.companyId, businessType, voyageNo],
  );
  return rows[0] || null;
}

async function searchTcByVoyage(pool, { voyageNo, businessType }) {
  const [rows] = await pool.query(
    `SELECT YEAR(m.UPDATE_ON_DATE) AS year, c.STATUS AS status
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND m.ESTIMATE_TYPE = ?
       AND m.TC_NO = ?
     ORDER BY DATE(m.FINAL_DATETIME) DESC
     LIMIT 1`,
    [appContext.moduleId, appContext.companyId, businessType, voyageNo],
  );
  return rows[0] || null;
}

/** PHP options.php id=126 — search by voyage / TC number. */
export async function dbSearchTodoVoyageByNumber({ voyageNo, voyType, businessType }) {
  const pool = getPool();
  const type = String(voyType || '').toUpperCase();
  const voyage = String(voyageNo || '').trim();
  const bType = String(businessType || '').trim();

  if (!voyage || !type || !bType) {
    return { res: 0, type: type.toLowerCase() === 'COA' ? 'COA' : type.toLowerCase(), year: 0, voyage: 0 };
  }

  if (type === 'VC' || type === 'COA') {
    const row = await searchVcByVoyage(pool, {
      voyageNo: voyage,
      businessType: bType,
      coaOnly: type === 'COA',
    });
    const outType = type === 'COA' ? 'COA' : 'vc';
    if (!row) return { res: 0, type: outType, year: 0, voyage: 0 };
    return {
      status: collapseStatus(row.status),
      type: outType,
      voyage,
      year: row.year || 0,
    };
  }

  if (type === 'TC') {
    const row = await searchTcByVoyage(pool, { voyageNo: voyage, businessType: bType });
    if (!row) return { res: 0, type: 'tc', year: 0, voyage: 0 };
    return {
      status: collapseStatus(row.status),
      type: 'tc',
      voyage,
      year: row.year || 0,
    };
  }

  return { res: 0, type: 'vc', year: 0, voyage: 0 };
}

/** PHP options.php id=153 — search voyages by vessel. */
export async function dbSearchTodoVoyagesByVessel({ vesselId, voyType, businessType }) {
  const pool = getPool();
  const type = String(voyType || '').toUpperCase();
  const vessel = String(vesselId || '').trim();
  const bType = String(businessType || '').trim();
  const result = [];

  if (!vessel || !type || !bType) {
    return [{ res: 0, type: type === 'COA' ? 'COA' : type.toLowerCase(), year: 0, voyage: 0 }];
  }

  if (type === 'VC' || type === 'COA') {
    const [rows] = await pool.query(
      `SELECT YEAR(m.ADD_ON_DATE) AS year,
              c.status AS status,
              m.VOYAGE_NO AS voyageNo,
              m.COMID AS comid,
              m.ADD_ON_DATE AS cpDate
       FROM freight_cost_estimate_compare c
       INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
       WHERE c.MODULEID = ?
         AND c.MCOMPANYID = ?
         AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
         AND m.FIXED = 1
         AND m.ESTIMATE_TYPE = ?
         AND m.VESSEL_IMO_ID = ?
         AND m.FINAL_ID IS NOT NULL AND m.FINAL_ID != ''
         AND ${type === 'COA' ? 'm.COAAID IS NOT NULL' : 'm.COAAID IS NULL'}
       ORDER BY DATE(m.FINAL_DATETIME) DESC`,
      [appContext.moduleId, appContext.companyId, bType, vessel],
    );

    if (!rows.length) {
      return [{ res: 0, type: type === 'COA' ? 'COA' : 'vc', year: 0, voyage: 0 }];
    }

    for (const row of rows) {
      const charterer = await resolveVcCharterer(pool, row.comid, bType);
      result.push({
        status: Number(row.status) || 0,
        type: type === 'COA' ? 'COA' : 'vc',
        voyage: row.voyageNo || '',
        year: row.year || 0,
        Charterer: charterer,
        CP_DATE: monthShort(row.cpDate),
      });
    }
    return result;
  }

  if (type === 'TC') {
    const [rows] = await pool.query(
      `SELECT YEAR(m.UPDATE_ON_DATE) AS year,
              c.STATUS AS status,
              m.TC_NO AS tcNo,
              m.UPDATE_ON_DATE AS updateOnDate,
              (SELECT NAME FROM vendor_master WHERE vendor_master.CODE = m.SEL_CHARTERER) AS charterer
       FROM chartering_estimate_tc_compare c
       INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
       WHERE c.MODULEID = ?
         AND c.MCOMPANYID = ?
         AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
         AND m.FIXED = 1
         AND m.ESTIMATE_TYPE = ?
         AND m.VESSEL_IMO_ID = ?
       ORDER BY DATE(m.FINAL_DATETIME) DESC`,
      [appContext.moduleId, appContext.companyId, bType, vessel],
    );

    if (!rows.length) {
      return [{ res: 0, type: 'tc', year: 0, voyage: 0 }];
    }

    return rows.map((row) => ({
      status: Number(row.status) || 0,
      type: 'tc',
      voyage: row.tcNo || '',
      year: row.year || 0,
      Charterer: row.charterer || '',
      CP_DATE: monthShort(row.updateOnDate),
    }));
  }

  return [{ res: 0, type: 'vc', year: 0, voyage: 0 }];
}
