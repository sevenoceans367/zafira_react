import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from '../utils/periodContractDates.js';

const CURRENCIES = [
  { id: 'EURO', name: 'Euro (EUR)' },
  { id: 'USD', name: 'United States Dollar (USD)' },
  { id: 'AUD', name: 'Australian dollar (AUD)' },
  { id: 'GBP', name: 'United Kingdom Pound (GBP)' },
  { id: 'INR', name: 'Indian Rupee (INR)' },
  { id: 'AED', name: 'Emirati Dirham (AED)' },
  { id: 'JPY', name: 'Japanese Yen (JPY)' },
];

const PERIOD_TYPES = [
  { id: '1', name: 'Months' },
  { id: '2', name: 'Days' },
];

function mapVendorRow(row) {
  return {
    id: row.CODE,
    name: `${row.NAME} ( ${row.CODE} )`,
  };
}

export async function dbGetNextPeriodContractId() {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT (MAX(MESSAGE_NO) + 1) AS nextNo
     FROM period_contract_master
     WHERE MODULEID = ? AND MCOMPANYID = ?`,
    [appContext.moduleId, appContext.companyId],
  );

  let messageNo = row?.nextNo;
  if (messageNo == null) {
    messageNo = 1;
  }

  const padded = String(messageNo).padStart(3, '0');
  const year = new Date().getFullYear();
  return {
    contractId: `PERIOD-${padded}-${year}`,
    messageNo: String(messageNo),
  };
}

export async function dbSearchPorts(query, limit = 25) {
  const pool = getPool();
  const term = String(query || '').trim();
  if (!term) return [];

  const like = `${term}%`;
  const [rows] = await pool.query(
    `SELECT PortId AS id, PortName, PortCode, COUNTRY_KEY
     FROM port_master
     WHERE PortName LIKE ? OR PortCode LIKE ?
     ORDER BY PortName
     LIMIT ?`,
    [like, like, limit],
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: `${row.PortName} (${row.COUNTRY_KEY || row.PortCode || ''})`,
  }));
}

export async function dbGetPeriodContractLookups() {
  const pool = getPool();

  const [vesselTypes] = await pool.query(
    `SELECT VesselTypeId AS id, VesselType AS name, BusinessType AS businessTypeId
     FROM vessel_type_master
     ORDER BY VesselType`,
  );

  const [vessels] = await pool.query(
    `SELECT VESSEL_IMO_ID AS id, VESSEL_NAME AS name, BUSINESSTYPEID AS businessTypeId
     FROM vessel_imo_master
     WHERE MCOMPANYID = ?
     ORDER BY VESSEL_NAME`,
    [appContext.companyId],
  );

  const [obaVendors] = await pool.query(
    `SELECT CODE, NAME FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID IN (11) AND MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );

  const [ownerVendors] = await pool.query(
    `SELECT CODE, NAME FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID IN (11) AND MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );

  const [brokerVendors] = await pool.query(
    `SELECT CODE, NAME FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID IN (12) AND MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );

  const [bunkers] = await pool.query(
    `SELECT BUNKERGRADEID AS id, NAME AS name
     FROM bunker_grade_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  const vesselTypesByBusiness = { 1: [], 2: [], 3: [] };
  for (const type of vesselTypes) {
    const key = String(type.businessTypeId);
    if (!vesselTypesByBusiness[key]) vesselTypesByBusiness[key] = [];
    vesselTypesByBusiness[key].push({ id: String(type.id), name: type.name });
  }

  const vesselsByBusiness = { 1: [], 2: [], 3: [] };
  for (const vessel of vessels) {
    const key = String(vessel.businessTypeId);
    if (!vesselsByBusiness[key]) vesselsByBusiness[key] = [];
    vesselsByBusiness[key].push({ id: String(vessel.id), name: vessel.name });
  }

  const { contractId } = await dbGetNextPeriodContractId();

  return {
    contractId,
    currencies: CURRENCIES,
    periodTypes: PERIOD_TYPES,
    bunkers: bunkers.map((row) => ({ id: String(row.id), name: row.name })),
    obaVendors: obaVendors.map(mapVendorRow),
    ownerVendors: ownerVendors.map(mapVendorRow),
    brokerVendors: brokerVendors.map(mapVendorRow),
    vesselTypesByBusiness,
    vesselsByBusiness,
    today: formatDateDMY(new Date()),
  };
}
