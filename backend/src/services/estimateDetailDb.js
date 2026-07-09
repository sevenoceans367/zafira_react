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

function mapPortLeg(row, index) {
  return {
    id: row.RANDOMID ?? row.FCA_SLVID ?? row.SLVID ?? `${row.FCAID}-${index}`,
    fromPortId: row.FROM_PORT,
    toPortId: row.TO_PORT,
    fromPortName: row.FROM_PORT_NAME ?? '',
    toPortName: row.TO_PORT_NAME ?? '',
    passageType: row.PASSAGE_TYPE,
    loadQty: row.LOAD_PORT_QTY,
    dischargeQty: row.DISC_PORT_QTY,
    distance: row.DISTANCE ?? '',
    seaDays: row.TOTAL_VOYAGE_DAYS ?? row.SEA_DAYS ?? '',
  };
}

function mapEstimateDetail(master, portLegs = []) {
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
    totalDays: master.TOTAL_DAYS ?? '',
    totalDistance: master.TOTAL_DISTANCE ?? '',
    cargoQuantity: master.QUANTITY ?? master.TANK_QUANTITY ?? master.GAS_QUANTITY ?? '',
    dailyEarning: master.DAILY_EARNING ?? '',
    dailyVesselOperationExp: master.DAILY_VESSEL_OPERATION_EXP ?? '',
    profitLoss: master.PROFIT_LOSS ?? '',
    freightGross: master.FREIGHT_GROSS ?? '',
    charteringPic: master.CHARTERING_PIC_NAME ?? '',
    comid: master.COMID || null,
    fixed: Number(master.FIXED) === 1,
    portLegs: portLegs.map((row, index) => mapPortLeg(row, index)),
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
     ORDER BY s.FROM_PORT, s.TO_PORT`,
    [id],
  );

  return mapEstimateDetail(rows[0], legs);
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
    name: `${row.VESSEL_NAME}${row.IMO_NO ? ` (${row.IMO_NO})` : ''}`,
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
  const transDate = toDbDate(payload.transDate) || new Date().toISOString().slice(0, 10);
  const estimateType = Number(payload.estimateType) || 2;
  const now = new Date();

  const [result] = await pool.query(
    `INSERT INTO freight_cost_estimete_master (
      FIXTURETYPEID, TRANS_DATE, MODULEID, MCOMPANYID, ADDED_BY, ADD_ON_DATE,
      VESSEL_IMO_ID, VESSEL_TYPE, FLAG, VOYAGE_NO, VOYAGE_NAME,
      DWT_SUMMER, GNRT, LOA, TPC, ESTIMATE_TYPE, FIXED, CP_DATE,
      GROSS_BREAKDOWN, BREAKDOWN_MT, SEL_BUSI_TYPE, PERIODID
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', ?, 0, 0, ?, ?)`,
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
      payload.gnrt || null,
      payload.loa || null,
      payload.tpc || null,
      estimateType,
      transDate,
      estimateType,
      payload.periodId || null,
    ],
  );

  return { msg: 0, id: String(result.insertId) };
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
