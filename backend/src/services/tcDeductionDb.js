import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.TC_DEDUCTIONID,
    index,
    name: row.NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListTcDeductions() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT TC_DEDUCTIONID, NAME, STATUS
     FROM tc_deduction_master
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetTcDeduction(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT TC_DEDUCTIONID, NAME, STATUS
     FROM tc_deduction_master
     WHERE TC_DEDUCTIONID = ?
       AND MODULEID = ?
     LIMIT 1`,
    [id, appContext.moduleId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateTcDeductionStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE tc_deduction_master
     SET STATUS = ?
     WHERE TC_DEDUCTIONID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('TC Deduction not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'TC Deduction Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

export async function dbCreateTcDeduction(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  await pool.query(
    `INSERT INTO tc_deduction_master (NAME, MODULEID, MCOMPANYID, STATUS)
     VALUES (?, ?, ?, 1)`,
    [name, appContext.moduleId, appContext.companyId],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'TC Deduction Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateTcDeduction(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  const [result] = await pool.query(
    `UPDATE tc_deduction_master
     SET NAME = ?
     WHERE TC_DEDUCTIONID = ?
       AND MODULEID = ?`,
    [name, id, appContext.moduleId],
  );
  if (!result.affectedRows) throw new Error('TC Deduction not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'TC Deduction Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
