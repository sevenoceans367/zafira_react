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


function mapRecord(row, index) {
  return {
    id: row.ID,
    index,
    businessTypeId: row.BUISNESS_TYPE == null ? '' : String(row.BUISNESS_TYPE),
    businessTypeName: row.BUSINESS_TYPE_NAME ?? '',
    scntBracket: row.SCNT_BRACKET == null ? '' : String(row.SCNT_BRACKET),
    sdrToUse: row.SDR_TO_USE == null ? '' : String(row.SDR_TO_USE),
    sdrRateBallast: row.SDR_RATE_BALLAST == null ? '' : String(row.SDR_RATE_BALLAST),
    sdrRateLadenCrude: row.SDR_RATE_LADEN_CRUDE == null ? '' : String(row.SDR_RATE_LADEN_CRUDE),
    sdrRateLadenProducts: row.SDR_RATE_LADEN_PRODUCTS == null ? '' : String(row.SDR_RATE_LADEN_PRODUCTS),
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

const SELECT = `
  SELECT s.ID, s.BUISNESS_TYPE, s.SCNT_BRACKET, s.SDR_TO_USE, s.SDR_RATE_BALLAST,
         s.SDR_RATE_LADEN_CRUDE, s.SDR_RATE_LADEN_PRODUCTS, s.STATUS,
         COALESCE(bt.NAME, CASE s.BUISNESS_TYPE WHEN 1 THEN 'Gas' WHEN 2 THEN 'Tanker' WHEN 3 THEN 'Dry Cargo' ELSE NULL END) AS BUSINESS_TYPE_NAME
  FROM sdr_rate_master s
  LEFT JOIN business_type_master bt ON bt.BUSINESSTYPEID = s.BUISNESS_TYPE
`;

export async function dbGetSdrRateLookups() {
  return { businessTypes: await loadBusinessTypes(getPool()) };
}

export async function dbListSdrRates() {
  const pool = getPool();
  const [rows] = await pool.query(`${SELECT} ORDER BY s.STATUS, s.ID`);
  return { records: rows.map((row, i) => mapRecord(row, i + 1)), recordsTotal: rows.length };
}

export async function dbGetSdrRate(id) {
  const pool = getPool();
  const [[row]] = await pool.query(`${SELECT} WHERE s.ID = ? LIMIT 1`, [id]);
  return row ? mapRecord(row, 1) : null;
}

export async function dbCreateSdrRate(payload) {
  const pool = getPool();
  const businessTypeId = String(payload.businessTypeId || '').trim();
  if (!businessTypeId) throw new Error('Business Type is required.');
  await pool.query(
    `INSERT INTO sdr_rate_master
       (SCNT_BRACKET, SDR_TO_USE, SDR_RATE_BALLAST, SDR_RATE_LADEN_CRUDE, SDR_RATE_LADEN_PRODUCTS, MODULEID, MCOMPANYID, BUISNESS_TYPE, STATUS)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      String(payload.scntBracket || '').trim(),
      String(payload.sdrToUse || '').trim(),
      String(payload.sdrRateBallast || '').trim(),
      String(payload.sdrRateLadenCrude || '').trim(),
      String(payload.sdrRateLadenProducts || '').trim(),
      appContext.moduleId,
      appContext.companyId,
      businessTypeId,
    ],
  );
  return { msg: 0 };
}

export async function dbUpdateSdrRate(id, payload) {
  const pool = getPool();
  const businessTypeId = String(payload.businessTypeId || '').trim();
  if (!businessTypeId) throw new Error('Business Type is required.');
  const [result] = await pool.query(
    `UPDATE sdr_rate_master
     SET SCNT_BRACKET = ?, SDR_TO_USE = ?, SDR_RATE_BALLAST = ?, SDR_RATE_LADEN_CRUDE = ?,
         SDR_RATE_LADEN_PRODUCTS = ?, BUISNESS_TYPE = ?
     WHERE ID = ?`,
    [
      String(payload.scntBracket || '').trim(),
      String(payload.sdrToUse || '').trim(),
      String(payload.sdrRateBallast || '').trim(),
      String(payload.sdrRateLadenCrude || '').trim(),
      String(payload.sdrRateLadenProducts || '').trim(),
      businessTypeId,
      id,
    ],
  );
  if (!result.affectedRows) throw new Error('SDR Rate not found.');
  return { msg: 0 };
}

export async function dbUpdateSdrRateStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(`UPDATE sdr_rate_master SET STATUS = ? WHERE ID = ?`, [nextStatus, id]);
  if (!result.affectedRows) throw new Error('SDR Rate not found.');
  return { msg: 2, status: nextStatus };
}
