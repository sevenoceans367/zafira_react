import { appContext } from '../config.js';
import { getPool } from '../db.js';

function mapRecord(row, index) {
  return {
    id: row.OTHER_SCOSTID,
    index,
    name: row.NAME ?? '',
    expenseClassGroup: row.EXP_CLS_GROUP ?? '',
    expenseClass: row.EXP_CLS ?? '',
    accountingType: row.ACC_TYP_EXP ?? '',
    postingType: row.POSTING_TYP_EXP ?? '',
    conditionType: row.CONDITION_TYP ?? '',
    partnerNumber: row.PARTNER_NUMBER ?? '',
    currencyKey: row.CURRENCY_KEY ?? '',
    taxCode: row.TAX_CODE ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    isActive: Number(row.STATUS) === 1,
  };
}

export async function dbListOtherShippingCosts() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT OTHER_SCOSTID, NAME, EXP_CLS_GROUP, EXP_CLS, ACC_TYP_EXP, POSTING_TYP_EXP,
            CONDITION_TYP, PARTNER_NUMBER, CURRENCY_KEY, TAX_CODE, STATUS
     FROM other_shipping_cost_master
     ORDER BY STATUS, NAME`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetOtherShippingCost(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT OTHER_SCOSTID, NAME, EXP_CLS_GROUP, EXP_CLS, ACC_TYP_EXP, POSTING_TYP_EXP,
            CONDITION_TYP, PARTNER_NUMBER, CURRENCY_KEY, TAX_CODE, STATUS
     FROM other_shipping_cost_master
     WHERE OTHER_SCOSTID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbUpdateOtherShippingCostStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE other_shipping_cost_master
     SET STATUS = ?
     WHERE OTHER_SCOSTID = ?`,
    [nextStatus, id],
  );
  if (!result.affectedRows) throw new Error('Other shipping cost not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Other Shipping Cost Record Status updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 2, status: nextStatus };
}

function normalizePayload(payload) {
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Name is required.');
  return {
    name,
    expenseClassGroup: String(payload.expenseClassGroup || '').trim(),
    expenseClass: String(payload.expenseClass || '').trim(),
    accountingType: String(payload.accountingType || '').trim(),
    postingType: String(payload.postingType || '').trim(),
    conditionType: String(payload.conditionType || '').trim(),
    partnerNumber: String(payload.partnerNumber || '').trim(),
    currencyKey: String(payload.currencyKey || '').trim(),
    taxCode: String(payload.taxCode || '').trim(),
  };
}

export async function dbCreateOtherShippingCost(payload) {
  const pool = getPool();
  const data = normalizePayload(payload);

  await pool.query(
    `INSERT INTO other_shipping_cost_master
       (NAME, EXP_CLS_GROUP, EXP_CLS, ACC_TYP_EXP, POSTING_TYP_EXP, CONDITION_TYP,
        PARTNER_NUMBER, CURRENCY_KEY, TAX_CODE, MODULEID, MCOMPANYID)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.expenseClassGroup,
      data.expenseClass,
      data.accountingType,
      data.postingType,
      data.conditionType,
      data.partnerNumber,
      data.currencyKey,
      data.taxCode,
      appContext.moduleId,
      appContext.companyId,
    ],
  );

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Other Shipping Cost Record added successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}

export async function dbUpdateOtherShippingCost(id, payload) {
  const pool = getPool();
  const data = normalizePayload(payload);

  const [result] = await pool.query(
    `UPDATE other_shipping_cost_master
     SET NAME = ?, EXP_CLS_GROUP = ?, EXP_CLS = ?, ACC_TYP_EXP = ?,
         POSTING_TYP_EXP = ?, CONDITION_TYP = ?, PARTNER_NUMBER = ?, CURRENCY_KEY = ?, TAX_CODE = ?
     WHERE OTHER_SCOSTID = ?`,
    [
      data.name,
      data.expenseClassGroup,
      data.expenseClass,
      data.accountingType,
      data.postingType,
      data.conditionType,
      data.partnerNumber,
      data.currencyKey,
      data.taxCode,
      id,
    ],
  );
  if (!result.affectedRows) throw new Error('Other shipping cost not found.');

  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'Other Shipping Cost Record Updated successfully.', NOW())`,
    [appContext.userId],
  );

  return { msg: 0 };
}
