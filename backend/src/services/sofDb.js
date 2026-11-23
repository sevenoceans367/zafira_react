import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

/** Sof key-ops "Date/Time To" — newer UI field; add column when missing (legacy PHP only had ACTIVITYDATETIME). */
let sofActivityDateTimeToReady = false;

export async function ensureSofActivityDateTimeToColumn(poolOrConn = getPool()) {
  if (sofActivityDateTimeToReady) return true;
  try {
    const [cols] = await poolOrConn.query(
      `SHOW COLUMNS FROM sof_slave_6 LIKE 'ACTIVITYDATETIMETO'`,
    );
    if (!cols.length) {
      await poolOrConn.query(
        `ALTER TABLE sof_slave_6
         ADD COLUMN ACTIVITYDATETIMETO DATETIME NULL AFTER ACTIVITYDATETIME`,
      );
    }
    sofActivityDateTimeToReady = true;
    return true;
  } catch (error) {
    console.warn('[sofDb] Could not ensure ACTIVITYDATETIMETO column:', error.message);
    return false;
  }
}

export const DEFAULT_KEY_OPERATIONS = [
  'EOSP',
  'Arrived at NOR tendering area',
  'Anchored or start drifing',
  'NOR tendered',
  'Anchor aweigh',
  'Pilot on board',
  'First line',
  'All fast',
  'Gangway ashore',
  'Commenced hose connection',
  'Completed hose connection',
  'Commenced tank inspection',
  'Completed tank inspection',
  'Commenced cargo operations',
  'Ceased cargo operations',
  'Resumed cargo operations',
  'Completed cargo operations',
  'Commenced tank inspections',
  'Completed tank inspection',
  'Commenced hose disconnection',
  'Completed hose diconnection',
  'Completed cargo calculation',
  'Cargo samples taken',
  'Cargo documents onboard',
  'Pilot on board',
  'Unberthed, Last line let go',
  'Pilot departed',
  'Full away on passage',
];

export const DEFAULT_CARGO_ROWS = [
  'Cargo Loaded',
  'Bunkers taken',
  'Tugs used arrival',
  'Tugs used for shifting',
  'Tugs used for departure',
  'Arrival draft',
  'Departure draft',
  'Remarks/delays/interuptions',
  'Lop Issued (Pls specify)',
  'Lop received (Pls Specify)',
];

function blankDateTime(value) {
  if (!value) return '';
  const str = String(value);
  if (str.startsWith('0000-00-00') || str.includes('1970-01-01')) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}-${m}-${y} ${hh}:${mm}`;
}

function blankDate(value) {
  if (!value) return '';
  const str = String(value);
  if (str.startsWith('0000-00-00') || str.includes('1970-01-01')) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function parseDmyDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (!match) {
    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) return null;
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')} ${String(fallback.getHours()).padStart(2, '0')}:${String(fallback.getMinutes()).padStart(2, '0')}:00`;
  }
  const [, dd, mm, yyyy, hh = '00', min = '00'] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

function parseDmyDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (!match) {
    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) return null;
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
  }
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function str(value) {
  if (value == null) return '';
  return String(value);
}

function strOrNull(value) {
  const s = String(value ?? '').trim();
  return s === '' ? null : s;
}

export function numOrNull(value) {
  if (value === '' || value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const hasGroupedThousands = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw);
  if (raw.includes(',') && !hasGroupedThousands) return null;
  const n = Number(hasGroupedThousands ? raw.replace(/,/g, '') : raw);
  return Number.isFinite(n) ? n : null;
}

function hasValue(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== '' && s.toLowerCase() !== 'null';
}

function isRemarksCargoActivity(activity) {
  const name = String(activity || '').toLowerCase();
  return !['cargo loaded', 'bunkers taken', 'tugs used arrival', 'tugs used for shifting', 'tugs used for departure', 'arrival draft', 'departure draft'].includes(name);
}

function isRobActivity(activity) {
  return activity === 'EOSP' || activity === 'Full away on passage';
}

async function getPortName(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    `SELECT PortName, COUNTRY_KEY FROM port_master WHERE PortId = ? LIMIT 1`,
    [portId],
  ).catch(() => [[null]]);
  if (!row?.PortName) return '';
  return row.COUNTRY_KEY ? `${row.PortName} (${row.COUNTRY_KEY})` : row.PortName;
}

async function getCountryName(pool, countryId) {
  if (!hasValue(countryId)) return '';
  const [[row]] = await pool.query(
    `SELECT COUNTRY_NAME FROM country_master WHERE COUNTRYID = ? LIMIT 1`,
    [countryId],
  ).catch(() => [[null]]);
  return row?.COUNTRY_NAME || '';
}

async function getLatestCostSheetId(pool, comId) {
  const [[row]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  );
  return row?.FCAID || null;
}

/**
 * PHP sof.php items 1-8 — readonly vessel particulars pulled from vessel_imo_master
 * via the cost sheet's VESSEL_IMO_ID. Labels 7/8 flip for tanker estimates (ESTIMATE_TYPE=2).
 */
async function loadVesselParticulars(pool, fcaId) {
  const [[row]] = await pool.query(
    `SELECT m.ESTIMATE_TYPE,
            vim.VESSEL_NAME, vim.YEARBUILT, vim.GRT_NRT, vim.NRT, vim.FLAG, vim.DWT, vim.LOA,
            vim.CARGO_GEAR, vim.HATCH_SIZE, vim.TANKER_CARGO_PUMP, vim.TANKER_PUMP_MAINCAP
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.FCAID = ?
     LIMIT 1`,
    [fcaId],
  ).catch(() => [[null]]);

  const estimateType = row?.ESTIMATE_TYPE != null ? Number(row.ESTIMATE_TYPE) : null;
  const isTanker = estimateType === 2;
  const flagName = await getCountryName(pool, row?.FLAG);
  const grt = str(row?.GRT_NRT);
  const nrt = str(row?.NRT);

  return {
    vesselName: str(row?.VESSEL_NAME),
    built: str(row?.YEARBUILT),
    grtNrt: (grt || nrt) ? `${grt}/${nrt}` : '',
    flag: flagName,
    dwt: str(row?.DWT),
    loaBeam: str(row?.LOA),
    estimateType,
    gearLabel: isTanker ? 'NO. OF CARGO PUMP(Main)' : 'GEAR/GRABS',
    gearValue: isTanker ? str(row?.TANKER_CARGO_PUMP) : str(row?.CARGO_GEAR),
    hatchLabel: isTanker ? 'CARGO PUMP MAIN CAP(CBM/Hr)' : 'HATCH/HOLD',
    hatchValue: isTanker ? str(row?.TANKER_PUMP_MAINCAP) : str(row?.HATCH_SIZE),
  };
}

async function loadPortTabs(pool, fcaId) {
  const [legs] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, RANDOMID, LOAD_PORT_QTY, DISC_PORT_QTY,
            PORT_COSTLP_VENDOR, PORT_COSTDP_VENDOR, PORT_COSTTP_VENDOR,
            LOAD_PORT_COST, DISC_PORT_COST, TRANSIT_PORT_COST, PASSAGE_TYPE,
            FROMARRIVAL, FROMDEPARTURE, TOARRIVAL, TODEPARTURE,
            FROMROBFOARRIVAL, FROMROBDOARRIVAL, FROMROBFODEPARTURE, FROMROBDODEPARTURE,
            TOROBFOARRIVAL, TOROBDOARRIVAL, TOROBFODEPARTURE, TOROBDODEPARTURE
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
     ORDER BY FCA_SLAVEID ASC`,
    [fcaId],
  );

  const tabs = [];
  for (const leg of legs || []) {
    const fromName = await getPortName(pool, leg.FROM_PORT);
    if (fromName === 'TBN' || String(fromName).startsWith('TBN ')) continue;

    const passageType = Number(leg.PASSAGE_TYPE);
    if (
      passageType === 2
      && (hasValue(leg.PORT_COSTLP_VENDOR) || Number(leg.LOAD_PORT_COST) > 0 || Number(leg.LOAD_PORT_QTY) > 0)
    ) {
      tabs.push({
        portType: 'LP',
        portId: str(leg.FROM_PORT),
        randomId: str(leg.RANDOMID),
        portName: fromName,
        defaults: {
          portArrival: blankDateTime(leg.FROMARRIVAL),
          portDeparture: blankDateTime(leg.FROMDEPARTURE),
          robFoArrival: str(leg.FROMROBFOARRIVAL),
          robDoArrival: str(leg.FROMROBDOARRIVAL),
          robFoDeparture: str(leg.FROMROBFODEPARTURE),
          robDoDeparture: str(leg.FROMROBDODEPARTURE),
        },
      });
    }

    const toName = await getPortName(pool, leg.TO_PORT);
    if (
      passageType === 2
      && (hasValue(leg.PORT_COSTDP_VENDOR) || Number(leg.DISC_PORT_COST) > 0 || Number(leg.DISC_PORT_QTY) > 0)
    ) {
      tabs.push({
        portType: 'DP',
        portId: str(leg.TO_PORT),
        randomId: str(leg.RANDOMID),
        portName: toName,
        defaults: {
          portArrival: blankDateTime(leg.TOARRIVAL),
          portDeparture: blankDateTime(leg.TODEPARTURE),
          robFoArrival: str(leg.TOROBFOARRIVAL),
          robDoArrival: str(leg.TOROBDOARRIVAL),
          robFoDeparture: str(leg.TOROBFODEPARTURE),
          robDoDeparture: str(leg.TOROBDODEPARTURE),
        },
      });
    }

    if (hasValue(leg.PORT_COSTTP_VENDOR) || Number(leg.TRANSIT_PORT_COST) > 0) {
      tabs.push({
        portType: 'TP',
        portId: str(leg.TO_PORT),
        randomId: str(leg.RANDOMID),
        portName: toName || fromName,
        defaults: {
          portArrival: blankDateTime(leg.TOARRIVAL),
          portDeparture: blankDateTime(leg.TODEPARTURE),
          robFoArrival: str(leg.TOROBFOARRIVAL),
          robDoArrival: str(leg.TOROBDOARRIVAL),
          robFoDeparture: str(leg.TOROBFODEPARTURE),
          robDoDeparture: str(leg.TOROBDODEPARTURE),
        },
      });
    }
  }
  return tabs;
}

function deriveMasterFieldsFromKeyOperations(keyOperations = [], cargoRows = [], explicit = {}) {
  const findFrom = (pattern) => {
    const row = keyOperations.find((r) => pattern.test(String(r.activity || '').trim()));
    const dt = str(row?.activityDateTime);
    return dt || null;
  };
  const cargoLoaded = (cargoRows || []).find(
    (r) => String(r.activity || '').trim().toLowerCase() === 'cargo loaded',
  );
  const stowageFromCargo = str(cargoLoaded?.shipFigure) || str(cargoLoaded?.blFigure) || '';
  return {
    terminal: str(explicit.terminal),
    stowageQty: strOrNull(explicit.stowageQty) || stowageFromCargo || null,
    vesselArrived: strOrNull(explicit.vesselArrived) || findFrom(/^eosp$/i),
    norTendered: strOrNull(explicit.norTendered) || findFrom(/^nor tendered$/i),
    pilotOnBoard: strOrNull(explicit.pilotOnBoard) || findFrom(/^pilot on board$/i),
    loadCommenced: strOrNull(explicit.loadCommenced) || findFrom(/^commenced cargo operations$/i),
    loadCompleted: strOrNull(explicit.loadCompleted) || findFrom(/^completed cargo operations$/i),
    vesselSailed: strOrNull(explicit.vesselSailed) || findFrom(/^full away on passage$/i),
  };
}

function applyMasterToKeyOperations(rows, record) {
  const fallbacks = {
    EOSP: record?.VAPS_1,
    'NOR tendered': record?.NT_1,
    'Commenced cargo operations': record?.LC,
    'Completed cargo operations': record?.LC1,
    'Full away on passage': record?.VS,
  };
  let pilotApplied = false;
  return rows.map((row) => {
    const activity = str(row.activity);
    if (row.activityDateTime) return row;
    if (activity === 'Pilot on board') {
      if (pilotApplied || !record?.PBFB_1) return row;
      pilotApplied = true;
      return {
        ...row,
        activityDateTime: blankDateTime(record.PBFB_1) || str(record.PBFB_1),
      };
    }
    const fallback = fallbacks[activity];
    if (!fallback) return row;
    return {
      ...row,
      activityDateTime: blankDateTime(fallback) || str(fallback),
    };
  });
}

function defaultKeyOperations(defaults = {}) {
  return DEFAULT_KEY_OPERATIONS.map((activity) => {
    const row = {
      activity,
      activityDateTime: '',
      activityDateTimeTo: '',
      robIfo: '',
      robMdo: '',
      comments: '',
      tDefault: 1,
    };
    if (activity === 'EOSP') {
      row.activityDateTime = defaults.portArrival || '';
      row.robIfo = defaults.robFoArrival || '';
      row.robMdo = defaults.robDoArrival || '';
    }
    if (activity === 'Full away on passage') {
      row.activityDateTime = defaults.portDeparture || '';
      row.robIfo = defaults.robFoDeparture || '';
      row.robMdo = defaults.robDoDeparture || '';
    }
    return row;
  });
}

function defaultCargoRows() {
  return DEFAULT_CARGO_ROWS.map((activity) => ({
    activity,
    shipFigure: '',
    blFigure: '',
    waterDensity: '',
    remarks: '',
    tDefault: 1,
  }));
}

function emptyBlRow() {
  return { blDate: '', cargo: '', blQty: '' };
}

function emptyPortActivityRow() {
  return {
    activity: '', from: '', to: '', duration: '',
    layTimeCount: false, portTimeCount: false, notes: '',
  };
}

function emptyDailyQtyRow() {
  return {
    date: '', engagementQty: '', loadLast: '', ttlLoad: '', balance: '', etcd: '',
  };
}

function emptyPreArrival() {
  return {
    cargoDecl: false,
    stowPlanQty: '',
    spDeptDraft: '',
    spArrDraft: '',
    eta30: '',
    eta25: '',
    eta20: '',
    eta15: '',
    eta10: '',
    eta7: '',
    eta5: '',
    eta3: '',
    eta2: '',
    eta1: '',
    actualArrival: '',
    norTendered: '',
  };
}

async function loadSofRecord(pool, comId, portType, portId, randomId) {
  const [[internal]] = await pool.query(
    `SELECT * FROM sof_master
     WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
       AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
  ).catch(() => [[null]]);

  if (internal) return internal;

  const [[agent]] = await pool.query(
    `SELECT * FROM sof_master
     WHERE COMID = ? AND LOGIN = 'AGENT'
       AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
       AND SUBMITID = '2'
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
  ).catch(() => [[null]]);

  return agent || null;
}

async function loadLaytimeDeductions(pool, comId, portType, portId, randomId) {
  const [[laytime]] = await pool.query(
    `SELECT LAYTIME_ID, SUBMITID FROM laytime_master
     WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
       AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
  );

  if (!laytime?.LAYTIME_ID) {
    return { deductions: [], laytimeId: '', laytimeLocked: false };
  }

  const [rows] = await pool.query(
    `SELECT ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION,
            LT_PARTIAL, CUMMULATIVE_TIME, NOTES
     FROM laytime_slave1 WHERE LAYTIME_ID = ? ORDER BY LAYTIME_LP_SLAVEID`,
    [laytime.LAYTIME_ID],
  );
  return {
    deductions: (rows || []).map((row) => ({
      activity: str(row.ACTIVITYID),
      start: blankDateTime(row.START_DATETIME),
      end: blankDateTime(row.FINISH_DATETIME),
      duration: str(row.DURATION),
      ltPartial: str(row.LT_PARTIAL),
      cumulative: str(row.CUMMULATIVE_TIME),
      notes: str(row.NOTES),
    })),
    laytimeId: String(laytime.LAYTIME_ID),
    laytimeLocked: Number(laytime.SUBMITID) === 5,
  };
}

async function loadKeyOperations(pool, sofId, defaults) {
  if (!sofId) return defaultKeyOperations(defaults);
  await ensureSofActivityDateTimeToColumn(pool);
  const [rows] = await pool.query(
    `SELECT * FROM sof_slave_6
     WHERE SOFID = ?
     ORDER BY (ACTIVITYDATETIME IS NULL OR ACTIVITYDATETIME = '0000-00-00 00:00:00'), ACTIVITYDATETIME ASC`,
    [sofId],
  ).catch(() => [[]]);
  if (!rows?.length) return defaultKeyOperations(defaults);
  return rows.map((row) => ({
    activity: str(row.ACTIVITY),
    activityDateTime: blankDateTime(row.ACTIVITYDATETIME),
    activityDateTimeTo: blankDateTime(row.ACTIVITYDATETIMETO),
    robIfo: str(row.ROBIFO),
    robMdo: str(row.ROBMDO),
    comments: str(row.COMMENTS),
    tDefault: Number(row.TDEFAULT) === 1 ? 1 : 0,
  }));
}

async function loadCargoRows(pool, sofId) {
  if (!sofId) return defaultCargoRows();
  const [rows] = await pool.query(
    `SELECT * FROM sof_slave_7 WHERE SOFID = ?`,
    [sofId],
  ).catch(() => [[]]);
  if (!rows?.length) return defaultCargoRows();
  return rows.map((row) => ({
    activity: str(row.ACTIVITY),
    shipFigure: str(row.SHIPFIGURE),
    blFigure: str(row.BLFIGURE),
    waterDensity: str(row.WATERDENSITY),
    remarks: str(row.REMARKS),
    tDefault: Number(row.TDEFAULT) === 1 ? 1 : 0,
  }));
}

/** PHP sof.php items 17+ — dynamic entity name/value rows (sof_slave_3). */
async function loadEntityRows(pool, sofId) {
  if (!sofId) return [];
  const [rows] = await pool.query(
    `SELECT ENTITY_NAME, ENTITY_VALUE FROM sof_slave_3 WHERE SOFID = ? ORDER BY SOF_SLAVEID ASC`,
    [sofId],
  ).catch(() => [[]]);
  return (rows || []).map((row) => ({
    name: str(row.ENTITY_NAME),
    value: str(row.ENTITY_VALUE),
  }));
}

/** PHP sof.php "BL Date / Cargo / BL Qty" table (sof_slave_1). */
async function loadBlRows(pool, sofId) {
  if (!sofId) return [emptyBlRow()];
  const [rows] = await pool.query(
    `SELECT BL_DATE, CARGO, BL_QTY FROM sof_slave_1 WHERE SOFID = ? ORDER BY SOF_SLAVEID ASC`,
    [sofId],
  ).catch(() => [[]]);
  if (!rows?.length) return [emptyBlRow()];
  return rows.map((row) => ({
    blDate: blankDate(row.BL_DATE),
    cargo: str(row.CARGO),
    blQty: row.BL_QTY != null ? String(row.BL_QTY) : '',
  }));
}

/** PHP sof.php "Activity in Port" block (sof_slave WHERE GROUP_NAME='1'). */
async function loadPortActivities(pool, sofId) {
  if (!sofId) return [emptyPortActivityRow()];
  const [rows] = await pool.query(
    `SELECT ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION,
            LAY_TIME_COUNT, PORT_TIME_COUNT, NOTES
     FROM sof_slave WHERE SOFID = ? AND GROUP_NAME = '1' ORDER BY SOF_SLAVEID ASC`,
    [sofId],
  ).catch(() => [[]]);
  if (!rows?.length) return [emptyPortActivityRow()];
  return rows.map((row) => ({
    activity: str(row.ACTIVITYID),
    from: blankDateTime(row.START_DATETIME),
    to: blankDateTime(row.FINISH_DATETIME),
    duration: str(row.DURATION),
    layTimeCount: Number(row.LAY_TIME_COUNT) === 1,
    portTimeCount: Number(row.PORT_TIME_COUNT) === 1,
    notes: str(row.NOTES),
  }));
}

/** PHP sof.php "PRE ARRIVAL & OTHER" block (sof_slave_4), falls back to AGENT copy. */
async function loadPreArrival(pool, comId, portType, portId, randomId) {
  const params = [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId];
  const [[internalRow]] = await pool.query(
    `SELECT * FROM sof_slave_4
     WHERE COMID = ? AND LOGIN = 'INTERNAL_USER' AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     LIMIT 1`,
    params,
  ).catch(() => [[null]]);

  let row = internalRow;
  if (!row) {
    const [[agentRow]] = await pool.query(
      `SELECT * FROM sof_slave_4
       WHERE COMID = ? AND LOGIN = 'AGENT' AND MODULEID = ? AND MCOMPANYID = ?
         AND PORT = ? AND PORTID = ? AND RANDOMID = ?
       LIMIT 1`,
      params,
    ).catch(() => [[null]]);
    row = agentRow;
  }
  if (!row) return emptyPreArrival();

  return {
    cargoDecl: Number(row.CARGO_DECL) === 1,
    stowPlanQty: row.STOW_PLAN_QTY != null ? String(row.STOW_PLAN_QTY) : '',
    spDeptDraft: str(row.SP_DEPT_DRAFT),
    spArrDraft: str(row.SP_ARR_DRAFT),
    eta30: blankDateTime(row.ETA_30_DAYS),
    eta25: blankDateTime(row.ETA_25_DAYS),
    eta20: blankDateTime(row.ETA_20_DAYS),
    eta15: blankDateTime(row.ETA_15_DAYS),
    eta10: blankDateTime(row.ETA_10_DAYS),
    eta7: blankDateTime(row.ETA_7_DAYS),
    eta5: blankDateTime(row.ETA_5_DAYS),
    eta3: blankDateTime(row.ETA_3_DAYS),
    eta2: blankDateTime(row.ETA_2_DAYS),
    eta1: blankDateTime(row.ETA_1_DAYS),
    actualArrival: blankDateTime(row.ACTUAL_ARRIVAL),
    norTendered: blankDateTime(row.NOR_TENDERED),
  };
}

/** PHP sof.php "DAILY QTY" block (sof_slave_5), falls back to AGENT copy. */
async function loadDailyQty(pool, comId, portType, portId, randomId) {
  const params = [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId];
  const [internalRows] = await pool.query(
    `SELECT * FROM sof_slave_5
     WHERE COMID = ? AND LOGIN = 'INTERNAL_USER' AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     ORDER BY SOFSLAVEID ASC`,
    params,
  ).catch(() => [[]]);

  let rows = internalRows;
  if (!rows?.length) {
    const [agentRows] = await pool.query(
      `SELECT * FROM sof_slave_5
       WHERE COMID = ? AND LOGIN = 'AGENT' AND MODULEID = ? AND MCOMPANYID = ?
         AND PORT = ? AND PORTID = ? AND RANDOMID = ?
       ORDER BY SOFSLAVEID ASC`,
      params,
    ).catch(() => [[]]);
    rows = agentRows;
  }
  if (!rows?.length) return [emptyDailyQtyRow()];

  return rows.map((row) => ({
    date: blankDate(row.PRE_DATE),
    engagementQty: row.ENGAGEMENT_QTY != null ? String(row.ENGAGEMENT_QTY) : '',
    loadLast: row.LOAD_LAST != null ? String(row.LOAD_LAST) : '',
    ttlLoad: row.TTL_LOAD != null ? String(row.TTL_LOAD) : '',
    balance: row.BALANCE != null ? String(row.BALANCE) : '',
    etcd: blankDateTime(row.ETCD),
  }));
}

function parseUploads(upload) {
  return String(upload || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * PHP sof.php — Statement of Facts form for Ops VC.
 */
export async function dbGetSofForm(comId) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const [[compare]] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, c.FCAID, m.VESSEL_IMO_ID, vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [comId, MODULE_ID],
  );

  if (!compare?.COMID) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }

  const fcaId = await getLatestCostSheetId(pool, comId) || compare.FCAID;
  const [[master]] = await pool.query(
    `SELECT VOYAGE_NO, CARGO_ID, FCAID, VESSEL_IMO_ID, CP_DATE, SHEET_NO,
            FIXTURETYPEID, SEL_BUSI_TYPE
     FROM freight_cost_estimete_master
     WHERE FCAID = ?
     LIMIT 1`,
    [fcaId],
  );

  let cargo = [];
  if (master?.CARGO_ID) {
    const ids = String(master.CARGO_ID)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && part !== '0');
    if (ids.length) {
      const [cargoRows] = await pool.query(
        `SELECT MATERIAL_TYPE FROM cargo_master WHERE MATERIALID IN (?)`,
        [ids],
      ).catch(() => [[]]);
      cargo = (cargoRows || []).map((row) => row.MATERIAL_TYPE).filter(Boolean);
    }
  }

  const vesselName = compare.VESSEL_NAME || '';
  const voyageNo = master?.VOYAGE_NO || '';
  let costSheetId = '';
  const sheetNo = master?.SHEET_NO;
  if (sheetNo != null && sheetNo !== '' && Number(sheetNo) !== 0) {
    costSheetId = String(sheetNo);
  } else {
    const [[named]] = await pool.query(
      `SELECT COST_SHEETID FROM cost_sheet_name_master
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       ORDER BY COST_SHEETID DESC
       LIMIT 1`,
      [comId, MODULE_ID, COMPANY_ID],
    ).catch(() => [[null]]);
    if (named?.COST_SHEETID) costSheetId = String(named.COST_SHEETID);
  }
  let cpDate = '';
  if (master?.CP_DATE) {
    const raw = master.CP_DATE instanceof Date ? master.CP_DATE : new Date(master.CP_DATE);
    if (!Number.isNaN(raw.getTime()) && raw.getFullYear() > 1970) {
      const d = String(raw.getDate()).padStart(2, '0');
      const m = String(raw.getMonth() + 1).padStart(2, '0');
      const y = raw.getFullYear();
      cpDate = `${d}-${m}-${y}`;
    }
  }
  const vesselParticulars = await loadVesselParticulars(pool, fcaId);
  const portTabs = await loadPortTabs(pool, fcaId);

  const ports = [];
  for (const tab of portTabs) {
    const record = await loadSofRecord(pool, comId, tab.portType, tab.portId, tab.randomId);
    const sofId = record?.SOFID || null;
    const submitId = record?.SUBMITID != null ? Number(record.SUBMITID) : 0;
    const locked = submitId === 2 && String(record?.LOGIN || '') === 'INTERNAL_USER';
    let keyOperations = await loadKeyOperations(pool, sofId, tab.defaults);
    keyOperations = applyMasterToKeyOperations(keyOperations, record);
    const cargoRows = await loadCargoRows(pool, sofId);
    const entityRows = await loadEntityRows(pool, sofId);
    const blRows = await loadBlRows(pool, sofId);
    const portActivities = await loadPortActivities(pool, sofId);
    const preArrival = await loadPreArrival(pool, comId, tab.portType, tab.portId, tab.randomId);
    const dailyQty = await loadDailyQty(pool, comId, tab.portType, tab.portId, tab.randomId);
    const laytime = await loadLaytimeDeductions(pool, comId, tab.portType, tab.portId, tab.randomId);
    const operation = tab.portType === 'LP'
      ? 'Loading'
      : tab.portType === 'DP'
        ? 'Discharging'
        : 'Transit';

    ports.push({
      key: `${tab.portType}-${tab.portId}-${tab.randomId}`,
      tabLabel: `${tab.portType}-${tab.portName}`,
      portType: tab.portType,
      portId: tab.portId,
      portName: tab.portName,
      randomId: tab.randomId,
      operation,
      sofId: sofId != null ? String(sofId) : '',
      terminal: str(record?.TERMINAL),
      submitId,
      locked,
      canEdit: !locked,
      uploads: parseUploads(record?.UPLOAD),
      stowageQty: str(record?.VA_1),
      vesselArrived: str(record?.VAPS_1),
      norTendered: str(record?.NT_1),
      pilotOnBoard: str(record?.PBFB_1),
      loadCommenced: str(record?.LC),
      loadCompleted: str(record?.LC1),
      vesselSailed: str(record?.VS),
      agentRemarks: str(record?.SHIPPER_REMARKS),
      entityRows,
      blRows,
      portActivities,
      preArrival,
      dailyQty,
      keyOperations,
      cargoRows,
      deductions: laytime.deductions,
      laytimeId: laytime.laytimeId,
      laytimeLocked: laytime.laytimeLocked,
    });
  }

  const fixtureTypeRaw = Number(master?.FIXTURETYPEID || master?.SEL_BUSI_TYPE || 0);

  return {
    comId: String(comId),
    fcaId: fcaId != null ? String(fcaId) : '',
    costSheetId,
    voyageNo,
    vesselName,
    fixtureTypeId: fixtureTypeRaw ? String(fixtureTypeRaw) : '',
    cpDate,
    message: compare.MESSAGE || '',
    cargo,
    vesselParticulars,
    estimateType: vesselParticulars.estimateType,
    ports,
  };
}

async function replaceKeyOperationRows(connection, sofId, keyOperations) {
  await connection.query(`DELETE FROM sof_slave_6 WHERE SOFID = ?`, [sofId]);

  const hasToColumn = await ensureSofActivityDateTimeToColumn(connection);

  for (const row of keyOperations || []) {
    const activity = String(row.activity || '').trim();
    if (!activity) continue;
    const activityDateTime = parseDmyDateTime(row.activityDateTime);
    const activityDateTimeTo = parseDmyDateTime(row.activityDateTimeTo);
    if (hasToColumn) {
      await connection.query(
        `INSERT INTO sof_slave_6
          (SOFID, ACTIVITY, ACTIVITYDATETIME, ACTIVITYDATETIMETO, ROBIFO, ROBMDO, COMMENTS, TDEFAULT)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sofId,
          activity,
          activityDateTime,
          activityDateTimeTo,
          numOrNull(row.robIfo),
          numOrNull(row.robMdo),
          str(row.comments),
          Number(row.tDefault) === 1 ? 1 : 0,
        ],
      );
    } else {
      await connection.query(
        `INSERT INTO sof_slave_6
          (SOFID, ACTIVITY, ACTIVITYDATETIME, ROBIFO, ROBMDO, COMMENTS, TDEFAULT)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sofId,
          activity,
          activityDateTime,
          numOrNull(row.robIfo),
          numOrNull(row.robMdo),
          str(row.comments),
          Number(row.tDefault) === 1 ? 1 : 0,
        ],
      );
    }
  }
}

async function replaceCargoRows(connection, sofId, cargoRows) {
  await connection.query(`DELETE FROM sof_slave_7 WHERE SOFID = ?`, [sofId]);

  for (const row of cargoRows || []) {
    const activity = String(row.activity || '').trim();
    if (!activity) continue;
    await connection.query(
      `INSERT INTO sof_slave_7
        (SOFID, ACTIVITY, SHIPFIGURE, BLFIGURE, WATERDENSITY, REMARKS, TDEFAULT)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sofId,
        activity,
        numOrNull(row.shipFigure),
        numOrNull(row.blFigure),
        numOrNull(row.waterDensity),
        str(row.remarks),
        Number(row.tDefault) === 1 ? 1 : 0,
      ],
    );
  }
}

/** PHP sof.php items 17+ persistence (sof_slave_3). */
async function replaceEntityRows(connection, sofId, entityRows) {
  await connection.query(`DELETE FROM sof_slave_3 WHERE SOFID = ?`, [sofId]);
  for (const row of entityRows || []) {
    const name = String(row.name || '').trim();
    const value = String(row.value || '').trim();
    if (!name && !value) continue;
    await connection.query(
      `INSERT INTO sof_slave_3 (SOFID, ENTITY_NAME, ENTITY_VALUE) VALUES (?, ?, ?)`,
      [sofId, name, value],
    );
  }
}

/** PHP sof.php BL table persistence (sof_slave_1). */
async function replaceBlRows(connection, sofId, blRows) {
  await connection.query(`DELETE FROM sof_slave_1 WHERE SOFID = ?`, [sofId]);
  for (const row of blRows || []) {
    const blDate = parseDmyDate(row.blDate);
    const cargo = String(row.cargo || '').trim();
    const blQty = numOrNull(row.blQty);
    if (!blDate && !cargo && blQty == null) continue;
    await connection.query(
      `INSERT INTO sof_slave_1 (SOFID, BL_DATE, BL_QTY, CARGO) VALUES (?, ?, ?, ?)`,
      [sofId, blDate, blQty, cargo],
    );
  }
}

/** PHP sof.php "Activity in Port" persistence (sof_slave WHERE GROUP_NAME='1'). */
async function replacePortActivities(connection, sofId, rows) {
  await connection.query(`DELETE FROM sof_slave WHERE SOFID = ? AND GROUP_NAME = '1'`, [sofId]);
  for (const row of rows || []) {
    const activity = String(row.activity || '').trim();
    const from = parseDmyDateTime(row.from);
    const to = parseDmyDateTime(row.to);
    const notes = String(row.notes || '').trim();
    const layTimeCount = row.layTimeCount === true || Number(row.layTimeCount) === 1 ? 1 : 0;
    const portTimeCount = row.portTimeCount === true || Number(row.portTimeCount) === 1 ? 1 : 0;
    if (!activity && !from && !to && !notes && !layTimeCount && !portTimeCount) continue;
    await connection.query(
      `INSERT INTO sof_slave
        (SOFID, ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, LAY_TIME_COUNT, PORT_TIME_COUNT, NOTES, GROUP_NAME)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1')`,
      [sofId, activity, from, to, str(row.duration), layTimeCount, portTimeCount, notes],
    );
  }
}

async function replaceLaytimeDeductions(connection, laytimeId, rows) {
  await connection.query(`DELETE FROM laytime_slave1 WHERE LAYTIME_ID = ?`, [laytimeId]);
  for (const row of rows || []) {
    const activity = String(row.activity || '').trim();
    const start = parseDmyDateTime(row.start);
    const end = parseDmyDateTime(row.end);
    const notes = String(row.notes || '').trim();
    await connection.query(
      `INSERT INTO laytime_slave1
        (LAYTIME_ID, ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, LT_PARTIAL, CUMMULATIVE_TIME, NOTES)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [laytimeId, activity, start, end, str(row.duration), strOrNull(row.ltPartial), str(row.cumulative), notes],
    ).catch(async () => {
      await connection.query(
        `INSERT INTO laytime_slave1
          (LAYTIME_ID, ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, NOTES)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [laytimeId, activity, start, end, str(row.duration), notes],
      );
    });
  }
}

/** PHP sof.php "PRE ARRIVAL & OTHER" persistence (sof_slave_4), keyed incl. RANDOMID. */
async function upsertPreArrival(connection, { comId, portType, portId, randomId, preArrival }) {
  const p = preArrival || {};
  const cargoDecl = p.cargoDecl ? 1 : 0;
  const stowPlanQty = numOrNull(p.stowPlanQty);
  const spDeptDraft = strOrNull(p.spDeptDraft);
  const spArrDraft = strOrNull(p.spArrDraft);
  const eta = {
    ETA_30_DAYS: parseDmyDateTime(p.eta30),
    ETA_25_DAYS: parseDmyDateTime(p.eta25),
    ETA_20_DAYS: parseDmyDateTime(p.eta20),
    ETA_15_DAYS: parseDmyDateTime(p.eta15),
    ETA_10_DAYS: parseDmyDateTime(p.eta10),
    ETA_7_DAYS: parseDmyDateTime(p.eta7),
    ETA_5_DAYS: parseDmyDateTime(p.eta5),
    ETA_3_DAYS: parseDmyDateTime(p.eta3),
    ETA_2_DAYS: parseDmyDateTime(p.eta2),
    ETA_1_DAYS: parseDmyDateTime(p.eta1),
    ACTUAL_ARRIVAL: parseDmyDateTime(p.actualArrival),
    NOR_TENDERED: parseDmyDateTime(p.norTendered),
  };

  const [[existing]] = await connection.query(
    `SELECT SOFSLAVEID FROM sof_slave_4
     WHERE COMID = ? AND LOGIN = 'INTERNAL_USER' AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
  );

  if (existing) {
    await connection.query(
      `UPDATE sof_slave_4 SET
         CARGO_DECL = ?, STOW_PLAN_QTY = ?, SP_DEPT_DRAFT = ?, SP_ARR_DRAFT = ?,
         ETA_30_DAYS = ?, ETA_25_DAYS = ?, ETA_20_DAYS = ?, ETA_15_DAYS = ?, ETA_10_DAYS = ?,
         ETA_7_DAYS = ?, ETA_5_DAYS = ?, ETA_3_DAYS = ?, ETA_2_DAYS = ?, ETA_1_DAYS = ?,
         ACTUAL_ARRIVAL = ?, NOR_TENDERED = ?
       WHERE SOFSLAVEID = ?`,
      [
        cargoDecl, stowPlanQty, spDeptDraft, spArrDraft,
        eta.ETA_30_DAYS, eta.ETA_25_DAYS, eta.ETA_20_DAYS, eta.ETA_15_DAYS, eta.ETA_10_DAYS,
        eta.ETA_7_DAYS, eta.ETA_5_DAYS, eta.ETA_3_DAYS, eta.ETA_2_DAYS, eta.ETA_1_DAYS,
        eta.ACTUAL_ARRIVAL, eta.NOR_TENDERED, existing.SOFSLAVEID,
      ],
    );
  } else {
    await connection.query(
      `INSERT INTO sof_slave_4 (
         COMID, LOGIN, LOGINID, MODULEID, MCOMPANYID, PORT, PORTID,
         CARGO_DECL, STOW_PLAN_QTY, SP_DEPT_DRAFT, SP_ARR_DRAFT,
         ETA_30_DAYS, ETA_25_DAYS, ETA_20_DAYS, ETA_15_DAYS, ETA_10_DAYS,
         ETA_7_DAYS, ETA_5_DAYS, ETA_3_DAYS, ETA_2_DAYS, ETA_1_DAYS,
         ACTUAL_ARRIVAL, NOR_TENDERED, RANDOMID
       ) VALUES (?, 'INTERNAL_USER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        comId, appContext.userId || 0, MODULE_ID, COMPANY_ID, portType, portId,
        cargoDecl, stowPlanQty, spDeptDraft, spArrDraft,
        eta.ETA_30_DAYS, eta.ETA_25_DAYS, eta.ETA_20_DAYS, eta.ETA_15_DAYS, eta.ETA_10_DAYS,
        eta.ETA_7_DAYS, eta.ETA_5_DAYS, eta.ETA_3_DAYS, eta.ETA_2_DAYS, eta.ETA_1_DAYS,
        eta.ACTUAL_ARRIVAL, eta.NOR_TENDERED, randomId,
      ],
    );
  }
}

/** PHP sof.php "DAILY QTY" persistence (sof_slave_5), keyed incl. RANDOMID. */
async function replaceDailyQty(connection, {
  comId, portType, portId, randomId, dailyQty,
}) {
  await connection.query(
    `DELETE FROM sof_slave_5
     WHERE COMID = ? AND LOGIN = 'INTERNAL_USER' AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?`,
    [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
  );
  for (const row of dailyQty || []) {
    const date = parseDmyDate(row.date);
    const engagementQty = numOrNull(row.engagementQty);
    const loadLast = numOrNull(row.loadLast);
    const ttlLoad = numOrNull(row.ttlLoad);
    const balance = numOrNull(row.balance);
    const etcd = parseDmyDateTime(row.etcd);
    if (!date && engagementQty == null && loadLast == null && ttlLoad == null && balance == null && !etcd) continue;
    await connection.query(
      `INSERT INTO sof_slave_5 (
         COMID, LOGIN, LOGINID, MODULEID, MCOMPANYID, PORT, PORTID,
         PRE_DATE, ENGAGEMENT_QTY, LOAD_LAST, TTL_LOAD, BALANCE, ETCD, RANDOMID
       ) VALUES (?, 'INTERNAL_USER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        comId, appContext.userId || 0, MODULE_ID, COMPANY_ID, portType, portId,
        date, engagementQty, loadLast, ttlLoad, balance, etcd, randomId,
      ],
    );
  }
}

/**
 * Resolve which master fields and child collections should be written on SOF save.
 * Any omitted optional field/collection preserves existing database state instead of wiping it.
 */
export function resolveSofSavePlan(payload = {}, existing = null) {
  const hasKeyOperations = Array.isArray(payload.keyOperations);
  const hasCargoRows = Array.isArray(payload.cargoRows);
  const keyOperations = hasKeyOperations ? payload.keyOperations : [];
  const cargoRows = hasCargoRows ? payload.cargoRows : [];
  const derived = deriveMasterFieldsFromKeyOperations(keyOperations, cargoRows, payload);

  const terminal = payload.terminal !== undefined
    ? derived.terminal
    : str(existing?.TERMINAL);
  const stowageQty = (payload.stowageQty !== undefined || hasCargoRows)
    ? derived.stowageQty
    : (existing?.VA_1 ?? null);
  const vesselArrived = (payload.vesselArrived !== undefined || hasKeyOperations)
    ? derived.vesselArrived
    : (existing?.VAPS_1 ?? null);
  const norTendered = (payload.norTendered !== undefined || hasKeyOperations)
    ? derived.norTendered
    : (existing?.NT_1 ?? null);
  const pilotOnBoard = (payload.pilotOnBoard !== undefined || hasKeyOperations)
    ? derived.pilotOnBoard
    : (existing?.PBFB_1 ?? null);
  const loadCommenced = (payload.loadCommenced !== undefined || hasKeyOperations)
    ? derived.loadCommenced
    : (existing?.LC ?? null);
  const loadCompleted = (payload.loadCompleted !== undefined || hasKeyOperations)
    ? derived.loadCompleted
    : (existing?.LC1 ?? null);
  const vesselSailed = (payload.vesselSailed !== undefined || hasKeyOperations)
    ? derived.vesselSailed
    : (existing?.VS ?? null);
  const agentRemarks = payload.agentRemarks !== undefined
    ? str(payload.agentRemarks)
    : str(existing?.SHIPPER_REMARKS);

  const keepFiles = Array.isArray(payload.keepFiles)
    ? payload.keepFiles.map(str).filter(Boolean)
    : null;
  const appendFiles = Array.isArray(payload.appendFiles)
    ? payload.appendFiles.map(str).filter(Boolean)
    : [];
  const existingUploads = str(existing?.UPLOAD || '').split(',').map((name) => name.trim()).filter(Boolean);
  const upload = keepFiles != null
    ? keepFiles.join(',')
    : [...existingUploads, ...appendFiles].join(',');

  const hasPreArrival = Boolean(
    payload.preArrival
    && typeof payload.preArrival === 'object'
    && !Array.isArray(payload.preArrival),
  );

  return {
    master: {
      terminal,
      stowageQty,
      vesselArrived,
      norTendered,
      pilotOnBoard,
      loadCommenced,
      loadCompleted,
      vesselSailed,
      agentRemarks,
      upload,
    },
    replaceKeyOperations: hasKeyOperations,
    keyOperations,
    replaceCargoRows: hasCargoRows,
    cargoRows,
    replaceEntityRows: Array.isArray(payload.entityRows),
    entityRows: Array.isArray(payload.entityRows) ? payload.entityRows : [],
    replaceBlRows: Array.isArray(payload.blRows),
    blRows: Array.isArray(payload.blRows) ? payload.blRows : [],
    replacePortActivities: Array.isArray(payload.portActivities),
    portActivities: Array.isArray(payload.portActivities) ? payload.portActivities : [],
    upsertPreArrival: hasPreArrival,
    preArrival: hasPreArrival ? payload.preArrival : null,
    replaceDailyQty: Array.isArray(payload.dailyQty),
    dailyQty: Array.isArray(payload.dailyQty) ? payload.dailyQty : [],
  };
}

/**
 * PHP updationSOFRecords — sof_master (items 9-16 + remarks) + slave_1/3/4/5/6/(slave GROUP_NAME=1)/7.
 * UPLOAD list is preserved / filtered by keepFiles; new files are merged in the route handler.
 * Child collections are only replaced when explicitly provided in payload.
 */
export async function dbSaveSof(payload = {}) {
  const pool = getPool();
  const comId = payload.comId || payload.comid;
  const portType = str(payload.portType || payload.port);
  const portId = str(payload.portId || payload.portid);
  const randomId = str(payload.randomId || payload.randomid);
  const submitId = Number(payload.submitId || payload.submitid || 1);

  if (!comId || !portType || !portId || !randomId) {
    const error = new Error('comId, portType, portId and randomId are required.');
    error.status = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.query(
      `SELECT * FROM sof_master
       WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
         AND MODULEID = ? AND MCOMPANYID = ?
         AND PORT = ? AND PORTID = ? AND RANDOMID = ?
       LIMIT 1`,
      [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
    );

    if (existing && Number(existing.SUBMITID) === 2) {
      const error = new Error('This SOF is locked (Submit & Close).');
      error.status = 400;
      throw error;
    }

    const plan = resolveSofSavePlan(payload, existing || null);
    const {
      terminal,
      stowageQty,
      vesselArrived,
      norTendered,
      pilotOnBoard,
      loadCommenced,
      loadCompleted,
      vesselSailed,
      agentRemarks,
      upload,
    } = plan.master;

    let sofId = existing?.SOFID;
    if (!sofId) {
      const [result] = await connection.query(
        `INSERT INTO sof_master (
           COMID, LOGIN, LOGINID, MODULEID, MCOMPANYID, PORT, PORTID,
           BL_DATE, LOADED_QTY, DISCH_QTY, BL_QTY_LOADED, SUBMITID,
           TERMINAL, VA_1, VAPS_1, NT_1, PBFB_1, LC, LC1, VS, SHIPPER_REMARKS,
           UPLOAD, RANDOMID
         ) VALUES (?, 'INTERNAL_USER', ?, ?, ?, ?, ?, '1970-01-01', 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          comId,
          appContext.userId || 0,
          MODULE_ID,
          COMPANY_ID,
          portType,
          portId,
          submitId,
          terminal,
          stowageQty,
          vesselArrived,
          norTendered,
          pilotOnBoard,
          loadCommenced,
          loadCompleted,
          vesselSailed,
          agentRemarks,
          upload,
          randomId,
        ],
      );
      sofId = result.insertId;
      if (!sofId) {
        const [[maxRow]] = await connection.query(
          `SELECT MAX(SOFID) AS maxId FROM sof_master
           WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
             AND PORT = ? AND PORTID = ? AND RANDOMID = ?`,
          [comId, portType, portId, randomId],
        );
        sofId = maxRow?.maxId;
      }
    } else {
      await connection.query(
        `UPDATE sof_master
         SET TERMINAL = ?, VA_1 = ?, VAPS_1 = ?, NT_1 = ?, PBFB_1 = ?, LC = ?, LC1 = ?, VS = ?,
             SHIPPER_REMARKS = ?, SUBMITID = ?, UPLOAD = ?
         WHERE SOFID = ?`,
        [
          terminal, stowageQty, vesselArrived, norTendered, pilotOnBoard,
          loadCommenced, loadCompleted, vesselSailed, agentRemarks, submitId, upload, sofId,
        ],
      );
    }

    if (plan.replaceEntityRows) {
      await replaceEntityRows(connection, sofId, plan.entityRows);
    }
    if (plan.replaceBlRows) {
      await replaceBlRows(connection, sofId, plan.blRows);
    }
    if (plan.replacePortActivities) {
      await replacePortActivities(connection, sofId, plan.portActivities);
    }
    if (plan.upsertPreArrival) {
      await upsertPreArrival(connection, {
        comId, portType, portId, randomId, preArrival: plan.preArrival,
      });
    }
    if (plan.replaceDailyQty) {
      await replaceDailyQty(connection, {
        comId, portType, portId, randomId, dailyQty: plan.dailyQty,
      });
    }
    if (plan.replaceKeyOperations) {
      await replaceKeyOperationRows(connection, sofId, plan.keyOperations);
    }
    if (plan.replaceCargoRows) {
      await replaceCargoRows(connection, sofId, plan.cargoRows);
    }
    if (Array.isArray(payload.deductions)) {
      const [[laytime]] = await connection.query(
        `SELECT LAYTIME_ID, SUBMITID FROM laytime_master
         WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
           AND MODULEID = ? AND MCOMPANYID = ?
           AND PORT = ? AND PORTID = ? AND RANDOMID = ?
         LIMIT 1 FOR UPDATE`,
        [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
      );

      if (laytime && Number(laytime.SUBMITID) === 5) {
        const error = new Error('This Laytime is locked (Submit & Close).');
        error.status = 400;
        throw error;
      }

      const deductionRows = payload.deductions.filter((row) => (
        String(row?.activity || '').trim()
        || String(row?.start || '').trim()
        || String(row?.end || '').trim()
        || String(row?.notes || '').trim()
      ));

      let laytimeId = laytime?.LAYTIME_ID;
      if (!laytimeId && deductionRows.length) {
        const [result] = await connection.query(
          `INSERT INTO laytime_master
            (COMID, LOGIN, LOGINID, MODULEID, MCOMPANYID, PORT, PORTID, RANDOMID,
             TERMINAL, STOWAGE_QTY, VESSEL_ARRIVED, NOR_TENDERED, PILOT_ON_BOARD,
             LOAD_DIS_COMMENCED, LOAD_DIS_COMPLETED, VESSEL_SAILED, SOF_LOADPORTID, SUBMITID)
           VALUES (?, 'INTERNAL_USER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            comId, appContext.userId || 0, MODULE_ID, COMPANY_ID, portType, portId, randomId,
            terminal, stowageQty, vesselArrived, norTendered, pilotOnBoard,
            loadCommenced, loadCompleted, vesselSailed, sofId,
          ],
        );
        laytimeId = result.insertId;
      }

      if (laytimeId) {
        await replaceLaytimeDeductions(connection, laytimeId, deductionRows);
      }
    }
    await connection.commit();

    return {
      msg: 0,
      sofId: String(sofId),
      submitId,
      closed: submitId === 2,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export { isRobActivity, isRemarksCargoActivity };
