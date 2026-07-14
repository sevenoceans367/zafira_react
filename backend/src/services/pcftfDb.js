import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.ID,
    index,
    vesselCategoryId: row.VESSEL_CATEGORY == null ? '' : String(row.VESSEL_CATEGORY),
    vesselCategoryName: row.VESSEL_CATEGORY_NAME ?? '',
    lockUsed: row.LOCK_USED ?? '',
    fromDwt: row.FROMDWT == null ? '' : String(row.FROMDWT),
    toDwt: row.TODWT == null ? '' : String(row.TODWT),
    fee: row.FEE == null ? '' : String(row.FEE),
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

const LIST_SELECT = `SELECT f.ID,
            f.VESSEL_CATEGORY,
            f.LOCK_USED,
            f.FROMDWT,
            f.TODWT,
            f.FEE,
            f.STATUS,
            vc.NAME AS VESSEL_CATEGORY_NAME
     FROM fcftf_master f
     LEFT JOIN vessel_category_master vc ON vc.VESSEL_CATEGORY_ID = f.VESSEL_CATEGORY`;

export async function dbGetPcftfLookups() {
  const pool = getPool();
  const [vesselCategories] = await pool.query(
    `SELECT VESSEL_CATEGORY_ID AS id, NAME AS name
     FROM vessel_category_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  return {
    vesselCategories: vesselCategories.map((row) => ({
      id: row.id,
      name: row.name ?? '',
    })),
  };
}

export async function dbListPcftf() {
  const pool = getPool();
  const [rows] = await pool.query(`${LIST_SELECT} ORDER BY f.STATUS, f.ID`);

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetPcftf(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `${LIST_SELECT}
     WHERE f.ID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdatePcftfStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE fcftf_master
     SET STATUS = ?
     WHERE ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Panama Canal Fixed Transit Fee not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Panama Canal Fixed Transit Fee Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

function parsePayload(payload) {
  const vesselCategoryId = Number(payload.vesselCategoryId);
  const lockUsed = String(payload.lockUsed ?? '').trim();
  const fromDwt = String(payload.fromDwt ?? '').trim();
  const toDwt = String(payload.toDwt ?? '').trim();
  const fee = String(payload.fee ?? '').trim();

  if (!Number.isFinite(vesselCategoryId) || vesselCategoryId <= 0) {
    throw new Error('Vessel Category is required.');
  }
  if (!lockUsed) throw new Error('Lock Used is required.');
  if (!fromDwt) throw new Error('From Range DWT is required.');
  if (!toDwt) throw new Error('To Range DWT is required.');
  if (!fee) throw new Error('Fixed Transit Fee is required.');

  return {
    vesselCategoryId,
    lockUsed,
    fromDwt: Number(fromDwt),
    toDwt: Number(toDwt),
    fee: Number(fee),
  };
}

export async function dbCreatePcftf(payload) {
  const pool = getPool();
  const data = parsePayload(payload);

  await pool.query(
    `INSERT INTO fcftf_master
       (VESSEL_CATEGORY, LOCK_USED, FROMDWT, TODWT, FEE, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.vesselCategoryId,
      data.lockUsed,
      data.fromDwt,
      data.toDwt,
      data.fee,
      appContext.moduleId,
      appContext.companyId,
    ],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Panama Canal Fixed Transit Fee Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdatePcftf(id, payload) {
  const pool = getPool();
  const data = parsePayload(payload);

  const [result] = await pool.query(
    `UPDATE fcftf_master
     SET VESSEL_CATEGORY = ?, LOCK_USED = ?, FROMDWT = ?, TODWT = ?, FEE = ?
     WHERE ID = ?`,
    [data.vesselCategoryId, data.lockUsed, data.fromDwt, data.toDwt, data.fee, id],
  );
  if (!result.affectedRows) throw new Error('Panama Canal Fixed Transit Fee not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Panama Canal Fixed Transit Fee Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
