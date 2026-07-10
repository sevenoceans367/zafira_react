import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.CATEGORY_ID,
    index,
    name: row.NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListElibraryCategories() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT CATEGORY_ID, NAME, STATUS
     FROM elibrary_categories
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetElibraryCategory(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT CATEGORY_ID, NAME, STATUS
     FROM elibrary_categories
     WHERE CATEGORY_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateElibraryCategoryStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE elibrary_categories
     SET STATUS = ?
     WHERE CATEGORY_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('E-Library category not found.');
  return { msg: 2, status: nextStatus };
}

export async function dbCreateElibraryCategory(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  await pool.query(
    `INSERT INTO elibrary_categories (NAME, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?)`,
    [name, appContext.moduleId, appContext.companyId],
  );

  return { msg: 0 };
}

export async function dbUpdateElibraryCategory(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  const [result] = await pool.query(
    `UPDATE elibrary_categories
     SET NAME = ?
     WHERE CATEGORY_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('E-Library category not found.');

  return { msg: 0 };
}
