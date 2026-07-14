import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.TERMINALID,
    index,
    name: row.NAME ?? '',
    portCode: row.PORT_CODE ?? '',
    portName: row.PORT_NAME ?? '',
    description: row.DESCRIPTION ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

const SELECT = `
  SELECT t.TERMINALID, t.NAME, t.PORT_CODE, t.DESCRIPTION, t.STATUS,
         CONCAT(COALESCE(pm.PortName, ''), '(', COALESCE(pm.PortCode, t.PORT_CODE, ''), ')') AS PORT_NAME
  FROM terminal_master t
  LEFT JOIN port_master pm ON pm.PortCode = t.PORT_CODE
`;

async function resolvePortCode(pool, portId, portCode) {
  let code = String(portCode || '').trim();
  if (code) return code;
  const id = String(portId || '').trim();
  if (!id) return '';
  const [[row]] = await pool.query(`SELECT PortCode FROM port_master WHERE PortId = ? LIMIT 1`, [id]);
  return row?.PortCode ? String(row.PortCode) : '';
}

export async function dbListTerminals() {
  const pool = getPool();
  const [rows] = await pool.query(`${SELECT} ORDER BY t.STATUS, t.NAME`);
  return { records: rows.map((row, i) => mapRecord(row, i + 1)), recordsTotal: rows.length };
}

export async function dbGetTerminal(id) {
  const pool = getPool();
  const [[row]] = await pool.query(`${SELECT} WHERE t.TERMINALID = ? LIMIT 1`, [id]);
  return row ? mapRecord(row, 1) : null;
}

export async function dbCreateTerminal(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  const portCode = await resolvePortCode(pool, payload.portId, payload.portCode);
  if (!name) throw new Error('Terminal Name is required.');
  if (!portCode) throw new Error('Port Name is required.');
  await pool.query(
    `INSERT INTO terminal_master (NAME, PORT_CODE, DESCRIPTION, MODULEID, MCOMPANYID, STATUS)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [name, portCode, description, appContext.moduleId, appContext.companyId],
  );
  return { msg: 0 };
}

export async function dbUpdateTerminal(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  const portCode = await resolvePortCode(pool, payload.portId, payload.portCode);
  if (!name) throw new Error('Terminal Name is required.');
  if (!portCode) throw new Error('Port Name is required.');
  const [result] = await pool.query(
    `UPDATE terminal_master SET NAME = ?, PORT_CODE = ?, DESCRIPTION = ? WHERE TERMINALID = ?`,
    [name, portCode, description, id],
  );
  if (!result.affectedRows) throw new Error('Terminal not found.');
  return { msg: 0 };
}

export async function dbUpdateTerminalStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE terminal_master SET STATUS = ? WHERE TERMINALID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('Terminal not found.');
  return { msg: 2, status: nextStatus };
}
