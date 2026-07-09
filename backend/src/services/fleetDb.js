import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.MODULE_ID || '6';

const BUSINESS_TYPE_LABELS = {
  1: 'Gas',
  2: 'Tanker',
  3: 'Dry Cargo',
};

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

async function getVesselTypeName(pool, typeId) {
  if (!typeId) return '';
  const [rows] = await pool.query(
    'SELECT VESSELTYPE FROM vessel_type_master WHERE VESSELTYPEID = ? LIMIT 1',
    [typeId],
  );
  return rows[0]?.VESSELTYPE ?? '';
}

async function getBunkerGradeName(pool, bunkerId) {
  if (!bunkerId) return '';
  const [rows] = await pool.query(
    `SELECT NAME FROM bunker_grade_master
     WHERE BUNKERGRADEID = ? AND MODULEID = ? AND MCOMPANYID = ? LIMIT 1`,
    [bunkerId, MODULE_ID, appContext.companyId],
  );
  return rows[0]?.NAME ?? '';
}

async function getVesselImoRow(pool, vesselId) {
  const [rows] = await pool.query(
    'SELECT * FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1',
    [vesselId],
  );
  return rows[0] ?? null;
}

async function getVesselParticularField(pool, table, vesselId, field) {
  const [rows] = await pool.query(
    `SELECT \`${field}\` AS value FROM \`${table}\` WHERE VESSEL_IMO_ID = ? LIMIT 1`,
    [vesselId],
  );
  return rows[0]?.value ?? '';
}

async function getCommercialParameterField(pool, vesselId, field) {
  const [rows] = await pool.query(
    `SELECT \`${field}\` AS value FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ? AND MODULEID = ? LIMIT 1`,
    [vesselId, MODULE_ID],
  );
  return rows[0]?.value ?? '';
}

async function getBunkerConsumptionValues(pool, commercialParameterId, identify, field) {
  if (!commercialParameterId) return '';
  const [rows] = await pool.query(
    `SELECT \`${field}\` AS qty, BUNKERID
     FROM vessel_commercial_parameters_slave1
     WHERE IDENTIFY = ? AND COMMERCIAL_PARAMETERID = ?`,
    [identify, commercialParameterId],
  );
  const parts = [];
  for (const row of rows) {
    const grade = await getBunkerGradeName(pool, row.BUNKERID);
    parts.push(`${grade} - ${row.qty ?? ''}`);
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
  const businessType = selBType || '3';
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

async function buildCompareRow(pool, vesselIds, label, valueFn) {
  const values = [];
  for (const vesselId of vesselIds) {
    values.push(await valueFn(vesselId));
  }
  return { label, values };
}

async function buildBunkerSection(pool, vesselIds, title, identify, levels, fields) {
  const rows = [];
  for (let j = 0; j < levels.length; j += 1) {
    rows.push(await buildCompareRow(pool, vesselIds, levels[j], async (vesselId) => {
      const commercialId = await getCommercialParameterField(pool, vesselId, 'COMMERCIAL_PARAMETERID');
      return getBunkerConsumptionValues(pool, commercialId, identify, fields[j]);
    }));
  }
  return { title, rows };
}

export async function dbCompareVessels(vesselIds) {
  const pool = getPool();
  const ids = vesselIds.filter(Boolean);
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
      await buildCompareRow(pool, ids, 'Vessel Type', async (vesselId) => {
        const row = await getVesselImoRow(pool, vesselId);
        return getVesselTypeName(pool, row?.VESSEL_TYPE);
      }),
      await buildCompareRow(pool, ids, 'DWT (Summer)', async (vesselId) => {
        const row = await getVesselImoRow(pool, vesselId);
        return row?.DWT ?? '';
      }),
      await buildCompareRow(pool, ids, 'Draft (Summer)', async (vesselId) => {
        const row = await getVesselImoRow(pool, vesselId);
        return row?.DRAFTM ?? '';
      }),
      await buildCompareRow(pool, ids, 'TPC', async (vesselId) =>
        getVesselParticularField(pool, 'vessel_master_1', vesselId, 'SUMMER_3')),
    ],
  });

  sections.push({
    title: 'SPEED DATA',
    rows: [
      await buildCompareRow(pool, ids, 'Ballast Speed - Full Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'B_FULL_SPEED')),
      await buildCompareRow(pool, ids, 'Ballast Speed - Service Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'B_ECO_SPEED1')),
      await buildCompareRow(pool, ids, 'Ballast Speed - Most Eco Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'B_ECO_SPEED2')),
      await buildCompareRow(pool, ids, 'Laden Speed - Full Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'L_FULL_SPEED')),
      await buildCompareRow(pool, ids, 'Laden Speed - Service Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'L_ECO_SPEED1')),
      await buildCompareRow(pool, ids, 'Laden Speed - Most Eco Speed (Knots)', (id) =>
        getCommercialParameterField(pool, id, 'L_ECO_SPEED2')),
    ],
  });

  sections.push(await buildBunkerSection(pool, ids, 'FO Consp/day(MT) - At Sea', 'FO', FO_AT_SEA_LEVELS, FO_AT_SEA_FIELDS));
  sections.push(await buildBunkerSection(pool, ids, 'DO Consp/day(MT) - At Sea', 'DO', FO_AT_SEA_LEVELS, FO_AT_SEA_FIELDS));
  sections.push(await buildBunkerSection(pool, ids, 'FO Consp/day(MT)- In Port', 'FO', FO_IN_PORT_LEVELS, FO_IN_PORT_FIELDS));
  sections.push(await buildBunkerSection(pool, ids, 'DO Consp/day(MT)- In Port', 'DO', FO_IN_PORT_LEVELS, FO_IN_PORT_FIELDS));

  return { vessels, sections };
}
