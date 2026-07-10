import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.LAWARBITRA_ID,
    index,
    name: row.LAW_ARBITRATION ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListLawArbitrations() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT LAWARBITRA_ID, LAW_ARBITRATION, STATUS
     FROM lawarbitration_master_list
     ORDER BY STATUS, LAW_ARBITRATION`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetLawArbitration(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT LAWARBITRA_ID, LAW_ARBITRATION, STATUS
     FROM lawarbitration_master_list
     WHERE LAWARBITRA_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateLawArbitrationStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE lawarbitration_master_list
     SET STATUS = ?
     WHERE LAWARBITRA_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Law/Arbitration record not found.');
  return { msg: 2, status: nextStatus };
}

export async function dbCreateLawArbitration(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Law/Arbitration is required.');

  await pool.query(
    `INSERT INTO lawarbitration_master_list (LAW_ARBITRATION, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?)`,
    [name, appContext.moduleId, appContext.companyId],
  );

  return { msg: 0 };
}

export async function dbUpdateLawArbitration(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Law/Arbitration is required.');

  const [result] = await pool.query(
    `UPDATE lawarbitration_master_list
     SET LAW_ARBITRATION = ?
     WHERE LAWARBITRA_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Law/Arbitration record not found.');

  return { msg: 0 };
}
