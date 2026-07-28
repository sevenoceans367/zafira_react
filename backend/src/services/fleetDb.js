import { appContext } from '../config.js';
import { getPool } from '../db.js';

function moduleId() {
  // Match commercialParametersDb so speeds/bunkers align with Commercial Parameters.
  return process.env.VC_MODULE_ID || process.env.MODULE_ID || '6';
}

const BUSINESS_TYPE_LABELS = {
  1: 'Gas',
  2: 'Tanker',
  3: 'Dry Cargo',
};

const DO_BUNKER_TYPES = new Set(['MDO', 'DO', 'MGO', 'LSDO', 'ULSDO']);

const FO_AT_SEA_LEVELS = [
  'SECA (Ballast) - Full Speed',
  'SECA (Laden) - Full Speed',
  'NON-SECA (Ballast) - Full Speed',
  'NON-SECA (Laden) - Full Speed',
  'SECA (Ballast) - Service Speed',
  'SECA (Laden) - Service Speed',
  'NON-SECA (Ballast) - Service Speed',
  'NON-SECA (Laden) - Service Speed',
  'SECA (Ballast) - Most Eco Speed',
  'SECA (Laden) - Most Eco Speed',
  'NON-SECA (Ballast) - Most Eco Speed',
  'NON-SECA (Laden) - Most Eco Speed',
];

const FO_AT_SEA_FIELDS = [
  'FO_BALAST_ATSEA_SECA_CONSP_FS',
  'FO_LADEN_ATSEA_SECA_CONSP_FS',
  'FO_BALAST_ATSEA_NONSECA_CONSP_FS',
  'FO_LADEN_ATSEA_NONSECA_CONSP_FS',
  'FO_BALAST_ATSEA_SECA_CONSP_SS',
  'FO_LADEN_ATSEA_SECA_CONSP_SS',
  'FO_BALAST_ATSEA_NONSECA_CONSP_SS',
  'FO_LADEN_ATSEA_NONSECA_CONSP_SS',
  'FO_BALAST_ATSEA_SECA_CONSP_MES',
  'FO_LADEN_ATSEA_SECA_CONSP_MES',
  'FO_BALAST_ATSEA_NONSECA_CONSP_MES',
  'FO_LADEN_ATSEA_NONSECA_CONSP_MES',
];

const FO_IN_PORT_LEVELS = [
  'SECA - Working',
  'NON-SECA - Working',
  'SECA - Idle',
  'NON-SECA - Idle',
  'SECA - Others',
  'NON-SECA - Others',
];

const FO_IN_PORT_FIELDS = [
  'FO_INPORT_SECA_CONSP_WORKING',
  'FO_INPORT_NONSECA_CONSP_WORKING',
  'FO_INPORT_SECA_CONSP_IDLE',
  'FO_INPORT_NONSECA_CONSP_IDLE',
  'FO_INPORT_SECA_CONSP_OTHER',
  'FO_INPORT_NONSECA_CONSP_OTHER',
];

function str(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function isSecaField(field) {
  return String(field).includes('_SECA_') && !String(field).includes('_NONSECA_');
}

function zoneMatchesField(zone, field) {
  const normalized = String(zone || '').trim().toLowerCase();
  // Legacy rows often have no ZONE and store both SECA + NON-SECA columns on one row.
  if (!normalized) return true;
  if (isSecaField(field)) return normalized === 'seca';
  return normalized === 'non seca' || normalized === 'non-seca' || normalized === 'nonseca';
}

function isDoBunker(identify, bunkerType) {
  const id = String(identify || '').toUpperCase();
  if (id === 'DO') return true;
  if (id === 'FO') return false;
  return DO_BUNKER_TYPES.has(String(bunkerType || '').toUpperCase());
}

function pickQty(row, field) {
  const direct = row[field];
  if (direct != null && String(direct).trim() !== '') return str(direct);

  const seca = isSecaField(field);
  // React commercial-parameters form saves LP/DP + ballast/laden idle instead of legacy Working/Idle.
  if (field.includes('WORKING') && !field.includes('WORKING_LP') && !field.includes('WORKING_DP')) {
    const lp = seca ? row.FO_INPORT_SECA_CONSP_WORKING_LP : row.FO_INPORT_NONSECA_CONSP_WORKING_LP;
    const dp = seca ? row.FO_INPORT_SECA_CONSP_WORKING_DP : row.FO_INPORT_NONSECA_CONSP_WORKING_DP;
    return [lp, dp].map(str).filter(Boolean).join(' / ');
  }
  if (field.includes('IDLE') && !field.includes('IDLE_BALLAST') && !field.includes('IDLE_LADEN')) {
    const ballast = seca ? row.FO_INPORT_SECA_CONSP_IDLE_BALLAST : row.FO_INPORT_NONSECA_CONSP_IDLE_BALLAST;
    const laden = seca ? row.FO_INPORT_SECA_CONSP_IDLE_LADEN : row.FO_INPORT_NONSECA_CONSP_IDLE_LADEN;
    return [ballast, laden].map(str).filter(Boolean).join(' / ');
  }
  return '';
}

async function getVesselTypeName(pool, typeId) {
  if (!typeId) return '';
  const [rows] = await pool.query(
    'SELECT VesselType AS name FROM vessel_type_master WHERE VesselTypeId = ? LIMIT 1',
    [typeId],
  );
  return rows[0]?.name ?? '';
}

async function getVesselImoRow(pool, vesselId) {
  const [rows] = await pool.query(
    'SELECT * FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1',
    [vesselId],
  );
  return rows[0] ?? null;
}

async function getTpc(pool, vesselId, businessTypeId) {
  if (Number(businessTypeId) === 3) {
    const [rows] = await pool.query(
      `SELECT COALESCE(NULLIF(TPC_MT, ''), NULLIF(SUMMER_3, '')) AS value
       FROM vessel_master_1
       WHERE VESSEL_IMO_ID = ?
       LIMIT 1`,
      [vesselId],
    );
    if (rows[0]?.value != null && rows[0].value !== '') return str(rows[0].value);
  }
  const [tankerRows] = await pool.query(
    'SELECT TPC_SUMMER AS value FROM vessel_master_tankers WHERE VESSEL_IMO_ID = ? LIMIT 1',
    [vesselId],
  );
  if (tankerRows[0]?.value != null && tankerRows[0].value !== '') {
    return str(tankerRows[0].value);
  }
  const [dryRows] = await pool.query(
    `SELECT COALESCE(NULLIF(TPC_MT, ''), NULLIF(SUMMER_3, '')) AS value
     FROM vessel_master_1
     WHERE VESSEL_IMO_ID = ?
     LIMIT 1`,
    [vesselId],
  );
  return str(dryRows[0]?.value);
}

async function getCommercialParameterField(pool, vesselId, field) {
  const [rows] = await pool.query(
    `SELECT \`${field}\` AS value FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ? AND MODULEID = ? LIMIT 1`,
    [vesselId, moduleId()],
  );
  return rows[0]?.value ?? '';
}

async function getBunkerConsumptionValues(pool, commercialParameterId, identify, foType, field) {
  if (!commercialParameterId) return '';

  const [rows] = await pool.query(
    `SELECT s.*, bg.NAME AS gradeName, bg.BUNKERTYPE AS bunkerType
     FROM vessel_commercial_parameters_slave1 s
     LEFT JOIN bunker_grade_master bg
       ON bg.BUNKERGRADEID = s.BUNKERID
      AND bg.MODULEID = ?
      AND bg.MCOMPANYID = ?
     WHERE s.COMMERCIAL_PARAMETERID = ?
       AND (
         s.FO_TYPE = ?
         OR IFNULL(s.FO_TYPE, '') = ''
       )
     ORDER BY s.BUNKERID, s.ZONE`,
    [moduleId(), appContext.companyId, commercialParameterId, foType],
  );

  const wantDo = String(identify).toUpperCase() === 'DO';
  const parts = [];
  for (const row of rows) {
    if (wantDo !== isDoBunker(row.IDENTIFY, row.bunkerType)) continue;
    if (!zoneMatchesField(row.ZONE, field)) continue;
    const qty = pickQty(row, field);
    const grade = row.gradeName || '';
    if (!grade && (qty === '' || qty == null)) continue;
    parts.push(`${grade} - ${qty}`);
  }
  return parts.join(', ');
}

export async function dbGetFleetList({
  selBType,
  page = 1,
  pageSize = 10,
  search = '',
  sortColumn = 0,
  sortDir = 'desc',
}) {
  const pool = getPool();
  const businessType = selBType || '2';
  const offset = (Math.max(1, page) - 1) * pageSize;
  const sortColumns = [
    'VESSEL_IMO_ID', 'VESSEL_TYPE', 'VESSEL_NAME', 'BUSINESSTYPEID', 'IMO_NO', 'DWT', 'YEARBUILT',
  ];
  const orderCol = sortColumns[sortColumn] || 'VESSEL_IMO_ID';
  const orderDir = sortDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['BUSINESSTYPEID = ?', 'MCOMPANYID = ?'];
  const params = [businessType, appContext.companyId];

  if (search) {
    conditions.push(`(
      VESSEL_NAME LIKE ? OR VESSEL_TYPE LIKE ? OR IMO_NO LIKE ?
      OR DWT LIKE ? OR YEARBUILT LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  const where = conditions.join(' AND ');

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM vessel_imo_master WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT VESSEL_IMO_ID, VESSEL_TYPE, VESSEL_NAME, BUSINESSTYPEID, IMO_NO, DWT, YEARBUILT
     FROM vessel_imo_master
     WHERE ${where}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const records = [];
  let index = offset;
  for (const row of rows) {
    index += 1;
    records.push({
      index,
      vesselImoId: row.VESSEL_IMO_ID,
      vesselType: await getVesselTypeName(pool, row.VESSEL_TYPE),
      vesselName: row.VESSEL_NAME ?? '',
      businessType: BUSINESS_TYPE_LABELS[Number(row.BUSINESSTYPEID)] ?? '',
      businessTypeId: Number(row.BUSINESSTYPEID),
      imoNo: row.IMO_NO ?? '',
      dwt: row.DWT ?? '',
      yearBuilt: row.YEARBUILT ?? '',
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page,
    pageSize,
  };
}

async function buildCompareRow(vesselIds, label, valueFn) {
  const values = [];
  for (const vesselId of vesselIds) {
    values.push(await valueFn(vesselId));
  }
  return { label, values };
}

async function buildBunkerSection(pool, vesselIds, title, identify, foType, levels, fields) {
  const rows = [];
  for (let j = 0; j < levels.length; j += 1) {
    rows.push(await buildCompareRow(vesselIds, levels[j], async (vesselId) => {
      const commercialId = await getCommercialParameterField(pool, vesselId, 'COMMERCIAL_PARAMETERID');
      return getBunkerConsumptionValues(pool, commercialId, identify, foType, fields[j]);
    }));
  }
  return { title, rows };
}

export async function dbCompareVessels(vesselIds) {
  const pool = getPool();
  const ids = (vesselIds || []).map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) {
    return { vessels: [], sections: [] };
  }

  const vessels = [];
  for (const id of ids) {
    const row = await getVesselImoRow(pool, id);
    vessels.push({
      id,
      name: row?.VESSEL_NAME ?? '',
    });
  }

  const sections = [];

  sections.push({
    title: null,
    rows: [
      await buildCompareRow(ids, 'Vessel Type', async (vesselId) => {
        const row = await getVesselImoRow(pool, vesselId);
        return getVesselTypeName(pool, row?.VESSEL_TYPE);
      }),
      await buildCompareRow(ids, 'DWT (Summer)', async (vesselId) => {
        const row = await getVesselImoRow(pool, vesselId);
        return str(row?.DWT);
      }),
      await buildCompareRow(ids, 'Draft (Summer)', async (vesselId) => {
        const row = await getVesselImoRow(pool, vesselId);
        return str(row?.DRAFTM);
      }),
      await buildCompareRow(ids, 'TPC', async (vesselId) => {
        const row = await getVesselImoRow(pool, vesselId);
        return getTpc(pool, vesselId, row?.BUSINESSTYPEID);
      }),
    ],
  });

  sections.push({
    title: 'SPEED DATA',
    rows: [
      await buildCompareRow(ids, 'Ballast Speed - Full Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'B_FULL_SPEED').then(str)),
      await buildCompareRow(ids, 'Ballast Speed - Service Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'B_ECO_SPEED1').then(str)),
      await buildCompareRow(ids, 'Ballast Speed - Most Eco Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'B_ECO_SPEED2').then(str)),
      await buildCompareRow(ids, 'Laden Speed - Full Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'L_FULL_SPEED').then(str)),
      await buildCompareRow(ids, 'Laden Speed - Service Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'L_ECO_SPEED1').then(str)),
      await buildCompareRow(ids, 'Laden Speed - Most Eco Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'L_ECO_SPEED2').then(str)),
    ],
  });

  sections.push(await buildBunkerSection(
    pool, ids, 'FO Consp/day(MT) - At Sea', 'FO', 'AT SEA', FO_AT_SEA_LEVELS, FO_AT_SEA_FIELDS,
  ));
  sections.push(await buildBunkerSection(
    pool, ids, 'DO Consp/day(MT) - At Sea', 'DO', 'AT SEA', FO_AT_SEA_LEVELS, FO_AT_SEA_FIELDS,
  ));
  sections.push(await buildBunkerSection(
    pool, ids, 'FO Consp/day(MT)- In Port', 'FO', 'IN PORT', FO_IN_PORT_LEVELS, FO_IN_PORT_FIELDS,
  ));
  sections.push(await buildBunkerSection(
    pool, ids, 'DO Consp/day(MT)- In Port', 'DO', 'IN PORT', FO_IN_PORT_LEVELS, FO_IN_PORT_FIELDS,
  ));

  return { vessels, sections };
}
