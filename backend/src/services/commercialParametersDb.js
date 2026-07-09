import { getPool } from '../db.js';
import { appContext } from '../config.js';

const MODULE_ID = process.env.MODULE_ID || '6';
const BUNKER_ZONES = ['Non Seca', 'Seca'];

function formatDmyDate(value) {
  if (!value || value === '0000-00-00' || value === '1970-01-01') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function parseDateToDb(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value).trim());
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function str(value) {
  return String(value ?? '');
}

function pickZoneValue(row, secaField, nonSecaField) {
  return row.ZONE === 'Seca' ? row[secaField] : row[nonSecaField];
}

function mapAtSeaRow(row, index) {
  return {
    key: `at-sea-${index}-${row.BUNKERID}-${row.ZONE}`,
    bunkerId: String(row.BUNKERID ?? ''),
    zone: row.ZONE || 'Non Seca',
    ballastFull: str(pickZoneValue(row, 'FO_BALAST_ATSEA_SECA_CONSP_FS', 'FO_BALAST_ATSEA_NONSECA_CONSP_FS')),
    ladenFull: str(pickZoneValue(row, 'FO_LADEN_ATSEA_SECA_CONSP_FS', 'FO_LADEN_ATSEA_NONSECA_CONSP_FS')),
    ballastService: str(pickZoneValue(row, 'FO_BALAST_ATSEA_SECA_CONSP_SS', 'FO_BALAST_ATSEA_NONSECA_CONSP_SS')),
    ladenService: str(pickZoneValue(row, 'FO_LADEN_ATSEA_SECA_CONSP_SS', 'FO_LADEN_ATSEA_NONSECA_CONSP_SS')),
    ballastEco: str(pickZoneValue(row, 'FO_BALAST_ATSEA_SECA_CONSP_MES', 'FO_BALAST_ATSEA_NONSECA_CONSP_MES')),
    ladenEco: str(pickZoneValue(row, 'FO_LADEN_ATSEA_SECA_CONSP_MES', 'FO_LADEN_ATSEA_NONSECA_CONSP_MES')),
  };
}

function mapInPortRow(row, index) {
  return {
    key: `in-port-${index}-${row.BUNKERID}-${row.ZONE}`,
    bunkerId: String(row.BUNKERID ?? ''),
    zone: row.ZONE || 'Non Seca',
    workingLp: str(pickZoneValue(row, 'FO_INPORT_SECA_CONSP_WORKING_LP', 'FO_INPORT_NONSECA_CONSP_WORKING_LP')),
    workingDp: str(pickZoneValue(row, 'FO_INPORT_SECA_CONSP_WORKING_DP', 'FO_INPORT_NONSECA_CONSP_WORKING_DP')),
    idleBallast: str(pickZoneValue(row, 'FO_INPORT_SECA_CONSP_IDLE_BALLAST', 'FO_INPORT_NONSECA_CONSP_IDLE_BALLAST')),
    idleLaden: str(pickZoneValue(row, 'FO_INPORT_SECA_CONSP_IDLE_LADEN', 'FO_INPORT_NONSECA_CONSP_IDLE_LADEN')),
  };
}

function mapVariousRow(row, index) {
  return {
    key: `various-${index}-${row.BUNKERID}-${row.ZONE}`,
    bunkerId: String(row.BUNKERID ?? ''),
    zone: row.ZONE || 'Non Seca',
    coldWash: str(pickZoneValue(row, 'FO_OTHER_SECA_CONSP_TK', 'FO_OTHER_NONSECA_CONSP_TK')),
    hotWash: str(pickZoneValue(row, 'FO_OTHER_SECA_CONSP_INERT', 'FO_OTHER_NONSECA_CONSP_INERT')),
    inertGasFree: str(pickZoneValue(row, 'FO_OTHER_SECA_CONSP_GF', 'FO_OTHER_NONSECA_CONSP_GF')),
    purgeGasFree: str(pickZoneValue(row, 'FO_OTHER_SECA_CONSP_HEAT', 'FO_OTHER_NONSECA_CONSP_HEAT')),
    heatingMaintain: str(row.FO_OTHER_SECA_CONSP_HEAT_1),
    heatingRaise: str(row.FO_OTHER_NONSECA_CONSP_HEAT_1),
  };
}

function buildAtSeaDbRow(row, commercialParameterId) {
  const isSeca = row.zone === 'Seca';
  return {
    COMMERCIAL_PARAMETERID: commercialParameterId,
    FO_TYPE: 'AT SEA',
    BUNKERID: row.bunkerId,
    IDENTIFY: 'FO',
    ZONE: row.zone || 'Non Seca',
    FO_BALAST_ATSEA_SECA_CONSP_FS: isSeca ? str(row.ballastFull) : '',
    FO_LADEN_ATSEA_SECA_CONSP_FS: isSeca ? str(row.ladenFull) : '',
    FO_BALAST_ATSEA_NONSECA_CONSP_FS: isSeca ? '' : str(row.ballastFull),
    FO_LADEN_ATSEA_NONSECA_CONSP_FS: isSeca ? '' : str(row.ladenFull),
    FO_BALAST_ATSEA_SECA_CONSP_SS: isSeca ? str(row.ballastService) : '',
    FO_LADEN_ATSEA_SECA_CONSP_SS: isSeca ? str(row.ladenService) : '',
    FO_BALAST_ATSEA_NONSECA_CONSP_SS: isSeca ? '' : str(row.ballastService),
    FO_LADEN_ATSEA_NONSECA_CONSP_SS: isSeca ? '' : str(row.ladenService),
    FO_BALAST_ATSEA_SECA_CONSP_MES: isSeca ? str(row.ballastEco) : '',
    FO_LADEN_ATSEA_SECA_CONSP_MES: isSeca ? str(row.ladenEco) : '',
    FO_BALAST_ATSEA_NONSECA_CONSP_MES: isSeca ? '' : str(row.ballastEco),
    FO_LADEN_ATSEA_NONSECA_CONSP_MES: isSeca ? '' : str(row.ladenEco),
  };
}

function buildInPortDbRow(row, commercialParameterId) {
  const isSeca = row.zone === 'Seca';
  return {
    COMMERCIAL_PARAMETERID: commercialParameterId,
    FO_TYPE: 'IN PORT',
    BUNKERID: row.bunkerId,
    IDENTIFY: 'FO',
    ZONE: row.zone || 'Non Seca',
    FO_INPORT_SECA_CONSP_WORKING_LP: isSeca ? str(row.workingLp) : '',
    FO_INPORT_NONSECA_CONSP_WORKING_LP: isSeca ? '' : str(row.workingLp),
    FO_INPORT_SECA_CONSP_WORKING_DP: isSeca ? str(row.workingDp) : '',
    FO_INPORT_NONSECA_CONSP_WORKING_DP: isSeca ? '' : str(row.workingDp),
    FO_INPORT_SECA_CONSP_IDLE_BALLAST: isSeca ? str(row.idleBallast) : '',
    FO_INPORT_NONSECA_CONSP_IDLE_BALLAST: isSeca ? '' : str(row.idleBallast),
    FO_INPORT_SECA_CONSP_IDLE_LADEN: isSeca ? str(row.idleLaden) : '',
    FO_INPORT_NONSECA_CONSP_IDLE_LADEN: isSeca ? '' : str(row.idleLaden),
  };
}

function buildVariousDbRow(row, commercialParameterId) {
  const isSeca = row.zone === 'Seca';
  return {
    COMMERCIAL_PARAMETERID: commercialParameterId,
    FO_TYPE: 'VARIOUS',
    BUNKERID: row.bunkerId,
    IDENTIFY: 'FO',
    ZONE: row.zone || 'Non Seca',
    FO_OTHER_SECA_CONSP_TK: isSeca ? str(row.coldWash) : '',
    FO_OTHER_NONSECA_CONSP_TK: isSeca ? '' : str(row.coldWash),
    FO_OTHER_SECA_CONSP_INERT: isSeca ? str(row.hotWash) : '',
    FO_OTHER_NONSECA_CONSP_INERT: isSeca ? '' : str(row.hotWash),
    FO_OTHER_SECA_CONSP_GF: isSeca ? str(row.inertGasFree) : '',
    FO_OTHER_NONSECA_CONSP_GF: isSeca ? '' : str(row.inertGasFree),
    FO_OTHER_SECA_CONSP_HEAT: isSeca ? str(row.purgeGasFree) : '',
    FO_OTHER_NONSECA_CONSP_HEAT: isSeca ? '' : str(row.purgeGasFree),
    FO_OTHER_SECA_CONSP_HEAT_1: str(row.heatingMaintain),
    FO_OTHER_NONSECA_CONSP_HEAT_1: str(row.heatingRaise),
  };
}

async function getVesselTypeName(pool, typeId) {
  if (!typeId) return '';
  const [rows] = await pool.query(
    'SELECT VesselType AS name FROM vessel_type_master WHERE VesselTypeId = ? LIMIT 1',
    [typeId],
  );
  return rows[0]?.name ?? '';
}

async function getTpc(pool, vesselId, businessTypeId) {
  if (Number(businessTypeId) === 3) {
    const [rows] = await pool.query(
      'SELECT TPC_MT AS value FROM vessel_master_1 WHERE VESSEL_IMO_ID = ? LIMIT 1',
      [vesselId],
    );
    return str(rows[0]?.value);
  }
  const [rows] = await pool.query(
    'SELECT TPC_SUMMER AS value FROM vessel_master_tankers WHERE VESSEL_IMO_ID = ? LIMIT 1',
    [vesselId],
  );
  return str(rows[0]?.value);
}

export async function dbGetCommercialParametersLookups() {
  const pool = getPool();
  const [bunkers] = await pool.query(
    `SELECT BUNKERGRADEID AS id, NAME AS name
     FROM bunker_grade_master
     WHERE STATUS = 1
       AND MODULEID = ?
       AND MCOMPANYID = ?
       AND BUNKERTYPE IN ('IFO', 'MDO')
     ORDER BY NAME`,
    [MODULE_ID, appContext.companyId],
  );
  return {
    bunkers: bunkers.map((row) => ({ id: String(row.id), name: row.name })),
    zones: BUNKER_ZONES.map((name) => ({ id: name, name })),
  };
}

export async function dbGetCommercialParametersSlaveRows(vesselId) {
  const pool = getPool();
  const [paramRows] = await pool.query(
    `SELECT COMMERCIAL_PARAMETERID
     FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ? AND MODULEID = ?
     LIMIT 1`,
    [vesselId, MODULE_ID],
  );
  const commercialParameterId = paramRows[0]?.COMMERCIAL_PARAMETERID;
  if (!commercialParameterId) return [];

  const [rows] = await pool.query(
    `SELECT *
     FROM vessel_commercial_parameters_slave1
     WHERE COMMERCIAL_PARAMETERID = ?
     ORDER BY FO_TYPE, BUNKERID, ZONE`,
    [commercialParameterId],
  );
  return rows;
}

export async function dbGetCommercialParameters(vesselId) {
  const pool = getPool();
  const [vesselRows] = await pool.query(
    `SELECT vim.VESSEL_IMO_ID,
            vim.VESSEL_NAME,
            vim.DWT,
            vim.DRAFTM,
            vim.VESSEL_TYPE,
            vim.BUSINESSTYPEID
     FROM vessel_imo_master vim
     WHERE vim.VESSEL_IMO_ID = ? AND vim.MCOMPANYID = ?
     LIMIT 1`,
    [vesselId, appContext.companyId],
  );
  const vesselRow = vesselRows[0];
  if (!vesselRow) return null;

  const [paramRows] = await pool.query(
    `SELECT *
     FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ? AND MODULEID = ?
     LIMIT 1`,
    [vesselId, MODULE_ID],
  );
  const paramRow = paramRows[0] ?? null;
  const commercialParameterId = paramRow?.COMMERCIAL_PARAMETERID ?? null;

  let slaveRows = [];
  if (commercialParameterId) {
    const [rows] = await pool.query(
      `SELECT *
       FROM vessel_commercial_parameters_slave1
       WHERE COMMERCIAL_PARAMETERID = ?
       ORDER BY FO_TYPE, BUNKERID, ZONE`,
      [commercialParameterId],
    );
    slaveRows = rows;
  }

  const atSea = slaveRows
    .filter((row) => row.FO_TYPE === 'AT SEA')
    .map((row, index) => mapAtSeaRow(row, index));
  const inPort = slaveRows
    .filter((row) => row.FO_TYPE === 'IN PORT')
    .map((row, index) => mapInPortRow(row, index));
  const various = slaveRows
    .filter((row) => row.FO_TYPE === 'VARIOUS')
    .map((row, index) => mapVariousRow(row, index));

  const lookups = await dbGetCommercialParametersLookups();
  const tpc = await getTpc(pool, vesselId, vesselRow.BUSINESSTYPEID);

  return {
    vessel: {
      id: vesselRow.VESSEL_IMO_ID,
      name: vesselRow.VESSEL_NAME ?? '',
      type: await getVesselTypeName(pool, vesselRow.VESSEL_TYPE),
      businessTypeId: Number(vesselRow.BUSINESSTYPEID),
      dwt: str(vesselRow.DWT),
      draft: str(vesselRow.DRAFTM),
      tpc,
    },
    main: {
      date: paramRow?.MAIN_DATA_DATE
        ? formatDmyDate(paramRow.MAIN_DATA_DATE)
        : formatDmyDate(new Date()),
      dwt: str(vesselRow.DWT),
      draft: str(vesselRow.DRAFTM),
      tpc,
    },
    speed: {
      ballastFull: str(paramRow?.B_FULL_SPEED),
      ballastService: str(paramRow?.B_ECO_SPEED1),
      ballastEco: str(paramRow?.B_ECO_SPEED2),
      ladenFull: str(paramRow?.L_FULL_SPEED),
      ladenService: str(paramRow?.L_ECO_SPEED1),
      ladenEco: str(paramRow?.L_ECO_SPEED2),
    },
    bunkersAtSea: atSea.length ? atSea : [emptyAtSeaRow()],
    bunkersInPort: inPort.length ? inPort : [emptyInPortRow()],
    bunkersVarious: various.length ? various : [emptyVariousRow()],
    lookups,
  };
}

function emptyAtSeaRow() {
  return {
    key: `at-sea-${Date.now()}`,
    bunkerId: '',
    zone: 'Non Seca',
    ballastFull: '',
    ladenFull: '',
    ballastService: '',
    ladenService: '',
    ballastEco: '',
    ladenEco: '',
  };
}

function emptyInPortRow() {
  return {
    key: `in-port-${Date.now()}`,
    bunkerId: '',
    zone: 'Non Seca',
    workingLp: '',
    workingDp: '',
    idleBallast: '',
    idleLaden: '',
  };
}

function emptyVariousRow() {
  return {
    key: `various-${Date.now()}`,
    bunkerId: '',
    zone: 'Non Seca',
    coldWash: '',
    hotWash: '',
    inertGasFree: '',
    purgeGasFree: '',
    heatingMaintain: '',
    heatingRaise: '',
  };
}

async function insertSlaveRow(connection, row) {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  await connection.query(
    `INSERT INTO vessel_commercial_parameters_slave1 (${columns.join(', ')})
     VALUES (${placeholders})`,
    columns.map((column) => row[column]),
  );
}

export async function dbSaveCommercialParameters(vesselId, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `SELECT COMMERCIAL_PARAMETERID
       FROM vessel_commercial_parameters
       WHERE VESSEL_IMO_ID = ? AND MODULEID = ?
       LIMIT 1`,
      [vesselId, MODULE_ID],
    );

    const mainDate = parseDateToDb(payload.main?.date);
    const speed = payload.speed ?? {};
    const masterValues = [
      mainDate,
      str(speed.ballastFull),
      str(speed.ballastService),
      str(speed.ballastEco),
      str(speed.ladenFull),
      str(speed.ladenService),
      str(speed.ladenEco),
    ];

    let commercialParameterId = existingRows[0]?.COMMERCIAL_PARAMETERID;

    if (!commercialParameterId) {
      const [insertResult] = await connection.query(
        `INSERT INTO vessel_commercial_parameters
          (VESSEL_IMO_ID, MAIN_DATA_DATE, B_FULL_SPEED, B_ECO_SPEED1, B_ECO_SPEED2,
           L_FULL_SPEED, L_ECO_SPEED1, L_ECO_SPEED2, MODULEID, REMARKS)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '')`,
        [vesselId, ...masterValues, MODULE_ID],
      );
      commercialParameterId = insertResult.insertId;
    } else {
      await connection.query(
        `UPDATE vessel_commercial_parameters
         SET MAIN_DATA_DATE = ?, B_FULL_SPEED = ?, B_ECO_SPEED1 = ?, B_ECO_SPEED2 = ?,
             L_FULL_SPEED = ?, L_ECO_SPEED1 = ?, L_ECO_SPEED2 = ?
         WHERE COMMERCIAL_PARAMETERID = ?`,
        [...masterValues, commercialParameterId],
      );
      await connection.query(
        'DELETE FROM vessel_commercial_parameters_slave1 WHERE COMMERCIAL_PARAMETERID = ?',
        [commercialParameterId],
      );
      await connection.query(
        'DELETE FROM vessel_commercial_parameters_slave2 WHERE COMMERCIAL_PARAMETERID = ?',
        [commercialParameterId],
      );
    }

    for (const row of payload.bunkersAtSea ?? []) {
      if (!row.bunkerId) continue;
      await insertSlaveRow(connection, buildAtSeaDbRow(row, commercialParameterId));
    }
    for (const row of payload.bunkersInPort ?? []) {
      if (!row.bunkerId) continue;
      await insertSlaveRow(connection, buildInPortDbRow(row, commercialParameterId));
    }
    for (const row of payload.bunkersVarious ?? []) {
      if (!row.bunkerId) continue;
      await insertSlaveRow(connection, buildVariousDbRow(row, commercialParameterId));
    }

    await connection.commit();
    return { msg: 2, commercialParameterId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { emptyAtSeaRow, emptyInPortRow, emptyVariousRow };
