import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.APPROVALID,
    index,
    name: row.NAME ?? '',
    description: row.DESCRIPTION ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListNecessaryApprovals() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT APPROVALID, NAME, DESCRIPTION, STATUS
     FROM approvals_master
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetNecessaryApproval(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT APPROVALID, NAME, DESCRIPTION, STATUS
     FROM approvals_master
     WHERE APPROVALID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateNecessaryApprovalStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE approvals_master
     SET STATUS = ?
     WHERE APPROVALID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('Necessary approval not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Approval Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

export async function dbCreateNecessaryApproval(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!name) throw new Error('Approval Name is required.');

  await pool.query(
    `INSERT INTO approvals_master (NAME, DESCRIPTION, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?)`,
    [name, description, appContext.moduleId, appContext.companyId],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Approval Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateNecessaryApproval(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!name) throw new Error('Approval Name is required.');

  const [result] = await pool.query(
    `UPDATE approvals_master
     SET NAME = ?, DESCRIPTION = ?
     WHERE APPROVALID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, description, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Necessary approval not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Approval Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
