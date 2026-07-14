import fs from 'fs';
import path from 'path';
import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { attachmentDir } from '../utils/ticketAttachments.js';

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAttachments(upload, uploadName) {
  const files = parseCsv(upload);
  const names = parseCsv(uploadName);
  return files.map((file, index) => ({
    file,
    name: names[index] || file,
    url: `/attachment/${file}`,
  }));
}

function unlinkUploads(upload) {
  for (const file of parseCsv(upload)) {
    const fullPath = path.join(attachmentDir, file);
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch {
      // ignore missing files
    }
  }
}

function mapRecord(row, index) {
  return {
    id: row.PORTDATA_ID,
    index,
    portId: row.PORT_ID == null ? '' : String(row.PORT_ID),
    portName: row.PORT_NAME ?? '',
    terminalId: row.TERMINALID == null ? '' : String(row.TERMINALID),
    terminalName: row.TERMINAL_NAME ?? '',
    materialIds: parseCsv(row.MATERIALID),
    materialCodeDesc: row.MATERIALCODE_DESC ?? '',
    remarks: row.REMARKS ?? '',
    upload: row.UPLOAD ?? '',
    uploadName: row.UPLOAD_NAME ?? '',
    attachments: parseAttachments(row.UPLOAD, row.UPLOAD_NAME),
    status: Number(row.STATUS) === 1 ? 1 : 2,
  };
}

const LIST_SELECT = `
  SELECT pd.PORTDATA_ID,
         pd.PORT_ID,
         pd.TERMINALID,
         pd.MATERIALID,
         pd.MATERIALCODE_DESC,
         pd.REMARKS,
         pd.UPLOAD,
         pd.UPLOAD_NAME,
         pd.STATUS,
         CONCAT(COALESCE(pm.PortName, ''), ' (', COALESCE(pm.COUNTRY_KEY, ''), ')') AS PORT_NAME,
         tm.NAME AS TERMINAL_NAME
  FROM port_data_master pd
  LEFT JOIN port_master pm ON pm.PortId = pd.PORT_ID
  LEFT JOIN terminal_master tm ON tm.TERMINALID = pd.TERMINALID
`;

async function resolveCargoDescriptions(pool, materialIds) {
  if (!materialIds.length) return '';
  const placeholders = materialIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT MATERIALID, MATERIAL_CODE_DESC
     FROM cargo_master
     WHERE MATERIALID IN (${placeholders})`,
    materialIds,
  );
  const byId = new Map(rows.map((row) => [String(row.MATERIALID), row.MATERIAL_CODE_DESC ?? '']));
  return materialIds.map((id) => byId.get(String(id)) || '').filter(Boolean).join(',');
}

export async function dbGetPortDataLookups() {
  const pool = getPool();

  const [terminals] = await pool.query(
    `SELECT TERMINALID AS id, NAME AS name
     FROM terminal_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  const [cargos] = await pool.query(
    `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name
     FROM cargo_master
     WHERE STATUS = 1
     ORDER BY MATERIAL_CODE_DESC`,
  );

  return {
    terminals: terminals.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
    })),
    cargos: cargos.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
    })),
  };
}

export async function dbListPortData() {
  const pool = getPool();
  const [rows] = await pool.query(
    `${LIST_SELECT}
     WHERE 1 = 1
     ORDER BY pd.PORTDATA_ID DESC`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetPortData(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `${LIST_SELECT}
     WHERE pd.PORTDATA_ID = ?
       AND pd.MODULEID = ?
       AND pd.MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) {
    const [[fallback]] = await pool.query(
      `${LIST_SELECT}
       WHERE pd.PORTDATA_ID = ?
       LIMIT 1`,
      [id],
    );
    if (!fallback) return null;
    return mapRecord(fallback, 1);
  }
  return mapRecord(row, 1);
}

export async function dbCreatePortData(payload, upload = '', uploadName = '') {
  const pool = getPool();
  const portId = String(payload.portId || '').trim();
  const terminalId = String(payload.terminalId || '').trim();
  const remarks = String(payload.remarks || '').trim();
  const materialIds = Array.isArray(payload.materialIds)
    ? payload.materialIds.map(String).map((id) => id.trim()).filter(Boolean)
    : parseCsv(payload.materialIds);

  if (!portId) throw new Error('Port is required.');
  if (!terminalId) throw new Error('Terminal is required.');
  if (!materialIds.length) throw new Error('Cargo is required.');

  const materialCodeDesc = await resolveCargoDescriptions(pool, materialIds);

  await pool.query(
    `INSERT INTO port_data_master
       (PORT_ID, TERMINALID, MATERIALID, MATERIALCODE_DESC, REMARKS, UPLOAD, MODULEID, MCOMPANYID, STATUS, UPLOAD_NAME)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      portId,
      terminalId,
      materialIds.join(','),
      materialCodeDesc,
      remarks,
      upload || '',
      appContext.moduleId,
      appContext.companyId,
      uploadName || '',
    ],
  );

  return { msg: 0 };
}

export async function dbUpdatePortData(id, payload, upload = '', uploadName = '') {
  const pool = getPool();
  const remarks = String(payload.remarks || '').trim();
  const existing = await dbGetPortData(id);
  if (!existing) throw new Error('Port Data record not found.');

  const keepFiles = parseCsv(payload.keepUpload);
  const keepNames = parseCsv(payload.keepUploadName);
  const newFiles = parseCsv(upload);
  const newNames = parseCsv(uploadName);

  let nextUpload = '';
  let nextUploadName = '';
  if (keepFiles.length && newFiles.length) {
    nextUpload = [...keepFiles, ...newFiles].join(',');
    nextUploadName = [...keepNames, ...newNames].join(',');
  } else if (!keepFiles.length && newFiles.length) {
    nextUpload = newFiles.join(',');
    nextUploadName = newNames.join(',');
  } else if (keepFiles.length && !newFiles.length) {
    nextUpload = keepFiles.join(',');
    nextUploadName = keepNames.join(',');
  }

  const [result] = await pool.query(
    `UPDATE port_data_master
     SET REMARKS = ?, UPLOAD = ?, UPLOAD_NAME = ?
     WHERE PORTDATA_ID = ?`,
    [remarks, nextUpload, nextUploadName, id],
  );
  if (!result.affectedRows) throw new Error('Port Data record not found.');

  return { msg: 0 };
}

export async function dbDeletePortData(id) {
  const pool = getPool();
  const existing = await dbGetPortData(id);
  if (!existing) throw new Error('Port Data record not found.');

  unlinkUploads(existing.upload);

  const [result] = await pool.query(
    `DELETE FROM port_data_master WHERE PORTDATA_ID = ?`,
    [id],
  );
  if (!result.affectedRows) throw new Error('Port Data record not found.');

  return { msg: 2 };
}
