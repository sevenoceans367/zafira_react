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
    rate: row.RATE == null ? '' : String(row.RATE),
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

const LIST_SELECT = `SELECT p.ID,
            p.BUSINESS_TYPE,
            p.VESSEL_CATEGORY,
            p.RATE,
            p.STATUS,
            COALESCE(bt.NAME, CASE p.BUSINESS_TYPE
              WHEN 1 THEN 'Gas'
              WHEN 2 THEN 'Tanker'
              WHEN 3 THEN 'Dry Cargo'
              ELSE NULL
            END) AS BUSINESS_TYPE_NAME,
            vc.NAME AS VESSEL_CATEGORY_NAME
     FROM pcctf_master p
     LEFT JOIN business_type_master bt ON bt.BUSINESSTYPEID = p.BUSINESS_TYPE
     LEFT JOIN vessel_category_master vc ON vc.VESSEL_CATEGORY_ID = p.VESSEL_CATEGORY`;

export async function dbGetPcctfLookups() {
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

export async function dbListPcctf() {
  const pool = getPool();
  const [rows] = await pool.query(`${LIST_SELECT} ORDER BY p.STATUS, p.ID`);

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetPcctf(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `${LIST_SELECT}
     WHERE p.ID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdatePcctfStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE pcctf_master
     SET STATUS = ?
     WHERE ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Panama Canal Capacity Tariff Fee not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Panama Canal Capacity Tariff Fee Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

function parsePayload(payload) {
  const businessTypeId = Number(payload.businessTypeId);
  const vesselCategoryId = Number(payload.vesselCategoryId);
  const rate = String(payload.rate ?? '').trim();

  if (!Number.isFinite(businessTypeId) || businessTypeId <= 0) {
    throw new Error('Business Type is required.');
  }
  if (!Number.isFinite(vesselCategoryId) || vesselCategoryId <= 0) {
    throw new Error('Vessel Category is required.');
  }
  if (!rate) throw new Error('Rate is required.');

  return {
    businessTypeId,
    vesselCategoryId,
    rate: Number(rate),
  };
}

export async function dbCreatePcctf(payload) {
  const pool = getPool();
  const data = parsePayload(payload);

  await pool.query(
    `INSERT INTO pcctf_master
       (BUSINESS_TYPE, VESSEL_CATEGORY, RATE, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.businessTypeId,
      data.vesselCategoryId,
      data.rate,
      appContext.moduleId,
      appContext.companyId,
    ],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Panama Canal Capacity Tariff Fee Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdatePcctf(id, payload) {
  const pool = getPool();
  const data = parsePayload(payload);

  const [result] = await pool.query(
    `UPDATE pcctf_master
     SET BUSINESS_TYPE = ?, VESSEL_CATEGORY = ?, RATE = ?
     WHERE ID = ?`,
    [data.businessTypeId, data.vesselCategoryId, data.rate, id],
  );
  if (!result.affectedRows) throw new Error('Panama Canal Capacity Tariff Fee not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Panama Canal Capacity Tariff Fee Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
