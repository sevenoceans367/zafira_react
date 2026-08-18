import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY, parsePeriodDate } from './estimateListMappers.js';

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

function buildPeriodContractFilters({
  selBType,
  status = 'open',
  search = '',
  periodFrom = '',
  periodTo = '',
}) {
  const businessType = selBType || '2';
  const conditions = ['pcm.MCOMPANYID = ?', 'pcm.BUSINESSTYPE = ?', 'pcm.UPDATE_STATUS = ?'];
  const params = [appContext.companyId, businessType, status === 'closed' ? '2' : '1'];

  const from = parsePeriodDate(periodFrom);
  const to = parsePeriodDate(periodTo);
  if (from) {
    conditions.push('DATE(pcm.CONTRACT_DATE) >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('DATE(pcm.CONTRACT_DATE) <= ?');
    params.push(to);
  }

  if (search) {
    conditions.push(`(
      pcm.CONTRACT_ID LIKE ? OR pcm.CONTRACT_NO LIKE ? OR pcm.CONTRACT_DATE LIKE ?
      OR pcm.OWN_BUSINESS_ACCOUNT LIKE ? OR vim.VESSEL_NAME LIKE ?
      OR pcm.REMARKS LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  return { where: conditions.join(' AND '), params, businessType };
}

const IN_OPS_SQL = `(
  EXISTS (
    SELECT 1
    FROM freight_cost_estimete_master m
    INNER JOIN freight_cost_estimate_compare c ON c.FCAID = m.FCAID
    WHERE m.PERIODID = pcm.PERIODID AND c.FINAL_ID != '' AND m.FIXED = 1
  )
  OR EXISTS (
    SELECT 1
    FROM chartering_estimate_tc_master m
    INNER JOIN chartering_estimate_tc_compare c ON c.TCOUTID = m.TCOUTID
    WHERE m.PERIODID = pcm.PERIODID AND c.FINAL_ID != '' AND m.FIXED = 1
  )
)`;

export async function dbGetPeriodBusinessStats({
  selBType,
  periodFrom = '',
  periodTo = '',
} = {}) {
  const pool = getPool();
  const { where, params } = buildPeriodContractFilters({
    selBType,
    status: 'open',
    periodFrom,
    periodTo,
  });

  const [[openRow]] = await pool.query(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT CASE
              WHEN pcm.VESSEL_IMO_ID IS NOT NULL AND pcm.VESSEL_IMO_ID != 0
              THEN pcm.VESSEL_IMO_ID END) AS vessels
     FROM period_contract_master pcm
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = pcm.VESSEL_IMO_ID
     WHERE ${where}`,
    params,
  );

  const [[opsRow]] = await pool.query(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT CASE
              WHEN pcm.VESSEL_IMO_ID IS NOT NULL AND pcm.VESSEL_IMO_ID != 0
              THEN pcm.VESSEL_IMO_ID END) AS vessels
     FROM period_contract_master pcm
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = pcm.VESSEL_IMO_ID
     WHERE ${where} AND ${IN_OPS_SQL}`,
    params,
  );

  return {
    openTrades: Number(openRow?.total || 0),
    vesselsOnSubs: Number(openRow?.vessels || 0),
    tradesInOperations: Number(opsRow?.total || 0),
    vesselsOnWater: Number(opsRow?.vessels || 0),
  };
}

export async function dbGetPeriodContractList({
  selBType,
  status = 'open',
  page = 1,
  pageSize = 10,
  search = '',
  sortColumn = 1,
  sortDir = 'desc',
  periodFrom = '',
  periodTo = '',
}) {
  const pool = getPool();
  const offset = (Math.max(1, page) - 1) * pageSize;
  const sortColumns = [
    'pcm.PERIODID', 'pcm.CONTRACT_ID', 'pcm.CONTRACT_NO', 'pcm.CONTRACT_DATE',
    'vim.VESSEL_NAME', 'vt.VesselType', 'vim.DWT', 'pcm.HIRE', 'pcm.OWN_BUSINESS_ACCOUNT',
  ];
  const orderCol = sortColumns[sortColumn] || 'pcm.PERIODID';
  const orderDir = sortDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const { where, params } = buildPeriodContractFilters({
    selBType,
    status,
    search,
    periodFrom,
    periodTo,
  });

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

  const stats = await dbGetPeriodBusinessStats({ selBType, periodFrom, periodTo });

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    stats,
    page,
    pageSize,
    status,
  };
}

export async function dbGetPeriodLinkedVoyage(periodId) {
  const pool = getPool();
  const id = Number(periodId);
  if (!id) return null;

  const [vcRows] = await pool.query(
    `SELECT m.FCAID, m.VOYAGE_NO
     FROM freight_cost_estimete_master m
     INNER JOIN freight_cost_estimate_compare c ON c.COMID = m.COMID
     WHERE m.PERIODID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
     ORDER BY m.FCAID DESC
     LIMIT 1`,
    [id],
  );
  if (vcRows[0]?.FCAID) {
    return {
      type: 'vc',
      id: String(vcRows[0].FCAID),
      voyageNo: vcRows[0].VOYAGE_NO != null ? String(vcRows[0].VOYAGE_NO) : '',
    };
  }

  const [tcRows] = await pool.query(
    `SELECT m.TCOUTID, m.TC_NO
     FROM chartering_estimate_tc_master m
     INNER JOIN chartering_estimate_tc_compare c ON c.COMID = m.COMID
     WHERE m.PERIODID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
     ORDER BY m.TCOUTID DESC
     LIMIT 1`,
    [id],
  );
  if (tcRows[0]?.TCOUTID) {
    return {
      type: 'tc',
      id: String(tcRows[0].TCOUTID),
      voyageNo: tcRows[0].TC_NO != null ? String(tcRows[0].TC_NO) : '',
    };
  }

  return null;
}

async function getPortName(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
    [portId],
  );
  return row?.PortName || '';
}

export async function dbGetPeriodNominations(periodId, { businessType } = {}) {
  const pool = getPool();
  const id = Number(periodId);
  if (!id) return null;

  const [[master]] = await pool.query(
    `SELECT PERIODID, CONTRACT_ID, CONTRACT_NO, WORKING_CURRENCY
     FROM period_contract_master
     WHERE PERIODID = ?
     LIMIT 1`,
    [id],
  );
  if (!master) return null;

  const voyageParams = [VC_MODULE_ID, appContext.companyId, id];
  let estimateTypeFilter = '';
  if (businessType) {
    estimateTypeFilter = ' AND m.ESTIMATE_TYPE = ?';
    voyageParams.push(businessType);
  }

  const [voyageRows] = await pool.query(
    `SELECT m.FCAID, m.COMID, m.VESSEL_IMO_ID, m.VOYAGE_NO, m.PROFIT_LOSS,
            m.QUANTITY, m.TRANS_DATE, m.TOTAL_DAYS, m.FIXED,
            v.VESSEL_NAME, v.DWT
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
       AND c.FINAL_ID != '' AND m.FIXED = 1
       AND m.PERIODID = ?${estimateTypeFilter}
     ORDER BY m.FCAID ASC`,
    voyageParams,
  );

  const voyages = [];
  let voyageIndex = 0;
  for (const row of voyageRows) {
    voyageIndex += 1;
    const [legs] = await pool.query(
      `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY
       FROM freight_cost_estimete_slave1
       WHERE FCAID = ?`,
      [row.FCAID],
    );
    const loadPorts = [];
    const discPorts = [];
    for (const leg of legs) {
      if (Number(leg.LOAD_PORT_QTY) > 0) {
        const name = await getPortName(pool, leg.FROM_PORT);
        if (name) loadPorts.push(name);
      }
      if (Number(leg.DISC_PORT_QTY) > 0) {
        const name = await getPortName(pool, leg.TO_PORT);
        if (name) discPorts.push(name);
      }
    }

    const [[qtyRow]] = await pool.query(
      `SELECT SUM(QUANTITY) AS sumQty
       FROM freight_cost_estimete_slave7
       WHERE FCAID = ?`,
      [row.FCAID],
    ).catch(() => [[{ sumQty: 0 }]]);

    const duration = Number(row.TOTAL_DAYS) || 0;
    const profitLoss = Number(row.PROFIT_LOSS) || 0;
    const cargoQty = Number(qtyRow?.sumQty || 0) + Number(row.QUANTITY || 0);
    const netTce = duration ? (profitLoss / duration) : 0;

    voyages.push({
      index: voyageIndex,
      fcaId: String(row.FCAID),
      comId: row.COMID != null ? String(row.COMID) : '',
      vesselName: row.VESSEL_NAME || '',
      voyageNo: row.VOYAGE_NO || '',
      cpDate: formatDateDMY(row.TRANS_DATE),
      dwt: row.DWT != null ? String(row.DWT) : '',
      lpDp: `${loadPorts.join(', ')}/ ${discPorts.join(', ')}`.trim(),
      duration: duration ? duration.toFixed(2) : '',
      cargoQuantity: cargoQty ? String(cargoQty) : '',
      netTce: netTce ? netTce.toFixed(2) : '',
      profitLoss: profitLoss ? profitLoss.toFixed(2) : '',
    });
  }

  const hireIn = await getInitialHire(pool, id);
  const [tcRows] = await pool.query(
    `SELECT m.TCOUTID, m.COMID, m.VESSEL_IMO_ID, m.TC_NO, m.CP_DATE1,
            m.DWT_SUMMER_CP, m.DEL_RANGE_PORT, m.RE_DEL_RANGE, m.EXCHANGE_RATE, m.HIRE_FIX_PER,
            v.VESSEL_NAME,
            (SELECT SUM(TC_DAYS_EST) FROM chartering_tc_estimate_slave1 s1
             WHERE s1.TCOUTID = m.TCOUTID) AS TC_DAYS_EST,
            (SELECT TC_RATE FROM chartering_tc_estimate_slave2 s2
             WHERE s2.TC_SLAVE1ID = (
               SELECT TC_SLAVE1ID FROM chartering_tc_estimate_slave1 s1
               WHERE s1.TCOUTID = m.TCOUTID LIMIT 1
             ) LIMIT 1) AS TC_RATE
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
       AND c.FINAL_ID != '' AND m.FIXED = 1
       AND m.PERIODID = ?
     ORDER BY m.TCOUTID ASC`,
    [VC_MODULE_ID, appContext.companyId, id],
  );

  const tcEstimates = tcRows.map((row, index) => {
    const exchange = Number(row.EXCHANGE_RATE);
    const hireOut = row.HIRE_FIX_PER != null && String(row.HIRE_FIX_PER).trim() !== ''
      ? formatNumber(Number(row.HIRE_FIX_PER) * (Number.isFinite(exchange) && exchange !== 0 ? exchange : 1))
      : (row.TC_RATE != null ? formatNumber(row.TC_RATE) : '');
    return {
      index: index + 1,
      tcOutId: String(row.TCOUTID),
      comId: row.COMID != null ? String(row.COMID) : '',
      vesselName: row.VESSEL_NAME || '',
      tcNo: row.TC_NO || '',
      cpDate: formatDateDMY(row.CP_DATE1),
      dwt: row.DWT_SUMMER_CP != null ? String(row.DWT_SUMMER_CP) : '',
      delPort: row.DEL_RANGE_PORT || '',
      reDelPort: row.RE_DEL_RANGE || '',
      tcDays: row.TC_DAYS_EST != null ? String(row.TC_DAYS_EST) : '',
      hireIn,
      hireOut,
      dailyGrossHire: hireOut,
    };
  });

  return {
    periodId: id,
    contractId: master.CONTRACT_ID || '',
    contractNo: master.CONTRACT_NO || '',
    workingCurrency: master.WORKING_CURRENCY || 'USD',
    voyages,
    tcEstimates,
  };
}

export { VC_MODULE_ID };
