import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.VESSEL_CATEGORY_ID,
    index,
    name: row.NAME ?? '',
    description: row.DESCRIPTION ?? '',
    size: row.SIZE == null ? '' : String(row.SIZE),
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListVesselCategories() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT VESSEL_CATEGORY_ID, NAME, DESCRIPTION, SIZE, STATUS
     FROM vessel_category_master
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetVesselCategory(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT VESSEL_CATEGORY_ID, NAME, DESCRIPTION, SIZE, STATUS
     FROM vessel_category_master
     WHERE VESSEL_CATEGORY_ID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateVesselCategoryStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE vessel_category_master
     SET STATUS = ?
     WHERE VESSEL_CATEGORY_ID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('Vessel Category not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Vessel Category Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

function normalizePayload(payload) {
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');
  const size = String(payload.size ?? '').trim();
  if (!size) throw new Error('Size is required.');
  const description = String(payload.description || '').trim();
  if (!description) throw new Error('Description is required.');
  return { name, size, description };
}

export async function dbCreateVesselCategory(payload) {
  const pool = getPool();
  const data = normalizePayload(payload);

  await pool.query(
    `INSERT INTO vessel_category_master (NAME, DESCRIPTION, SIZE, STATUS)
     VALUES (?, ?, ?, 1)`,
    [data.name, data.description, data.size],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Vessel Category Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateVesselCategory(id, payload) {
  const pool = getPool();
  const data = normalizePayload(payload);

  const [result] = await pool.query(
    `UPDATE vessel_category_master
     SET NAME = ?, DESCRIPTION = ?, SIZE = ?
     WHERE VESSEL_CATEGORY_ID = ?`,
    [data.name, data.description, data.size, id],
  );
  if (!result.affectedRows) throw new Error('Vessel Category not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Vessel Category Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
