import fs from 'fs';
import path from 'path';
import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { attachmentDir } from '../utils/ticketAttachments.js';
import { attachmentPublicUrl } from '../utils/attachmentUrl.js';

function parseUploads(upload) {
  return String(upload || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((file) => ({
      file,
      name: file,
      url: attachmentPublicUrl(file),
    }));
}

function unlinkUploads(upload) {
  for (const item of parseUploads(upload)) {
    const fullPath = path.join(attachmentDir, item.file);
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch {
      // ignore missing files
    }
  }
}

function mapRecord(row, index) {
  return {
    id: row.MSDS_ID,
    index,
    materialId: row.MATERIALID == null ? '' : String(row.MATERIALID),
    cargoName: row.CARGO_NAME ?? '',
    portId: row.PORT_ID == null ? '' : String(row.PORT_ID),
    portName: row.PORT_NAME ?? '',
    vendorId: row.VENDORID == null ? '' : String(row.VENDORID),
    shipperName: row.SHIPPER_NAME ?? '',
    remarks: row.REMARKS ?? '',
    upload: row.UPLOAD ?? '',
    attachments: parseUploads(row.UPLOAD),
    status: Number(row.STATUS) === 1 ? 1 : 2,
  };
}

const LIST_SELECT = `
  SELECT m.MSDS_ID,
         m.MATERIALID,
         m.PORT_ID,
         m.VENDORID,
         m.REMARKS,
         m.UPLOAD,
         m.STATUS,
         cm.MATERIAL_CODE_DESC AS CARGO_NAME,
         CONCAT(COALESCE(pm.PortName, ''), ' (', COALESCE(pm.COUNTRY_KEY, pm.PortCode, ''), ')') AS PORT_NAME,
         CONCAT(COALESCE(vm.NAME, ''), ' ( ', COALESCE(vm.CODE, ''), ' )') AS SHIPPER_NAME
  FROM msds_master m
  LEFT JOIN cargo_master cm ON cm.MATERIALID = m.MATERIALID
  LEFT JOIN port_master pm ON pm.PortId = m.PORT_ID
  LEFT JOIN vendor_master vm ON vm.VENDORID = m.VENDORID
`;

export async function dbGetMsdsLookups() {
  const pool = getPool();

  const [cargos] = await pool.query(
    `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name
     FROM cargo_master
     WHERE STATUS = 1
     ORDER BY MATERIAL_CODE_DESC`,
  );

  const [shippers] = await pool.query(
    `SELECT VENDORID AS id, NAME, CODE
     FROM vendor_master
     WHERE STATUS = 1
       AND MCOMPANYID = ?
     ORDER BY VENDOR_TYPEID, NAME`,
    [appContext.companyId],
  );

  return {
    cargos: cargos.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
    })),
    shippers: shippers.map((row) => ({
      id: String(row.id),
      name: `${row.NAME ?? ''} ( ${row.CODE ?? ''} )`,
    })),
  };
}

export async function dbListMsds() {
  const pool = getPool();
  const [rows] = await pool.query(
    `${LIST_SELECT}
     WHERE 1 = 1
     ORDER BY m.MSDS_ID DESC`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetMsds(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `${LIST_SELECT}
     WHERE m.MSDS_ID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) {
    const [[fallback]] = await pool.query(
      `${LIST_SELECT}
       WHERE m.MSDS_ID = ?
       LIMIT 1`,
      [id],
    );
    if (!fallback) return null;
    return mapRecord(fallback, 1);
  }
  return mapRecord(row, 1);
}

export async function dbCreateMsds(payload, upload = '') {
  const pool = getPool();
  const materialId = String(payload.materialId || '').trim();
  const portId = String(payload.portId || '').trim();
  const vendorId = String(payload.vendorId || '').trim();
  const remarks = String(payload.remarks || '').trim();

  if (!materialId) throw new Error('Cargo is required.');
  if (!portId) throw new Error('Port is required.');
  if (!vendorId) throw new Error('Shipper is required.');

  await pool.query(
    `INSERT INTO msds_master
       (MATERIALID, PORT_ID, VENDORID, REMARKS, UPLOAD, MODULEID, MCOMPANYID, STATUS)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      materialId,
      portId,
      vendorId,
      remarks,
      upload || '',
      appContext.moduleId,
      appContext.companyId,
    ],
  );

  return { msg: 0 };
}

export async function dbUpdateMsds(id, payload, upload = '') {
  const pool = getPool();
  const materialId = String(payload.materialId || '').trim();
  const portId = String(payload.portId || '').trim();
  const vendorId = String(payload.vendorId || '').trim();
  const remarks = String(payload.remarks || '').trim();
  const existing = await dbGetMsds(id);
  if (!existing) throw new Error('MSDS record not found.');

  if (!materialId) throw new Error('Cargo is required.');
  if (!portId) throw new Error('Port is required.');
  if (!vendorId) throw new Error('Shipper is required.');

  if (upload) {
    unlinkUploads(existing.upload);
    const [result] = await pool.query(
      `UPDATE msds_master
       SET MATERIALID = ?, PORT_ID = ?, VENDORID = ?, REMARKS = ?, UPLOAD = ?
       WHERE MSDS_ID = ?`,
      [materialId, portId, vendorId, remarks, upload, id],
    );
    if (!result.affectedRows) throw new Error('MSDS record not found.');
  } else {
    const [result] = await pool.query(
      `UPDATE msds_master
       SET MATERIALID = ?, PORT_ID = ?, VENDORID = ?, REMARKS = ?
       WHERE MSDS_ID = ?`,
      [materialId, portId, vendorId, remarks, id],
    );
    if (!result.affectedRows) throw new Error('MSDS record not found.');
  }

  return { msg: 0 };
}

export async function dbDeleteMsds(id) {
  const pool = getPool();
  const existing = await dbGetMsds(id);
  if (!existing) throw new Error('MSDS record not found.');

  unlinkUploads(existing.upload);

  const [result] = await pool.query(
    `DELETE FROM msds_master WHERE MSDS_ID = ?`,
    [id],
  );
  if (!result.affectedRows) throw new Error('MSDS record not found.');

  return { msg: 2 };
}
