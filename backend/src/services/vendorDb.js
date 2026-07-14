import { appContext } from '../config.js';
import { getPool } from '../db.js';

function parseSlaveRows(payload) {
  const rows = Array.isArray(payload.bankRows) ? payload.bankRows : [];
  return rows
    .map((row) => ({
      randomId: String(row.randomId || '').trim(),
      name: String(row.name || '').trim(),
      address: String(row.address || '').trim(),
      accountNo: String(row.accountNo || '').replace(/[^a-zA-Z0-9]/g, ''),
      ibanNo: String(row.ibanNo || '').replace(/[^a-zA-Z0-9]/g, ''),
      ibanRemarks: String(row.ibanRemarks || '').trim(),
      bankName: String(row.bankName || '').trim(),
      bankAddress: String(row.bankAddress || '').trim(),
      swiftCode: String(row.swiftCode || '').trim(),
      usCorrBank: String(row.usCorrBank || '').trim(),
    }))
    .filter((row) =>
      row.name || row.address || row.accountNo || row.ibanNo || row.bankName || row.swiftCode,
    );
}

function mapRecord(row, index) {
  return {
    id: row.VENDORID,
    index,
    vendorTypeId: row.VENDOR_TYPEID == null ? '' : String(row.VENDOR_TYPEID),
    vendorTypeName: row.VENDOR_TYPE_NAME ?? '',
    name: row.NAME ?? '',
    shortName: row.SHORT_NAME ?? '',
    code: row.CODE ?? '',
    vatNumber: row.VAT_NUMBER ?? '',
    street1: row.STREET_1 ?? '',
    street2: row.STREET_2 ?? '',
    city: row.CITY ?? '',
    country: row.COUNTRY ?? '',
    postalCode: row.CITY_POSTAL_CODE ?? '',
    phone: row.PHONE ?? '',
    fax: row.FAX ?? '',
    email: row.EMAILID ?? '',
    bankingDetails: row.BANKING_DETAILS ?? '',
    footerDetails: row.FOOTER_DETAILS ?? '',
    accountNos: row.ACCOUNT_NOS ?? '',
    slaveAddress: row.SLAVE_ADDRESS ?? '',
    ibanNos: row.IBAN_NOS ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
    bankRows: [],
  };
}

export async function dbGetVendorLookups() {
  const pool = getPool();
  const [types] = await pool.query(
    `SELECT VENDOR_TYPEID AS id, NAME AS name, VENDOR_PREFIX AS prefix
     FROM vendor_type_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );
  return {
    vendorTypes: types.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
      prefix: row.prefix ?? '',
    })),
  };
}

export async function dbListVendors() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT v.VENDORID, v.VENDOR_TYPEID, v.NAME, v.SHORT_NAME, v.CODE, v.VAT_NUMBER,
            v.STREET_1, v.STREET_2, v.CITY, v.COUNTRY, v.CITY_POSTAL_CODE, v.PHONE, v.FAX,
            v.EMAILID, v.BANKING_DETAILS, v.FOOTER_DETAILS, v.STATUS,
            vt.NAME AS VENDOR_TYPE_NAME,
            (SELECT GROUP_CONCAT(s.ACCOUNTNO SEPARATOR ', ')
             FROM vendor_master_slave s WHERE s.VENDORID = v.VENDORID) AS ACCOUNT_NOS,
            (SELECT s.ADDRESS FROM vendor_master_slave s WHERE s.VENDORID = v.VENDORID ORDER BY s.RANDOMID LIMIT 1) AS SLAVE_ADDRESS,
            (SELECT GROUP_CONCAT(s.IBAN_NO SEPARATOR ', ')
             FROM vendor_master_slave s WHERE s.VENDORID = v.VENDORID) AS IBAN_NOS
     FROM vendor_master v
     LEFT JOIN vendor_type_master vt ON vt.VENDOR_TYPEID = v.VENDOR_TYPEID
     ORDER BY v.NAME`,
  );
  return { records: rows.map((row, i) => mapRecord(row, i + 1)), recordsTotal: rows.length };
}

export async function dbGetVendor(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT v.VENDORID, v.VENDOR_TYPEID, v.NAME, v.SHORT_NAME, v.CODE, v.VAT_NUMBER,
            v.STREET_1, v.STREET_2, v.CITY, v.COUNTRY, v.CITY_POSTAL_CODE, v.PHONE, v.FAX,
            v.EMAILID, v.BANKING_DETAILS, v.FOOTER_DETAILS, v.STATUS,
            vt.NAME AS VENDOR_TYPE_NAME,
            '' AS ACCOUNT_NOS, '' AS SLAVE_ADDRESS, '' AS IBAN_NOS
     FROM vendor_master v
     LEFT JOIN vendor_type_master vt ON vt.VENDOR_TYPEID = v.VENDOR_TYPEID
     WHERE v.VENDORID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  const record = mapRecord(row, 1);
  const [slaves] = await pool.query(
    `SELECT RANDOMID, NAME, ADDRESS, ACCOUNTNO, IBAN_NO, IBAN_REMARKS, BANK_NAME, BANK_ADDRESS, SWIFT_CODE, US_CORRES_BANK
     FROM vendor_master_slave
     WHERE VENDORID = ?
     ORDER BY RANDOMID`,
    [id],
  );
  record.bankRows = slaves.map((slave) => ({
    randomId: slave.RANDOMID == null ? '' : String(slave.RANDOMID),
    name: slave.NAME ?? '',
    address: slave.ADDRESS ?? '',
    accountNo: slave.ACCOUNTNO ?? '',
    ibanNo: slave.IBAN_NO ?? '',
    ibanRemarks: slave.IBAN_REMARKS ?? '',
    bankName: slave.BANK_NAME ?? '',
    bankAddress: slave.BANK_ADDRESS ?? '',
    swiftCode: slave.SWIFT_CODE ?? '',
    usCorrBank: slave.US_CORRES_BANK ?? '',
  }));
  return record;
}

async function nextVendorCode(pool, vendorTypeId) {
  const [[typeRow]] = await pool.query(
    `SELECT VENDOR_PREFIX FROM vendor_type_master WHERE VENDOR_TYPEID = ? LIMIT 1`,
    [vendorTypeId],
  );
  const prefix = String(typeRow?.VENDOR_PREFIX || '').toUpperCase();
  const [[seqRow]] = await pool.query(
    `SELECT COALESCE(MAX(VENDOR_AUTO_GENID), 0) + 1 AS nextSeq
     FROM vendor_master
     WHERE VENDOR_TYPEID = ?`,
    [vendorTypeId],
  );
  const nextSeq = Number(seqRow?.nextSeq || 1);
  const padded = String(nextSeq).padStart(4, '0');
  return { code: `${prefix}${padded}`, autoGenId: nextSeq };
}

async function replaceBankRows(pool, vendorId, bankRows) {
  await pool.query(`DELETE FROM vendor_master_slave WHERE VENDORID = ?`, [vendorId]);
  for (const row of bankRows) {
    const randomId = row.randomId || String(Math.floor(10000 + Math.random() * 90000));
    await pool.query(
      `INSERT INTO vendor_master_slave
         (VENDORID, RANDOMID, NAME, ADDRESS, ACCOUNTNO, IBAN_NO, IBAN_REMARKS, BANK_NAME, BANK_ADDRESS, SWIFT_CODE, US_CORRES_BANK)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendorId,
        randomId,
        row.name,
        row.address,
        row.accountNo,
        row.ibanNo,
        row.ibanRemarks,
        row.bankName,
        row.bankAddress,
        row.swiftCode,
        row.usCorrBank,
      ],
    );
  }
}

export async function dbCreateVendor(payload) {
  const pool = getPool();
  const vendorTypeId = String(payload.vendorTypeId || '').trim();
  const name = String(payload.name || '').trim().toUpperCase();
  const shortName = String(payload.shortName || '').trim();
  if (!vendorTypeId) throw new Error('Vendor Type is required.');
  if (!name) throw new Error('Vendor Name is required.');
  if (!shortName) throw new Error('Vendor Short Name is required.');

  const { code, autoGenId } = await nextVendorCode(pool, vendorTypeId);
  const [result] = await pool.query(
    `INSERT INTO vendor_master
       (VENDOR_TYPEID, NAME, SHORT_NAME, CODE, VENDOR_AUTO_GENID, VAT_NUMBER, STREET_1, STREET_2,
        CITY, COUNTRY, CITY_POSTAL_CODE, PHONE, FAX, EMAILID, BANKING_DETAILS, FOOTER_DETAILS,
        MODULEID, MCOMPANYID, STATUS)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      vendorTypeId,
      name,
      shortName,
      code,
      autoGenId,
      String(payload.vatNumber || '').trim(),
      String(payload.street1 || '').trim(),
      String(payload.street2 || '').trim(),
      String(payload.city || '').trim(),
      String(payload.country || '').trim(),
      String(payload.postalCode || '').trim(),
      String(payload.phone || '').trim(),
      String(payload.fax || '').trim(),
      String(payload.email || '').trim(),
      String(payload.bankingDetails || '').trim(),
      String(payload.footerDetails || '').trim(),
      appContext.moduleId,
      appContext.companyId,
    ],
  );

  const vendorId = result.insertId;
  await replaceBankRows(pool, vendorId, parseSlaveRows(payload));
  return { msg: 0, id: vendorId };
}

export async function dbUpdateVendor(id, payload) {
  const pool = getPool();
  const existing = await dbGetVendor(id);
  if (!existing) throw new Error('Vendor not found.');

  const vendorTypeId = String(payload.vendorTypeId || existing.vendorTypeId || '').trim();
  const name = String(payload.name || '').trim().toUpperCase();
  const shortName = String(payload.shortName || '').trim();
  if (!vendorTypeId) throw new Error('Vendor Type is required.');
  if (!name) throw new Error('Vendor Name is required.');
  if (!shortName) throw new Error('Vendor Short Name is required.');

  const [result] = await pool.query(
    `UPDATE vendor_master
     SET VENDOR_TYPEID = ?, NAME = ?, SHORT_NAME = ?, VAT_NUMBER = ?, STREET_1 = ?, STREET_2 = ?,
         CITY = ?, COUNTRY = ?, CITY_POSTAL_CODE = ?, PHONE = ?, FAX = ?, EMAILID = ?,
         BANKING_DETAILS = ?, FOOTER_DETAILS = ?
     WHERE VENDORID = ?`,
    [
      vendorTypeId,
      name,
      shortName,
      String(payload.vatNumber || '').trim(),
      String(payload.street1 || '').trim(),
      String(payload.street2 || '').trim(),
      String(payload.city || '').trim(),
      String(payload.country || '').trim(),
      String(payload.postalCode || '').trim(),
      String(payload.phone || '').trim(),
      String(payload.fax || '').trim(),
      String(payload.email || '').trim(),
      String(payload.bankingDetails || '').trim(),
      String(payload.footerDetails || '').trim(),
      id,
    ],
  );
  if (!result.affectedRows) throw new Error('Vendor not found.');
  await replaceBankRows(pool, id, parseSlaveRows(payload));
  return { msg: 0 };
}
