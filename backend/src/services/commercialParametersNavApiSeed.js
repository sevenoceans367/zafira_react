import { appContext } from '../config.js';

const SHIP_PROFILE_URL =
  process.env.NAVAPI_SHIP_PROFILE_URL
  || 'https://v1.navapi.pro/moda/info/ShipProfile';

const SHIP_PROFILE_TOKEN =
  process.env.NAVAPI_SHIP_PROFILE_TOKEN
  || process.env.NAVAPI_SHIP_DETAILS_TOKEN
  || '7b9fef98663924af84d9c87bfddeb8ac1742376574214';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveShipProfileQuery(vessel, options = {}) {
  const shipTypeApi = String(options.shipType || vessel.VESSEL_TYPE_API || '').trim().toLowerCase();
  const dwt = num(options.dwtFromApi ?? vessel.DWT, 0);

  // Mirrors PHP getVesselDetails(): only Bulk / Oil-and-Chemical use real DWT.
  // All other types (e.g. General Cargo) hardcode ShipSize=23000.
  if (shipTypeApi === 'bulk carrier') {
    return { model: 'VCLAGR', shipType: 'BULK', shipSize: dwt || 50000 };
  }
  if (shipTypeApi === 'oil and chemical tanker') {
    return { model: 'VCLAGR', shipType: 'TANK', shipSize: dwt || 23000 };
  }
  return { model: 'VCLAGR', shipType: 'TANK', shipSize: 23000 };
}

function resolveAeScrubberRates(shipSize) {
  const size = num(shipSize, 0);
  if (size >= 150000) return { sea: 1.0, port: 0.3 };
  if (size >= 110000) return { sea: 0.75, port: 0.2 };
  if (size >= 90000) return { sea: 0.75, port: 0.2 };
  if (size >= 70000) return { sea: 0.5, port: 0.2 };
  if (size >= 50000) return { sea: 0.5, port: 0.2 };
  if (size >= 30000) return { sea: 0.5, port: 0.1 };
  if (size >= 20000) return { sea: 0.4, port: 0.1 };
  if (size >= 10000) return { sea: 0.4, port: 0.1 };
  return { sea: 1.0, port: 0.3 };
}

async function fetchShipProfile(query) {
  const url = new URL(SHIP_PROFILE_URL);
  url.searchParams.set('Model', query.model);
  url.searchParams.set('ShipType', query.shipType);
  url.searchParams.set('ShipSize', String(query.shipSize));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${SHIP_PROFILE_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`ShipProfile API returned ${response.status}`);
  }
  return response.json();
}

function buildAtSeaRow(cpId, bunkerId, identify, zone, values) {
  return {
    COMMERCIAL_PARAMETERID: cpId,
    FO_TYPE: 'AT SEA',
    BUNKERID: bunkerId,
    IDENTIFY: identify,
    FO_BALAST_ATSEA_SECA_CONSP_FS: values.balFs,
    FO_LADEN_ATSEA_SECA_CONSP_FS: values.ladFs,
    FO_BALAST_ATSEA_NONSECA_CONSP_FS: values.balFs,
    FO_LADEN_ATSEA_NONSECA_CONSP_FS: values.ladFs,
    FO_BALAST_ATSEA_SECA_CONSP_SS: values.balSs,
    FO_LADEN_ATSEA_SECA_CONSP_SS: values.ladSs,
    FO_BALAST_ATSEA_NONSECA_CONSP_SS: values.balSs,
    FO_LADEN_ATSEA_NONSECA_CONSP_SS: values.ladSs,
    FO_BALAST_ATSEA_SECA_CONSP_MES: values.balMes,
    FO_LADEN_ATSEA_SECA_CONSP_MES: values.ladMes,
    FO_BALAST_ATSEA_NONSECA_CONSP_MES: values.balMes,
    FO_LADEN_ATSEA_NONSECA_CONSP_MES: values.ladMes,
    ZONE: zone,
  };
}

function buildInPortRow(cpId, bunkerId, identify, zone, portWkg, portIdle) {
  return {
    COMMERCIAL_PARAMETERID: cpId,
    FO_TYPE: 'IN PORT',
    BUNKERID: bunkerId,
    IDENTIFY: identify,
    FO_INPORT_SECA_CONSP_WORKING: portWkg,
    FO_INPORT_NONSECA_CONSP_WORKING: portWkg,
    FO_INPORT_SECA_CONSP_IDLE: portIdle,
    FO_INPORT_NONSECA_CONSP_IDLE: portIdle,
    FO_INPORT_SECA_CONSP_OTHER: 0,
    FO_INPORT_NONSECA_CONSP_OTHER: 0,
    FO_INPORT_SECA_CONSP_IDLE_BALLAST: 0,
    FO_INPORT_NONSECA_CONSP_IDLE_BALLAST: 0,
    FO_INPORT_SECA_CONSP_IDLE_LADEN: 0,
    FO_INPORT_NONSECA_CONSP_IDLE_LADEN: 0,
    FO_INPORT_SECA_CONSP_WORKING_LP: 0,
    FO_INPORT_NONSECA_CONSP_WORKING_LP: 0,
    FO_INPORT_SECA_CONSP_WORKING_DP: 0,
    FO_INPORT_NONSECA_CONSP_WORKING_DP: 0,
    ZONE: zone,
  };
}

function buildVariousRow(cpId, bunkerId, identify, zone, defaults = 0) {
  return {
    COMMERCIAL_PARAMETERID: cpId,
    FO_TYPE: 'VARIOUS',
    BUNKERID: bunkerId,
    IDENTIFY: identify,
    FO_OTHER_SECA_CONSP_TK: defaults,
    FO_OTHER_NONSECA_CONSP_TK: defaults,
    FO_OTHER_SECA_CONSP_INERT: defaults,
    FO_OTHER_NONSECA_CONSP_INERT: defaults,
    FO_OTHER_SECA_CONSP_GF: defaults,
    FO_OTHER_NONSECA_CONSP_GF: defaults,
    FO_OTHER_SECA_CONSP_HEAT: defaults,
    FO_OTHER_NONSECA_CONSP_HEAT: defaults,
    FO_OTHER_SECA_CONSP_HEAT_1: defaults,
    FO_OTHER_NONSECA_CONSP_HEAT_1: defaults,
    ZONE: zone,
  };
}

async function insertSlaveRows(connection, rows) {
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    await connection.query(
      `INSERT INTO vessel_commercial_parameters_slave1 (${columns.join(', ')})
       VALUES (${placeholders})`,
      columns.map((column) => row[column]),
    );
  }
}

/**
 * Insert commercial parameters from NavAPI ShipProfile — mirrors PHP getVesselDetails().
 */
async function seedCommercialParameters(connection, vesselId, profile, moduleId, aeScrubber) {
  const balSrv = num(profile.BallastSrvSpeed);
  const balEco = num(profile.BallastEcoSpeed);
  const ladSrv = num(profile.LadenSrvSpeed);
  const ladEco = num(profile.LadenEcoSpeed);
  const balSrvCons = num(profile.BallastSrvCons);
  const balEcoCons = num(profile.BallastEcoCons);
  const ladSrvCons = num(profile.LadenSrvCons);
  const ladEcoCons = num(profile.LadenEcoCons);
  const portWkg = num(profile.PortWkgCons);
  const portIdle = num(profile.PortIdleCons);

  const mostEcoSpeedBal = balEco - (balSrv - balEco);
  const mostEcoSpeedLad = ladEco - (ladSrv - ladEco);
  const mostEcoSpeedBalCons = balEcoCons - (balSrvCons - balEcoCons);
  const mostEcoSpeedLadCons = ladEcoCons - (ladSrvCons - ladEcoCons);

  const [insertResult] = await connection.query(
    `INSERT INTO vessel_commercial_parameters (
      VESSEL_IMO_ID, MAIN_DATA_DATE, B_FULL_SPEED, B_ECO_SPEED1, B_ECO_SPEED2,
      L_FULL_SPEED, L_ECO_SPEED1, L_ECO_SPEED2, MODULEID, REMARKS
    ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, 'COMM_PARA_API')`,
    [
      vesselId,
      balSrv,
      balEco,
      mostEcoSpeedBal,
      ladSrv,
      ladEco,
      mostEcoSpeedLad,
      moduleId,
    ],
  );
  const cpId = insertResult.insertId;

  const foAtSeaValues = {
    balFs: balSrvCons,
    ladFs: ladSrvCons,
    balSs: balEcoCons,
    ladSs: ladEcoCons,
    balMes: mostEcoSpeedBalCons,
    ladMes: mostEcoSpeedLadCons,
  };

  const slaveRows = [];
  for (const zone of ['Non Seca', 'Seca']) {
    for (const bunkerId of [29, 11]) {
      slaveRows.push(buildAtSeaRow(cpId, bunkerId, 'FO', zone, foAtSeaValues));
      slaveRows.push(buildInPortRow(cpId, bunkerId, 'FO', zone, portWkg, portIdle));
      slaveRows.push(buildVariousRow(cpId, bunkerId, 'FO', zone, 0));
    }
    slaveRows.push(buildAtSeaRow(cpId, 35, 'FO', zone, {
      balFs: aeScrubber.sea,
      ladFs: aeScrubber.sea,
      balSs: aeScrubber.sea,
      ladSs: aeScrubber.sea,
      balMes: aeScrubber.sea,
      ladMes: aeScrubber.sea,
    }));
    slaveRows.push(buildInPortRow(cpId, 35, 'FO', zone, aeScrubber.port, aeScrubber.port));
    slaveRows.push(buildVariousRow(cpId, 35, 'FO', zone, 0));

    for (const bunkerId of [23]) {
      slaveRows.push(buildAtSeaRow(cpId, bunkerId, 'DO', zone, {
        balFs: 0.1,
        ladFs: 0.1,
        balSs: 0.1,
        ladSs: 0.1,
        balMes: 0.1,
        ladMes: 0.1,
      }));
      slaveRows.push(buildInPortRow(cpId, bunkerId, 'DO', zone, 0.1, 0.1));
      slaveRows.push(buildVariousRow(cpId, bunkerId, 'DO', zone, 0.1));
    }
  }

  await insertSlaveRows(connection, slaveRows);
  return cpId;
}

/**
 * If vessel has no commercial parameters, seed from NavAPI ShipProfile (PHP options.php id=42).
 */
export async function ensureCommercialParametersFromNavApi(pool, vesselId, vessel, options = {}) {
  const moduleId = options.moduleId || appContext.moduleId || '6';

  const [anyRows] = await pool.query(
    `SELECT COMMERCIAL_PARAMETERID FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ?
     LIMIT 1`,
    [vesselId],
  );
  if (anyRows.length) return anyRows[0].COMMERCIAL_PARAMETERID;

  const query = resolveShipProfileQuery(vessel, options);
  const aeScrubber = resolveAeScrubberRates(query.shipSize);

  let payload;
  try {
    payload = await fetchShipProfile(query);
  } catch (err) {
    console.error('NavAPI ShipProfile failed:', err.message || err);
    return null;
  }

  if (payload?.Metadata?.ResultMessage !== 'Success') return null;

  let profiles = payload?.ApiResults?.extd_ShipProfile;
  let profile = Array.isArray(profiles) ? profiles[0] : profiles;

  // Small DWT / odd ship types can return Success with an empty profile.
  // Retry with PHP's default tank size so commercial params still seed.
  if (!profile && query.shipSize !== 23000) {
    try {
      payload = await fetchShipProfile({ ...query, shipSize: 23000 });
      profiles = payload?.ApiResults?.extd_ShipProfile;
      profile = Array.isArray(profiles) ? profiles[0] : profiles;
    } catch (err) {
      console.error('NavAPI ShipProfile retry failed:', err.message || err);
    }
  }
  if (!profile) return null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const cpId = await seedCommercialParameters(
      connection,
      vesselId,
      profile,
      moduleId,
      aeScrubber,
    );
    await connection.commit();
    return cpId;
  } catch (err) {
    await connection.rollback();
    console.error('Commercial parameters seed failed:', err.message || err);
    return null;
  } finally {
    connection.release();
  }
}

export async function loadCommercialParameterRow(pool, vesselId, moduleId) {
  const [byModule] = await pool.query(
    `SELECT * FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ? AND MODULEID = ?
     LIMIT 1`,
    [vesselId, moduleId],
  );
  if (byModule.length) return byModule[0];

  const [any] = await pool.query(
    `SELECT * FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ?
     ORDER BY COMMERCIAL_PARAMETERID DESC
     LIMIT 1`,
    [vesselId],
  );
  return any[0] || null;
}
