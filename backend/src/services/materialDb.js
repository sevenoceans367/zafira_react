import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MATERIAL_TYPE_LABELS = {
  1: 'Gas',
  2: 'Tanker',
  3: 'Dry Cargo',
};

function mapRecord(row, index) {
  const materialTypeId = row.MATERIAL_TYPEID == null || row.MATERIAL_TYPEID === ''
    ? ''
    : String(row.MATERIAL_TYPEID);
  return {
    id: row.MATERIALID,
    index,
    materialName: row.MATERIAL_TYPE ?? '',
    materialTypeId,
    materialTypeLabel: MATERIAL_TYPE_LABELS[Number(row.MATERIAL_TYPEID)] ?? '',
    materialCode: row.MATERIAL_CODE ?? '',
    materialCodeDesc: row.MATERIAL_CODE_DESC ?? '',
    materialTypeDesc: row.MATERIAL_TYPE_DESC ?? '',
    materialGroup: row.MATERIAL_GROUP ?? '',
    materialGroupDesc: row.MATERIAL_GROUP_DESC ?? '',
    stowFacMMt: row.STOW_FAC_M_MT == null ? '' : String(row.STOW_FAC_M_MT),
    stowFacFtMt: row.STOW_FAC_FT_MT == null ? '' : String(row.STOW_FAC_FT_MT),
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

const SELECT_FIELDS = `MATERIALID, MATERIAL_TYPE, MATERIAL_CODE, MATERIAL_TYPE_DESC,
            MATERIAL_CODE_DESC, MATERIAL_GROUP, MATERIAL_GROUP_DESC,
            MATERIAL_TYPEID, STOW_FAC_M_MT, STOW_FAC_FT_MT, STATUS`;

export async function dbListMaterials() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS}
     FROM cargo_master
     ORDER BY MATERIALID DESC`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetMaterial(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT ${SELECT_FIELDS}
     FROM cargo_master
     WHERE MATERIALID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateMaterialStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE cargo_master
     SET STATUS = ?
     WHERE MATERIALID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('Material not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Cargo Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

function parsePayload(payload) {
  const materialName = String(payload.materialName || '').trim();
  const materialCode = String(payload.materialCode || '').trim();
  const materialTypeDesc = String(payload.materialTypeDesc || '').trim();
  const materialCodeDesc = String(payload.materialCodeDesc || '').trim();
  const materialGroup = String(payload.materialGroup || '').trim();
  const materialGroupDesc = String(payload.materialGroupDesc || '').trim();
  const materialTypeId = String(payload.materialTypeId || '').trim() || '1';
  const stowFacMMt = String(payload.stowFacMMt || '').trim();
  const stowFacFtMt = String(payload.stowFacFtMt || '').trim();

  if (!materialName) throw new Error('Material Name is required.');

  return {
    materialName,
    materialCode,
    materialTypeDesc,
    materialCodeDesc,
    materialGroup,
    materialGroupDesc,
    materialTypeId,
    stowFacMMt: stowFacMMt === '' ? null : stowFacMMt,
    stowFacFtMt: stowFacFtMt === '' ? null : stowFacFtMt,
  };
}

export async function dbCreateMaterial(payload) {
  const pool = getPool();
  const data = parsePayload(payload);

  await pool.query(
    `INSERT INTO cargo_master
       (MATERIAL_TYPE, MATERIAL_CODE, MATERIAL_TYPE_DESC, MATERIAL_CODE_DESC,
        MODULEID, MCOMPANYID, MATERIAL_GROUP, MATERIAL_GROUP_DESC, MATERIAL_TYPEID,
        STOW_FAC_M_MT, STOW_FAC_FT_MT)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.materialName,
      data.materialCode,
      data.materialTypeDesc,
      data.materialCodeDesc,
      appContext.moduleId,
      appContext.companyId,
      data.materialGroup,
      data.materialGroupDesc,
      data.materialTypeId,
      data.stowFacMMt,
      data.stowFacFtMt,
    ],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Cargo Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateMaterial(id, payload) {
  const pool = getPool();
  const data = parsePayload(payload);

  const [result] = await pool.query(
    `UPDATE cargo_master
     SET MATERIAL_TYPE = ?,
         MATERIAL_CODE = ?,
         MATERIAL_TYPE_DESC = ?,
         MATERIAL_CODE_DESC = ?,
         MATERIAL_GROUP = ?,
         MATERIAL_GROUP_DESC = ?,
         MATERIAL_TYPEID = ?,
         STOW_FAC_M_MT = ?,
         STOW_FAC_FT_MT = ?
     WHERE MATERIALID = ?`,
    [
      data.materialName,
      data.materialCode,
      data.materialTypeDesc,
      data.materialCodeDesc,
      data.materialGroup,
      data.materialGroupDesc,
      data.materialTypeId,
      data.stowFacMMt,
      data.stowFacFtMt,
      id,
    ],
  );
  if (!result.affectedRows) throw new Error('Material not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Cargo Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
