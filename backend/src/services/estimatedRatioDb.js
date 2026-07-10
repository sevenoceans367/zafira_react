import { appContext } from '../config.js';
import { getPool } from '../db.js';

const BUSINESS_TYPE_FALLBACK = [
  { id: 1, name: 'Gas' },
  { id: 2, name: 'Tanker' },
  { id: 3, name: 'Dry Cargo' },
];

function mapRecord(row, index) {
  return {
    id: row.ID,
    index,
    businessTypeId: row.BUSINESS_TYPE == null ? '' : String(row.BUSINESS_TYPE),
    businessTypeName: row.BUSINESS_TYPE_NAME ?? '',
    vesselCategoryId: row.VESSEL_CATEGORY == null ? '' : String(row.VESSEL_CATEGORY),
    vesselCategoryName: row.VESSEL_CATEGORY_NAME ?? '',
    dwt: row.DWT == null ? '' : String(row.DWT),
    percent: row.PERCENT == null ? '' : String(row.PERCENT),
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbGetEstimatedRatioLookups() {
  const pool = getPool();

  let businessTypes = [];
  try {
    const [rows] = await pool.query(
      `SELECT BUSINESSTYPEID AS id, NAME AS name
       FROM business_type_master
       WHERE STATUS = 1
       ORDER BY NAME`,
    );
    businessTypes = rows.map((row) => ({
      id: row.id,
      name: row.name ?? '',
    }));
  } catch {
    businessTypes = [];
  }
  if (businessTypes.length === 0) {
    businessTypes = BUSINESS_TYPE_FALLBACK;
  }

  const [vesselCategories] = await pool.query(
    `SELECT VESSEL_CATEGORY_ID AS id, NAME AS name
     FROM vessel_category_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  return {
    businessTypes,
    vesselCategories: vesselCategories.map((row) => ({
      id: row.id,
      name: row.name ?? '',
    })),
  };
}

export async function dbListEstimatedRatios() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT er.ID,
            er.BUSINESS_TYPE,
            er.VESSEL_CATEGORY,
            er.DWT,
            er.PERCENT,
            er.STATUS,
            COALESCE(bt.NAME, CASE er.BUSINESS_TYPE
              WHEN 1 THEN 'Gas'
              WHEN 2 THEN 'Tanker'
              WHEN 3 THEN 'Dry Cargo'
              ELSE NULL
            END) AS BUSINESS_TYPE_NAME,
            vc.NAME AS VESSEL_CATEGORY_NAME
     FROM estimated_ratio_master er
     LEFT JOIN business_type_master bt ON bt.BUSINESSTYPEID = er.BUSINESS_TYPE
     LEFT JOIN vessel_category_master vc ON vc.VESSEL_CATEGORY_ID = er.VESSEL_CATEGORY
     ORDER BY er.STATUS, er.DWT, er.ID`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetEstimatedRatio(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT er.ID,
            er.BUSINESS_TYPE,
            er.VESSEL_CATEGORY,
            er.DWT,
            er.PERCENT,
            er.STATUS,
            COALESCE(bt.NAME, CASE er.BUSINESS_TYPE
              WHEN 1 THEN 'Gas'
              WHEN 2 THEN 'Tanker'
              WHEN 3 THEN 'Dry Cargo'
              ELSE NULL
            END) AS BUSINESS_TYPE_NAME,
            vc.NAME AS VESSEL_CATEGORY_NAME
     FROM estimated_ratio_master er
     LEFT JOIN business_type_master bt ON bt.BUSINESSTYPEID = er.BUSINESS_TYPE
     LEFT JOIN vessel_category_master vc ON vc.VESSEL_CATEGORY_ID = er.VESSEL_CATEGORY
     WHERE er.ID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateEstimatedRatioStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE estimated_ratio_master
     SET STATUS = ?
     WHERE ID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('Estimated ratio not found.');
  return { msg: 2, status: nextStatus };
}

function parsePayload(payload) {
  const businessTypeId = Number(payload.businessTypeId);
  const vesselCategoryId = Number(payload.vesselCategoryId);
  const dwt = String(payload.dwt ?? '').trim();
  const percent = String(payload.percent ?? '').trim();

  if (!Number.isFinite(businessTypeId) || businessTypeId <= 0) {
    throw new Error('Business Type is required.');
  }
  if (!Number.isFinite(vesselCategoryId) || vesselCategoryId <= 0) {
    throw new Error('Vessel Category is required.');
  }
  if (!dwt) throw new Error('DWT is required.');
  if (!percent) throw new Error('Percent is required.');

  return {
    businessTypeId,
    vesselCategoryId,
    dwt: Number(dwt),
    percent: Number(percent),
  };
}

export async function dbCreateEstimatedRatio(payload) {
  const pool = getPool();
  const data = parsePayload(payload);

  await pool.query(
    `INSERT INTO estimated_ratio_master
       (BUSINESS_TYPE, VESSEL_CATEGORY, DWT, PERCENT, STATUS, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [
      data.businessTypeId,
      data.vesselCategoryId,
      data.dwt,
      data.percent,
      appContext.moduleId,
      appContext.companyId,
    ],
  );

  return { msg: 0 };
}

export async function dbUpdateEstimatedRatio(id, payload) {
  const pool = getPool();
  const data = parsePayload(payload);

  const [result] = await pool.query(
    `UPDATE estimated_ratio_master
     SET BUSINESS_TYPE = ?, VESSEL_CATEGORY = ?, DWT = ?, PERCENT = ?
     WHERE ID = ?`,
    [
      data.businessTypeId,
      data.vesselCategoryId,
      data.dwt,
      data.percent,
      id,
    ],
  );
  if (!result.affectedRows) throw new Error('Estimated ratio not found.');

  return { msg: 0 };
}
