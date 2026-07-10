import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.IS_ID,
    index,
    name: row.NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListInvoiceStatuses() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT IS_ID, NAME, STATUS
     FROM invoice_status_master
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetInvoiceStatus(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT IS_ID, NAME, STATUS
     FROM invoice_status_master
     WHERE IS_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateInvoiceStatusStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE invoice_status_master
     SET STATUS = ?
     WHERE IS_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Invoice status not found.');
  return { msg: 2, status: nextStatus };
}

export async function dbCreateInvoiceStatus(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  await pool.query(
    `INSERT INTO invoice_status_master (NAME, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?)`,
    [name, appContext.moduleId, appContext.companyId],
  );

  return { msg: 0 };
}

export async function dbUpdateInvoiceStatus(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');

  const [result] = await pool.query(
    `UPDATE invoice_status_master
     SET NAME = ?
     WHERE IS_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Invoice status not found.');

  return { msg: 0 };
}
