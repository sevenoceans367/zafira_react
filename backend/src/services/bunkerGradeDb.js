import { appContext } from '../config.js';
import { getPool } from '../db.js';

function normalizeBunkerName(value) {
  return String(value || '').trim().replace(/ +/g, '_');
}

function emptyToNull(value) {
  if (value == null) return '';
  return String(value);
}

function mapRecord(row, index) {
  return {
    id: row.BUNKERGRADEID,
    index,
    name: row.NAME ?? '',
    fuelGrade: row.FUEL_GRADE ?? row.NAME ?? '',
    bunkerType: row.BUNKERTYPE ?? '',
    lcv: emptyToNull(row.LCV),
    co2Fac: emptyToNull(row.CO2_FAC),
    ch4Fac: emptyToNull(row.CH4_FAC),
    n2oFac: emptyToNull(row.N2O_FAC),
    co2Wt: emptyToNull(row.CO2_WT),
    penalty: emptyToNull(row.PENALITY),
    intensity2025: emptyToNull(row.INTENSITY_2025),
    intensity2026: emptyToNull(row.INTENSITY_2026),
    intensity2027: emptyToNull(row.INTENSITY_2027),
    intensity2028: emptyToNull(row.INTENSITY_2028),
    intensity2029: emptyToNull(row.INTENSITY_2029),
    ghg2025: emptyToNull(row.GHG_2025),
    ghg2026: emptyToNull(row.GHG_2026),
    ghg2027: emptyToNull(row.GHG_2027),
    ghg2028: emptyToNull(row.GHG_2028),
    ghg2029: emptyToNull(row.GHG_2029),
    rate2025: emptyToNull(row.RATE_2025),
    rate2026: emptyToNull(row.RATE_2026),
    rate2027: emptyToNull(row.RATE_2027),
    rate2028: emptyToNull(row.RATE_2028),
    rate2029: emptyToNull(row.RATE_2029),
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

function payloadFields(payload) {
  const name = normalizeBunkerName(payload.name);
  const bunkerType = String(payload.bunkerType || '').trim();
  if (!name) throw new Error('Fuel Grade is required.');
  if (!bunkerType) throw new Error('Bunker type is required.');

  return {
    name,
    bunkerType,
    values: [
      name,
      name,
      bunkerType,
      payload.lcv ?? '',
      payload.co2Fac ?? '',
      payload.ch4Fac ?? '',
      payload.n2oFac ?? '',
      payload.co2Wt ?? '',
      payload.penalty ?? '',
      payload.ghg2025 ?? '',
      payload.ghg2026 ?? '',
      payload.ghg2027 ?? '',
      payload.ghg2028 ?? '',
      payload.ghg2029 ?? '',
      payload.intensity2025 ?? '',
      payload.intensity2026 ?? '',
      payload.intensity2027 ?? '',
      payload.intensity2028 ?? '',
      payload.intensity2029 ?? '',
      payload.rate2025 ?? '',
      payload.rate2026 ?? '',
      payload.rate2027 ?? '',
      payload.rate2028 ?? '',
      payload.rate2029 ?? '',
    ],
  };
}

export async function dbListBunkerGrades() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT BUNKERGRADEID, NAME, BUNKERTYPE, STATUS
     FROM bunker_grade_master
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetBunkerGrade(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT *
     FROM bunker_grade_master
     WHERE BUNKERGRADEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [id, appContext.moduleId, appContext.companyId],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateBunkerGradeStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE bunker_grade_master
     SET STATUS = ?
     WHERE BUNKERGRADEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Bunker grade not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Bunker Grade Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

export async function dbCreateBunkerGrade(payload) {
  const pool = getPool();
  const { values } = payloadFields(payload);

  await pool.query(
    `INSERT INTO bunker_grade_master (
      NAME, FUEL_GRADE, BUNKERTYPE,
      LCV, CO2_FAC, CH4_FAC, N2O_FAC, CO2_WT, PENALITY,
      GHG_2025, GHG_2026, GHG_2027, GHG_2028, GHG_2029,
      INTENSITY_2025, INTENSITY_2026, INTENSITY_2027, INTENSITY_2028, INTENSITY_2029,
      RATE_2025, RATE_2026, RATE_2027, RATE_2028, RATE_2029,
      MODULEID, MCOMPANYID
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values, appContext.moduleId, appContext.companyId],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Bunker Grade Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateBunkerGrade(id, payload) {
  const pool = getPool();
  const { values } = payloadFields(payload);

  const [result] = await pool.query(
    `UPDATE bunker_grade_master
     SET NAME = ?,
         FUEL_GRADE = ?,
         BUNKERTYPE = ?,
         LCV = ?,
         CO2_FAC = ?,
         CH4_FAC = ?,
         N2O_FAC = ?,
         CO2_WT = ?,
         PENALITY = ?,
         GHG_2025 = ?,
         GHG_2026 = ?,
         GHG_2027 = ?,
         GHG_2028 = ?,
         GHG_2029 = ?,
         INTENSITY_2025 = ?,
         INTENSITY_2026 = ?,
         INTENSITY_2027 = ?,
         INTENSITY_2028 = ?,
         INTENSITY_2029 = ?,
         RATE_2025 = ?,
         RATE_2026 = ?,
         RATE_2027 = ?,
         RATE_2028 = ?,
         RATE_2029 = ?
     WHERE BUNKERGRADEID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [...values, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) throw new Error('Bunker grade not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Bunker Grade Record updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
