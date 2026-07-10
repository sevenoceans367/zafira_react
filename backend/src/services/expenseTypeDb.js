import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.EXPENSETYPEID,
    index,
    name: row.EXPENSE_TYPE ?? '',
    description: row.DESCRIPTION ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListExpenseTypes() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT EXPENSETYPEID, EXPENSE_TYPE, DESCRIPTION, STATUS
     FROM expense_type_master
     ORDER BY STATUS, EXPENSE_TYPE`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetExpenseType(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT EXPENSETYPEID, EXPENSE_TYPE, DESCRIPTION, STATUS
     FROM expense_type_master
     WHERE EXPENSETYPEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateExpenseTypeStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE expense_type_master
     SET STATUS = ?
     WHERE EXPENSETYPEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Expense type not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Expense Type Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

export async function dbCreateExpenseType(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!name) throw new Error('Expense Type is required.');
  if (!description) throw new Error('Description is required.');

  await pool.query(
    `INSERT INTO expense_type_master (EXPENSE_TYPE, DESCRIPTION, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?)`,
    [name, description, appContext.moduleId, appContext.companyId],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Expense Type Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateExpenseType(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!name) throw new Error('Expense Type is required.');
  if (!description) throw new Error('Description is required.');

  const [result] = await pool.query(
    `UPDATE expense_type_master
     SET EXPENSE_TYPE = ?, DESCRIPTION = ?
     WHERE EXPENSETYPEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, description, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Expense type not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Expense Type Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
