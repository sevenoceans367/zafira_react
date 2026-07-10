import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.CHARTERER_COSTID,
    index,
    name: row.NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListChartererCosts() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT CHARTERER_COSTID, NAME, STATUS
     FROM charterers_master
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetChartererCost(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT CHARTERER_COSTID, NAME, STATUS
     FROM charterers_master
     WHERE CHARTERER_COSTID = ?
       AND MODULEID = ?
     LIMIT 1`,
    [id, appContext.moduleId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateChartererCostStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE charterers_master
     SET STATUS = ?
     WHERE CHARTERER_COSTID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('Charterer cost not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Charterer Cost Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

export async function dbCreateChartererCost(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  await pool.query(
    `INSERT INTO charterers_master (NAME, MODULEID, MCOMPANYID, STATUS)
     VALUES (?, ?, ?, 1)`,
    [name, appContext.moduleId, appContext.companyId],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Charterer Cost Record Inserted successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateChartererCost(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  const [result] = await pool.query(
    `UPDATE charterers_master
     SET NAME = ?
     WHERE CHARTERER_COSTID = ?
       AND MODULEID = ?`,
    [name, id, appContext.moduleId],
  );
  if (!result.affectedRows) throw new Error('Charterer cost not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Charterer Cost Record Updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
