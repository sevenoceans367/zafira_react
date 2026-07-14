import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  const countryIds = String(row.COUNTRY_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return {
    id: row.PC_TYPE_ID,
    index,
    name: row.NAME ?? '',
    countryIds,
    countryNames: row.COUNTRY_NAMES ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

async function resolveCountryNames(pool, countryIdsCsv) {
  const ids = String(countryIdsCsv || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) return '';

  const [rows] = await pool.query(
    `SELECT COUNTRYID, COUNTRY_NAME
     FROM country_master
     WHERE COUNTRYID IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  const byId = new Map(rows.map((row) => [String(row.COUNTRYID), row.COUNTRY_NAME ?? '']));
  return ids.map((id) => byId.get(String(id)) || id).join(' , ');
}

export async function dbGetPortCostTypeLookups() {
  const pool = getPool();
  const [countries] = await pool.query(
    `SELECT COUNTRYID AS id, COUNTRY_NAME AS name
     FROM country_master
     WHERE STATUS = 1
     ORDER BY COUNTRY_NAME`,
  );
  return {
    countries: countries.map((row) => ({
      id: row.id,
      name: row.name ?? '',
    })),
  };
}

export async function dbListPortCostTypes() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT PC_TYPE_ID, NAME, COUNTRY_IDS, STATUS
     FROM port_cost_type_master
     ORDER BY STATUS, NAME`,
  );

  const records = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const countryNames = await resolveCountryNames(pool, row.COUNTRY_IDS);
    records.push(mapRecord({ ...row, COUNTRY_NAMES: countryNames }, i + 1));
  }

  return { records, recordsTotal: records.length };
}

export async function dbGetPortCostType(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT PC_TYPE_ID, NAME, COUNTRY_IDS, STATUS
     FROM port_cost_type_master
     WHERE PC_TYPE_ID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  const countryNames = await resolveCountryNames(pool, row.COUNTRY_IDS);
  return mapRecord({ ...row, COUNTRY_NAMES: countryNames }, 1);
}

export async function dbUpdatePortCostTypeStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE port_cost_type_master
     SET STATUS = ?
     WHERE PC_TYPE_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Port cost type not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Port Cost Type Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

function normalizeCountryIds(payload) {
  const raw = Array.isArray(payload.countryIds) ? payload.countryIds : [];
  const ids = raw.map((id) => String(id).trim()).filter(Boolean);
  if (ids.length === 0) throw new Error('At least one country is required.');
  return ids;
}

export async function dbCreatePortCostTypes(payload) {
  const pool = getPool();
  const countryIds = normalizeCountryIds(payload);
  const names = (Array.isArray(payload.names) ? payload.names : [payload.name])
    .map((name) => String(name || '').trim())
    .filter(Boolean);

  if (names.length === 0) throw new Error('Port Cost Type is required.');

  const countriesCsv = countryIds.join(',');
  for (const name of names) {
    await pool.query(
      `INSERT INTO port_cost_type_master (NAME, COUNTRY_IDS, MODULEID, MCOMPANYID)
       VALUES (?, ?, ?, ?)`,
      [name, countriesCsv, appContext.moduleId, appContext.companyId],
    );
    await pool.query(
      `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
       VALUES (?, 'Port Cost Type Record added successfully.', NOW())`,
      [appContext.userId],
    );
  }

  return { msg: 0 };
}

export async function dbUpdatePortCostType(id, payload) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  const countryIds = normalizeCountryIds(payload);
  if (!name) throw new Error('Port Cost Type is required.');

  const [result] = await pool.query(
    `UPDATE port_cost_type_master
     SET NAME = ?, COUNTRY_IDS = ?
     WHERE PC_TYPE_ID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [name, countryIds.join(','), id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Port cost type not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Port Cost Type Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
