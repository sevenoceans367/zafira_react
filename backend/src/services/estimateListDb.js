import { appContext } from '../config.js';
import { getPool } from '../db.js';
import {
  ESTIMATE_TYPE_LABELS,
  formatDateDMY,
  getCargoQuantity,
  getFreightLabel,
  mapCompareRow,
  mapListRow,
  parsePeriodDate,
} from './estimateListMappers.js';

const SLAVE_TABLES = [
  'freight_cost_estimete_slave1',
  'freight_cost_estimete_slave2',
  'freight_cost_estimete_slave3',
  'freight_cost_estimete_slave4',
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

async function copySlaveRows(connection, tableName, sourceId, targetId) {
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
}

async function loadPortLegs(fcaIds) {
  if (!fcaIds.length) return {};

  const pool = getPool();
  const placeholders = fcaIds.map(() => '?').join(',');
  const [legs] = await pool.query(
    `SELECT s.FCAID, s.FROM_PORT, s.TO_PORT, s.LOAD_PORT_QTY, s.DISC_PORT_QTY, s.PASSAGE_TYPE,
            fp.PortName AS FROM_PORT_NAME, fp.COUNTRY_KEY AS FROM_COUNTRY,
            tp.PortName AS TO_PORT_NAME, tp.COUNTRY_KEY AS TO_COUNTRY
     FROM freight_cost_estimete_slave1 s
     LEFT JOIN port_master fp ON fp.PortId = s.FROM_PORT
     LEFT JOIN port_master tp ON tp.PortId = s.TO_PORT
     WHERE s.FCAID IN (${placeholders})`,
    fcaIds,
  );

  const grouped = {};
  for (const leg of legs) {
    const key = String(leg.FCAID);
    if (!grouped[key]) {
      grouped[key] = { load: [], discharge: [], ballast: [] };
    }

    const fromLabel = leg.FROM_PORT_NAME
      ? `${leg.FROM_PORT_NAME} (${leg.FROM_COUNTRY || ''})`
      : '';
    const toLabel = leg.TO_PORT_NAME
      ? `${leg.TO_PORT_NAME} (${leg.TO_COUNTRY || ''})`
      : '';

    if (Number(leg.LOAD_PORT_QTY) > 0 && fromLabel) {
      grouped[key].load.push(fromLabel);
    }
    if (Number(leg.DISC_PORT_QTY) > 0 && toLabel) {
      grouped[key].discharge.push(toLabel);
    }
    if (Number(leg.PASSAGE_TYPE) === 1 && fromLabel) {
      grouped[key].ballast.push(fromLabel);
    }
  }

  return grouped;
}

async function enrichDryCargoQuantity(rows) {
  const pool = getPool();
  const dryRows = rows.filter(
    (row) => Number(row.ESTIMATE_TYPE) === 3 && Number(row.QTY_TYPE_RADIO) !== 1,
  );
  if (!dryRows.length) return rows;

  const ids = dryRows.map((row) => row.FCAID);
  const placeholders = ids.map(() => '?').join(',');
  const [sums] = await pool.query(
    `SELECT FCAID, SUM(QUANTITY) AS sumQty, SUM(GROSS_FREIGHT) AS sumFreight
     FROM freight_cost_estimete_slave7
     WHERE FCAID IN (${placeholders})
     GROUP BY FCAID`,
    ids,
  );

  const sumById = Object.fromEntries(
    sums.map((row) => [String(row.FCAID), row]),
  );

  return rows.map((row) => {
    if (Number(row.ESTIMATE_TYPE) === 3 && Number(row.QTY_TYPE_RADIO) !== 1) {
      const extra = sumById[String(row.FCAID)];
      return {
        ...row,
        slave7SumQty: extra?.sumQty ?? 0,
        slave7SumFreight: extra?.sumFreight ?? 0,
      };
    }
    return row;
  });
}

function normalizeMasterRow(row) {
  return {
    fcaId: String(row.FCAID),
    estimateType: Number(row.ESTIMATE_TYPE),
    vesselName: row.VESSEL_NAME || '',
    vesselType: row.VESSEL_TYPE || '',
    voyageName: row.VOYAGE_NAME || '',
    transDate: row.TRANS_DATE,
    dwt: row.DWT ?? '',
    totalDays: Number(row.TOTAL_DAYS || 0),
    gasQuantity: Number(row.GAS_QUANTITY || 0),
    tankQuantity: Number(row.TANK_QUANTITY || 0),
    quantity: Number(row.QUANTITY || 0),
    qtyTypeRadio: Number(row.QTY_TYPE_RADIO || 1),
    dailyEarning: row.DAILY_EARNING,
    netDailyEarning: row.NET_DAILY_EARNING,
    dailyVesselOperationExp: row.DAILY_VESSEL_OPERATION_EXP,
    profitLoss: row.PROFIT_LOSS,
    charteringPicName: row.CHARTERING_PIC_NAME || '',
    ifBenchmark: Number(row.IF_BENCHMARK || 0),
    comid: row.COMID ? String(row.COMID) : '',
    gasMarket: Number(row.GAS_MARKET || 0),
    gasBaseRate: row.GAS_BASE_RATE,
    gasLumsum: row.GAS_LUMSUM,
    tankerRadioSingleDis: Number(row.TANKER_RADIO_SINGLE_DIS || 1),
    chkLumpsum: Number(row.CHK_LUMPSUM || 0),
    lumpsumAmt: row.LUMPSUMAMT,
    freightGross: row.FREIGHT_GROSS,
    minWs: row.MIN_WS,
    slave10Sum: row.slave10Sum,
    slave7SumQty: row.slave7SumQty,
    slave7SumFreight: row.slave7SumFreight,
  };
}

function buildPeriodFilter(periodFrom, periodTo) {
  const from = parsePeriodDate(periodFrom);
  const to = parsePeriodDate(periodTo);
  if (!from && !to) {
    return { sql: '', params: [] };
  }
  if (from && to) {
    return {
      sql: ' AND DATE(m.TRANS_DATE) >= ? AND DATE(m.TRANS_DATE) <= ?',
      params: [from, to],
    };
  }
  if (from) {
    return { sql: ' AND DATE(m.TRANS_DATE) >= ?', params: [from] };
  }
  return { sql: ' AND DATE(m.TRANS_DATE) <= ?', params: [to] };
}

async function fetchMasterRows(selBType, fcaIds = null, { excludeSentToChart = false, periodFrom, periodTo } = {}) {
  const pool = getPool();
  const params = [appContext.moduleId, appContext.companyId, selBType];
  let idFilter = '';
  const comidFilter = excludeSentToChart
    ? ` AND (m.COMID IS NULL OR m.COMID = '' OR m.COMID = 0)`
    : '';
  const periodFilter = buildPeriodFilter(periodFrom, periodTo);

  if (fcaIds?.length) {
    idFilter = ` AND m.FCAID IN (${fcaIds.map(() => '?').join(',')})`;
  }

  const [rows] = await pool.query(
    `SELECT m.FCAID, m.VESSEL_IMO_ID, m.VOYAGE_NAME, m.VESSEL_TYPE, m.FREIGHT_GROSS,
            m.TOTAL_DAYS, m.QUANTITY, m.DAILY_EARNING, m.NET_DAILY_EARNING,
            m.DAILY_VESSEL_OPERATION_EXP,
            m.PROFIT_LOSS, m.TRANS_DATE, m.QTY_TYPE_RADIO, m.ESTIMATE_TYPE,
            m.GAS_QUANTITY, m.TANK_QUANTITY, m.IF_BENCHMARK, m.COMID,
            m.GAS_MARKET, m.GAS_BASE_RATE, m.GAS_LUMSUM, m.TANKER_RADIO_SINGLE_DIS,
            m.CHK_LUMPSUM, m.LUMPSUMAMT,
            v.VESSEL_NAME, v.DWT,
            l.CONTACT_PERSON AS CHARTERING_PIC_NAME,
            ws.MIN_WS
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN login l ON l.LOGINID = m.CHARTERING_PIC
     LEFT JOIN (
       SELECT FCAID, MIN_WS FROM freight_cost_estimete_slave12
     ) ws ON ws.FCAID = m.FCAID
     WHERE m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.ESTIMATE_TYPE = ?
       AND m.COAID IS NULL
       AND m.FIXED = 0
       ${comidFilter}
       ${periodFilter.sql}
       ${idFilter}
     ORDER BY m.FCAID DESC`,
    [...params, ...periodFilter.params, ...(fcaIds ?? [])],
  );

  return enrichDryCargoQuantity(rows);
}

async function fetchEstimateStats(selBType, { periodFrom, periodTo } = {}) {
  const pool = getPool();
  const periodFilter = buildPeriodFilter(periodFrom, periodTo);
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS vesselsOnWater,
       SUM(CASE WHEN (m.COMID IS NULL OR m.COMID = '' OR m.COMID = 0) THEN 1 ELSE 0 END) AS vesselsInSubs,
       SUM(CASE WHEN (m.COMID IS NULL OR m.COMID = '' OR m.COMID = 0) THEN COALESCE(m.PROFIT_LOSS, 0) ELSE 0 END) AS openTradePl,
       SUM(CASE WHEN (m.COMID IS NOT NULL AND m.COMID != '' AND m.COMID != 0) THEN COALESCE(m.PROFIT_LOSS, 0) ELSE 0 END) AS tradesInOperationsPl
     FROM freight_cost_estimete_master m
     WHERE m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.ESTIMATE_TYPE = ?
       AND m.COAID IS NULL
       AND m.FIXED = 0
       ${periodFilter.sql}`,
    [appContext.moduleId, appContext.companyId, selBType, ...periodFilter.params],
  );

  const row = rows[0] ?? {};
  return {
    openTrade: Number(row.openTradePl ?? 0) / 1000,
    vesselsInSubs: Number(row.vesselsInSubs ?? 0),
    tradesInOperations: Number(row.tradesInOperationsPl ?? 0) / 1000,
    vesselsOnWater: Number(row.vesselsOnWater ?? 0),
  };
}

export async function dbGetEstimateList({ selBType, periodFrom, periodTo }) {
  if (!selBType) {
    return {
      estimateType: null,
      businessType: '',
      rows: [],
      stats: {
        openTrade: 0,
        vesselsInSubs: 0,
        tradesInOperations: 0,
        vesselsOnWater: 0,
      },
    };
  }

  const periodOptions = { periodFrom, periodTo };
  const [masterRows, stats] = await Promise.all([
    fetchMasterRows(selBType, null, periodOptions),
    fetchEstimateStats(selBType, periodOptions),
  ]);
  const fcaIds = masterRows.map((row) => row.FCAID);
  const portLegs = await loadPortLegs(fcaIds);

  const normalized = masterRows.map(normalizeMasterRow);
  const rows = normalized.map((row, index) => mapListRow(row, index, portLegs));

  return {
    estimateType: Number(selBType),
    businessType: selBType,
    rows,
    stats,
  };
}

export async function dbDeleteEstimate(id) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const tables = SLAVE_TABLES;

    for (const table of tables) {
      await connection.query(`DELETE FROM ${table} WHERE FCAID = ?`, [id]);
    }

    const [result] = await connection.query(
      'DELETE FROM freight_cost_estimete_master WHERE FCAID = ?',
      [id],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return null;
    }

    await connection.commit();
    return { msg: 2 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbReplicateEstimate(id) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [sourceRows] = await connection.query(
      'SELECT * FROM freight_cost_estimete_master WHERE FCAID = ?',
      [id],
    );
    if (!sourceRows.length) {
      await connection.rollback();
      return null;
    }

    const source = sourceRows[0];
    const columns = await getInsertableColumns(connection, 'freight_cost_estimete_master');
    const dataColumns = columns.filter((column) => column !== 'FCAID');
    const values = dataColumns.map((column) => {
      switch (column) {
        case 'COMID':
        case 'COAID':
          return null;
        case 'FIXED':
          return '0';
        case 'VOYAGE_NAME':
          return source.VOYAGE_NAME ? `${source.VOYAGE_NAME} (Copy)` : '';
        case 'ADD_ON_DATE':
        case 'TRANS_DATE':
          return new Date();
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

    for (const table of SLAVE_TABLES) {
      await copySlaveRows(connection, table, id, newId);
    }

    await connection.commit();
    return { msg: 0, newId: String(newId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbGetCompareEstimates(ids) {
  const idList = ids.map(String);
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT m.*, v.VESSEL_NAME, v.DWT, ws.MIN_WS
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN (
       SELECT FCAID, MIN_WS FROM freight_cost_estimete_slave12
     ) ws ON ws.FCAID = m.FCAID
     WHERE m.FCAID IN (${idList.map(() => '?').join(',')})
     ORDER BY m.FCAID DESC`,
    idList,
  );

  const enriched = await enrichDryCargoQuantity(rows);
  const portLegs = await loadPortLegs(idList);
  const normalized = enriched.map(normalizeMasterRow);

  return {
    businessType: normalized[0]?.estimateType ?? null,
    count: normalized.length,
    fixtures: normalized.map((row, index) => mapCompareRow(row, index, portLegs)),
  };
}

export async function dbSendEstimateToOps(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT FCAID, COMID
     FROM freight_cost_estimete_master
     WHERE FCAID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [id, appContext.moduleId, appContext.companyId],
  );

  if (!rows.length) return null;

  const comid = rows[0].COMID;
  if (comid != null && comid !== '' && Number(comid) !== 0) {
    throw new Error('This estimate has already been sent to Operations.');
  }

  return dbSubmitDecisionChart({
    selection: {
      id: String(id),
      remarks: 'Sent to Operations',
    },
  });
}

export async function dbSubmitDecisionChart({ selection }) {
  const { id, remarks } = selection ?? {};
  if (!id || !remarks?.trim()) {
    throw new Error('Please select one Fixture and fill remarks');
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  const year = new Date().getFullYear();

  try {
    await connection.beginTransaction();

    const [maxRows] = await connection.query(
      `SELECT (MAX(MESSAGE_NO) + 1) AS MESSAGE_NO
       FROM freight_cost_estimate_compare
       WHERE YEAR(ADD_ON_DATE) = ? AND MCOMPANYID = ? AND COAAID IS NULL`,
      [year, appContext.companyId],
    );

    let messageNo = maxRows[0]?.MESSAGE_NO;
    if (!messageNo) {
      messageNo = 1;
    }
    const padded = String(messageNo).padStart(3, '0');
    const yearSuffix = String(year).slice(-2);
    const message = `${yearSuffix}-${padded}`;

    const [compareResult] = await connection.query(
      `INSERT INTO freight_cost_estimate_compare
        (FCAID, FINAL_ID, MESSAGE_NO, USERID, REMARKS, ADD_ON_DATE, MESSAGE, MODULEID, MCOMPANYID)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [id, id, padded, appContext.userId, remarks, message, appContext.moduleId, appContext.companyId],
    );

    await connection.query(
      'UPDATE freight_cost_estimete_master SET COMID = ? WHERE FCAID = ?',
      [compareResult.insertId, id],
    );

    await connection.commit();

    return {
      msg: 0,
      message,
      messageNo: padded,
      redirect: '/internal-user/sopf/decisionchart_list',
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
