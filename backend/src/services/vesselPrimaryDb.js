import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { attachmentPublicUrl } from '../utils/attachmentUrl.js';

function parseAttachments(attachment, attachmentName) {
  const files = String(attachment || '').split(',').map((part) => part.trim()).filter(Boolean);
  const names = String(attachmentName || '').split(',').map((part) => part.trim()).filter(Boolean);
  return files.map((file, index) => ({
    file,
    name: names[index] || file,
    url: attachmentPublicUrl(file),
  }));
}

function mapVesselRow(row) {
  if (!row) return null;
  return {
    vesselImoId: row.VESSEL_IMO_ID,
    businessTypeId: String(row.BUSINESSTYPEID ?? ''),
    vesselTypeId: String(row.VESSEL_TYPE ?? ''),
    imoNo: row.IMO_NO ?? '',
    vesselName: row.VESSEL_NAME ?? '',
    vesselCode: row.VESSEL_CODE ?? '',
    yearBuilt: row.YEARBUILT ?? '',
    flagId: String(row.FLAG ?? ''),
    dwt: row.DWT ?? '',
    draftM: row.DRAFTM ?? '',
    loa: row.LOA ?? '',
    extBreadth: row.EXT_BREADTH ?? '',
    grtNrt: row.GRT_NRT ?? '',
    nrt: row.NRT ?? '',
    grain: row.GRAIN ?? '',
    bale: row.BALE ?? '',
    noh: row.NOH ?? '',
    noha: row.NOHA ?? '',
    hatchSize: row.HATCH_SIZE ?? '',
    cargoGear: row.CARGO_GEAR ?? '',
    craneSize: row.CRANESIZE ?? '',
    grabSize: row.GRABSIZE ?? '',
    gasCargoTanks: row.GAS_CARGO_TANKS ?? '',
    gasTankCapacity: row.GAS_TANK_CAPACITY ?? '',
    gasCargoPumps: row.GAS_CARGO_PUMPS ?? '',
    gasMainCargoPumps: row.GAS_MAIN_CARGO_PUMPS ?? '',
    sizeOfManifolds: row.SIZE_OF_MONIFOLDS ?? '',
    gasSbtCapacity: row.SBT_CAPACITY ?? '',
    tankerCapacity: row.TANKER_CAPACITY ?? '',
    noOfGrade: row.NO_OF_GRADE ?? '',
    tankerCargoPump: row.TANKER_CARGO_PUMP ?? '',
    tankerSbtCapacity: row.TANKER_SBT_CAPACITY ?? '',
    tankerPumpMainCap: row.TANKER_PUMP_MAINCAP ?? '',
    piVendorId: String(row.P_I ?? ''),
    classSocId: String(row.CLA_SOC_ID ?? ''),
    ownerVendorId: String(row.OWNER ?? ''),
    remarks: row.REMARKS ?? '',
    attachments: parseAttachments(row.ATTACHMENT, row.ATTACHMENT_NAME),
  };
}

export async function dbGetVesselPrimaryLookups() {
  const pool = getPool();

  const [vesselTypes] = await pool.query(
    `SELECT VesselTypeId AS id, VesselType AS name, BusinessType AS businessTypeId
     FROM vessel_type_master
     ORDER BY VesselType`,
  );

  const [countries] = await pool.query(
    `SELECT COUNTRYID AS id, COUNTRY_NAME AS name
     FROM country_master
     WHERE STATUS = 1
     ORDER BY COUNTRY_NAME`,
  );

  const [piVendors] = await pool.query(
    `SELECT VENDORID AS id, CONCAT(NAME, ' (', CODE, ')') AS name
     FROM vendor_master
     WHERE VENDOR_TYPEID = 17 AND MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );

  const [owners] = await pool.query(
    `SELECT VENDORID AS id, CONCAT(NAME, ' (', CODE, ')') AS name
     FROM vendor_master
     WHERE MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );

  const [classSocieties] = await pool.query(
    `SELECT CLA_SOC_ID AS id, NAME AS name
     FROM classification_soc_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  const vesselTypesByBusiness = { 1: [], 2: [], 3: [] };
  for (const type of vesselTypes) {
    const key = String(type.businessTypeId);
    if (!vesselTypesByBusiness[key]) vesselTypesByBusiness[key] = [];
    vesselTypesByBusiness[key].push({ id: String(type.id), name: type.name });
  }

  return {
    vesselTypesByBusiness,
    countries: countries.map((row) => ({ id: String(row.id), name: row.name })),
    piVendors: piVendors.map((row) => ({ id: String(row.id), name: row.name })),
    owners: owners.map((row) => ({ id: String(row.id), name: row.name })),
    classSocieties: classSocieties.map((row) => ({ id: String(row.id), name: row.name })),
  };
}

export async function dbGetVesselPrimary(vesselId) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT * FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? AND MCOMPANYID = ? LIMIT 1',
    [vesselId, appContext.companyId],
  );
  return mapVesselRow(rows[0]);
}

export async function dbUpdateVesselPrimary(vesselId, payload) {
  const pool = getPool();
  const {
    businessTypeId,
    vesselTypeId,
    imoNo,
    vesselName,
    vesselCode,
    yearBuilt,
    flagId,
    dwt,
    draftM,
    loa,
    extBreadth,
    grtNrt,
    nrt,
    grain,
    bale,
    noh,
    noha,
    hatchSize,
    cargoGear,
    craneSize,
    grabSize,
    gasCargoTanks,
    gasTankCapacity,
    gasCargoPumps,
    gasMainCargoPumps,
    sizeOfManifolds,
    gasSbtCapacity,
    tankerCapacity,
    noOfGrade,
    tankerCargoPump,
    tankerSbtCapacity,
    tankerPumpMainCap,
    piVendorId,
    classSocId,
    ownerVendorId,
    remarks,
    attachment,
    attachmentName,
  } = payload;

  const [result] = await pool.query(
    `UPDATE vessel_imo_master SET
      VESSEL_TYPE = ?, BUILDER = 0, HULL_TYPE = 0, DWT = ?, YEARBUILT = ?, OWNER = ?,
      COATING = '', BUSINESSTYPEID = ?, DRAFTM = ?, CRANESIZE = ?, GRABSIZE = ?,
      IMO_NO = ?, FLAG = ?, LOA = ?, EXT_BREADTH = ?, GRT_NRT = ?, GRAIN = ?, BALE = ?,
      NOH = ?, NOHA = ?, HATCH_SIZE = ?, CARGO_GEAR = ?, P_I = ?, CLA_SOC_ID = ?, REMARKS = ?,
      ATTACHMENT = ?, ATTACHMENT_NAME = ?, GAS_CARGO_TANKS = ?, GAS_TANK_CAPACITY = ?,
      GAS_CARGO_PUMPS = ?, GAS_MAIN_CARGO_PUMPS = ?, SIZE_OF_MONIFOLDS = ?, SBT_CAPACITY = ?,
      TANKER_CAPACITY = ?, NO_OF_GRADE = ?, TANKER_CARGO_PUMP = ?, TANKER_SBT_CAPACITY = ?,
      TANKER_PUMP_MAINCAP = ?, NRT = ?, VESSEL_CODE = ?, VESSEL_NAME = ?
     WHERE VESSEL_IMO_ID = ? AND MCOMPANYID = ?`,
    [
      vesselTypeId || null,
      dwt ?? '',
      yearBuilt ?? '',
      ownerVendorId || null,
      businessTypeId || null,
      draftM ?? '',
      craneSize ?? '',
      grabSize ?? '',
      imoNo ?? '',
      flagId || null,
      loa ?? '',
      extBreadth ?? '',
      grtNrt ?? '',
      grain ?? '',
      bale ?? '',
      noh ?? '',
      noha ?? '',
      hatchSize ?? '',
      cargoGear ?? '',
      piVendorId || null,
      classSocId || null,
      remarks ?? '',
      attachment ?? '',
      attachmentName ?? '',
      gasCargoTanks ?? '',
      gasTankCapacity ?? '',
      gasCargoPumps ?? '',
      gasMainCargoPumps ?? '',
      sizeOfManifolds ?? '',
      gasSbtCapacity ?? '',
      tankerCapacity ?? '',
      noOfGrade ?? '',
      tankerCargoPump ?? '',
      tankerSbtCapacity ?? '',
      tankerPumpMainCap ?? '',
      nrt ?? '',
      vesselCode ?? '',
      vesselName ?? '',
      vesselId,
      appContext.companyId,
    ],
  );

  if (result.affectedRows === 0) {
    throw new Error('Vessel not found or could not be updated.');
  }

  return dbGetVesselPrimary(vesselId);
}

export async function dbCreateVesselPrimary(payload) {
  const pool = getPool();
  const {
    businessTypeId,
    vesselTypeId,
    imoNo,
    vesselName,
    vesselCode,
    yearBuilt,
    flagId,
    dwt,
    draftM,
    loa,
    extBreadth,
    grtNrt,
    nrt,
    grain,
    bale,
    noh,
    noha,
    hatchSize,
    cargoGear,
    craneSize,
    grabSize,
    gasCargoTanks,
    gasTankCapacity,
    gasCargoPumps,
    gasMainCargoPumps,
    sizeOfManifolds,
    gasSbtCapacity,
    tankerCapacity,
    noOfGrade,
    tankerCargoPump,
    tankerSbtCapacity,
    tankerPumpMainCap,
    piVendorId,
    classSocId,
    ownerVendorId,
    remarks,
    attachment,
    attachmentName,
  } = payload;

  if (!vesselName?.trim()) throw new Error('Vessel Name is required.');
  if (!vesselTypeId) throw new Error('Vessel Type is required.');
  if (!imoNo?.trim()) throw new Error('IMO number is required.');
  if (!vesselCode?.trim()) throw new Error('Vessel Code is required.');
  if (!dwt) throw new Error('Summer DWT is required.');
  if (!yearBuilt) throw new Error('Year Built is required.');
  if (!businessTypeId) throw new Error('Business Type is required.');
  if (!flagId) throw new Error('Flag is required.');

  const [[imoExists]] = await pool.query(
    `SELECT VESSEL_IMO_ID FROM vessel_imo_master
     WHERE IMO_NO = ? AND MCOMPANYID = ? LIMIT 1`,
    [imoNo.trim(), appContext.companyId],
  );
  if (imoExists) throw new Error('IMO number already exists.');

  const [[nameExists]] = await pool.query(
    `SELECT VESSEL_IMO_ID FROM vessel_imo_master
     WHERE VESSEL_NAME = ? AND MCOMPANYID = ? LIMIT 1`,
    [vesselName.trim(), appContext.companyId],
  );
  if (nameExists) throw new Error('Vessel Name already exists.');

  const today = new Date().toISOString().slice(0, 10);

  const [result] = await pool.query(
    `INSERT INTO vessel_imo_master (
      VESSEL_NAME, VESSEL_TYPE, BUILDER, HULL_TYPE, DWT, YEARBUILT, ALLOCATE_STATUS,
      OWNER, COATING, TRANS_DATE, BUSINESSTYPEID, MCOMPANYID, DRAFTM, CRANESIZE, GRABSIZE,
      IMO_NO, FLAG, LOA, EXT_BREADTH, GRT_NRT, GRAIN, BALE, NOH, NOHA, HATCH_SIZE, CARGO_GEAR,
      P_I, CLA_SOC_ID, REMARKS, ATTACHMENT, ATTACHMENT_NAME, GAS_CARGO_TANKS, GAS_TANK_CAPACITY,
      GAS_CARGO_PUMPS, GAS_MAIN_CARGO_PUMPS, SIZE_OF_MONIFOLDS, SBT_CAPACITY, TANKER_CAPACITY,
      NO_OF_GRADE, TANKER_CARGO_PUMP, TANKER_SBT_CAPACITY, TANKER_PUMP_MAINCAP, NRT, VESSEL_CODE
    ) VALUES (
      ?, ?, 0, 0, ?, ?, 0,
      ?, '', ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )`,
    [
      vesselName.trim(),
      vesselTypeId,
      dwt ?? '',
      yearBuilt ?? '',
      ownerVendorId || null,
      today,
      businessTypeId,
      appContext.companyId,
      draftM ?? '',
      craneSize ?? '',
      grabSize ?? '',
      imoNo.trim(),
      flagId,
      loa ?? '',
      extBreadth ?? '',
      grtNrt ?? '',
      grain ?? '',
      bale ?? '',
      noh ?? '',
      noha ?? '',
      hatchSize ?? '',
      cargoGear ?? '',
      piVendorId || null,
      classSocId || null,
      remarks ?? '',
      attachment ?? '',
      attachmentName ?? '',
      gasCargoTanks ?? '',
      gasTankCapacity ?? '',
      gasCargoPumps ?? '',
      gasMainCargoPumps ?? '',
      sizeOfManifolds ?? '',
      gasSbtCapacity ?? '',
      tankerCapacity ?? '',
      noOfGrade ?? '',
      tankerCargoPump ?? '',
      tankerSbtCapacity ?? '',
      tankerPumpMainCap ?? '',
      nrt ?? '',
      vesselCode.trim(),
    ],
  );

  return dbGetVesselPrimary(result.insertId);
}
