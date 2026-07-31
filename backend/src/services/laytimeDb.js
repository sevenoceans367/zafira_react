import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function blankDateTime(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.startsWith('0000-00-00') || raw.includes('1970-01-01')) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) {
    // Already stored as display string (dd-mm-yyyy hh:mm)
    const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (dmy) return raw.trim();
    return '';
  }
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}-${m}-${y} ${hh}:${mm}`;
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

function isEmptyDateTime(value) {
  if (value == null) return true;
  const raw = String(value).trim();
  if (!raw || raw.startsWith('0000-00-00') || raw.includes('1970-01-01')) return true;
  return blankDateTime(value) === '' && !/^\d{1,2}-\d{1,2}-\d{4}/.test(raw);
}

function flag01(value, defaultValue = '0') {
  if (value == null || value === '') return defaultValue;
  return Number(value) === 1 || value === true || value === '1' ? '1' : '0';
}

function parseApprovers(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseUploads(attachments, attachmentNames) {
  const files = String(attachments || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const names = String(attachmentNames || '')
    .split(',')
    .map((part) => part.trim());
  return files.map((file, index) => ({
    file,
    name: names[index] || file,
  }));
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

export async function getLatestCostSheetId(pool, comId) {
  const [[row]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  );
  return row?.FCAID || null;
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

/** LP/DP ports from cost-sheet legs — aligned with agency-letter fallbacks (no PASSAGE_TYPE gate). */
async function loadPortTabs(pool, fcaId, comId = null) {
  const [legs] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, RANDOMID, LOAD_PORT_QTY, DISC_PORT_QTY,
            PORT_COSTLP_VENDOR, PORT_COSTDP_VENDOR,
            LOAD_PORT_COST, DISC_PORT_COST, PASSAGE_TYPE
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
     ORDER BY FCA_SLAVEID ASC`,
    [fcaId],
  ).catch(() => [[]]);

  const tabs = [];
  const seen = new Set();

  const pushTab = (tab) => {
    if (!tab?.portId) return;
    const key = `${tab.portType}-${tab.portId}-${tab.randomId}`;
    if (seen.has(key)) return;
    seen.add(key);
    tabs.push(tab);
  };

  const isTbnName = (name) => {
    const n = String(name || '').trim().toUpperCase();
    return !n || n === 'TBN' || n.startsWith('TBN ');
  };

  for (const leg of legs || []) {
    const fromName = await getPortName(pool, leg.FROM_PORT);
    const toName = await getPortName(pool, leg.TO_PORT);
    const fromIsTbn = isTbnName(fromName);
    const toIsTbn = isTbnName(toName);

    const hasLp = hasValue(leg.PORT_COSTLP_VENDOR)
      || Number(leg.LOAD_PORT_COST) > 0
      || Number(leg.LOAD_PORT_QTY) > 0;
    const hasDp = hasValue(leg.PORT_COSTDP_VENDOR)
      || Number(leg.DISC_PORT_COST) > 0
      || Number(leg.DISC_PORT_QTY) > 0;

    if (!fromIsTbn && hasLp) {
      pushTab({
        portType: 'LP',
        portId: str(leg.FROM_PORT),
        randomId: str(leg.RANDOMID || leg.FROM_PORT),
        portName: fromName,
        defaults: {
          loadedQty: leg.LOAD_PORT_QTY != null && leg.LOAD_PORT_QTY !== ''
            ? String(leg.LOAD_PORT_QTY)
            : '',
        },
      });
    }

    if (!toIsTbn && hasDp) {
      pushTab({
        portType: 'DP',
        portId: str(leg.TO_PORT),
        randomId: str(leg.RANDOMID || leg.TO_PORT),
        portName: toName,
        defaults: {
          loadedQty: leg.DISC_PORT_QTY != null && leg.DISC_PORT_QTY !== ''
            ? String(leg.DISC_PORT_QTY)
            : '',
        },
      });
    }

    // Last resort: any non-TBN from/to on the leg (agency-letter style).
    if (!hasLp && !hasDp) {
      if (!fromIsTbn && hasValue(leg.FROM_PORT)) {
        pushTab({
          portType: 'LP',
          portId: str(leg.FROM_PORT),
          randomId: str(leg.RANDOMID || leg.FROM_PORT),
          portName: fromName || str(leg.FROM_PORT),
          defaults: {
            loadedQty: leg.LOAD_PORT_QTY != null && leg.LOAD_PORT_QTY !== ''
              ? String(leg.LOAD_PORT_QTY)
              : '',
          },
        });
      }
      if (
        !toIsTbn
        && hasValue(leg.TO_PORT)
        && String(leg.TO_PORT) !== String(leg.FROM_PORT)
      ) {
        pushTab({
          portType: 'DP',
          portId: str(leg.TO_PORT),
          randomId: str(leg.RANDOMID || leg.TO_PORT),
          portName: toName || str(leg.TO_PORT),
          defaults: {
            loadedQty: leg.DISC_PORT_QTY != null && leg.DISC_PORT_QTY !== ''
              ? String(leg.DISC_PORT_QTY)
              : '',
          },
        });
      }
    }
  }

  // Keep tabs for ports already saved on this nomination (laytime / SOF).
  if (comId) {
    const [laytimeRows] = await pool.query(
      `SELECT PORT, PORTID, RANDOMID
       FROM laytime_master
       WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
         AND MODULEID = ? AND MCOMPANYID = ?
         AND PORT IN ('LP', 'DP')
       ORDER BY LAYTIME_ID ASC`,
      [comId, MODULE_ID, COMPANY_ID],
    ).catch(() => [[]]);

    for (const row of laytimeRows || []) {
      const portName = await getPortName(pool, row.PORTID);
      pushTab({
        portType: str(row.PORT),
        portId: str(row.PORTID),
        randomId: str(row.RANDOMID || row.PORTID),
        portName: portName || str(row.PORTID),
        defaults: { loadedQty: '' },
      });
    }

    const [sofRows] = await pool.query(
      `SELECT PORT, PORTID, RANDOMID
       FROM sof_master
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
         AND PORT IN ('LP', 'DP')
       ORDER BY SOFID ASC`,
      [comId, MODULE_ID, COMPANY_ID],
    ).catch(() => [[]]);

    for (const row of sofRows || []) {
      const portName = await getPortName(pool, row.PORTID);
      pushTab({
        portType: str(row.PORT),
        portId: str(row.PORTID),
        randomId: str(row.RANDOMID || row.PORTID),
        portName: portName || str(row.PORTID),
        defaults: { loadedQty: '' },
      });
    }
  }

  return tabs;
}

/** Same lookup as sofDb.loadSofRecord — seed source when no laytime row exists. */
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

async function loadLaytimeRecord(pool, comId, portType, portId, randomId) {
  const [[row]] = await pool.query(
    `SELECT * FROM laytime_master
     WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
       AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT = ? AND PORTID = ? AND RANDOMID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
  ).catch(() => [[null]]);
  return row || null;
}

function emptyActivity() {
  return {
    activity: '',
    start: '',
    end: '',
    duration: '',
    ltCounts: false,
    ltNoCounts: false,
    ltPartial: '',
    cumulative: '',
    notes: '',
  };
}

function emptyDeduction() {
  return {
    activity: '',
    start: '',
    end: '',
    duration: '',
    ltPartial: '',
    cumulative: '',
    notes: '',
  };
}

async function loadActivities(pool, laytimeId, sofId) {
  if (laytimeId) {
    const [rows] = await pool.query(
      `SELECT * FROM laytime_slave WHERE LAYTIME_ID = ?`,
      [laytimeId],
    ).catch(() => [[]]);
    if (rows?.length) {
      return rows.map((row) => ({
        activity: str(row.ACTIVITYID ?? row.ACTIVITY),
        start: blankDateTime(row.START_DATETIME),
        end: blankDateTime(row.FINISH_DATETIME),
        duration: str(row.DURATION),
        ltCounts: Number(row.LT_C) === 1,
        ltNoCounts: Number(row.LT_NC) === 1,
        ltPartial: str(row.LT_PARTIAL),
        cumulative: str(row.CUMMULATIVE_TIME),
        notes: str(row.NOTES),
      }));
    }
  }

  if (!sofId) return [emptyActivity()];

  const [sofRows] = await pool.query(
    `SELECT * FROM sof_slave_6
     WHERE SOFID = ?
       AND ACTIVITYDATETIME IS NOT NULL
       AND ACTIVITYDATETIME != '0000-00-00 00:00:00'
       AND ACTIVITYDATETIMETO IS NOT NULL
       AND ACTIVITYDATETIMETO != '0000-00-00 00:00:00'
     ORDER BY ACTIVITYDATETIME ASC`,
    [sofId],
  ).catch(() => [[]]);

  if (!sofRows?.length) return [emptyActivity()];
  return sofRows.map((row) => ({
    activity: str(row.ACTIVITY),
    start: blankDateTime(row.ACTIVITYDATETIME),
    end: blankDateTime(row.ACTIVITYDATETIMETO),
    duration: '',
    ltCounts: false,
    ltNoCounts: false,
    ltPartial: '',
    cumulative: '',
    notes: '',
  }));
}

async function loadDeductions(pool, laytimeId) {
  if (!laytimeId) return [emptyDeduction()];
  const [rows] = await pool.query(
    `SELECT * FROM laytime_slave1 WHERE LAYTIME_ID = ?`,
    [laytimeId],
  ).catch(() => [[]]);
  if (!rows?.length) return [emptyDeduction()];
  return rows.map((row) => ({
    activity: str(row.ACTIVITYID ?? row.ACTIVITY),
    start: blankDateTime(row.START_DATETIME),
    end: blankDateTime(row.FINISH_DATETIME),
    duration: str(row.DURATION),
    ltPartial: str(row.LT_PARTIAL),
    cumulative: str(row.CUMMULATIVE_TIME),
    notes: str(row.NOTES),
  }));
}

async function loadEntityRows(pool, laytimeId, sofId) {
  if (laytimeId) {
    const [rows] = await pool.query(
      `SELECT * FROM laytime_slave2 WHERE LAYTIME_ID = ?`,
      [laytimeId],
    ).catch(() => [[]]);
    if (rows?.length) {
      return rows.map((row) => ({
        name: str(row.ENTITY_NAME),
        value: blankDateTime(row.ENTITY_VALUE) || str(row.ENTITY_VALUE),
      }));
    }
  }

  if (!sofId) return [];

  const [sofRows] = await pool.query(
    `SELECT * FROM sof_slave_6
     WHERE SOFID = ?
       AND ACTIVITYDATETIME IS NOT NULL
       AND ACTIVITYDATETIME != '0000-00-00 00:00:00'
       AND (ACTIVITYDATETIMETO IS NULL
            OR ACTIVITYDATETIMETO = ''
            OR ACTIVITYDATETIMETO = '0000-00-00 00:00:00')
     ORDER BY ACTIVITYDATETIME ASC`,
    [sofId],
  ).catch(() => [[]]);

  return (sofRows || []).map((row) => ({
    name: str(row.ACTIVITY),
    value: blankDateTime(row.ACTIVITYDATETIME),
  }));
}

function mapMasterFields(record, sof, defaults = {}) {
  const hasLaytime = Boolean(record);
  return {
    terminal: hasLaytime ? str(record.TERMINAL) : str(sof?.TERMINAL),
    stowageQty: hasLaytime ? str(record.STOWAGE_QTY) : str(sof?.VA_1),
    vesselArrived: hasLaytime
      ? (blankDateTime(record.VESSEL_ARRIVED) || str(record.VESSEL_ARRIVED))
      : (blankDateTime(sof?.VAPS_1) || str(sof?.VAPS_1)),
    norTendered: hasLaytime
      ? (blankDateTime(record.NOR_TENDERED) || str(record.NOR_TENDERED))
      : (blankDateTime(sof?.NT_1) || str(sof?.NT_1)),
    norAccepted: blankDateTime(record?.NOR_ACCEPTED) || str(record?.NOR_ACCEPTED),
    startCounting: blankDateTime(record?.START_COUNTING) || str(record?.START_COUNTING),
    pilotOnBoard: hasLaytime
      ? (blankDateTime(record.PILOT_ON_BOARD) || str(record.PILOT_ON_BOARD))
      : (blankDateTime(sof?.PBFB_1) || str(sof?.PBFB_1)),
    loadCommenced: hasLaytime
      ? (blankDateTime(record.LOAD_DIS_COMMENCED) || str(record.LOAD_DIS_COMMENCED))
      : (blankDateTime(sof?.LC) || str(sof?.LC)),
    loadCompleted: hasLaytime
      ? (blankDateTime(record.LOAD_DIS_COMPLETED) || str(record.LOAD_DIS_COMPLETED))
      : (blankDateTime(sof?.LC1) || str(sof?.LC1)),
    vesselSailed: hasLaytime
      ? (blankDateTime(record.VESSEL_SAILED) || str(record.VESSEL_SAILED))
      : (blankDateTime(sof?.VS) || str(sof?.VS)),
    loadedQty: hasLaytime ? str(record.LOADED_QTY) : str(defaults.loadedQty || ''),
    loadedRate: hasLaytime ? str(record.LOADED_RATE) : '',
    laytimeAllowed: str(record?.LAYTIME_ALLOWED),
    actualLaytime: str(record?.ACTUAL_LAYTIME),
    turnTime: str(record?.TURN_TIME),
    turnTimeToAdd: str(record?.TURN_TIME_TO_ADD),
    timeToDemurrage: str(record?.TIME_TO_DEMURRAGE),
    demurrageRate: hasLaytime ? str(record.DEMURRAGE_RATE) : '',
    ttlDemurrage: str(record?.TTL_DEMURRAGE),
    ttlDemurrageManual: str(record?.TTL_DEMURRAGE_MANUAL),
    timeToDespatch: str(record?.TIME_TO_DESPATCH),
    despatchRate: hasLaytime ? str(record.DESPATCH_RATE) : '',
    ttlDespatch: str(record?.TTL_DESPATCH),
    ttlDespatchManual: str(record?.TTL_DESPATCH_MANUAL),
    totalDaysAtPort: str(record?.TOTAL_DAYS_AT_PORT),
    loadedTerms: str(record?.LOADED_TERMS),
    remarks: str(record?.REMARKS),
    reversible: flag01(record?.REVERSIBLE ?? record?.REVERSIABLE, '0'),
    detention: flag01(record?.DETENTION, '0'),
    laytimeApplicable: hasLaytime
      ? flag01(record.APPLICABLE_STATUS ?? record.LAYTIME_APPLICABLE, '1')
      : '1',
    portNameManual: str(
      record?.PORT_NAME_MANUAL
      ?? record?.port_name_manual
      ?? '',
    ),
    approvers: parseApprovers(record?.APPROVERS),
    uploads: parseUploads(record?.ATTACHMENTS, record?.ATTACHMENTS_NAME),
  };
}

function entityValueForDb(value) {
  const parsed = parseDmyDateTime(value);
  if (parsed) return parsed;
  const s = String(value ?? '').trim();
  return s === '' ? null : s;
}

async function replaceActivities(connection, laytimeId, activities) {
  await connection.query(`DELETE FROM laytime_slave WHERE LAYTIME_ID = ?`, [laytimeId]);
  for (const row of activities || []) {
    const activity = String(row.activity || '').trim();
    const start = parseDmyDateTime(row.start);
    const end = parseDmyDateTime(row.end);
    const notes = String(row.notes || '').trim();
    if (!activity && !start && !end && !notes) continue;
    await connection.query(
      `INSERT INTO laytime_slave
        (LAYTIME_ID, ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, LT_C, LT_NC, LT_PARTIAL, CUMMULATIVE_TIME, NOTES)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        laytimeId,
        activity,
        start,
        end,
        str(row.duration),
        row.ltCounts ? 1 : 0,
        row.ltNoCounts ? 1 : 0,
        strOrNull(row.ltPartial),
        str(row.cumulative),
        notes,
      ],
    ).catch(async () => {
      await connection.query(
        `INSERT INTO laytime_slave
          (LAYTIME_ID, ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, NOTES)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [laytimeId, activity, start, end, str(row.duration), notes],
      );
    });
  }
}

async function replaceDeductions(connection, laytimeId, deductions) {
  await connection.query(`DELETE FROM laytime_slave1 WHERE LAYTIME_ID = ?`, [laytimeId]);
  for (const row of deductions || []) {
    const activity = String(row.activity || '').trim();
    const start = parseDmyDateTime(row.start);
    const end = parseDmyDateTime(row.end);
    const notes = String(row.notes || '').trim();
    if (!activity && !start && !end && !notes) continue;
    await connection.query(
      `INSERT INTO laytime_slave1
        (LAYTIME_ID, ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, LT_PARTIAL, CUMMULATIVE_TIME, NOTES)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        laytimeId,
        activity,
        start,
        end,
        str(row.duration),
        strOrNull(row.ltPartial),
        str(row.cumulative),
        notes,
      ],
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

async function replaceEntityRows(connection, laytimeId, entityRows) {
  await connection.query(`DELETE FROM laytime_slave2 WHERE LAYTIME_ID = ?`, [laytimeId]);
  for (const row of entityRows || []) {
    const name = String(row.name || '').trim();
    const value = entityValueForDb(row.value);
    if (!name && value == null) continue;
    await connection.query(
      `INSERT INTO laytime_slave2 (LAYTIME_ID, ENTITY_NAME, ENTITY_VALUE) VALUES (?, ?, ?)`,
      [laytimeId, name, value],
    );
  }
}

/**
 * PHP laytime_calculation.php — Ops VC Laytime form.
 */
export async function dbGetLaytimeForm(comId) {
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
  let portTabs = await loadPortTabs(pool, fcaId, comId);
  // If latest cost sheet has no legs, fall back to the compare FCAID sheet.
  if (!portTabs.length && compare.FCAID && String(compare.FCAID) !== String(fcaId)) {
    portTabs = await loadPortTabs(pool, compare.FCAID, comId);
  }

  const ports = [];
  for (const tab of portTabs) {
    const record = await loadLaytimeRecord(pool, comId, tab.portType, tab.portId, tab.randomId);
    const sof = await loadSofRecord(pool, comId, tab.portType, tab.portId, tab.randomId);
    const laytimeId = record?.LAYTIME_ID || null;
    const sofId = record?.SOF_LOADPORTID || sof?.SOFID || null;
    const submitId = record?.SUBMITID != null ? Number(record.SUBMITID) : 0;
    const locked = submitId === 5;
    const fields = mapMasterFields(record, sof, tab.defaults);
    const activities = await loadActivities(pool, laytimeId, sofId);
    const deductions = await loadDeductions(pool, laytimeId);
    const entityRows = await loadEntityRows(pool, laytimeId, sofId);
    const operation = tab.portType === 'LP' ? 'Loading' : 'Discharging';

    ports.push({
      key: `${tab.portType}-${tab.portId}-${tab.randomId}`,
      tabLabel: `${tab.portType}-${tab.portName}`,
      portType: tab.portType,
      portId: tab.portId,
      portName: tab.portName,
      randomId: tab.randomId,
      operation,
      laytimeId: laytimeId != null ? String(laytimeId) : '',
      sofId: sofId != null ? String(sofId) : '',
      submitId,
      locked,
      canEdit: !locked,
      ...fields,
      activities,
      deductions,
      entityRows,
    });
  }

  return {
    comId: String(comId),
    fcaId: fcaId != null ? String(fcaId) : '',
    voyageNo,
    vesselName,
    message: compare.MESSAGE || '',
    cargo,
    currency: 'USD',
    vesselParticulars,
    rateUnit: 'days',
    canOpen: true,
    approverOptions: [],
    ports,
  };
}

async function upsertLaytimeMaster(connection, {
  existing,
  comId,
  portType,
  portId,
  randomId,
  submitId,
  sofId,
  fields,
  attachments,
  attachmentNames,
}) {
  const paramsCore = [
    fields.terminal,
    fields.stowageQty,
    fields.vesselArrived,
    fields.norTendered,
    fields.norAccepted,
    fields.startCounting,
    fields.pilotOnBoard,
    fields.loadCommenced,
    fields.loadCompleted,
    fields.vesselSailed,
    fields.loadedQty,
    fields.loadedRate,
    fields.laytimeAllowed,
    fields.actualLaytime,
    fields.turnTime,
    fields.turnTimeToAdd,
    fields.timeToDemurrage,
    fields.demurrageRate,
    fields.ttlDemurrage,
    fields.ttlDemurrageManual,
    fields.timeToDespatch,
    fields.despatchRate,
    fields.ttlDespatch,
    fields.ttlDespatchManual,
    fields.totalDaysAtPort,
    fields.loadedTerms,
    fields.remarks,
    fields.reversible,
    fields.detention,
    fields.laytimeApplicable,
    fields.portNameManual,
    fields.approvers,
    attachments,
    attachmentNames,
    sofId,
    submitId,
  ];

  if (existing?.LAYTIME_ID) {
    const laytimeId = existing.LAYTIME_ID;
    await connection.query(
      `UPDATE laytime_master SET
         TERMINAL = ?, STOWAGE_QTY = ?, VESSEL_ARRIVED = ?, NOR_TENDERED = ?,
         NOR_ACCEPTED = ?, START_COUNTING = ?, PILOT_ON_BOARD = ?,
         LOAD_DIS_COMMENCED = ?, LOAD_DIS_COMPLETED = ?, VESSEL_SAILED = ?,
         LOADED_QTY = ?, LOADED_RATE = ?, LAYTIME_ALLOWED = ?, ACTUAL_LAYTIME = ?,
         TURN_TIME = ?, TURN_TIME_TO_ADD = ?,
         TIME_TO_DEMURRAGE = ?, DEMURRAGE_RATE = ?, TTL_DEMURRAGE = ?, TTL_DEMURRAGE_MANUAL = ?,
         TIME_TO_DESPATCH = ?, DESPATCH_RATE = ?, TTL_DESPATCH = ?, TTL_DESPATCH_MANUAL = ?,
         TOTAL_DAYS_AT_PORT = ?, LOADED_TERMS = ?, REMARKS = ?,
         REVERSIBLE = ?, DETENTION = ?, APPLICABLE_STATUS = ?, PORT_NAME_MANUAL = ?,
         APPROVERS = ?, ATTACHMENTS = ?, ATTACHMENTS_NAME = ?, SOF_LOADPORTID = ?, SUBMITID = ?
       WHERE LAYTIME_ID = ?`,
      [...paramsCore, laytimeId],
    ).catch(async () => {
      await connection.query(
        `UPDATE laytime_master SET
           TERMINAL = ?, STOWAGE_QTY = ?, VESSEL_ARRIVED = ?, NOR_TENDERED = ?,
           NOR_ACCEPTED = ?, START_COUNTING = ?, PILOT_ON_BOARD = ?,
           LOAD_DIS_COMMENCED = ?, LOAD_DIS_COMPLETED = ?, VESSEL_SAILED = ?,
           LOADED_QTY = ?, LOADED_RATE = ?, LAYTIME_ALLOWED = ?, ACTUAL_LAYTIME = ?,
           TURN_TIME = ?, TURN_TIME_TO_ADD = ?,
           TIME_TO_DEMURRAGE = ?, DEMURRAGE_RATE = ?, TTL_DEMURRAGE = ?, TTL_DEMURRAGE_MANUAL = ?,
           TIME_TO_DESPATCH = ?, DESPATCH_RATE = ?, TTL_DESPATCH = ?, TTL_DESPATCH_MANUAL = ?,
           TOTAL_DAYS_AT_PORT = ?, LOADED_TERMS = ?, REMARKS = ?,
           REVERSIBLE = ?, DETENTION = ?, APPROVERS = ?, ATTACHMENTS = ?, SUBMITID = ?
         WHERE LAYTIME_ID = ?`,
        [
          fields.terminal, fields.stowageQty, fields.vesselArrived, fields.norTendered,
          fields.norAccepted, fields.startCounting, fields.pilotOnBoard,
          fields.loadCommenced, fields.loadCompleted, fields.vesselSailed,
          fields.loadedQty, fields.loadedRate, fields.laytimeAllowed, fields.actualLaytime,
          fields.turnTime, fields.turnTimeToAdd,
          fields.timeToDemurrage, fields.demurrageRate, fields.ttlDemurrage, fields.ttlDemurrageManual,
          fields.timeToDespatch, fields.despatchRate, fields.ttlDespatch, fields.ttlDespatchManual,
          fields.totalDaysAtPort, fields.loadedTerms, fields.remarks,
          fields.reversible, fields.detention, fields.approvers, attachments, submitId,
          laytimeId,
        ],
      );
    });
    return laytimeId;
  }

  const [result] = await connection.query(
    `INSERT INTO laytime_master (
       COMID, LOGIN, LOGINID, MODULEID, MCOMPANYID, PORT, PORTID, RANDOMID,
       TERMINAL, STOWAGE_QTY, VESSEL_ARRIVED, NOR_TENDERED, NOR_ACCEPTED, START_COUNTING,
       PILOT_ON_BOARD, LOAD_DIS_COMMENCED, LOAD_DIS_COMPLETED, VESSEL_SAILED,
       LOADED_QTY, LOADED_RATE, LAYTIME_ALLOWED, ACTUAL_LAYTIME, TURN_TIME, TURN_TIME_TO_ADD,
       TIME_TO_DEMURRAGE, DEMURRAGE_RATE, TTL_DEMURRAGE, TTL_DEMURRAGE_MANUAL,
       TIME_TO_DESPATCH, DESPATCH_RATE, TTL_DESPATCH, TTL_DESPATCH_MANUAL,
       TOTAL_DAYS_AT_PORT, LOADED_TERMS, REMARKS,
       REVERSIBLE, DETENTION, APPLICABLE_STATUS, PORT_NAME_MANUAL,
       APPROVERS, ATTACHMENTS, ATTACHMENTS_NAME, SOF_LOADPORTID, SUBMITID
     ) VALUES (
       ?, 'INTERNAL_USER', ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?
     )`,
    [
      comId, appContext.userId || 0, MODULE_ID, COMPANY_ID, portType, portId, randomId,
      ...paramsCore,
    ],
  ).catch(async () => connection.query(
    `INSERT INTO laytime_master (
       COMID, LOGIN, LOGINID, MODULEID, MCOMPANYID, PORT, PORTID, RANDOMID,
       TERMINAL, STOWAGE_QTY, VESSEL_ARRIVED, NOR_TENDERED, NOR_ACCEPTED, START_COUNTING,
       PILOT_ON_BOARD, LOAD_DIS_COMMENCED, LOAD_DIS_COMPLETED, VESSEL_SAILED,
       LOADED_QTY, LOADED_RATE, LAYTIME_ALLOWED, ACTUAL_LAYTIME, TURN_TIME, TURN_TIME_TO_ADD,
       TIME_TO_DEMURRAGE, DEMURRAGE_RATE, TTL_DEMURRAGE, TTL_DEMURRAGE_MANUAL,
       TIME_TO_DESPATCH, DESPATCH_RATE, TTL_DESPATCH, TTL_DESPATCH_MANUAL,
       TOTAL_DAYS_AT_PORT, LOADED_TERMS, REMARKS,
       REVERSIBLE, DETENTION, APPROVERS, ATTACHMENTS, SUBMITID
     ) VALUES (
       ?, 'INTERNAL_USER', ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?, ?
     )`,
    [
      comId, appContext.userId || 0, MODULE_ID, COMPANY_ID, portType, portId, randomId,
      fields.terminal, fields.stowageQty, fields.vesselArrived, fields.norTendered,
      fields.norAccepted, fields.startCounting, fields.pilotOnBoard,
      fields.loadCommenced, fields.loadCompleted, fields.vesselSailed,
      fields.loadedQty, fields.loadedRate, fields.laytimeAllowed, fields.actualLaytime,
      fields.turnTime, fields.turnTimeToAdd,
      fields.timeToDemurrage, fields.demurrageRate, fields.ttlDemurrage, fields.ttlDemurrageManual,
      fields.timeToDespatch, fields.despatchRate, fields.ttlDespatch, fields.ttlDespatchManual,
      fields.totalDaysAtPort, fields.loadedTerms, fields.remarks,
      fields.reversible, fields.detention, fields.approvers, attachments, submitId,
    ],
  ));

  let laytimeId = result?.insertId;
  if (!laytimeId) {
    const [[maxRow]] = await connection.query(
      `SELECT MAX(LAYTIME_ID) AS maxId FROM laytime_master
       WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
         AND PORT = ? AND PORTID = ? AND RANDOMID = ?`,
      [comId, portType, portId, randomId],
    );
    laytimeId = maxRow?.maxId;
  }
  return laytimeId;
}

/**
 * PHP updationLaytimeRecords / openLaytimeRecords — upsert master + replace slaves.
 */
export async function dbSaveLaytime(payload = {}) {
  const pool = getPool();
  const comId = payload.comId || payload.comid;
  const portType = str(payload.portType || payload.port);
  const portId = str(payload.portId || payload.portid);
  const randomId = str(payload.randomId || payload.randomid);
  const action = String(payload.action || 'save').toLowerCase();
  let submitId = Number(payload.submitId ?? payload.submitid ?? 0);
  if (action === 'open') submitId = 0;

  if (!comId || !portType || !portId || !randomId) {
    const error = new Error('comId, portType, portId and randomId are required.');
    error.status = 400;
    throw error;
  }

  const approvers = Array.isArray(payload.approvers)
    ? payload.approvers.map(str).filter(Boolean).join(',')
    : str(payload.approvers);

  const keepFiles = Array.isArray(payload.keepFiles)
    ? payload.keepFiles.map(str).filter(Boolean)
    : null;
  const keepFileNames = Array.isArray(payload.keepFileNames)
    ? payload.keepFileNames.map(str)
    : null;

  const fields = {
    terminal: str(payload.terminal),
    stowageQty: strOrNull(payload.stowageQty),
    vesselArrived: strOrNull(payload.vesselArrived),
    norTendered: strOrNull(payload.norTendered),
    norAccepted: strOrNull(payload.norAccepted),
    startCounting: strOrNull(payload.startCounting),
    pilotOnBoard: strOrNull(payload.pilotOnBoard),
    loadCommenced: strOrNull(payload.loadCommenced),
    loadCompleted: strOrNull(payload.loadCompleted),
    vesselSailed: strOrNull(payload.vesselSailed),
    loadedQty: strOrNull(payload.loadedQty),
    loadedRate: strOrNull(payload.loadedRate),
    laytimeAllowed: strOrNull(payload.laytimeAllowed),
    actualLaytime: strOrNull(payload.actualLaytime),
    turnTime: strOrNull(payload.turnTime),
    turnTimeToAdd: strOrNull(payload.turnTimeToAdd),
    timeToDemurrage: strOrNull(payload.timeToDemurrage),
    demurrageRate: strOrNull(payload.demurrageRate),
    ttlDemurrage: strOrNull(payload.ttlDemurrage),
    ttlDemurrageManual: strOrNull(payload.ttlDemurrageManual),
    timeToDespatch: strOrNull(payload.timeToDespatch),
    despatchRate: strOrNull(payload.despatchRate),
    ttlDespatch: strOrNull(payload.ttlDespatch),
    ttlDespatchManual: strOrNull(payload.ttlDespatchManual),
    totalDaysAtPort: strOrNull(payload.totalDaysAtPort),
    loadedTerms: strOrNull(payload.loadedTerms),
    remarks: str(payload.remarks),
    reversible: flag01(payload.reversible, '0'),
    detention: flag01(payload.detention, '0'),
    laytimeApplicable: flag01(payload.laytimeApplicable, '1'),
    portNameManual: str(payload.portNameManual),
    approvers,
  };

  const activities = payload.activities || [];
  const deductions = payload.deductions || [];
  const entityRows = payload.entityRows || [];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.query(
      `SELECT * FROM laytime_master
       WHERE COMID = ? AND LOGIN = 'INTERNAL_USER'
         AND MODULEID = ? AND MCOMPANYID = ?
         AND PORT = ? AND PORTID = ? AND RANDOMID = ?
       LIMIT 1`,
      [comId, MODULE_ID, COMPANY_ID, portType, portId, randomId],
    );

    if (existing && Number(existing.SUBMITID) === 5 && action !== 'open') {
      const error = new Error('This Laytime is locked (Submit & Close).');
      error.status = 400;
      throw error;
    }

    let sofId = strOrNull(payload.sofId || payload.sof_loadportid);
    if (!sofId) {
      const sof = await loadSofRecord(connection, comId, portType, portId, randomId);
      sofId = sof?.SOFID != null ? String(sof.SOFID) : null;
    }

    const attachments = keepFiles != null
      ? keepFiles.join(',')
      : str(existing?.ATTACHMENTS || '');
    const attachmentNames = keepFiles != null
      ? (keepFileNames || keepFiles).join(',')
      : str(existing?.ATTACHMENTS_NAME || '');

    const laytimeId = await upsertLaytimeMaster(connection, {
      existing,
      comId,
      portType,
      portId,
      randomId,
      submitId,
      sofId,
      fields,
      attachments,
      attachmentNames,
    });

    if (!laytimeId) {
      const error = new Error('Failed to save laytime record.');
      error.status = 500;
      throw error;
    }

    await replaceActivities(connection, laytimeId, activities);
    await replaceDeductions(connection, laytimeId, deductions);
    await replaceEntityRows(connection, laytimeId, entityRows);

    await connection.commit();
    return {
      msg: 0,
      laytimeId: String(laytimeId),
      submitId,
      closed: submitId === 5,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export { isEmptyDateTime, blankDateTime, parseDmyDateTime };
