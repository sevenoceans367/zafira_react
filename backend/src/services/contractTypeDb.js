import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.CONTRACTTYPEID,
    index,
    name: row.CONTRACT_TYPE ?? '',
    description: row.DESCRIPTION ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListContractTypes() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT CONTRACTTYPEID, CONTRACT_TYPE, DESCRIPTION, STATUS
     FROM contract_type_master
     ORDER BY STATUS, CONTRACT_TYPE`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetContractType(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT CONTRACTTYPEID, CONTRACT_TYPE, DESCRIPTION, STATUS
     FROM contract_type_master
     WHERE CONTRACTTYPEID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateContractTypeStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE contract_type_master
     SET STATUS = ?
     WHERE CONTRACTTYPEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Contract type not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Contract Type Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

export async function dbCreateContractType(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!name) throw new Error('Contract Type is required.');

  await pool.query(
    `INSERT INTO contract_type_master (CONTRACT_TYPE, DESCRIPTION, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?)`,
    [name, description, appContext.moduleId, appContext.companyId],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Contract Type Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateContractType(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  if (!name) throw new Error('Contract Type is required.');

  const [result] = await pool.query(
    `UPDATE contract_type_master
     SET CONTRACT_TYPE = ?, DESCRIPTION = ?
     WHERE CONTRACTTYPEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, description, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Contract type not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Contract Type Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
