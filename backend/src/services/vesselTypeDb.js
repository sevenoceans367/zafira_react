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
  const status = Number(row.Status) === 1 ? 1 : 2;
  return {
    id: row.VesselTypeId,
    index,
    name: row.VesselType ?? '',
    businessTypeId: row.BusinessType == null ? '' : String(row.BusinessType),
    businessTypeName: row.BUSINESS_TYPE_NAME ?? '',
    status,
    statusLabel: status === 1 ? 'Active' : 'In-active',
    isActive: status === 1,
  };
}

const SELECT = `
  SELECT vt.VesselTypeId, vt.VesselType, vt.BusinessType, vt.Status,
         COALESCE(bt.NAME, CASE vt.BusinessType WHEN 1 THEN 'Gas' WHEN 2 THEN 'Tanker' WHEN 3 THEN 'Dry Cargo' ELSE NULL END) AS BUSINESS_TYPE_NAME
  FROM vessel_type_master vt
  LEFT JOIN business_type_master bt ON bt.BUSINESSTYPEID = vt.BusinessType
`;

export async function dbGetVesselTypeLookups() {
  return { businessTypes: await loadBusinessTypes(getPool()) };
}

export async function dbListVesselTypes() {
  const pool = getPool();
  const [rows] = await pool.query(`${SELECT} ORDER BY vt.Status, vt.VesselType`);
  return { records: rows.map((row, i) => mapRecord(row, i + 1)), recordsTotal: rows.length };
}

export async function dbGetVesselType(id) {
  const pool = getPool();
  const [[row]] = await pool.query(`${SELECT} WHERE vt.VesselTypeId = ? LIMIT 1`, [id]);
  return row ? mapRecord(row, 1) : null;
}

export async function dbCreateVesselType(payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const businessTypeId = String(payload.businessTypeId || '').trim();
  const status = Number(payload.status) === 2 ? 2 : 1;
  if (!name) throw new Error('Vessel Type is required.');
  if (!businessTypeId) throw new Error('Business Type is required.');
  await pool.query(
    `INSERT INTO vessel_type_master (VesselType, Status, BusinessType) VALUES (?, ?, ?)`,
    [name, status, businessTypeId],
  );
  return { msg: 0 };
}

export async function dbUpdateVesselType(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const businessTypeId = String(payload.businessTypeId || '').trim();
  const status = Number(payload.status) === 2 ? 2 : 1;
  if (!name) throw new Error('Vessel Type is required.');
  if (!businessTypeId) throw new Error('Business Type is required.');
  const [result] = await pool.query(
    `UPDATE vessel_type_master SET VesselType = ?, Status = ?, BusinessType = ? WHERE VesselTypeId = ?`,
    [name, status, businessTypeId, id],
  );
  if (!result.affectedRows) throw new Error('Vessel Type not found.');
  return { msg: 0 };
}
