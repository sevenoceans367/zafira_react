import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.REF_ID,
    index,
    name: row.NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListElibraryReferenceTypes() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT REF_ID, NAME, STATUS
     FROM elibrary_refrences
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetElibraryReferenceType(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT REF_ID, NAME, STATUS
     FROM elibrary_refrences
     WHERE REF_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateElibraryReferenceTypeStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE elibrary_refrences
     SET STATUS = ?
     WHERE REF_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('E-Library reference type not found.');
  return { msg: 2, status: nextStatus };
}

export async function dbCreateElibraryReferenceType(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  await pool.query(
    `INSERT INTO elibrary_refrences (NAME, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?)`,
    [name, appContext.moduleId, appContext.companyId],
  );

  return { msg: 0 };
}

export async function dbUpdateElibraryReferenceType(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  const [result] = await pool.query(
    `UPDATE elibrary_refrences
     SET NAME = ?
     WHERE REF_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('E-Library reference type not found.');

  return { msg: 0 };
}
