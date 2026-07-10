import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { dbSearchPorts } from './periodContractLookupsDb.js';

const CURRENCIES = [
  { id: 'EURO', name: 'Euro (EUR)' },
  { id: 'USD', name: 'United States Dollar (USD)' },
  { id: 'AUD', name: 'Australian dollar (AUD)' },
  { id: 'GBP', name: 'United Kingdom Pound (GBP)' },
  { id: 'INR', name: 'Indian Rupee (INR)' },
  { id: 'AED', name: 'Emirati Dirham (AED)' },
  { id: 'JPY', name: 'Japanese Yen (JPY)' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatAgencyFeeDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${String(date.getDate()).padStart(2, '0')}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

function toSqlDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value;
  const parts = String(value).split(/[-/]/);
  if (parts.length === 3 && parts[0].length === 2) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getVendorName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    'SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1',
    [code],
  );
  return row?.NAME ?? String(code);
}

async function getPortLabel(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    'SELECT PortName, COUNTRY_KEY FROM port_master WHERE PortId = ? LIMIT 1',
    [portId],
  );
  if (!row) return String(portId);
  return `${row.PortName} (${row.COUNTRY_KEY || ''})`;
}

function mapRecordRow(row, index, agentName, portName) {
  return {
    id: row.AGENCYFEE_RECORDID,
    index,
    agentId: row.AGENTMASTERID,
    agentName,
    portId: row.PORTID,
    portName,
    date: formatAgencyFeeDate(row.DATE),
    dateValue: row.DATE ? String(row.DATE).slice(0, 10) : '',
    fee: row.FEE ?? '',
    sundries: row.SUNDRIES ?? '',
    vendorTypeId: row.VENDOR_TYPEID ?? '',
    currencyId: row.CURRENCYID ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbGetAgencyFeeRecordLookups() {
  const pool = getPool();
  const [vendorTypes] = await pool.query(
    `SELECT VENDOR_TYPEID AS id, NAME AS name
     FROM vendor_type_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );
  const [agents] = await pool.query(
    `SELECT CODE AS id, NAME AS name, CODE
     FROM vendor_master
     WHERE STATUS = 1 AND MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );

  return {
    vendorTypes: vendorTypes.map((row) => ({ id: String(row.id), name: row.name })),
    agents: agents.map((row) => ({
      id: String(row.id),
      name: `${row.name} ( ${row.CODE} )`,
    })),
    currencies: CURRENCIES,
  };
}

export async function dbListAgencyFeeRecords() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT *
     FROM agency_fee_record_master
     ORDER BY STATUS, AGENCYFEE_RECORDID`,
  );

  const records = [];
  let index = 0;
  for (const row of rows) {
    index += 1;
    const agentName = await getVendorName(pool, row.AGENTMASTERID);
    const portName = await getPortLabel(pool, row.PORTID);
    records.push(mapRecordRow(row, index, agentName, portName));
  }
  return { records, recordsTotal: records.length };
}

export async function dbGetAgencyFeeRecord(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT *
     FROM agency_fee_record_master
     WHERE AGENCYFEE_RECORDID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;

  const agentName = await getVendorName(pool, row.AGENTMASTERID);
  const portName = await getPortLabel(pool, row.PORTID);
  return mapRecordRow(row, 1, agentName, portName);
}

export async function dbUpdateAgencyFeeRecordStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE agency_fee_record_master
     SET STATUS = ?
     WHERE AGENCYFEE_RECORDID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Agency fee record not found.');
  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Agency Fee Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );
  return { msg: 2, status: nextStatus };
}

export async function dbCreateAgencyFeeRecord(payload) {
  const pool = getPool();
  const date = toSqlDate(payload.date);
  if (!date) throw new Error('Date is required.');
  if (!payload.agentId) throw new Error('Agent is required.');
  if (!payload.portId) throw new Error('Port is required.');

  const [[existing]] = await pool.query(
    `SELECT AGENCYFEE_RECORDID
     FROM agency_fee_record_master
     WHERE DATE = ?
       AND AGENTMASTERID = ?
       AND PORTID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [date, payload.agentId, payload.portId, appContext.moduleId, appContext.companyId],
  );
  if (existing) {
    const error = new Error('Agency fee record already exists for this date, agent, and port.');
    error.code = 'DUPLICATE';
    throw error;
  }

  await pool.query(
    `INSERT INTO agency_fee_record_master
      (DATE, VENDOR_TYPEID, AGENTMASTERID, PORTID, FEE, MODULEID, MCOMPANYID, CURRENCYID, SUNDRIES)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date,
      payload.vendorTypeId || '',
      payload.agentId,
      payload.portId,
      payload.fee ?? '',
      appContext.moduleId,
      appContext.companyId,
      payload.currencyId || '',
      payload.sundries ?? '',
    ],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Agency Fee Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateAgencyFeeRecord(id, payload) {
  const pool = getPool();
  const date = toSqlDate(payload.date);
  if (!date) throw new Error('Date is required.');
  if (!payload.agentId) throw new Error('Agent is required.');
  if (!payload.portId) throw new Error('Port is required.');

  const [result] = await pool.query(
    `UPDATE agency_fee_record_master
     SET DATE = ?,
         FEE = ?,
         VENDOR_TYPEID = ?,
         AGENTMASTERID = ?,
         PORTID = ?,
         CURRENCYID = ?,
         SUNDRIES = ?
     WHERE AGENCYFEE_RECORDID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [
      date,
      payload.fee ?? '',
      payload.vendorTypeId || '',
      payload.agentId,
      payload.portId,
      payload.currencyId || '',
      payload.sundries ?? '',
      id,
      appContext.moduleId,
      appContext.companyId,
    ],
  );
  if (!result.affectedRows) throw new Error('Agency fee record not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Agency Fee Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export { dbSearchPorts as dbSearchMasterPorts };
