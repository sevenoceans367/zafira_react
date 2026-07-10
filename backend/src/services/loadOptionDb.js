import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.LOADOPTIONSID,
    index,
    name: row.LOADOPTION_NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListLoadOptions() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT LOADOPTIONSID, LOADOPTION_NAME, STATUS
     FROM loadoption_master
     ORDER BY STATUS, LOADOPTION_NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetLoadOption(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT LOADOPTIONSID, LOADOPTION_NAME, STATUS
     FROM loadoption_master
     WHERE LOADOPTIONSID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateLoadOptionStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE loadoption_master
     SET STATUS = ?
     WHERE LOADOPTIONSID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Load option not found.');
  return { msg: 2, status: nextStatus };
}

export async function dbCreateLoadOption(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Load Options is required.');

  await pool.query(
    `INSERT INTO loadoption_master (LOADOPTION_NAME, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?)`,
    [name, appContext.moduleId, appContext.companyId],
  );

  return { msg: 0 };
}

export async function dbUpdateLoadOption(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Load Options is required.');

  const [result] = await pool.query(
    `UPDATE loadoption_master
     SET LOADOPTION_NAME = ?
     WHERE LOADOPTIONSID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Load option not found.');

  return { msg: 0 };
}
