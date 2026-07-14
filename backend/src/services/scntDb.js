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
    businessTypeId: row.BUSINESS_TYPE == null ? '' : String(row.BUSINESS_TYPE),
    businessTypeName: row.BUSINESS_TYPE_NAME ?? '',
    vesselTypeId: row.VESSEL_TYPE == null ? '' : String(row.VESSEL_TYPE),
    vesselTypeName: row.VESSEL_TYPE_NAME ?? '',
    fromRange: row.FROM_RANGE == null ? '' : String(row.FROM_RANGE),
    toRange: row.TO_RANGE == null ? '' : String(row.TO_RANGE),
    percent: row.PERCENT == null ? '' : String(row.PERCENT),
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

const SELECT = `
  SELECT s.ID, s.BUSINESS_TYPE, s.VESSEL_TYPE, s.FROM_RANGE, s.TO_RANGE, s.PERCENT, s.STATUS,
         COALESCE(bt.NAME, CASE s.BUSINESS_TYPE WHEN 1 THEN 'Gas' WHEN 2 THEN 'Tanker' WHEN 3 THEN 'Dry Cargo' ELSE NULL END) AS BUSINESS_TYPE_NAME,
         vt.VesselType AS VESSEL_TYPE_NAME
  FROM scnt_master s
  LEFT JOIN business_type_master bt ON bt.BUSINESSTYPEID = s.BUSINESS_TYPE
  LEFT JOIN vessel_type_master vt ON vt.VesselTypeId = s.VESSEL_TYPE
`;

export async function dbGetScntLookups() {
  const pool = getPool();
  const businessTypes = await loadBusinessTypes(pool);
  const [vesselTypes] = await pool.query(
    `SELECT VesselTypeId AS id, VesselType AS name, BusinessType AS businessTypeId
     FROM vessel_type_master
     WHERE Status = 1
     ORDER BY VesselType`,
  );
  return {
    businessTypes,
    vesselTypes: vesselTypes.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
      businessTypeId: row.businessTypeId == null ? '' : String(row.businessTypeId),
    })),
  };
}

export async function dbListScnt() {
  const pool = getPool();
  const [rows] = await pool.query(`${SELECT} ORDER BY s.STATUS, s.ID`);
  return { records: rows.map((row, i) => mapRecord(row, i + 1)), recordsTotal: rows.length };
}

export async function dbGetScnt(id) {
  const pool = getPool();
  const [[row]] = await pool.query(`${SELECT} WHERE s.ID = ? LIMIT 1`, [id]);
  return row ? mapRecord(row, 1) : null;
}

export async function dbCreateScnt(payload) {
  const pool = getPool();
  const businessTypeId = String(payload.businessTypeId || '').trim();
  const vesselTypeId = String(payload.vesselTypeId || '').trim();
  const fromRange = String(payload.fromRange || '').trim();
  const toRange = String(payload.toRange || '').trim();
  const percent = String(payload.percent || '').trim();
  if (!businessTypeId || !vesselTypeId || fromRange === '' || toRange === '' || percent === '') {
    throw new Error('All fields are required.');
  }
  if (Number(toRange) < Number(fromRange)) throw new Error('To Range must be greater than or equal to From Range.');
  await pool.query(
    `INSERT INTO scnt_master (BUSINESS_TYPE, VESSEL_TYPE, FROM_RANGE, TO_RANGE, PERCENT, MODULEID, MCOMPANYID, STATUS)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [businessTypeId, vesselTypeId, fromRange, toRange, percent, appContext.moduleId, appContext.companyId],
  );
  return { msg: 0 };
}

export async function dbUpdateScnt(id, payload) {
  const pool = getPool();
  const businessTypeId = String(payload.businessTypeId || '').trim();
  const vesselTypeId = String(payload.vesselTypeId || '').trim();
  const fromRange = String(payload.fromRange || '').trim();
  const toRange = String(payload.toRange || '').trim();
  const percent = String(payload.percent || '').trim();
  if (!businessTypeId || !vesselTypeId || fromRange === '' || toRange === '' || percent === '') {
    throw new Error('All fields are required.');
  }
  if (Number(toRange) < Number(fromRange)) throw new Error('To Range must be greater than or equal to From Range.');
  const [result] = await pool.query(
    `UPDATE scnt_master SET BUSINESS_TYPE = ?, VESSEL_TYPE = ?, FROM_RANGE = ?, TO_RANGE = ?, PERCENT = ? WHERE ID = ?`,
    [businessTypeId, vesselTypeId, fromRange, toRange, percent, id],
  );
  if (!result.affectedRows) throw new Error('SCNT record not found.');
  return { msg: 0 };
}

export async function dbUpdateScntStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(`UPDATE scnt_master SET STATUS = ? WHERE ID = ?`, [nextStatus, id]);
  if (!result.affectedRows) throw new Error('SCNT record not found.');
  return { msg: 2, status: nextStatus };
}
