import { getPool } from '../db.js';
import {
  TANKER_DATE_FIELDS,
  TANKER_RADIO_FIELDS,
  TANKER_REQUEST_TO_COLUMN,
} from './tankerParticularsFieldMap.js';
import { mergeVesselAttachments } from '../utils/vesselAttachments.js';

const EMPTY_DATE = '1970-01-01';

function parseDateToDb(value) {
  if (!value || value === '0000-00-00' || value === EMPTY_DATE) return EMPTY_DATE;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value).trim());
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_DATE;
  return date.toISOString().slice(0, 10);
}

function parseRadioToDb(value) {
  const num = Number(value);
  if (num === 1 || num === 2) return num;
  return 1;
}

function mapFieldsToDbRow(fields = {}) {
  const row = {};
  Object.entries(TANKER_REQUEST_TO_COLUMN).forEach(([requestKey, column]) => {
    const value = fields[requestKey];
    if (TANKER_DATE_FIELDS.has(requestKey)) {
      row[column] = parseDateToDb(value);
      return;
    }
    if (TANKER_RADIO_FIELDS.has(requestKey)) {
      row[column] = parseRadioToDb(value);
      return;
    }
    row[column] = String(value ?? '').trim();
  });
  return row;
}

function mapCertificateRow(certificate, uploadedFiles = []) {
  const existingFiles = String(certificate.existingFiles || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const existingNames = String(certificate.existingNames || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const { attachment, attachmentName } = mergeVesselAttachments(
    existingFiles,
    existingNames,
    uploadedFiles,
  );

  return {
    certificateId: String(certificate.certificateId || '').trim(),
    dateIssue: parseDateToDb(certificate.dateIssue),
    dateLastAnnual: parseDateToDb(certificate.dateLastAnnual),
    dateExpiry: parseDateToDb(certificate.dateExpiry),
    upload: attachment,
    uploadName: attachmentName,
  };
}

export async function dbUpdateTankerParticulars(vesselId, { fields = {}, certificates = [] }, filesByIndex = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      'DELETE FROM vessel_master_tankers_slave WHERE VESSEL_IMO_ID = ?',
      [vesselId],
    );
    await connection.query(
      'DELETE FROM vessel_master_tankers WHERE VESSEL_IMO_ID = ?',
      [vesselId],
    );

    const dbRow = mapFieldsToDbRow(fields);
    const columns = Object.values(TANKER_REQUEST_TO_COLUMN);
    const placeholders = ['?', ...columns.map(() => '?'), 'NOW()'].join(', ');
    const values = [vesselId, ...columns.map((column) => dbRow[column] ?? '')];

    await connection.query(
      `INSERT INTO vessel_master_tankers (VESSEL_IMO_ID, ${columns.join(', ')}, UPDATEONDATE)
       VALUES (${placeholders})`,
      values,
    );

    for (let index = 0; index < certificates.length; index += 1) {
      const certificate = certificates[index];
      if (!certificate?.certificateId) continue;

      const mapped = mapCertificateRow(certificate, filesByIndex[index] || []);
      await connection.query(
        `INSERT INTO vessel_master_tankers_slave
          (VESSEL_IMO_ID, CERTIFICATE_ID, DATE_ISSUE, DATE_LAST, DATE_EXPIRY, UPLOAD, UPLOAD_NANE)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          vesselId,
          mapped.certificateId,
          mapped.dateIssue,
          mapped.dateLastAnnual,
          mapped.dateExpiry,
          mapped.upload,
          mapped.uploadName,
        ],
      );
    }

    await connection.commit();
    return { msg: 0 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
