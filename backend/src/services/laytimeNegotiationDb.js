import { createHash } from 'node:crypto';
import { parseDmyDateTimeMs } from './laytimeTankerValidation.js';

const ENTITY_TYPES = new Set(['OWNER', 'CHARTERER']);
const STATUSES = new Set(['ON_HOLD', 'UNDER_NEGO', 'COMPLETED']);

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

async function loadRows(db, laytimeId, forUpdate = false) {
  if (!laytimeId) return [];
  const [rows] = await db.query(`SELECT CAST(NEGO_ID AS CHAR) AS id, ENTITY_TYPE AS entity,
      DATE_FORMAT(DIALOGUE_DATE, '%d-%m-%Y %H:%i') AS date,
      DATE_FORMAT(DIALOGUE_DATE, '%Y-%m-%d %H:%i:%s') AS sqlDate,
      REASON AS reason, AGREED_AMOUNT AS agreedDemm, CURRENCY_CODE AS currencyCode, STATUS AS status, NOTES AS notes,
      SORT_ORDER AS sortOrder, CAST(VENDOR_ID AS CHAR) AS vendorId,
      CREATED_BY, CAST(CREATED_AT AS CHAR) AS createdAt, UPDATED_BY, CAST(UPDATED_AT AS CHAR) AS updatedAt
    FROM laytime_negotiation WHERE LAYTIME_ID = CAST(? AS SIGNED)
    ORDER BY SORT_ORDER, NEGO_ID${forUpdate ? ' FOR UPDATE' : ''}`, [laytimeId]);
  return rows;
}

function revision(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

async function sofLaytimeSnapshot(db, sof) {
  if (!sof) return null;
  const fields = ['SOFID', 'TERMINAL', 'VA_1', 'VAPS_1', 'NT_1', 'PBFB_1', 'LC', 'LC1', 'VS'];
  const [[activities], [pointEvents], [keyOps], [cargo]] = await Promise.all([
    db.query(`SELECT ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION,
        LAY_TIME_COUNT, PORT_TIME_COUNT, NOTES FROM sof_slave
      WHERE SOFID = ? AND GROUP_NAME = '1' ORDER BY SOF_SLAVEID`, [sof.SOFID]),
    db.query(`SELECT ENTITY_NAME, ENTITY_VALUE FROM sof_slave_3
      WHERE SOFID = ? ORDER BY SOF_SLAVEID`, [sof.SOFID]),
    // The end-time column is optional on older SOF schemas.
    db.query('SELECT * FROM sof_slave_6 WHERE SOFID = ? ORDER BY SLAVEID', [sof.SOFID]),
    db.query('SELECT ACTIVITY, SHIPFIGURE, BLFIGURE FROM sof_slave_7 WHERE SOFID = ? ORDER BY SLAVEID', [sof.SOFID]),
  ]);
  return [fields.map((field) => sof[field] ?? null), activities, pointEvents,
    keyOps.map(({ ACTIVITY, ACTIVITYDATETIME, ACTIVITYDATETIMETO }) => [ACTIVITY, ACTIVITYDATETIME, ACTIVITYDATETIMETO ?? null]), cargo];
}

export async function laytimeSaveVersion(db, record, { sof, carry, forUpdate = false } = {}) {
  const snapshot = [record, await sofLaytimeSnapshot(db, sof), carry ?? {}];
  if (record) {
    const children = [
      ['laytime_slave', 'LAYTIME_LP_SLAVEID'],
      ['laytime_slave1', 'LAYTIME_LP_SLAVEID'],
      ['laytime_slave2', 'LAYTIME_SLAVEID'],
    ];
    for (const [table, id] of children) {
      const [rows] = await db.query(
        `SELECT * FROM ${table} WHERE LAYTIME_ID = CAST(? AS SIGNED) ORDER BY ${id}${forUpdate ? ' FOR UPDATE' : ''}`,
        [record.LAYTIME_ID],
      );
      snapshot.push(rows);
    }
  }
  return revision(snapshot);
}

export async function assertLaytimeSaveVersion(db, expected, record, inputs) {
  if (expected !== await laytimeSaveVersion(db, record, { ...inputs, forUpdate: true })) {
    fail('Laytime changed since this port was loaded. Reload before saving.', 409);
  }
}

export async function loadLaytimeNegotiations(db, laytimeId) {
  const rows = await loadRows(db, laytimeId);
  return {
    version: revision(rows),
    rows: rows.map(({ id, entity, date, reason, agreedDemm, currencyCode, status, notes }) => ({
      id, entity, date, reason, agreedDemm: agreedDemm ?? '', currencyCode, status, notes: notes ?? '',
      retained: status === 'COMPLETED',
    })),
  };
}

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
}

function textField(value, label, index) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 65535) {
    fail(`Dialogue ${index + 1} has invalid ${label}.`);
  }
  return value;
}

function normalizeRow(row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`Dialogue ${index + 1} is invalid.`);
  const { id, entity, status, currencyCode = 'USD' } = row;
  if (id != null && !validId(id)) fail(`Dialogue ${index + 1} has an invalid ID.`);
  if (!ENTITY_TYPES.has(entity)) fail(`Choose Owner or Charterer for dialogue ${index + 1}.`);
  if (!STATUSES.has(status)) fail(`Choose a valid status for dialogue ${index + 1}.`);
  if (currencyCode !== 'USD') fail('Negotiation amounts must be in USD.');
  const date = textField(row.date ?? '', 'date', index).trim();
  const reason = textField(row.reason ?? '', 'reason', index);
  const notes = textField(row.notes ?? '', 'notes', index);
  const rawAmount = textField(row.agreedDemm ?? '', 'amount', index).trim();
  if (!id && !date && !reason.trim() && !notes.trim() && !rawAmount && status === 'ON_HOLD') return null;

  const dateMs = parseDmyDateTimeMs(date);
  const parsedDate = new Date(dateMs);
  if (dateMs == null || parsedDate.getUTCFullYear() < 1000) fail(`Enter a valid date for dialogue ${index + 1}.`);
  if (!reason.trim()) fail(`Enter a reason for dialogue ${index + 1}.`);
  if (rawAmount && !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(rawAmount)) {
    fail(`Enter a valid USD amount with up to two decimal places for dialogue ${index + 1}.`);
  }
  const [digits, cents = ''] = rawAmount.replaceAll(',', '').split('.');
  const dollars = digits.replace(/^0+(?=\d)/, '');
  if (dollars.length > 16) fail(`The USD amount for dialogue ${index + 1} is too large.`);
  const agreedDemm = rawAmount ? `${dollars}.${cents.padEnd(2, '0')}` : null;
  if (status === 'COMPLETED' && agreedDemm == null) fail(`Enter an agreed amount for completed dialogue ${index + 1}.`);
  const [, day, month, year, hour = '0', minute = '0'] = date.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  const pad = (part) => part.padStart(2, '0');
  const sqlDate = `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:00`;
  return { id, entity, status, currencyCode, sqlDate, reason, notes, agreedDemm };
}

export function prepareLaytimeNegotiations(payload) {
  if (!payload || typeof payload.version !== 'string' || !/^[a-f0-9]{64}$/.test(payload.version)
    || !Array.isArray(payload.rows) || !Array.isArray(payload.deletedIds)) fail('Invalid negotiation changes.');
  const rows = payload.rows.map(normalizeRow).filter(Boolean);
  const ids = [...rows.filter((row) => row.id).map((row) => row.id), ...payload.deletedIds];
  if (!ids.every(validId) || new Set(ids).size !== ids.length) fail('Invalid or duplicate negotiation row IDs.');
  return { version: payload.version, rows, deletedIds: payload.deletedIds, ids };
}

export async function saveLaytimeNegotiations(conn, laytimeId, userId, draft) {
  const stored = await loadRows(conn, laytimeId, true);
  if (revision(stored) !== draft.version) fail('Negotiations changed since this Laytime was loaded. Reload before saving.', 409);
  const byId = new Map(stored.map((row) => [row.id, row]));
  if (draft.ids.length !== byId.size || draft.ids.some((id) => !byId.has(id))) {
    fail('Negotiation rows must belong to this Laytime record and deletions must be explicit.');
  }
  if (draft.deletedIds.some((id) => byId.get(id).status === 'COMPLETED')
    || draft.rows.some(({ id, status }) => byId.get(id)?.status === 'COMPLETED' && status !== 'COMPLETED')) {
    fail('Completed dialogues must be retained and stay completed.', 409);
  }

  for (const id of draft.deletedIds) {
    await conn.query('DELETE FROM laytime_negotiation WHERE LAYTIME_ID = CAST(? AS SIGNED) AND NEGO_ID = CAST(? AS SIGNED)', [laytimeId, id]);
  }
  for (const [sortOrder, row] of draft.rows.entries()) {
    const { id, entity, sqlDate, reason, agreedDemm, currencyCode, status, notes } = row;
    const values = [entity, sqlDate, reason, agreedDemm, currencyCode, status, notes || null, sortOrder];
    if (!id) {
      await conn.query(`INSERT INTO laytime_negotiation
        (LAYTIME_ID, ENTITY_TYPE, DIALOGUE_DATE, REASON, AGREED_AMOUNT, CURRENCY_CODE, STATUS, NOTES, SORT_ORDER, CREATED_BY)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [laytimeId, ...values, userId]);
      continue;
    }
    const before = byId.get(id);
    const originalValues = [before.entity, before.sqlDate, before.reason, before.agreedDemm, before.currencyCode,
      before.status, before.notes, before.sortOrder];
    if (values.every((value, index) => value === originalValues[index])) continue;
    await conn.query(`UPDATE laytime_negotiation SET ENTITY_TYPE = ?, DIALOGUE_DATE = ?, REASON = ?,
      AGREED_AMOUNT = ?, CURRENCY_CODE = ?, STATUS = ?, NOTES = ?, SORT_ORDER = ?, UPDATED_BY = ?
      WHERE LAYTIME_ID = CAST(? AS SIGNED) AND NEGO_ID = CAST(? AS SIGNED)`, [...values, userId, laytimeId, id]);
  }
}
