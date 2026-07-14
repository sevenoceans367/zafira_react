import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.ID,
    index,
    name: row.NAME_OF_LEDGER ?? '',
    groupId: row.ACC_GROUP == null ? '' : String(row.ACC_GROUP),
    groupName: row.GROUP_NAME ?? '',
    code: row.CODE ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

const SELECT = `
  SELECT al.ID, al.NAME_OF_LEDGER, al.ACC_GROUP, al.CODE, al.STATUS,
         ag.NAME AS GROUP_NAME
  FROM account_ledger al
  LEFT JOIN accounting_group ag ON ag.ID = al.ACC_GROUP
`;

export async function dbGetAccountingLedgerLookups() {
  const pool = getPool();
  const [groups] = await pool.query(
    `SELECT ID AS id, NAME AS name FROM accounting_group WHERE STATUS = 1 ORDER BY NAME`,
  );
  return {
    groups: groups.map((row) => ({ id: String(row.id), name: row.name ?? '' })),
  };
}

export async function dbListAccountingLedgers() {
  const pool = getPool();
  const [rows] = await pool.query(`${SELECT} ORDER BY al.STATUS, al.NAME_OF_LEDGER`);
  return { records: rows.map((row, i) => mapRecord(row, i + 1)), recordsTotal: rows.length };
}

export async function dbGetAccountingLedger(id) {
  const pool = getPool();
  const [[row]] = await pool.query(`${SELECT} WHERE al.ID = ? LIMIT 1`, [id]);
  return row ? mapRecord(row, 1) : null;
}

export async function dbCreateAccountingLedger(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const groupId = String(payload.groupId || '').trim();
  const code = String(payload.code || '').trim();
  if (!name) throw new Error('Name of Ledger is required.');
  if (!groupId) throw new Error('Group is required.');
  await pool.query(
    `INSERT INTO account_ledger (NAME_OF_LEDGER, ACC_GROUP, CODE, STATUS) VALUES (?, ?, ?, 1)`,
    [name, groupId, code],
  );
  return { msg: 0 };
}

export async function dbUpdateAccountingLedger(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const groupId = String(payload.groupId || '').trim();
  const code = String(payload.code || '').trim();
  if (!name) throw new Error('Name of Ledger is required.');
  if (!groupId) throw new Error('Group is required.');
  const [result] = await pool.query(
    `UPDATE account_ledger SET NAME_OF_LEDGER = ?, ACC_GROUP = ?, CODE = ? WHERE ID = ?`,
    [name, groupId, code, id],
  );
  if (!result.affectedRows) throw new Error('Accounting Ledger not found.');
  return { msg: 0 };
}

export async function dbUpdateAccountingLedgerStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(`UPDATE account_ledger SET STATUS = ? WHERE ID = ?`, [nextStatus, id]);
  if (!result.affectedRows) throw new Error('Accounting Ledger not found.');
  return { msg: 2, status: nextStatus };
}
