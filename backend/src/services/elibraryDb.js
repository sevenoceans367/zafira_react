import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { attachmentPublicUrl } from '../utils/attachmentUrl.js';

function formatDateDisplay(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateInput(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseAttachments(upload, uploadName) {
  const files = String(upload || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const names = String(uploadName || '')
    .split(',')
    .map((part) => part.trim());

  return files.map((file, index) => ({
    file,
    name: names[index] || file,
    url: attachmentPublicUrl(file),
  }));
}

function mapRecord(row, index = 1) {
  return {
    id: row.ELIBREF_ID,
    index,
    categoryId: row.CATEGORY != null ? String(row.CATEGORY) : '',
    categoryName: row.CATEGORY_NAME || '',
    referenceTypeId: row.REFERENCE != null ? String(row.REFERENCE) : '',
    referenceTypeName: row.REFERENCE_NAME || '',
    date: formatDateDisplay(row.DATE),
    dateInput: formatDateInput(row.DATE),
    name: row.NAME || '',
    description: row.DESCRIPTION || '',
    source: row.SOURCE || '',
    upload: row.UPLOAD || '',
    uploadName: row.UPLOAD_NAME || '',
    attachments: parseAttachments(row.UPLOAD, row.UPLOAD_NAME),
  };
}

export async function dbListElibraryLookups() {
  const pool = getPool();
  const [categories] = await pool.query(
    `SELECT CATEGORY_ID AS id, NAME AS name
     FROM elibrary_categories
     WHERE STATUS = 1
     ORDER BY NAME`,
  );
  const [referenceTypes] = await pool.query(
    `SELECT REF_ID AS id, NAME AS name
     FROM elibrary_refrences
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  return {
    categories: categories.map((row) => ({ id: String(row.id), name: row.name || '' })),
    referenceTypes: referenceTypes.map((row) => ({ id: String(row.id), name: row.name || '' })),
  };
}

export async function dbListElibraryReferences({
  categoryId = '',
  referenceTypeId = '',
  name = '',
} = {}) {
  const pool = getPool();
  const params = [appContext.moduleId, appContext.companyId];
  let where = `e.MODULEID = ? AND e.MCOMPANYID = ?`;

  if (categoryId) {
    where += ' AND e.CATEGORY = ?';
    params.push(categoryId);
  }
  if (referenceTypeId) {
    where += ' AND e.REFERENCE = ?';
    params.push(referenceTypeId);
  }
  if (name) {
    where += ' AND e.NAME LIKE ?';
    params.push(`%${name}%`);
  }

  const [rows] = await pool.query(
    `SELECT e.ELIBREF_ID, e.CATEGORY, e.REFERENCE, e.DATE, e.NAME, e.DESCRIPTION,
            e.SOURCE, e.UPLOAD, e.UPLOAD_NAME,
            c.NAME AS CATEGORY_NAME, r.NAME AS REFERENCE_NAME
     FROM elibrary e
     LEFT JOIN elibrary_categories c ON c.CATEGORY_ID = e.CATEGORY
     LEFT JOIN elibrary_refrences r ON r.REF_ID = e.REFERENCE
     WHERE ${where}
     ORDER BY e.ELIBREF_ID DESC`,
    params,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetElibraryReference(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT e.ELIBREF_ID, e.CATEGORY, e.REFERENCE, e.DATE, e.NAME, e.DESCRIPTION,
            e.SOURCE, e.UPLOAD, e.UPLOAD_NAME,
            c.NAME AS CATEGORY_NAME, r.NAME AS REFERENCE_NAME
     FROM elibrary e
     LEFT JOIN elibrary_categories c ON c.CATEGORY_ID = e.CATEGORY
     LEFT JOIN elibrary_refrences r ON r.REF_ID = e.REFERENCE
     WHERE e.ELIBREF_ID = ?
       AND e.MODULEID = ?
       AND e.MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

function normalizePayload(payload = {}) {
  const categoryId = String(payload.categoryId || '').trim();
  const referenceTypeId = String(payload.referenceTypeId || '').trim();
  const name = String(payload.name || '').trim();
  const source = String(payload.source || '').trim();
  const description = String(payload.description || '').trim();
  let dateValue = payload.date || '';

  if (!categoryId) throw new Error('Category is required.');
  if (!referenceTypeId) throw new Error('Reference type is required.');
  if (!name) throw new Error('Name is required.');

  if (dateValue) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) {
      dateValue = formatDateInput(parsed);
    }
  } else {
    dateValue = formatDateInput(new Date());
  }

  return {
    categoryId,
    referenceTypeId,
    name,
    source,
    description,
    dateValue,
  };
}

export async function dbCreateElibraryReference(payload, attachments = {}) {
  const pool = getPool();
  const data = normalizePayload(payload);
  const upload = attachments.attachment || '';
  const uploadName = attachments.attachmentName || '';

  const [result] = await pool.query(
    `INSERT INTO elibrary
      (CATEGORY, REFERENCE, DATE, NAME, SOURCE, DESCRIPTION, UPLOAD, UPLOAD_NAME, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.categoryId,
      data.referenceTypeId,
      data.dateValue,
      data.name,
      data.source,
      data.description,
      upload,
      uploadName,
      appContext.moduleId,
      appContext.companyId,
    ],
  );

  return { msg: 0, id: result.insertId };
}

export async function dbUpdateElibraryReference(id, payload, attachments = {}) {
  const pool = getPool();
  const data = normalizePayload(payload);
  const upload = attachments.attachment || '';
  const uploadName = attachments.attachmentName || '';

  const [result] = await pool.query(
    `UPDATE elibrary
     SET CATEGORY = ?, REFERENCE = ?, DATE = ?, NAME = ?, SOURCE = ?, DESCRIPTION = ?,
         UPLOAD = ?, UPLOAD_NAME = ?
     WHERE ELIBREF_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [
      data.categoryId,
      data.referenceTypeId,
      data.dateValue,
      data.name,
      data.source,
      data.description,
      upload,
      uploadName,
      id,
      appContext.moduleId,
      appContext.companyId,
    ],
  );
  if (!result.affectedRows) throw Object.assign(new Error('E-Library reference not found.'), { status: 404 });

  return { msg: 0 };
}

export async function dbDeleteElibraryReference(id) {
  const pool = getPool();
  const [result] = await pool.query(
    `DELETE FROM elibrary
     WHERE ELIBREF_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw Object.assign(new Error('E-Library reference not found.'), { status: 404 });
  return { msg: 3 };
}
