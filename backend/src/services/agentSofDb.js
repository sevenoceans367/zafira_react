import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function blankDateTime(value) {
  if (!value) return '';
  const text = String(value);
  if (text.startsWith('0000-00-00') || text.includes('1970-01-01')) return '';
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
  const text = String(value);
  if (text.startsWith('0000-00-00') || text.includes('1970-01-01')) return '';
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

function shortPortName(name) {
  const text = String(name || '').trim();
  if (!text) return '';
  return text.split('/')[0].trim() || text;
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

function emptyDailyQtyRow() {
  return {
    date: '',
    engagementQty: '',
    loadLast: '',
    ttlLoad: '',
    balance: '',
    etcd: '',
  };
}

function emptyBlRow() {
  return { blDate: '', cargo: '', blQty: '' };
}

function emptyPortActivityRow() {
  return { activity: '', from: '', to: '', duration: '', notes: '' };
}

function emptyEntityRow() {
  return { name: '', value: '' };
}

function parseUploads(upload) {
  return String(upload || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function durationHours(from, to) {
  const a = parseDmyDateTime(from);
  const b = parseDmyDateTime(to);
  if (!a || !b) return '0.0';
  const start = new Date(a.replace(' ', 'T'));
  const end = new Date(b.replace(' ', 'T'));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '0.0';
  const hours = (end - start) / 3600000;
  if (!Number.isFinite(hours)) return '0.0';
  return hours.toFixed(4);
}

async function getCountryName(pool, countryId) {
  if (countryId == null || String(countryId).trim() === '') return '';
  const [[row]] = await pool.query(
    'SELECT COUNTRY_NAME FROM country_master WHERE COUNTRYID = ? LIMIT 1',
    [countryId],
  ).catch(() => [[null]]);
  return row?.COUNTRY_NAME || '';
}

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

async function loadAgentLetter(pool, genAgencyId) {
  const id = Number(genAgencyId);
  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error('Agent session is missing an agency letter.');
    error.status = 400;
    throw error;
  }
  const [[letter]] = await pool.query(
    'SELECT * FROM generate_agency_letter WHERE GEN_AGENCY_ID = ? LIMIT 1',
    [id],
  );
  if (!letter) {
    const error = new Error('Agency letter not found for this agent session.');
    error.status = 404;
    throw error;
  }
  return letter;
}

async function loadPreArrivalAgent(pool, letter) {
  const [[row]] = await pool.query(
    `SELECT * FROM sof_slave_4
     WHERE COMID = ? AND LOGIN = 'AGENT' AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     LIMIT 1`,
    [letter.COMID, letter.MODULEID || MODULE_ID, letter.MCOMPANYID || COMPANY_ID,
      letter.PORT, letter.PORTID, letter.RANDOMID],
  ).catch(() => [[null]]);
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

async function loadDailyQtyAgent(pool, letter) {
  const [rows] = await pool.query(
    `SELECT * FROM sof_slave_5
     WHERE COMID = ? AND LOGIN = 'AGENT' AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     ORDER BY SOFSLAVEID ASC`,
    [letter.COMID, letter.MODULEID || MODULE_ID, letter.MCOMPANYID || COMPANY_ID,
      letter.PORT, letter.PORTID, letter.RANDOMID],
  ).catch(() => [[]]);
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

/**
 * Agent portal SOF form — php/agent/postfixture-dry-out/sof.php (LOGIN='AGENT').
 */
export async function dbGetAgentSof(agentUser) {
  const pool = getPool();
  const letter = await loadAgentLetter(pool, agentUser?.genAgencyId ?? agentUser?.id);

  const [[compare]] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, c.FCAID, m.VESSEL_IMO_ID, m.VOYAGE_NO, vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COMID = ?
     ORDER BY c.FCAID DESC
     LIMIT 1`,
    [letter.COMID],
  ).catch(() => [[null]]);

  let fcaId = compare?.FCAID || null;
  if (!fcaId) {
    const [[m]] = await pool.query(
      `SELECT FCAID, VOYAGE_NO, VESSEL_IMO_ID FROM freight_cost_estimete_master
       WHERE COMID = ? ORDER BY FCAID DESC LIMIT 1`,
      [letter.COMID],
    ).catch(() => [[null]]);
    fcaId = m?.FCAID || null;
  }

  const vessel = fcaId
    ? await loadVesselParticulars(pool, fcaId)
    : {
      vesselName: compare?.VESSEL_NAME || '',
      built: '',
      grtNrt: '',
      flag: '',
      dwt: '',
      loaBeam: '',
      gearLabel: 'GEAR/GRABS',
      gearValue: '',
      hatchLabel: 'HATCH/HOLD',
      hatchValue: '',
    };

  const [[port]] = await pool.query(
    'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
    [letter.PORTID],
  ).catch(() => [[null]]);

  const portType = String(letter.PORT || '');
  const portName = shortPortName(port?.PortName) || `Port ${letter.PORTID || ''}`;
  const isLoadPort = portType === 'LP';

  const [[sof]] = await pool.query(
    `SELECT * FROM sof_master
     WHERE COMID = ? AND LOGIN = 'AGENT'
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     ORDER BY SOFID DESC
     LIMIT 1`,
    [letter.COMID, portType, letter.PORTID, letter.RANDOMID],
  ).catch(() => [[null]]);

  const sofId = sof?.SOFID || null;
  const submitId = sof?.SUBMITID != null ? Number(sof.SUBMITID) : 0;
  const locked = submitId === 2;

  let entityRows = [];
  let blRows = [emptyBlRow()];
  let portActivities = [emptyPortActivityRow()];
  if (sofId) {
    const [entities] = await pool.query(
      `SELECT ENTITY_NAME, ENTITY_VALUE FROM sof_slave_3 WHERE SOFID = ? ORDER BY SOF_SLAVEID ASC`,
      [sofId],
    ).catch(() => [[]]);
    entityRows = (entities || []).map((row) => ({
      name: str(row.ENTITY_NAME),
      value: str(row.ENTITY_VALUE),
    }));

    const [bls] = await pool.query(
      `SELECT BL_DATE, CARGO, BL_QTY FROM sof_slave_1 WHERE SOFID = ? ORDER BY SOF_SLAVEID ASC`,
      [sofId],
    ).catch(() => [[]]);
    if (bls?.length) {
      blRows = bls.map((row) => ({
        blDate: blankDate(row.BL_DATE),
        cargo: str(row.CARGO),
        blQty: row.BL_QTY != null ? String(row.BL_QTY) : '',
      }));
    }

    const [acts] = await pool.query(
      `SELECT ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, NOTES
       FROM sof_slave WHERE SOFID = ? AND GROUP_NAME = '1' ORDER BY SOF_SLAVEID ASC`,
      [sofId],
    ).catch(() => [[]]);
    if (acts?.length) {
      portActivities = acts.map((row) => ({
        activity: str(row.ACTIVITYID),
        from: blankDateTime(row.START_DATETIME),
        to: blankDateTime(row.FINISH_DATETIME),
        duration: str(row.DURATION),
        notes: str(row.NOTES),
      }));
    }
  }

  const preArrival = await loadPreArrivalAgent(pool, letter);
  const dailyQty = await loadDailyQtyAgent(pool, letter);

  const vesselArrived = str(sof?.VAPS_1) || preArrival.actualArrival;
  const norTendered = str(sof?.NT_1) || preArrival.norTendered;

  return {
    genAgencyId: letter.GEN_AGENCY_ID,
    comId: letter.COMID,
    nomId: compare?.MESSAGE || '',
    voyageNo: compare?.VOYAGE_NO || '',
    portType,
    portId: letter.PORTID != null ? String(letter.PORTID) : '',
    randomId: letter.RANDOMID != null ? String(letter.RANDOMID) : '',
    portName,
    title: isLoadPort
      ? `SOF - Load Port - ${portName}`
      : `SOF - Discharge Port - ${portName}`,
    labels: {
      cargoDecl: isLoadPort ? 'CARGO DECL.SIGN MASTER' : 'BL MANIFEST',
      stowPlanQty: isLoadPort ? 'STOW PLAN QTY' : 'BL QUANTITY',
      deptDraft: isLoadPort ? 'SP DEP DRAFT' : 'ARR DRAFT',
      arrDraft: isLoadPort ? 'SP ARR DRAFT' : 'DEP DRAFT',
      loadLast: isLoadPort ? 'LOADED LAST 24 HRS (MT)' : 'DISCHARGED LAST 24 HRS (MT)',
      ttlLoad: isLoadPort ? 'TOTAL LOADED THIS FAR (MT)' : 'TOTAL DISCHARGED THIS FAR (MT)',
    },
    vessel,
    sofId: sofId != null ? String(sofId) : '',
    submitId,
    locked,
    canEdit: !locked,
    uploads: parseUploads(sof?.UPLOAD),
    terminal: str(sof?.TERMINAL),
    stowageQty: str(sof?.VA_1),
    vesselArrived,
    norTendered,
    pilotOnBoard: str(sof?.PBFB_1),
    loadCommenced: str(sof?.LC),
    loadCompleted: str(sof?.LC1),
    vesselSailed: str(sof?.VS),
    agentRemarks: str(sof?.SHIPPER_REMARKS),
    entityRows,
    blRows,
    portActivities,
    preArrival,
    dailyQty,
  };
}

async function upsertPreArrivalAgent(connection, {
  letter, loginId, preArrival, dailyQty,
}) {
  const p = preArrival || {};
  const moduleId = letter.MODULEID || MODULE_ID;
  const companyId = letter.MCOMPANYID || COMPANY_ID;
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
     WHERE COMID = ? AND LOGIN = 'AGENT' AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     LIMIT 1`,
    [letter.COMID, moduleId, companyId, letter.PORT, letter.PORTID, letter.RANDOMID],
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
       ) VALUES (?, 'AGENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        letter.COMID, loginId, moduleId, companyId, letter.PORT, letter.PORTID,
        cargoDecl, stowPlanQty, spDeptDraft, spArrDraft,
        eta.ETA_30_DAYS, eta.ETA_25_DAYS, eta.ETA_20_DAYS, eta.ETA_15_DAYS, eta.ETA_10_DAYS,
        eta.ETA_7_DAYS, eta.ETA_5_DAYS, eta.ETA_3_DAYS, eta.ETA_2_DAYS, eta.ETA_1_DAYS,
        eta.ACTUAL_ARRIVAL, eta.NOR_TENDERED, letter.RANDOMID,
      ],
    );
  }

  await connection.query(
    `DELETE FROM sof_slave_5
     WHERE COMID = ? AND LOGIN = 'AGENT' AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?`,
    [letter.COMID, moduleId, companyId, letter.PORT, letter.PORTID, letter.RANDOMID],
  );

  for (const row of dailyQty || []) {
    const date = parseDmyDate(row.date);
    const engagementQty = numOrNull(row.engagementQty);
    const loadLast = numOrNull(row.loadLast);
    const ttlLoad = numOrNull(row.ttlLoad);
    const balance = numOrNull(row.balance);
    const etcd = parseDmyDateTime(row.etcd);
    if (!date && engagementQty == null && loadLast == null && ttlLoad == null && balance == null && !etcd) {
      continue;
    }
    await connection.query(
      `INSERT INTO sof_slave_5 (
         COMID, LOGIN, LOGINID, MODULEID, MCOMPANYID, PORT, PORTID,
         PRE_DATE, ENGAGEMENT_QTY, LOAD_LAST, TTL_LOAD, BALANCE, ETCD, RANDOMID
       ) VALUES (?, 'AGENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        letter.COMID, loginId, moduleId, companyId, letter.PORT, letter.PORTID,
        date, engagementQty, loadLast, ttlLoad, balance, etcd, letter.RANDOMID,
      ],
    );
  }
}

/** PHP insertPreArrivalDetails — Pre Arrival & Other + Daily Qty. */
export async function dbSaveAgentPreArrival(agentUser, payload = {}) {
  const pool = getPool();
  const letter = await loadAgentLetter(pool, agentUser?.genAgencyId ?? agentUser?.id);
  const loginId = letter.GEN_AGENCY_ID;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await upsertPreArrivalAgent(connection, {
      letter,
      loginId,
      preArrival: payload.preArrival || {},
      dailyQty: payload.dailyQty || [],
    });
    await connection.commit();
    return { msg: 2, ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** PHP updationSOFRecords — main SOF tab (LOGIN='AGENT'). */
export async function dbSaveAgentSof(agentUser, payload = {}) {
  const pool = getPool();
  const letter = await loadAgentLetter(pool, agentUser?.genAgencyId ?? agentUser?.id);
  const loginId = letter.GEN_AGENCY_ID;
  const moduleId = letter.MODULEID || MODULE_ID;
  const companyId = letter.MCOMPANYID || COMPANY_ID;
  const submitId = Number(payload.submitId || 1);
  const portType = String(letter.PORT || '');
  const portId = letter.PORTID;
  const randomId = letter.RANDOMID;

  const terminal = str(payload.terminal);
  const stowageQty = str(payload.stowageQty);
  const vesselArrived = str(payload.vesselArrived);
  const norTendered = str(payload.norTendered);
  const pilotOnBoard = str(payload.pilotOnBoard);
  const loadCommenced = str(payload.loadCommenced);
  const loadCompleted = str(payload.loadCompleted);
  const vesselSailed = str(payload.vesselSailed);
  const agentRemarks = str(payload.agentRemarks);
  const entityRows = payload.entityRows || [];
  const blRows = payload.blRows || [];
  const portActivities = (payload.portActivities || []).map((row) => ({
    ...row,
    duration: row.duration || durationHours(row.from, row.to),
  }));
  const keepFiles = Array.isArray(payload.keepFiles)
    ? payload.keepFiles.map(str).filter(Boolean)
    : null;

  if (submitId === 2) {
    const required = [stowageQty, vesselArrived, norTendered, loadCommenced, loadCompleted, vesselSailed];
    if (required.some((v) => !String(v || '').trim())) {
      const error = new Error(
        'Please fill the STOWAGE PLAN QUANTITY, VESSEL ARRIVED, NOR TENDERED, LOAD/DISCH COMMENCED, LOAD/DISCH COMPLETED & VESSEL SAILED.',
      );
      error.status = 400;
      throw error;
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.query(
      `SELECT * FROM sof_master
       WHERE COMID = ? AND LOGIN = 'AGENT' AND MODULEID = ? AND MCOMPANYID = ?
         AND PORT = ? AND PORTID = ? AND RANDOMID = ?
       LIMIT 1`,
      [letter.COMID, moduleId, companyId, portType, portId, randomId],
    );

    if (existing && Number(existing.SUBMITID) === 2) {
      const error = new Error('This SOF is locked (Submit & Close).');
      error.status = 400;
      throw error;
    }

    const upload = keepFiles != null
      ? keepFiles.join(',')
      : str(existing?.UPLOAD || '');

    const firstBl = blRows.find((row) => row.blDate || row.blQty) || {};
    const blDate = parseDmyDate(firstBl.blDate) || '1970-01-01';
    const ttlBlQty = (blRows || []).reduce((sum, row) => sum + (Number(row.blQty) || 0), 0);

    let sofId = existing?.SOFID;
    if (!sofId) {
      const [result] = await connection.query(
        `INSERT INTO sof_master (
           COMID, LOGIN, LOGINID, MODULEID, MCOMPANYID, PORT, PORTID,
           BL_DATE, LOADED_QTY, DISCH_QTY, BL_QTY_LOADED, SUBMITID,
           TERMINAL, VA_1, VAPS_1, NT_1, PBFB_1, LC, LC1, VS, SHIPPER_REMARKS,
           UPLOAD, RANDOMID
         ) VALUES (?, 'AGENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          letter.COMID,
          loginId,
          moduleId,
          companyId,
          portType,
          portId,
          blDate,
          portType === 'LP' ? ttlBlQty : 0,
          portType === 'DP' ? ttlBlQty : 0,
          ttlBlQty,
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
    } else {
      await connection.query(
        `UPDATE sof_master
         SET TERMINAL = ?, VA_1 = ?, VAPS_1 = ?, NT_1 = ?, PBFB_1 = ?, LC = ?, LC1 = ?, VS = ?,
             SHIPPER_REMARKS = ?, SUBMITID = ?, UPLOAD = ?,
             BL_DATE = ?, BL_QTY_LOADED = ?,
             LOADED_QTY = ?, DISCH_QTY = ?
         WHERE SOFID = ?`,
        [
          terminal, stowageQty, vesselArrived, norTendered, pilotOnBoard,
          loadCommenced, loadCompleted, vesselSailed, agentRemarks, submitId, upload,
          blDate, ttlBlQty,
          portType === 'LP' ? ttlBlQty : 0,
          portType === 'DP' ? ttlBlQty : 0,
          sofId,
        ],
      );
    }

    await connection.query('DELETE FROM sof_slave_3 WHERE SOFID = ?', [sofId]);
    for (const row of entityRows) {
      const name = String(row.name || '').trim();
      const value = String(row.value || '').trim();
      if (!name && !value) continue;
      await connection.query(
        'INSERT INTO sof_slave_3 (SOFID, ENTITY_NAME, ENTITY_VALUE) VALUES (?, ?, ?)',
        [sofId, name, value],
      );
    }

    await connection.query('DELETE FROM sof_slave_1 WHERE SOFID = ?', [sofId]);
    for (const row of blRows) {
      const date = parseDmyDate(row.blDate);
      const cargo = String(row.cargo || '').trim();
      const blQty = numOrNull(row.blQty);
      if (!date && !cargo && blQty == null) continue;
      await connection.query(
        'INSERT INTO sof_slave_1 (SOFID, BL_DATE, BL_QTY, CARGO) VALUES (?, ?, ?, ?)',
        [sofId, date, blQty, cargo],
      );
    }

    await connection.query(
      `DELETE FROM sof_slave WHERE SOFID = ? AND GROUP_NAME = '1'`,
      [sofId],
    );
    for (const row of portActivities) {
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

    await connection.commit();
    return {
      msg: 0,
      ok: true,
      sofId: String(sofId),
      submitId,
      closed: submitId === 2,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
