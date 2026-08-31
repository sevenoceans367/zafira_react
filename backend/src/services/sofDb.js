import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

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

function numOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
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

function defaultKeyOperations(defaults = {}) {
  return DEFAULT_KEY_OPERATIONS.map((activity) => {
    const row = {
      activity,
      activityDateTime: '',
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
    activity: '', from: '', to: '', duration: '', notes: '',
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

async function loadKeyOperations(pool, sofId, defaults) {
  if (!sofId) return defaultKeyOperations(defaults);
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
    `SELECT ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, NOTES
     FROM sof_slave WHERE SOFID = ? AND GROUP_NAME = '1' ORDER BY SOF_SLAVEID ASC`,
    [sofId],
  ).catch(() => [[]]);
  if (!rows?.length) return [emptyPortActivityRow()];
  return rows.map((row) => ({
    activity: str(row.ACTIVITYID),
    from: blankDateTime(row.START_DATETIME),
    to: blankDateTime(row.FINISH_DATETIME),
    duration: str(row.DURATION),
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
    `SELECT VOYAGE_NO, CARGO_ID, FCAID, VESSEL_IMO_ID
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
  const vesselParticulars = await loadVesselParticulars(pool, fcaId);
  const portTabs = await loadPortTabs(pool, fcaId);

  const ports = [];
  for (const tab of portTabs) {
    const record = await loadSofRecord(pool, comId, tab.portType, tab.portId, tab.randomId);
    const sofId = record?.SOFID || null;
    const submitId = record?.SUBMITID != null ? Number(record.SUBMITID) : 0;
    const locked = submitId === 2 && String(record?.LOGIN || '') === 'INTERNAL_USER';
    const keyOperations = await loadKeyOperations(pool, sofId, tab.defaults);
    const cargoRows = await loadCargoRows(pool, sofId);
    const entityRows = await loadEntityRows(pool, sofId);
    const blRows = await loadBlRows(pool, sofId);
    const portActivities = await loadPortActivities(pool, sofId);
    const preArrival = await loadPreArrival(pool, comId, tab.portType, tab.portId, tab.randomId);
    const dailyQty = await loadDailyQty(pool, comId, tab.portType, tab.portId, tab.randomId);
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
    });
  }

  return {
    comId: String(comId),
    fcaId: fcaId != null ? String(fcaId) : '',
    voyageNo,
    vesselName,
    message: compare.MESSAGE || '',
    cargo,
    vesselParticulars,
    estimateType: vesselParticulars.estimateType,
    ports,
  };
}

async function replaceSlaveRows(connection, sofId, keyOperations, cargoRows) {
  await connection.query(`DELETE FROM sof_slave_6 WHERE SOFID = ?`, [sofId]);
  await connection.query(`DELETE FROM sof_slave_7 WHERE SOFID = ?`, [sofId]);

  for (const row of keyOperations || []) {
    const activity = String(row.activity || '').trim();
    if (!activity) continue;
    const activityDateTime = parseDmyDateTime(row.activityDateTime);
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
    if (!activity && !from && !to && !notes) continue;
    await connection.query(
      `INSERT INTO sof_slave
        (SOFID, ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, LAY_TIME_COUNT, PORT_TIME_COUNT, NOTES, GROUP_NAME)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, '1')`,
      [sofId, activity, from, to, str(row.duration), notes],
    );
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
 * PHP updationSOFRecords — sof_master (items 9-16 + remarks) + slave_1/3/4/5/6/(slave GROUP_NAME=1)/7.
 * UPLOAD list is preserved / filtered by keepFiles; new files are merged in the route handler.
 */
export async function dbSaveSof(payload = {}) {
  const pool = getPool();
  const comId = payload.comId || payload.comid;
  const portType = str(payload.portType || payload.port);
  const portId = str(payload.portId || payload.portid);
  const randomId = str(payload.randomId || payload.randomid);
  const submitId = Number(payload.submitId || payload.submitid || 1);
  const terminal = str(payload.terminal);
  const stowageQty = strOrNull(payload.stowageQty);
  const vesselArrived = strOrNull(payload.vesselArrived);
  const norTendered = strOrNull(payload.norTendered);
  const pilotOnBoard = strOrNull(payload.pilotOnBoard);
  const loadCommenced = strOrNull(payload.loadCommenced);
  const loadCompleted = strOrNull(payload.loadCompleted);
  const vesselSailed = strOrNull(payload.vesselSailed);
  const agentRemarks = str(payload.agentRemarks);
  const keyOperations = payload.keyOperations || [];
  const cargoRows = payload.cargoRows || [];
  const entityRows = payload.entityRows || [];
  const blRows = payload.blRows || [];
  const portActivities = payload.portActivities || [];
  const preArrival = payload.preArrival || {};
  const dailyQty = payload.dailyQty || [];
  const keepFiles = Array.isArray(payload.keepFiles) ? payload.keepFiles.map(str).filter(Boolean) : null;

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

    const upload = keepFiles != null
      ? keepFiles.join(',')
      : str(existing?.UPLOAD || '');

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

    await replaceEntityRows(connection, sofId, entityRows);
    await replaceBlRows(connection, sofId, blRows);
    await replacePortActivities(connection, sofId, portActivities);
    await upsertPreArrival(connection, {
      comId, portType, portId, randomId, preArrival,
    });
    await replaceDailyQty(connection, {
      comId, portType, portId, randomId, dailyQty,
    });
    await replaceSlaveRows(connection, sofId, keyOperations, cargoRows);
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
