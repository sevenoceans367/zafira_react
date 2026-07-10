import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.BALTICID,
    index,
    code: row.CODE ?? '',
    name: row.NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListBalticRoutes() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT BALTICID, CODE, NAME, STATUS
     FROM baltic_master
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetBalticRoute(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT BALTICID, CODE, NAME, STATUS
     FROM baltic_master
     WHERE BALTICID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateBalticRouteStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE baltic_master
     SET STATUS = ?
     WHERE BALTICID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Baltic route not found.');
  return { msg: 2, status: nextStatus };
}

export async function dbCreateBalticRoute(payload) {
  const pool = getPool();
  const code = String(payload.code || '').trim();
  const name = String(payload.name || '').trim();
  if (!code) throw new Error('Baltic Route Code is required.');
  if (!name) throw new Error('Baltic Route Description is required.');

  await pool.query(
    `INSERT INTO baltic_master (CODE, NAME, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?)`,
    [code, name, appContext.moduleId, appContext.companyId],
  );

  return { msg: 0 };
}

export async function dbUpdateBalticRoute(id, payload) {
  const pool = getPool();
  const code = String(payload.code || '').trim();
  const name = String(payload.name || '').trim();
  if (!code) throw new Error('Baltic Route Code is required.');
  if (!name) throw new Error('Baltic Route Description is required.');

  const [result] = await pool.query(
    `UPDATE baltic_master
     SET CODE = ?, NAME = ?
     WHERE BALTICID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [code, name, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Baltic route not found.');

  return { msg: 0 };
}
