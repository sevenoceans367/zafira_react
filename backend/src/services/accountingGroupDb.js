import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.ID,
    index,
    name: row.NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListAccountingGroups() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT ID, NAME, STATUS
     FROM accounting_group
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetAccountingGroup(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT ID, NAME, STATUS
     FROM accounting_group
     WHERE ID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateAccountingGroupStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE accounting_group
     SET STATUS = ?
     WHERE ID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('Accounting Group not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Accounting Group Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

export async function dbCreateAccountingGroup(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  await pool.query(
    `INSERT INTO accounting_group (NAME, STATUS)
     VALUES (?, 1)`,
    [name],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Accounting Group Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateAccountingGroup(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  const [result] = await pool.query(
    `UPDATE accounting_group
     SET NAME = ?
     WHERE ID = ?`,
    [name, id],
  );
  if (!result.affectedRows) throw new Error('Accounting Group not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Accounting Group Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
