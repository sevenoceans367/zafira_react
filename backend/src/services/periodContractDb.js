import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const VC_MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || '6';

function formatNumber(value, decimals = 2) {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  return num.toFixed(decimals);
}

async function getBunkerGradeName(pool, bunkerId) {
  if (!bunkerId) return '';
  const [rows] = await pool.query(
    'SELECT NAME FROM bunker_grade_master WHERE BUNKERGRADEID = ? LIMIT 1',
    [bunkerId],
  );
  return rows[0]?.NAME ?? String(bunkerId);
}

async function getPerformedDays(pool, periodId) {
  let performedDays = 0;

  const [tcRows] = await pool.query(
    `SELECT (SELECT TCOUTID FROM chartering_estimate_tc_master m
             WHERE m.COMID = c.COMID ORDER BY m.TCOUTID DESC LIMIT 1) AS TCOUTID
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.COMID = c.COMID
     WHERE m.PERIODID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
     GROUP BY m.COMID`,
    [periodId],
  );
  for (const tc of tcRows) {
    if (!tc.TCOUTID) continue;
    const [[sumRow]] = await pool.query(
      'SELECT SUM(TC_DAYS_EST) AS SUM FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ?',
      [tc.TCOUTID],
    );
    performedDays += Number(sumRow?.SUM || 0);
  }

  const [vcRows] = await pool.query(
    `SELECT (SELECT TOTAL_DAYS FROM freight_cost_estimete_master m
             WHERE m.COMID = c.COMID ORDER BY m.FCAID DESC LIMIT 1) AS TOTAL_DAYS
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.COMID = c.COMID
     WHERE m.PERIODID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
     GROUP BY m.COMID`,
    [periodId],
  );
  for (const vc of vcRows) {
    performedDays += Number(vc.TOTAL_DAYS || 0);
  }

  return performedDays;
}

async function getBunkerBalances(pool, periodId) {
  const [delRows] = await pool.query(
    `SELECT BUNKERGRADEID, BUNKER_QTY
     FROM period_contract_master_slave1
     WHERE IDENTITY = 'DEL' AND PERIODID = ?`,
    [periodId],
  );

  const opening = [];
  const closing = [];

  for (const delRow of delRows) {
    const bunkerId = delRow.BUNKERGRADEID;
    const bunkerName = await getBunkerGradeName(pool, bunkerId);
    const openingQty = Number(delRow.BUNKER_QTY || 0);
    opening.push(`${bunkerName} - ${formatNumber(openingQty, 4)} MT`);

    let remainingBunker = 0;

    const [tcRows] = await pool.query(
      `SELECT (SELECT TCOUTID FROM chartering_estimate_tc_master m
               WHERE m.COMID = c.COMID ORDER BY m.TCOUTID DESC LIMIT 1) AS TCOUTID
       FROM chartering_estimate_tc_compare c
       INNER JOIN chartering_estimate_tc_master m ON m.COMID = c.COMID
       WHERE m.PERIODID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
       GROUP BY m.COMID`,
      [periodId],
    );
    for (const tc of tcRows) {
      if (!tc.TCOUTID) continue;
      const [slaveRows] = await pool.query(
        'SELECT TC_SLAVE1ID FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ?',
        [tc.TCOUTID],
      );
      for (const slave of slaveRows) {
        const [[delBunker]] = await pool.query(
          `SELECT QTY FROM chartering_estimate_tc_slave5
           WHERE TC_SLAVE1ID = ? AND IDENTITY = 'DEL' AND BUNKERID = ?`,
          [slave.TC_SLAVE1ID, bunkerId],
        );
        const [[reDelBunker]] = await pool.query(
          `SELECT QTY FROM chartering_estimate_tc_slave5
           WHERE TC_SLAVE1ID = ? AND IDENTITY = 'REDEL' AND BUNKERID = ?`,
          [slave.TC_SLAVE1ID, bunkerId],
        );
        remainingBunker += Number(delBunker?.QTY || 0) - Number(reDelBunker?.QTY || 0);
      }
    }

    const [vcRows] = await pool.query(
      `SELECT (SELECT FCAID FROM freight_cost_estimete_master m
               WHERE m.COMID = c.COMID ORDER BY m.FCAID DESC LIMIT 1) AS FCAID
       FROM freight_cost_estimate_compare c
       INNER JOIN freight_cost_estimete_master m ON m.COMID = c.COMID
       WHERE m.PERIODID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
       GROUP BY m.COMID`,
      [periodId],
    );
    for (const vc of vcRows) {
      if (!vc.FCAID) continue;
      const [[consumption]] = await pool.query(
        `SELECT QTY FROM freight_cost_estimete_slave8
         WHERE IDENTIFY = 'CONSUMPTION' AND FCAID = ? AND BUNKERID = ?`,
        [vc.FCAID, bunkerId],
      );
      const [[supply]] = await pool.query(
        `SELECT QTY FROM freight_cost_estimete_slave8
         WHERE IDENTIFY = 'SUPPLY' AND FCAID = ? AND BUNKERID = ?`,
        [vc.FCAID, bunkerId],
      );
      remainingBunker += Number(supply?.QTY || 0) - Number(consumption?.QTY || 0);
    }

    closing.push(`${bunkerName} - ${formatNumber(openingQty - remainingBunker, 4)} MT`);
  }

  return {
    bunkerOpening: opening.join('\n'),
    bunkerClosing: closing.join('\n'),
  };
}

async function getInitialHire(pool, periodId) {
  const [[row]] = await pool.query(
    `SELECT HIRE_RATE FROM period_contract_master_slave4
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC
     LIMIT 1`,
    [periodId],
  );
  return row?.HIRE_RATE != null ? formatNumber(row.HIRE_RATE) : '';
}

function mapStatus(updateStatus, tab) {
  if (Number(updateStatus) === 1 || tab === 'open') {
    return 'Saved & Open Period Contract';
  }
  return 'Closed Period Contract';
}

export async function dbGetPeriodContractList({
  selBType,
  status = 'open',
  page = 1,
  pageSize = 10,
  search = '',
  sortColumn = 1,
  sortDir = 'desc',
}) {
  const pool = getPool();
  const businessType = selBType || '2';
  const updateStatus = status === 'closed' ? '2' : '1';
  const offset = (Math.max(1, page) - 1) * pageSize;
  const sortColumns = [
    'pcm.PERIODID', 'pcm.CONTRACT_ID', 'pcm.CONTRACT_NO', 'pcm.CONTRACT_DATE',
    'vim.VESSEL_NAME', 'vt.VesselType', 'vim.DWT', 'pcm.HIRE', 'pcm.OWN_BUSINESS_ACCOUNT',
  ];
  const orderCol = sortColumns[sortColumn] || 'pcm.PERIODID';
  const orderDir = sortDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['pcm.MCOMPANYID = ?', 'pcm.BUSINESSTYPE = ?', 'pcm.UPDATE_STATUS = ?'];
  const params = [appContext.companyId, businessType, updateStatus];

  if (search) {
    conditions.push(`(
      pcm.CONTRACT_ID LIKE ? OR pcm.CONTRACT_NO LIKE ? OR pcm.CONTRACT_DATE LIKE ?
      OR pcm.OWN_BUSINESS_ACCOUNT LIKE ? OR vim.VESSEL_NAME LIKE ?
      OR pcm.REMARKS LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  const where = conditions.join(' AND ');

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM period_contract_master pcm
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = pcm.VESSEL_IMO_ID
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT pcm.PERIODID, pcm.CONTRACT_ID, pcm.CONTRACT_NO, pcm.CONTRACT_DATE,
            pcm.DELIVERY_DATE, pcm.RE_DEL_MIN_DATE, pcm.RE_DEL_MAX_DATE,
            pcm.WORKING_CURRENCY, pcm.HIRE, pcm.REMARKS, pcm.UPDATE_STATUS,
            pcm.VESSEL_IMO_ID,
            vim.VESSEL_NAME, vim.DWT,
            vt.VesselType AS VESSEL_TYPE_NAME,
            (SELECT CONCAT(NAME, '(', CODE, ')')
             FROM vendor_master
             WHERE vendor_master.CODE = pcm.OWN_BUSINESS_ACCOUNT) AS OWN_BUSINESS_ACCOUNT
     FROM period_contract_master pcm
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = pcm.VESSEL_IMO_ID
     LEFT JOIN vessel_type_master vt ON vt.VesselTypeId = pcm.VESSEL_TYPE
     WHERE ${where}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const records = [];
  let index = offset;
  for (const row of rows) {
    index += 1;
    const totalDays = row.DELIVERY_DATE && row.RE_DEL_MAX_DATE
      ? (new Date(row.RE_DEL_MAX_DATE) - new Date(row.DELIVERY_DATE)) / (1000 * 60 * 60 * 24)
      : 0;
    const performedDays = await getPerformedDays(pool, row.PERIODID);
    const bunkers = await getBunkerBalances(pool, row.PERIODID);
    const initialHire = await getInitialHire(pool, row.PERIODID);

    records.push({
      index,
      periodId: row.PERIODID,
      contractId: row.CONTRACT_ID ?? '',
      contractNo: row.CONTRACT_NO ?? '',
      contractDate: formatDateDMY(row.CONTRACT_DATE),
      vesselName: row.VESSEL_NAME ?? '',
      vesselType: row.VESSEL_TYPE_NAME ?? '',
      dwt: row.DWT ?? '',
      initialHire: initialHire || formatNumber(row.HIRE),
      ownBusinessAccount: row.OWN_BUSINESS_ACCOUNT ?? '',
      reDelMinDate: formatDateDMY(row.RE_DEL_MIN_DATE),
      reDelMaxDate: formatDateDMY(row.RE_DEL_MAX_DATE),
      totalDays: formatNumber(totalDays, 5),
      performedDays: String(performedDays),
      balanceDays: formatNumber(totalDays - performedDays, 5),
      remarks: row.REMARKS ?? '',
      bunkerOpening: bunkers.bunkerOpening,
      bunkerClosing: bunkers.bunkerClosing,
      status: mapStatus(row.UPDATE_STATUS, status),
      workingCurrency: row.WORKING_CURRENCY ?? '',
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page,
    pageSize,
    status,
  };
}

export { VC_MODULE_ID };
