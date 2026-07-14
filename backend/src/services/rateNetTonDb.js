import { appContext } from '../config.js';
import { getPool } from '../db.js';

const BUSINESS_TYPE_FALLBACK = [
  { id: 1, name: 'Gas' },
  { id: 2, name: 'Tanker' },
  { id: 3, name: 'Dry Cargo' },
];

async function loadBusinessTypes(pool) {
  let businessTypes = [];
  try {
    const [rows] = await pool.query(
      `SELECT BUSINESSTYPEID AS id, NAME AS name
       FROM business_type_master
       WHERE STATUS = 1
       ORDER BY NAME`,
    );
    businessTypes = rows.map((row) => ({ id: row.id, name: row.name ?? '' }));
  } catch {
    businessTypes = [];
  }
  if (!businessTypes.length) businessTypes = BUSINESS_TYPE_FALLBACK;
  return businessTypes;
}


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Normalize mysql DATE / Date / ISO string to YYYY-MM-DD for <input type="date">. */
function toInputDate(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsed.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

function formatDateLabel(value) {
  const raw = toInputDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [year, month, day] = raw.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

function formatPeriod(from, to) {
  const f = formatDateLabel(from);
  const t = formatDateLabel(to);
  return f && t ? `${f} - ${t}` : f || t || '';
}

function mapRecord(row, index) {
  return {
    id: row.ID,
    index,
    fromPeriod: toInputDate(row.FROM_PERIOD),
    toPeriod: toInputDate(row.TO_PERIOD),
    periodLabel: formatPeriod(row.FROM_PERIOD, row.TO_PERIOD),
    rate: row.RATE == null ? '' : String(row.RATE),
    businessTypeId: row.BUSINESS_TYPE == null ? '' : String(row.BUSINESS_TYPE),
    businessTypeName: row.BUSINESS_TYPE_NAME ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

const SELECT = `
  SELECT r.ID, r.FROM_PERIOD, r.TO_PERIOD, r.RATE, r.BUSINESS_TYPE, r.STATUS,
         COALESCE(bt.NAME, CASE r.BUSINESS_TYPE WHEN 1 THEN 'Gas' WHEN 2 THEN 'Tanker' WHEN 3 THEN 'Dry Cargo' ELSE NULL END) AS BUSINESS_TYPE_NAME
  FROM rate_net_ton_master r
  LEFT JOIN business_type_master bt ON bt.BUSINESSTYPEID = r.BUSINESS_TYPE
`;

export async function dbGetRateNetTonLookups() {
  return { businessTypes: await loadBusinessTypes(getPool()) };
}

export async function dbListRateNetTons() {
  const pool = getPool();
  const [rows] = await pool.query(`${SELECT} ORDER BY r.STATUS, r.ID`);
  return { records: rows.map((row, i) => mapRecord(row, i + 1)), recordsTotal: rows.length };
}

export async function dbGetRateNetTon(id) {
  const pool = getPool();
  const [[row]] = await pool.query(`${SELECT} WHERE r.ID = ? LIMIT 1`, [id]);
  return row ? mapRecord(row, 1) : null;
}

export async function dbCreateRateNetTon(payload) {
  const pool = getPool();
  const fromPeriod = String(payload.fromPeriod || '').trim();
  const toPeriod = String(payload.toPeriod || '').trim();
  const rate = String(payload.rate || '').trim();
  const businessTypeId = String(payload.businessTypeId || '').trim();
  if (!fromPeriod || !toPeriod || !rate || !businessTypeId) throw new Error('All fields are required.');
  if (toPeriod < fromPeriod) throw new Error('To Period must be on or after From Period.');
  await pool.query(
    `INSERT INTO rate_net_ton_master (FROM_PERIOD, TO_PERIOD, RATE, BUSINESS_TYPE, MODULEID, MCOMPANYID, STATUS)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [fromPeriod, toPeriod, rate, businessTypeId, appContext.moduleId, appContext.companyId],
  );
  return { msg: 0 };
}

export async function dbUpdateRateNetTon(id, payload) {
  const pool = getPool();
  const fromPeriod = String(payload.fromPeriod || '').trim();
  const toPeriod = String(payload.toPeriod || '').trim();
  const rate = String(payload.rate || '').trim();
  const businessTypeId = String(payload.businessTypeId || '').trim();
  if (!fromPeriod || !toPeriod || !rate || !businessTypeId) throw new Error('All fields are required.');
  if (toPeriod < fromPeriod) throw new Error('To Period must be on or after From Period.');
  const [result] = await pool.query(
    `UPDATE rate_net_ton_master SET FROM_PERIOD = ?, TO_PERIOD = ?, RATE = ?, BUSINESS_TYPE = ? WHERE ID = ?`,
    [fromPeriod, toPeriod, rate, businessTypeId, id],
  );
  if (!result.affectedRows) throw new Error('Rate Net Ton not found.');
  return { msg: 0 };
}

export async function dbUpdateRateNetTonStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(`UPDATE rate_net_ton_master SET STATUS = ? WHERE ID = ?`, [nextStatus, id]);
  if (!result.affectedRows) throw new Error('Rate Net Ton not found.');
  return { msg: 2, status: nextStatus };
}
