import { appContext } from '../config.js';
import { getPool } from '../db.js';

function numOrZero(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function mapRecord(row, index) {
  return {
    id: row.PORT_INFORMATIONID,
    index,
    portCode: row.PORTID == null ? '' : String(row.PORTID),
    portName: row.PORT_NAME ?? '',
    cargoId: row.CARGOID == null ? '' : String(row.CARGOID),
    cargoName: row.CARGO_NAME ?? '',
    terminalId: row.TERMINALID == null ? '' : String(row.TERMINALID),
    terminalName: row.TERMINAL_NAME ?? '',
    maxDraft: row.MAX_DRAFT == null ? '' : String(row.MAX_DRAFT),
    maxLoa: row.MAX_LOA == null ? '' : String(row.MAX_LOA),
    maxBeam: row.MAX_BEAM == null ? '' : String(row.MAX_BEAM),
    maxHeight: row.MAX_HEIGHT == null ? '' : String(row.MAX_HEIGHT),
    loadingMethod: row.LOADING_METHOD ?? '',
    loadingRateDay: row.LOADING_RATE_DAY == null ? '' : String(row.LOADING_RATE_DAY),
    dischRateDay: row.DISCH_RATE_DAY == null ? '' : String(row.DISCH_RATE_DAY),
    loadingRateHr: row.LOADING_RATE_HR == null ? '' : String(row.LOADING_RATE_HR),
    dischRateHr: row.DISCH_RATE_HR == null ? '' : String(row.DISCH_RATE_HR),
    dwt: row.DWT == null ? '' : String(row.DWT),
    dcts: row.DCTS == null ? '' : String(row.DCTS),
    loader: row.LOADER == null ? '' : String(row.LOADER),
    remarks: row.REMARKS ?? '',
    displacement: row.DISPLACEMENT ?? '',
    craneOutReach: row.CRANE_OUT_REACH ?? '',
    hatchDimension: row.HATCH_DIMENSION ?? '',
    status: Number(row.STATUS) === 1 ? 1 : 2,
  };
}

const LIST_SELECT = `
  SELECT pi.PORT_INFORMATIONID,
         pi.PORTID,
         pi.CARGOID,
         pi.TERMINALID,
         pi.MAX_DRAFT,
         pi.MAX_LOA,
         pi.MAX_BEAM,
         pi.MAX_HEIGHT,
         pi.LOADING_METHOD,
         pi.LOADING_RATE_DAY,
         pi.DISCH_RATE_DAY,
         pi.LOADING_RATE_HR,
         pi.DISCH_RATE_HR,
         pi.DWT,
         pi.DCTS,
         pi.LOADER,
         pi.REMARKS,
         pi.DISPLACEMENT,
         pi.CRANE_OUT_REACH,
         pi.HATCH_DIMENSION,
         pi.STATUS,
         CONCAT(COALESCE(pm.PortName, ''), '(', COALESCE(pm.PortCode, pi.PORTID, ''), ')') AS PORT_NAME,
         cm.MATERIAL_CODE_DESC AS CARGO_NAME,
         tm.NAME AS TERMINAL_NAME
  FROM port_information_master pi
  LEFT JOIN port_master pm ON pm.PortCode = pi.PORTID
  LEFT JOIN cargo_master cm ON cm.MATERIALID = pi.CARGOID
  LEFT JOIN terminal_master tm ON tm.TERMINALID = pi.TERMINALID
`;

export async function dbGetPortInformationLookups() {
  const pool = getPool();
  const [cargos] = await pool.query(
    `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name, MATERIAL_CODE AS code
     FROM cargo_master
     WHERE STATUS = 1
       AND MCOMPANYID = ?
     ORDER BY MATERIAL_CODE_DESC`,
    [appContext.companyId],
  );

  return {
    cargos: cargos.map((row) => ({
      id: String(row.id),
      name: `${row.name ?? ''} (${row.code ?? ''})`,
    })),
    loaders: [
      { id: '1', name: 'Yes' },
      { id: '2', name: 'No' },
    ],
  };
}

export async function dbGetTerminalsByPort(portIdOrCode) {
  const pool = getPool();
  const key = String(portIdOrCode || '').trim();
  if (!key) return { portCode: '', terminals: [] };

  const [[byId]] = await pool.query(
    `SELECT PortCode FROM port_master WHERE PortId = ? LIMIT 1`,
    [key],
  );
  let portCode = byId?.PortCode || '';
  if (!portCode) {
    const [[byCode]] = await pool.query(
      `SELECT PortCode FROM port_master WHERE PortCode = ? LIMIT 1`,
      [key],
    );
    portCode = byCode?.PortCode || key;
  }
  if (!portCode) return { portCode: '', terminals: [] };

  const [terminals] = await pool.query(
    `SELECT TERMINALID AS id, NAME AS name
     FROM terminal_master
     WHERE MODULEID = ?
       AND MCOMPANYID = ?
       AND PORT_CODE = ?
     ORDER BY NAME`,
    [appContext.moduleId, appContext.companyId, portCode],
  );

  return {
    portCode: String(portCode),
    terminals: terminals.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
    })),
  };
}

export async function dbListPortInformation() {
  const pool = getPool();
  const [rows] = await pool.query(
    `${LIST_SELECT}
     ORDER BY pi.STATUS, pi.PORT_INFORMATIONID DESC`,
  );

  return {
    records: rows.map((row, i) => mapRecord(row, i + 1)),
    recordsTotal: rows.length,
  };
}

export async function dbGetPortInformation(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `${LIST_SELECT}
     WHERE pi.PORT_INFORMATIONID = ?
     LIMIT 1`,
    [id],
  );
  if (!row) return null;
  return mapRecord(row, 1);
}

export async function dbCreatePortInformation(payload) {
  const pool = getPool();
  const cargoId = String(payload.cargoId || '').trim();
  const portCode = String(payload.portCode || '').trim();
  const terminalId = String(payload.terminalId || '').trim();
  const loader = String(payload.loader || '').trim();
  const loadingMethod = String(payload.loadingMethod || '').trim();
  const remarks = String(payload.remarks || '').trim();
  const displacement = String(payload.displacement || '').trim();
  const craneOutReach = String(payload.craneOutReach || '').trim();
  const hatchDimension = String(payload.hatchDimension || '').trim();

  if (!cargoId) throw new Error('Cargo Name is required.');
  if (!portCode) throw new Error('Port Name is required.');
  if (!terminalId) throw new Error('Terminal is required.');

  const [[existing]] = await pool.query(
    `SELECT PORT_INFORMATIONID
     FROM port_information_master
     WHERE PORTID = ?
       AND CARGOID = ?
       AND TERMINALID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
     LIMIT 1`,
    [portCode, cargoId, terminalId, appContext.moduleId, appContext.companyId],
  );
  if (existing) {
    const err = new Error('Port Information already exists for this Cargo, Port, and Terminal.');
    err.msg = 1;
    throw err;
  }

  await pool.query(
    `INSERT INTO port_information_master
       (PORTID, CARGOID, MAX_DRAFT, MAX_LOA, MAX_BEAM, MAX_HEIGHT, LOADING_METHOD,
        LOADING_RATE_DAY, DISCH_RATE_DAY, LOADING_RATE_HR, DISCH_RATE_HR, DWT, DCTS,
        LOADER, REMARKS, MODULEID, MCOMPANYID, DISPLACEMENT, CRANE_OUT_REACH,
        HATCH_DIMENSION, TERMINALID, STATUS)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      portCode,
      cargoId,
      numOrZero(payload.maxDraft),
      numOrZero(payload.maxLoa),
      numOrZero(payload.maxBeam),
      numOrZero(payload.maxHeight),
      loadingMethod,
      numOrZero(payload.loadingRateDay),
      numOrZero(payload.dischRateDay),
      numOrZero(payload.loadingRateHr),
      numOrZero(payload.dischRateHr),
      numOrZero(payload.dwt),
      numOrZero(payload.dcts),
      loader || null,
      remarks,
      appContext.moduleId,
      appContext.companyId,
      displacement,
      craneOutReach,
      hatchDimension,
      terminalId,
    ],
  );

  return { msg: 0 };
}

export async function dbUpdatePortInformation(id, payload) {
  const pool = getPool();
  const existing = await dbGetPortInformation(id);
  if (!existing) throw new Error('Port Information record not found.');

  const loader = String(payload.loader || '').trim();
  if (!loader) throw new Error('Loader (Y/N) is required.');

  const [result] = await pool.query(
    `UPDATE port_information_master
     SET MAX_DRAFT = ?,
         MAX_LOA = ?,
         MAX_BEAM = ?,
         MAX_HEIGHT = ?,
         LOADING_METHOD = ?,
         LOADING_RATE_DAY = ?,
         DISCH_RATE_DAY = ?,
         LOADING_RATE_HR = ?,
         DISCH_RATE_HR = ?,
         DWT = ?,
         DCTS = ?,
         LOADER = ?,
         REMARKS = ?,
         DISPLACEMENT = ?,
         CRANE_OUT_REACH = ?,
         HATCH_DIMENSION = ?
     WHERE PORT_INFORMATIONID = ?`,
    [
      numOrZero(payload.maxDraft),
      numOrZero(payload.maxLoa),
      numOrZero(payload.maxBeam),
      numOrZero(payload.maxHeight),
      String(payload.loadingMethod || '').trim(),
      numOrZero(payload.loadingRateDay),
      numOrZero(payload.dischRateDay),
      numOrZero(payload.loadingRateHr),
      numOrZero(payload.dischRateHr),
      numOrZero(payload.dwt),
      numOrZero(payload.dcts),
      loader,
      String(payload.remarks || '').trim(),
      String(payload.displacement || '').trim(),
      String(payload.craneOutReach || '').trim(),
      String(payload.hatchDimension || '').trim(),
      id,
    ],
  );
  if (!result.affectedRows) throw new Error('Port Information record not found.');

  return { msg: 0 };
}

export async function dbUpdatePortInformationStatus(id, currentStatus) {
  const pool = getPool();
  const nextStatus = Number(currentStatus) === 1 ? 2 : 1;
  const [result] = await pool.query(
    `UPDATE port_information_master
     SET STATUS = ?
     WHERE PORT_INFORMATIONID = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?`,
    [nextStatus, id, appContext.moduleId, appContext.companyId],
  );
  if (!result.affectedRows) {
    const [fallback] = await pool.query(
      `UPDATE port_information_master SET STATUS = ? WHERE PORT_INFORMATIONID = ?`,
      [nextStatus, id],
    );
    if (!fallback.affectedRows) throw new Error('Port Information record not found.');
  }
  return { msg: 2, status: nextStatus };
}
