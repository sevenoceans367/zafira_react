import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { ESTIMATE_TYPE_LABELS, formatDateDMY } from './estimateListMappers.js';

function toDbDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const [d, m, y] = str.split(/[-/]/);
  if (d && m && y) {
    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

function numOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function randomId() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

function mapPortLeg(row, index) {
  return {
    id: row.RANDOMID ?? row.FCA_SLAVEID ?? row.FCA_SLVID ?? `${row.FCAID}-${index}`,
    fromPortId: row.FROM_PORT,
    toPortId: row.TO_PORT,
    fromPortName: row.FROM_PORT_NAME ?? '',
    toPortName: row.TO_PORT_NAME ?? '',
    passageType: row.PASSAGE_TYPE,
    speedType: row.SPEED_TYPE,
    loadQty: row.LOAD_PORT_QTY,
    dischargeQty: row.DISC_PORT_QTY,
    distance: row.DISTANCE ?? '',
    seaDays: row.TOTAL_VOYAGE_DAYS ?? row.SEA_DAYS ?? '',
    loadPortCost: row.LOAD_PORT_COST ?? '',
    discPortCost: row.DISC_PORT_COST ?? '',
    loadPortRate: row.LOAD_PORT_RATE ?? '',
    discPortRate: row.DISC_PORT_RATE ?? '',
  };
}

function mapCargoRow(row, index) {
  return {
    id: row.RANDOMID ?? `cargo-${row.FCAID}-${index}`,
    cargoId: row.CARGOID != null ? String(row.CARGOID) : '',
    cargoName: row.CARGO_NAME ?? '',
    cargoCbm: row.CARGO_CBM ?? '',
    cargoMt: row.CARGO_MT ?? '',
    rateUsdMt: row.RATE_USD_MT ?? '',
    amountUsd: row.AMOUNT_USD ?? '',
    charterer: row.SHIPPER_CHARTER ?? '',
    status: row.STATUS ?? 1,
  };
}

function mapBunkerRow(row, index) {
  return {
    id: `bunker-${row.FCAID}-${index}`,
    bunkerGradeId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
    qty: row.QTY ?? '',
    price: row.PRICE ?? '',
    cost: row.COST ?? '',
    identify: row.IDENTIFY || 'CONSUMPTION',
  };
}

function mapEstimateDetail(master, portLegs = [], cargoRows = [], bunkerRows = [], brokerage = null) {
  const estimateType = Number(master.ESTIMATE_TYPE);
  return {
    id: String(master.FCAID),
    fixtureTypeId: Number(master.FIXTURETYPEID) || null,
    estimateType,
    estimateTypeLabel: ESTIMATE_TYPE_LABELS[estimateType] ?? '',
    vesselImoId: master.VESSEL_IMO_ID,
    vesselName: master.VESSEL_NAME ?? '',
    imoNo: master.IMO_NO ?? '',
    vesselType: master.VESSEL_TYPE ?? '',
    flag: master.FLAG ?? '',
    transDate: formatDateDMY(master.TRANS_DATE),
    voyageNo: master.VOYAGE_NO ?? '',
    voyageName: master.VOYAGE_NAME ?? '',
    dwtSummer: master.DWT_SUMMER ?? master.VESSEL_DWT ?? '',
    dwtTropical: master.DWT_TOPICAL ?? '',
    gnrt: master.GNRT ?? '',
    nrt: master.GNRT ? Number((Number(master.GNRT) * 0.7).toFixed(2)) : '',
    loa: master.LOA ?? '',
    tpc: master.TPC ?? '',
    gear: master.GEAR ?? '',
    builtYear: master.BUILT_YEAR ?? '',
    beam: master.BEAM ?? '',
    loadable: master.LOADABLE ?? '',
    stowageFactor: master.STOWAGE_FACTOR ?? '',
    grainCap: master.GRAIN_CAP ?? '',
    baleCap: master.BALE_CAP ?? '',
    totalDays: master.TOTAL_DAYS ?? '',
    totalDistance: master.TOTAL_DISTANCE ?? '',
    cargoQuantity: master.QUANTITY ?? master.TANK_QUANTITY ?? master.GAS_QUANTITY ?? '',
    dailyEarning: master.DAILY_EARNING ?? '',
    dailyVesselOperationExp: master.DAILY_VESSEL_OPERATION_EXP ?? '',
    profitLoss: master.PROFIT_LOSS ?? '',
    freightGross: master.FREIGHT_GROSS ?? '',
    revenue: master.REVENUE ?? master.FREIGHT_GROSS ?? '',
    voyageEarnings: master.VOYAGE_EARNINGS ?? '',
    totalBunkerCost: master.TOTAL_BUNKER_COST ?? '',
    totalPortCost: master.TOTAL_PORT_COST ?? '',
    hireRate: master.HIRE_RATE ?? '',
    hireAmt: master.HIRE_AMT ?? '',
    brokeragePercent: brokerage?.BROKAGE_PERCENT ?? master.BROKERAGE_PERCENT ?? '',
    brokerageAmt: brokerage?.BROKAGE_AMT ?? master.BROKERAGE_AMT ?? '',
    cveAmt: master.CVE_AMT ?? '',
    ballastBonus: master.BALLAST_BONUS ?? '',
    lumpsum: master.LUMPSUM ?? '',
    lumpsumQty: master.LUMPSUM_QTY ?? '',
    marketRate: master.MARKET_RATE ?? '',
    addCommPercent: master.ADD_COMM ?? '',
    charteringPic: master.CHARTERING_PIC_NAME ?? '',
    comid: master.COMID || null,
    fixed: Number(master.FIXED) === 1,
    portLegs: portLegs.map((row, index) => mapPortLeg(row, index)),
    cargoRows: cargoRows.map((row, index) => mapCargoRow(row, index)),
    bunkerRows: bunkerRows.map((row, index) => mapBunkerRow(row, index)),
  };
}

const HEADER_UPDATE_FIELDS = {
  fixtureTypeId: 'FIXTURETYPEID',
  vesselType: 'VESSEL_TYPE',
  flag: 'FLAG',
  transDate: 'TRANS_DATE',
  voyageNo: 'VOYAGE_NO',
  voyageName: 'VOYAGE_NAME',
  dwtSummer: 'DWT_SUMMER',
  gnrt: 'GNRT',
};

export async function dbGetEstimateLookups(estimateType = 2) {
  const pool = getPool();
  const type = Number(estimateType) || 2;

  const [cargos] = await pool.query(
    `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name
     FROM cargo_master
     WHERE STATUS = 1
       AND (MATERIAL_TYPEID = ? OR MATERIAL_TYPEID IS NULL OR MATERIAL_TYPEID = '')
     ORDER BY MATERIAL_CODE_DESC
     LIMIT 500`,
    [type],
  );

  let cargoRows = cargos;
  if (!cargoRows.length) {
    const [allCargos] = await pool.query(
      `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name
       FROM cargo_master
       WHERE STATUS = 1
       ORDER BY MATERIAL_CODE_DESC
       LIMIT 500`,
    );
    cargoRows = allCargos;
  }

  const [bunkerGrades] = await pool.query(
    `SELECT BUNKERGRADEID AS id, NAME AS name, BUNKERTYPE
     FROM bunker_grade_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  return {
    cargos: cargoRows.map((row) => ({ id: String(row.id), name: row.name ?? '' })),
    bunkerGrades: bunkerGrades.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
      bunkerType: row.BUNKERTYPE ?? '',
    })),
  };
}

export async function dbGetPeriodPrefill(periodId) {
  const pool = getPool();
  const id = String(periodId || '').trim();
  if (!id) return null;

  const [[period]] = await pool.query(
    `SELECT BROKERAGE, ADD_COMM
     FROM period_contract_master
     WHERE PERIODID = ?
     LIMIT 1`,
    [id],
  );
  if (!period) return null;

  const [[hire]] = await pool.query(
    `SELECT HIRE_RATE
     FROM period_contract_master_slave4
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC
     LIMIT 1`,
    [id],
  );

  return {
    periodId: id,
    brokeragePercent: period.BROKERAGE != null ? String(period.BROKERAGE) : '',
    addCommPercent: period.ADD_COMM != null ? String(period.ADD_COMM) : '',
    hireRate: hire?.HIRE_RATE != null ? String(hire.HIRE_RATE) : '',
  };
}

export async function dbGetEstimateDetail(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT m.*, v.VESSEL_NAME, v.IMO_NO, v.DWT AS VESSEL_DWT,
            l.CONTACT_PERSON AS CHARTERING_PIC_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN login l ON l.LOGINID = m.CHARTERING_PIC
     WHERE m.FCAID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?`,
    [id, appContext.moduleId, appContext.companyId],
  );

  if (!rows.length) return null;

  const [legs] = await pool.query(
    `SELECT s.*,
            fp.PortName AS FROM_PORT_NAME,
            tp.PortName AS TO_PORT_NAME
     FROM freight_cost_estimete_slave1 s
     LEFT JOIN port_master fp ON fp.PortId = s.FROM_PORT
     LEFT JOIN port_master tp ON tp.PortId = s.TO_PORT
     WHERE s.FCAID = ?
     ORDER BY s.FCA_SLAVEID ASC`,
    [id],
  );

  const [cargos] = await pool.query(
    `SELECT s.*, cm.MATERIAL_CODE_DESC AS CARGO_NAME
     FROM freight_cost_estimete_slave10 s
     LEFT JOIN cargo_master cm ON cm.MATERIALID = s.CARGOID
     WHERE s.FCAID = ?
     ORDER BY s.STATUS ASC`,
    [id],
  );

  const [bunkers] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave8 WHERE FCAID = ?`,
    [id],
  );

  const [[brokerage]] = await pool.query(
    `SELECT BROKAGE_PERCENT, BROKAGE_AMT
     FROM freight_cost_estimete_slave4
     WHERE FCAID = ?
     LIMIT 1`,
    [id],
  );

  return mapEstimateDetail(rows[0], legs, cargos, bunkers, brokerage || null);
}

export async function dbSearchVessels(query) {
  const term = String(query || '').trim();
  if (term.length < 2) return [];

  const pool = getPool();
  const like = `%${term}%`;
  const [rows] = await pool.query(
    `SELECT VESSEL_IMO_ID, VESSEL_NAME, IMO_NO, DWT, VESSEL_TYPE, FLAG, LOA, GRT_NRT
     FROM vessel_imo_master
     WHERE VESSEL_NAME LIKE ? OR IMO_NO LIKE ?
     ORDER BY VESSEL_NAME
     LIMIT 25`,
    [like, like],
  );

  return rows.map((row) => ({
    id: String(row.VESSEL_IMO_ID),
    name: `${row.VESSEL_NAME ?? ''} (${row.IMO_NO ?? ''})`.trim(),
    vesselName: row.VESSEL_NAME ?? '',
    imoNo: row.IMO_NO ?? '',
    dwt: row.DWT ?? '',
    vesselType: row.VESSEL_TYPE ?? '',
    flag: row.FLAG ?? '',
    loa: row.LOA ?? '',
    gnrt: row.GRT_NRT ?? '',
  }));
}

export async function dbCreateEstimateDetail(payload) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const transDate = toDbDate(payload.transDate) || new Date().toISOString().slice(0, 10);
  const estimateType = Number(payload.estimateType) || 2;
  const now = new Date();

  try {
    await connection.beginTransaction();

    const quantity = numOrNull(payload.cargoQuantity);
    const [result] = await connection.query(
      `INSERT INTO freight_cost_estimete_master (
        FIXTURETYPEID, TRANS_DATE, MODULEID, MCOMPANYID, ADDED_BY, ADD_ON_DATE,
        VESSEL_IMO_ID, VESSEL_TYPE, FLAG, VOYAGE_NO, VOYAGE_NAME,
        DWT_SUMMER, DWT_TOPICAL, GNRT, LOA, TPC, ESTIMATE_TYPE, FIXED, CP_DATE,
        GROSS_BREAKDOWN, BREAKDOWN_MT, SEL_BUSI_TYPE, PERIODID,
        QUANTITY, TOTAL_DAYS, TOTAL_DISTANCE, DAILY_EARNING, PROFIT_LOSS, FREIGHT_GROSS,
        BFULLSPEED, LFULLSPEED, LUMSUM
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.fixtureTypeId,
        transDate,
        appContext.moduleId,
        appContext.companyId,
        appContext.userId,
        now,
        payload.vesselImoId,
        payload.vesselType || null,
        payload.flag || null,
        payload.voyageNo || null,
        payload.voyageName || null,
        payload.dwtSummer || null,
        payload.dwtTropical || null,
        payload.gnrt || null,
        payload.loa || null,
        payload.tpc || null,
        estimateType,
        transDate,
        estimateType,
        payload.periodId || null,
        quantity,
        numOrNull(payload.totalDays),
        numOrNull(payload.totalDistance),
        numOrNull(payload.dailyEarning),
        numOrNull(payload.profitLoss),
        numOrNull(payload.freightGross),
        numOrNull(payload.bFullSpeed),
        numOrNull(payload.lFullSpeed),
        numOrNull(payload.lumpsum),
      ],
    );

    const fcaId = result.insertId;

    for (const leg of payload.portLegs || []) {
      if (!leg.fromPortId && !leg.toPortId) continue;
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave1 (
          FCAID, FROM_PORT, TO_PORT, PASSAGE_TYPE, SPEED_TYPE, DISTANCE,
          LOAD_PORT_QTY, DISC_PORT_QTY, LOAD_PORT_COST, DISC_PORT_COST,
          LOAD_PORT_RATE, DISC_PORT_RATE, TOTAL_VOYAGE_DAYS, RANDOMID
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fcaId,
          leg.fromPortId || null,
          leg.toPortId || null,
          leg.passageType || null,
          leg.speedType || null,
          numOrNull(leg.distance),
          numOrNull(leg.loadQty),
          numOrNull(leg.dischargeQty),
          numOrNull(leg.loadPortCost),
          numOrNull(leg.discPortCost),
          numOrNull(leg.loadPortRate),
          numOrNull(leg.discPortRate),
          numOrNull(leg.seaDays),
          randomId(),
        ],
      );
    }

    let cargoStatus = 1;
    for (const cargo of payload.cargoRows || []) {
      if (!cargo.cargoId && !cargo.cargoMt) continue;
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave10 (
          FCAID, SHIPPER_CHARTER, CARGO_CBM, CARGO_MT, RATE_USD_MT, AMOUNT_USD,
          STATUS, CARGOID, RANDOMID
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fcaId,
          cargo.charterer || null,
          numOrNull(cargo.cargoCbm),
          numOrNull(cargo.cargoMt),
          numOrNull(cargo.rateUsdMt),
          numOrNull(cargo.amountUsd),
          cargo.status || cargoStatus,
          cargo.cargoId || null,
          randomId(),
        ],
      );
      cargoStatus += 1;
    }

    for (const bunker of payload.bunkerRows || []) {
      if (!bunker.bunkerGradeId && !bunker.qty) continue;
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave8 (
          FCAID, BUNKERGRADEID, COST, COST_MT, QTY, PRICE, IDENTIFY
        ) VALUES (?, ?, ?, '0.00', ?, ?, ?)`,
        [
          fcaId,
          bunker.bunkerGradeId || null,
          numOrNull(bunker.cost),
          numOrNull(bunker.qty),
          numOrNull(bunker.price),
          bunker.identify || 'CONSUMPTION',
        ],
      );
    }

    if (payload.brokeragePercent || payload.brokerageAmt) {
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave4 (
          FCAID, BROKAGE_PERCENT, BROKAGE_AMT
        ) VALUES (?, ?, ?)`,
        [
          fcaId,
          numOrNull(payload.brokeragePercent),
          numOrNull(payload.brokerageAmt),
        ],
      );
    }

    await connection.commit();
    return { msg: 0, id: String(fcaId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbUpdateEstimateDetail(id, payload) {
  const pool = getPool();
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(HEADER_UPDATE_FIELDS)) {
    if (payload[key] === undefined) continue;
    let value = payload[key];
    if (key === 'transDate') value = toDbDate(value);
    sets.push(`\`${column}\` = ?`);
    values.push(value === '' ? null : value);
  }

  if (!sets.length) {
    return { msg: 0 };
  }

  values.push(id, appContext.moduleId, appContext.companyId);

  const [result] = await pool.query(
    `UPDATE freight_cost_estimete_master
     SET ${sets.join(', ')}
     WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
    values,
  );

  if (result.affectedRows === 0) return null;
  return { msg: 0 };
}
