import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.COAROUTEID,
    index,
    name: row.COAROUTE_NAME ?? '',
    description: row.COAROUTE_DESC ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListCoaRoutes() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COAROUTEID, COAROUTE_NAME, COAROUTE_DESC, STATUS
     FROM coaroute_master
     ORDER BY STATUS, COAROUTE_NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetCoaRoute(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT COAROUTEID, COAROUTE_NAME, COAROUTE_DESC, STATUS
     FROM coaroute_master
     WHERE COAROUTEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateCoaRouteStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE coaroute_master
     SET STATUS = ?
     WHERE COAROUTEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('COA route not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'COA Route Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

export async function dbCreateCoaRoute(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!name) throw new Error('COA Route name is required.');

  await pool.query(
    `INSERT INTO coaroute_master (COAROUTE_NAME, COAROUTE_DESC, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?)`,
    [name, description, appContext.moduleId, appContext.companyId],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'COA Route Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateCoaRoute(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!name) throw new Error('COA Route name is required.');

  const [result] = await pool.query(
    `UPDATE coaroute_master
     SET COAROUTE_NAME = ?, COAROUTE_DESC = ?
     WHERE COAROUTEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, description, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('COA route not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'COA Route Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
