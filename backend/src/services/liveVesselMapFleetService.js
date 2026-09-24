import { isDbConfigured, appContext } from '../config.js';
import { getPool } from '../db.js';
import { listSpotOpsInOpsFleetHeaders } from './opsChecklistService.js';
import { approxCoordsForPortLabel } from './liveVesselMapRouteService.js';
import { fetchLastPositionsForImos } from './vesselPositionService.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function stripImo(value) {
  return String(value || '').replace(/^IMO/i, '').replace(/\D/g, '').trim();
}

/** First non-empty line of a multi-line "Full style" particulars field. */
function firstLineItem(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function parseRoute(route) {
  const text = String(route || '').trim();
  if (!text || text === '—') return { from: '', to: '' };
  const parts = text.split(/\s*[→\-–—]+\s*/);
  if (parts.length >= 2) {
    return { from: parts[0].trim(), to: parts[parts.length - 1].trim() };
  }
  return { from: text, to: '' };
}

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Match estimate-list getTce: daily → net daily → P&L / days. */
function resolveTceFromRow(row = {}) {
  const daily = toNumberOrNull(row.DAILY_EARNING ?? row.dailyEarning);
  if (daily != null && daily !== 0) return daily;
  const net = toNumberOrNull(row.NET_DAILY_EARNING ?? row.netDailyEarning);
  if (net != null && net !== 0) return net;
  const pnl = toNumberOrNull(row.PROFIT_LOSS ?? row.profitLoss ?? row.ACTUAL_PL);
  const days = toNumberOrNull(row.TOTAL_DAYS ?? row.totalDays);
  if (pnl != null && days != null && days > 0) {
    return Math.round((pnl / days) * 100) / 100;
  }
  // Allow explicit zero daily earning once fallbacks are exhausted.
  if (daily != null) return daily;
  if (net != null) return net;
  return null;
}

function resolvePnlFromRow(row = {}) {
  const actual = toNumberOrNull(row.ACTUAL_PL ?? row.actualPl);
  if (actual != null) return actual;
  return toNumberOrNull(row.PROFIT_LOSS ?? row.profitLoss);
}

function formatLaycan(from, to) {
  const a = String(from || '').trim();
  const b = String(to || '').trim();
  if (a && b) return `${a} – ${b}`;
  return a || b || '';
}

function formatEstimateDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1972) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function formatRate({
  ws, cargoRate, lumpsumAmt, chkLumpsum, hireRate, hireAmt, isTc,
}) {
  if (Number(chkLumpsum) === 1 && toNumberOrNull(lumpsumAmt) != null) {
    return `LS ${Number(lumpsumAmt).toLocaleString()}`;
  }
  if (ws != null && String(ws).trim() !== '' && Number(ws) !== 0) {
    return `WS ${ws}`;
  }
  if (cargoRate != null && String(cargoRate).trim() !== '' && Number(cargoRate) !== 0) {
    return `$${Number(cargoRate).toLocaleString()}/MT`;
  }
  const hire = toNumberOrNull(hireRate) ?? toNumberOrNull(hireAmt);
  if (hire != null) {
    return isTc || hireRate != null ? `$${hire.toLocaleString()}/day` : `$${hire.toLocaleString()}`;
  }
  return '';
}

function parseCargoIds(value) {
  if (value == null || value === '') return [];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '0');
}

/** Prefer latest named cost sheet that has an estimate (Ops "working" sheet). */
async function loadWorkingCostSheets(comIds = []) {
  const byCom = new Map();
  if (!isDbConfigured() || !comIds.length) return byCom;
  const pool = getPool();
  const ids = [...new Set(comIds.map(Number).filter(Boolean))];
  if (!ids.length) return byCom;
  const placeholders = ids.map(() => '?').join(',');

  const mapVcSheet = (row) => ({
    costSheetId: row.COST_SHEETID,
    sheetName: row.SHEET_NAME || `Sheet ${row.COST_SHEETID}`,
    sheetKind: 'vc',
    fcaId: row.FCAID ?? null,
    DAILY_EARNING: row.DAILY_EARNING,
    NET_DAILY_EARNING: row.NET_DAILY_EARNING,
    PROFIT_LOSS: row.PROFIT_LOSS,
    ACTUAL_PL: row.ACTUAL_PL,
    TOTAL_DAYS: row.TOTAL_DAYS,
  });

  try {
    // Prefer working Voyage Worksheet master (SHEET_NO = COST_SHEETID) for TCE / P&L.
    let vcSheets;
    try {
      [vcSheets] = await pool.query(
        `SELECT m.COMID, m.COST_SHEETID, m.SHEET_NAME, e.FCAID,
                e.DAILY_EARNING, e.NET_DAILY_EARNING, e.PROFIT_LOSS, e.ACTUAL_PL, e.TOTAL_DAYS
         FROM cost_sheet_name_master m
         LEFT JOIN freight_cost_estimete_master e
           ON e.COMID = m.COMID AND e.SHEET_NO = m.COST_SHEETID
         WHERE m.COMID IN (${placeholders}) AND m.MODULEID = ? AND m.MCOMPANYID = ?
         ORDER BY m.COMID, m.COST_SHEETID DESC`,
        [...ids, MODULE_ID, COMPANY_ID],
      );
    } catch {
      [vcSheets] = await pool.query(
        `SELECT m.COMID, m.COST_SHEETID, m.SHEET_NAME, e.FCAID,
                e.DAILY_EARNING, e.NET_DAILY_EARNING, e.PROFIT_LOSS, e.TOTAL_DAYS
         FROM cost_sheet_name_master m
         LEFT JOIN freight_cost_estimete_master e
           ON e.COMID = m.COMID AND e.SHEET_NO = m.COST_SHEETID
         WHERE m.COMID IN (${placeholders}) AND m.MODULEID = ? AND m.MCOMPANYID = ?
         ORDER BY m.COMID, m.COST_SHEETID DESC`,
        [...ids, MODULE_ID, COMPANY_ID],
      );
    }
    for (const row of vcSheets || []) {
      const key = String(row.COMID);
      if (byCom.has(key)) continue;
      if (row.FCAID == null) continue;
      byCom.set(key, mapVcSheet(row));
    }
    for (const row of vcSheets || []) {
      const key = String(row.COMID);
      if (byCom.has(key)) continue;
      byCom.set(key, mapVcSheet(row));
    }
  } catch {
    /* optional */
  }

  try {
    const [tcSheets] = await pool.query(
      `SELECT m.COMID, m.COST_SHEETID, m.SHEET_NAME
       FROM cost_sheet_name_master_tc m
       WHERE m.COMID IN (${placeholders}) AND m.MODULEID = ? AND m.MCOMPANYID = ?
       ORDER BY m.COMID, m.COST_SHEETID DESC`,
      [...ids, MODULE_ID, COMPANY_ID],
    );
    for (const row of tcSheets || []) {
      const key = String(row.COMID);
      if (byCom.has(key)) continue;
      byCom.set(key, {
        costSheetId: row.COST_SHEETID,
        sheetName: row.SHEET_NAME || `Sheet ${row.COST_SHEETID}`,
        sheetKind: 'tc',
        fcaId: null,
      });
    }
  } catch {
    /* optional */
  }

  return byCom;
}

async function loadCargoNamesByFca(pool, fcaIds = []) {
  const byFca = new Map();
  const ids = [...new Set(fcaIds.map(Number).filter(Boolean))];
  if (!ids.length) return byFca;
  const placeholders = ids.map(() => '?').join(',');

  try {
    const [rows] = await pool.query(
      `SELECT s.FCAID, s.CARGOID, s.SHIPPER_CHARTER,
              cm.MATERIAL_TYPE AS CARGO_NAME,
              vm.NAME AS CHARTERER_NAME
       FROM freight_cost_estimete_slave10 s
       LEFT JOIN cargo_master cm ON cm.MATERIALID = s.CARGOID
       LEFT JOIN vendor_master vm ON vm.CODE = s.SHIPPER_CHARTER
       WHERE s.FCAID IN (${placeholders})
         AND (s.STATUS IS NULL OR s.STATUS = 1)
       ORDER BY s.FCAID, s.STATUS ASC, s.RANDOMID ASC`,
      ids,
    );
    for (const row of rows || []) {
      const key = String(row.FCAID);
      if (!byFca.has(key)) byFca.set(key, { names: [], charterer: '' });
      const entry = byFca.get(key);
      const cargoIdRaw = String(row.CARGOID || '').trim();
      const name = String(row.CARGO_NAME || '').trim()
        || (!/^\d+$/.test(cargoIdRaw) ? cargoIdRaw : '');
      if (name && !entry.names.includes(name)) entry.names.push(name);
      if (!entry.charterer) {
        const charterer = String(row.CHARTERER_NAME || row.SHIPPER_CHARTER || '').trim();
        // Prefer resolved vendor name; skip raw numeric codes without a name.
        if (charterer && !(/^\d+$/.test(charterer) && !row.CHARTERER_NAME)) {
          entry.charterer = String(row.CHARTERER_NAME || charterer).trim();
        }
      }
    }
  } catch {
    /* optional — retry without vendor join */
    try {
      const [rows] = await pool.query(
        `SELECT s.FCAID, s.CARGOID, s.SHIPPER_CHARTER, cm.MATERIAL_TYPE AS CARGO_NAME
         FROM freight_cost_estimete_slave10 s
         LEFT JOIN cargo_master cm ON cm.MATERIALID = s.CARGOID
         WHERE s.FCAID IN (${placeholders})
           AND (s.STATUS IS NULL OR s.STATUS = 1)
         ORDER BY s.FCAID, s.STATUS ASC, s.RANDOMID ASC`,
        ids,
      );
      for (const row of rows || []) {
        const key = String(row.FCAID);
        if (!byFca.has(key)) byFca.set(key, { names: [], charterer: '' });
        const entry = byFca.get(key);
        const cargoIdRaw = String(row.CARGOID || '').trim();
        const name = String(row.CARGO_NAME || '').trim()
          || (!/^\d+$/.test(cargoIdRaw) ? cargoIdRaw : '');
        if (name && !entry.names.includes(name)) entry.names.push(name);
        if (!entry.charterer && row.SHIPPER_CHARTER) {
          const raw = String(row.SHIPPER_CHARTER).trim();
          if (raw && !/^\d+$/.test(raw)) entry.charterer = raw;
        }
      }
    } catch {
      /* optional */
    }
  }

  return byFca;
}

async function loadCurrentLegsByFca(pool, fcaIds = []) {
  const byFca = new Map();
  const ids = [...new Set(fcaIds.map(Number).filter(Boolean))];
  if (!ids.length) return byFca;
  const placeholders = ids.map(() => '?').join(',');

  try {
    const [rows] = await pool.query(
      `SELECT s.FCAID,
              s.LOAD_PORT_QTY,
              s.DISC_PORT_QTY,
              s.PASSAGE_TYPE,
              TRIM(CONCAT(COALESCE(fp.PortName, ''), IF(fp.COUNTRY_KEY IS NULL OR fp.COUNTRY_KEY = '', '', CONCAT(' (', fp.COUNTRY_KEY, ')')))) AS FROM_PORT_NAME,
              TRIM(CONCAT(COALESCE(tp.PortName, ''), IF(tp.COUNTRY_KEY IS NULL OR tp.COUNTRY_KEY = '', '', CONCAT(' (', tp.COUNTRY_KEY, ')')))) AS TO_PORT_NAME
       FROM freight_cost_estimete_slave1 s
       LEFT JOIN port_master fp
         ON CAST(fp.PortId AS CHAR) = CAST(s.FROM_PORT AS CHAR)
       LEFT JOIN port_master tp
         ON CAST(tp.PortId AS CHAR) = CAST(s.TO_PORT AS CHAR)
       WHERE s.FCAID IN (${placeholders})
       ORDER BY s.FCAID, s.FCA_SLAVEID ASC`,
      ids,
    );

    for (const row of rows || []) {
      const key = String(row.FCAID);
      if (!byFca.has(key)) {
        byFca.set(key, {
          legFrom: '',
          legTo: '',
          passageFrom: '',
          passageTo: '',
          _loads: [],
          _discharges: [],
          _allFrom: [],
          _allTo: [],
        });
      }
      const entry = byFca.get(key);
      const fromName = String(row.FROM_PORT_NAME || '').trim();
      const toName = String(row.TO_PORT_NAME || '').trim();
      const passageType = row.PASSAGE_TYPE == null ? 2 : Number(row.PASSAGE_TYPE);

      if (fromName) {
        entry.legFrom = fromName;
        if (!entry._allFrom.includes(fromName)) entry._allFrom.push(fromName);
      }
      if (toName) {
        entry.legTo = toName;
        if (!entry._allTo.includes(toName)) entry._allTo.push(toName);
      }

      if (passageType === 2 || row.PASSAGE_TYPE == null) {
        if (Number(row.LOAD_PORT_QTY) > 0 && fromName && !entry._loads.includes(fromName)) {
          entry._loads.push(fromName);
        }
        if (Number(row.DISC_PORT_QTY) > 0 && toName && !entry._discharges.includes(toName)) {
          entry._discharges.push(toName);
        }
      }
    }

    for (const entry of byFca.values()) {
      entry.passageFrom = entry._loads.length
        ? entry._loads.join(', ')
        : (entry._allFrom[0] || '');
      entry.passageTo = entry._discharges.length
        ? entry._discharges.join(', ')
        : (entry._allTo[entry._allTo.length - 1] || '');
      if (!entry.legFrom) entry.legFrom = entry.passageFrom;
      if (!entry.legTo) entry.legTo = entry.passageTo;
      delete entry._loads;
      delete entry._discharges;
      delete entry._allFrom;
      delete entry._allTo;
    }
  } catch {
    /* optional */
  }

  return byFca;
}

async function loadContactsByComId(pool, comIds = []) {
  const byCom = new Map();
  const ids = [...new Set(comIds.map(Number).filter(Boolean))];
  if (!ids.length) return byCom;
  const placeholders = ids.map(() => '?').join(',');

  try {
    const [rows] = await pool.query(
      `SELECT g.COMID, g.VENDORID, g.PORT, vm.NAME AS vendorName, vm.EMAILID AS vendorEmail,
              p.PortName AS portName
       FROM generate_agency_letter g
       LEFT JOIN vendor_master vm ON vm.CODE = g.VENDORID AND vm.MCOMPANYID = g.MCOMPANYID
       LEFT JOIN port_master p ON p.PortId = g.PORTID
       WHERE g.COMID IN (${placeholders}) AND g.MODULEID = ? AND g.MCOMPANYID = ?
       ORDER BY g.COMID, g.GEN_AGENCY_ID DESC`,
      [...ids, MODULE_ID, COMPANY_ID],
    );
    for (const row of rows || []) {
      const key = String(row.COMID);
      if (!byCom.has(key)) byCom.set(key, []);
      const list = byCom.get(key);
      const name = String(row.vendorName || row.VENDORID || '').trim();
      if (!name) continue;
      if (list.some((item) => item.name === name && item.type === 'agent')) continue;
      if (list.filter((item) => item.type === 'agent').length >= 3) continue;
      list.push({
        name,
        company: String(row.portName || row.PORT || '').trim() || name,
        role: 'Selected Agent',
        type: 'agent',
        contact: String(row.vendorEmail || '').trim(),
      });
    }
  } catch {
    /* optional */
  }

  return byCom;
}

/**
 * Resolve cargo display names from master.CARGO_ID / compare.CARGO_ID.
 * PHP often stores cargo *names* (not MATERIALIDs) in CARGO_ID.
 */
async function resolveCargoDisplayNames(pool, cargoIdCsv) {
  const tokens = parseCargoIds(cargoIdCsv);
  if (!tokens.length) return [];
  const numericIds = tokens.filter((token) => /^\d+$/.test(token));
  const nameById = new Map();
  if (numericIds.length) {
    const placeholders = numericIds.map(() => '?').join(',');
    try {
      const [rows] = await pool.query(
        `SELECT MATERIALID, MATERIAL_TYPE AS name
         FROM cargo_master
         WHERE MATERIALID IN (${placeholders})`,
        numericIds,
      );
      for (const row of rows || []) {
        const name = String(row.name || '').trim();
        if (name) nameById.set(String(row.MATERIALID), name);
      }
    } catch {
      /* fall through — treat tokens as names */
    }
  }
  const names = [];
  for (const token of tokens) {
    const resolved = nameById.get(token);
    if (resolved) {
      if (!names.includes(resolved)) names.push(resolved);
      continue;
    }
    // Non-numeric / unresolved → already a display name (legacy PHP storage).
    if (!/^\d+$/.test(token) && !names.includes(token)) names.push(token);
  }
  return names;
}

async function loadVendorNames(pool, codes = []) {
  const byCode = new Map();
  const uniq = [...new Set(
    codes.map((code) => String(code ?? '').trim()).filter((code) => code && code !== '0'),
  )];
  if (!uniq.length) return byCode;
  const placeholders = uniq.map(() => '?').join(',');
  try {
    const [rows] = await pool.query(
      `SELECT CODE, VENDORID, NAME
       FROM vendor_master
       WHERE CODE IN (${placeholders}) OR CAST(VENDORID AS CHAR) IN (${placeholders})`,
      [...uniq, ...uniq],
    );
    for (const row of rows || []) {
      const name = String(row.NAME || '').trim();
      if (!name) continue;
      if (row.CODE != null && String(row.CODE).trim() !== '') {
        byCode.set(String(row.CODE).trim(), name);
      }
      if (row.VENDORID != null) byCode.set(String(row.VENDORID), name);
    }
  } catch {
    /* optional */
  }
  return byCode;
}

/**
 * Vessel name + type label from Voyage Worksheet estimate (vessel_imo_master / vessel_type_master).
 */
async function loadVesselIdentityByFca(pool, fcaIds = []) {
  const byFca = new Map();
  const ids = [...new Set(fcaIds.map(Number).filter(Boolean))];
  if (!ids.length) return byFca;
  const placeholders = ids.map(() => '?').join(',');

  try {
    const [rows] = await pool.query(
      `SELECT m.FCAID,
              vim.VESSEL_NAME,
              vim.IMO_NO,
              m.VESSEL_TYPE,
              vt.VesselType AS VESSEL_TYPE_NAME
       FROM freight_cost_estimete_master m
       LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       LEFT JOIN vessel_type_master vt
         ON vt.VesselTypeId = m.VESSEL_TYPE
         OR CAST(vt.VesselTypeId AS CHAR) = CAST(m.VESSEL_TYPE AS CHAR)
       WHERE m.FCAID IN (${placeholders})`,
      ids,
    );
    for (const row of rows || []) {
      const key = String(row.FCAID);
      if (byFca.has(key)) continue;
      const typeName = String(row.VESSEL_TYPE_NAME || '').trim();
      const typeRaw = String(row.VESSEL_TYPE ?? '').trim();
      // Prefer master label; fall back to non-numeric worksheet text; skip bare type ids.
      const vesselType = typeName
        || (typeRaw && !/^\d+$/.test(typeRaw) ? typeRaw : '');
      byFca.set(key, {
        vesselName: String(row.VESSEL_NAME || '').trim(),
        vesselType,
        imoNo: stripImo(row.IMO_NO),
      });
    }
  } catch {
    try {
      const [rows] = await pool.query(
        `SELECT m.FCAID, vim.VESSEL_NAME, vim.IMO_NO, m.VESSEL_TYPE
         FROM freight_cost_estimete_master m
         LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
         WHERE m.FCAID IN (${placeholders})`,
        ids,
      );
      for (const row of rows || []) {
        const key = String(row.FCAID);
        if (byFca.has(key)) continue;
        const typeRaw = String(row.VESSEL_TYPE ?? '').trim();
        byFca.set(key, {
          vesselName: String(row.VESSEL_NAME || '').trim(),
          vesselType: typeRaw && !/^\d+$/.test(typeRaw) ? typeRaw : '',
          imoNo: stripImo(row.IMO_NO),
        });
      }
    } catch {
      /* optional */
    }
  }

  return byFca;
}

/**
 * Registered owner from Operated Vessels → Ownership and Operation →
 * Registered owner - Full style (vessel_master_tankers.REGISTEREDOWNER), first line.
 */
async function loadRegisteredOwnersByImo(pool, imos = []) {
  const byImo = new Map();
  const ids = [...new Set(imos.map(stripImo).filter(Boolean))];
  if (!ids.length) return byImo;
  const placeholders = ids.map(() => '?').join(',');

  try {
    const [rows] = await pool.query(
      `SELECT vim.IMO_NO, t.REGISTEREDOWNER
       FROM vessel_imo_master vim
       INNER JOIN vessel_master_tankers t ON t.VESSEL_IMO_ID = vim.VESSEL_IMO_ID
       WHERE REPLACE(REPLACE(UPPER(COALESCE(vim.IMO_NO, '')), 'IMO', ''), ' ', '') IN (${placeholders})`,
      ids,
    );
    for (const row of rows || []) {
      const key = stripImo(row.IMO_NO);
      if (!key || byImo.has(key)) continue;
      const owner = firstLineItem(row.REGISTEREDOWNER);
      if (owner) byImo.set(key, owner);
    }
  } catch {
    /* optional — column/table may be absent on some DBs */
  }

  return byImo;
}

/**
 * Commercial display fields from Voyage Worksheet:
 * - Freight ← Cargo Total Freight (FREIGHT_GROSS)
 * - Charterer ← Freight Adjustment Customer (slave12.CUSTOMER)
 * - Cargo ← cargo row names (slave10)
 */
async function loadWorksheetCommercialByFca(pool, fcaIds = []) {
  const byFca = new Map();
  const ids = [...new Set(fcaIds.map(Number).filter(Boolean))];
  if (!ids.length) return byFca;
  const placeholders = ids.map(() => '?').join(',');

  // Seed maps so missing joins still leave known FCAIDs present.
  for (const id of ids) {
    byFca.set(String(id), {
      freightGross: null,
      freightLabel: '',
      customerCode: '',
      charterer: '',
      cargo: '',
    });
  }

  try {
    const [masters] = await pool.query(
      `SELECT FCAID, FREIGHT_GROSS, LUMPSUMAMT, CHK_LUMPSUM, LUMP_VENDOR, FGFF_VENDORID
       FROM freight_cost_estimete_master
       WHERE FCAID IN (${placeholders})`,
      ids,
    );
    for (const row of masters || []) {
      const entry = byFca.get(String(row.FCAID));
      if (!entry) continue;
      const gross = toNumberOrNull(row.FREIGHT_GROSS);
      entry.freightGross = gross;
      // Match Voyage Worksheet Cargo → Total Freight (plain numeric display).
      if (gross != null && gross !== 0) {
        entry.freightLabel = Number(gross).toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
      // Dry single shipper / charterer sometimes stored on master (fallback only).
      if (row.LUMP_VENDOR) entry.customerCode = String(row.LUMP_VENDOR).trim();
      else if (row.FGFF_VENDORID) entry.customerCode = String(row.FGFF_VENDORID).trim();
    }
  } catch {
    try {
      const [masters] = await pool.query(
        `SELECT FCAID, FREIGHT_GROSS
         FROM freight_cost_estimete_master
         WHERE FCAID IN (${placeholders})`,
        ids,
      );
      for (const row of masters || []) {
        const entry = byFca.get(String(row.FCAID));
        if (!entry) continue;
        const gross = toNumberOrNull(row.FREIGHT_GROSS);
        entry.freightGross = gross;
        if (gross != null && gross !== 0) {
          entry.freightLabel = Number(gross).toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
      }
    } catch {
      /* optional */
    }
  }

  // Freight Adjustment → Customer (prefer first non-empty CUSTOMER on slave12).
  try {
    const [wsRows] = await pool.query(
      `SELECT FCAID, CUSTOMER
       FROM freight_cost_estimete_slave12
       WHERE FCAID IN (${placeholders})
       ORDER BY FCAID, RANDOMID ASC`,
      ids,
    );
    const seen = new Set();
    for (const row of wsRows || []) {
      const key = String(row.FCAID);
      if (seen.has(key)) continue;
      const entry = byFca.get(key);
      if (!entry) continue;
      const code = String(row.CUSTOMER ?? '').trim();
      if (code && code !== '0') {
        entry.customerCode = code;
        seen.add(key);
      }
    }
  } catch {
    /* optional */
  }

  const customerCodes = [...byFca.values()]
    .map((entry) => entry.customerCode)
    .filter(Boolean);
  const vendorNames = await loadVendorNames(pool, customerCodes);
  for (const entry of byFca.values()) {
    if (!entry.customerCode) continue;
    entry.charterer = vendorNames.get(entry.customerCode) || '';
  }

  // Cargo names from worksheet cargo rows.
  const cargoByFca = await loadCargoNamesByFca(pool, ids);
  for (const [fcaKey, cargoInfo] of cargoByFca.entries()) {
    const entry = byFca.get(fcaKey);
    if (!entry) continue;
    entry.cargo = (cargoInfo?.names || []).join(', ');
  }

  return byFca;
}

/**
 * Load fixed-fixture masters via compare.FCAID (ops source of truth).
 * Falls back to MAX(FCAID) per COMID without SHEET_NO filter.
 */
async function loadVcMasterRowsByComId(pool, ids = []) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const selectCols = [
    `c.COMID, c.FCAID,
     c.CARGO_ID AS CMP_CARGO_ID, c.MATERIALID AS CMP_MATERIALID, c.QTY_VENDORID,
     c.COA_SPOT AS CMP_COA_SPOT,
     m.DAILY_EARNING, m.NET_DAILY_EARNING, m.PROFIT_LOSS, m.ACTUAL_PL,
     m.VESSEL_TYPE, m.PERIODID, m.WS, m.LUMPSUMAMT, m.CHK_LUMPSUM, m.COA_SPOT,
     m.CARGO_RATE, m.HIRE_RATE, m.HIREAGE_AMT, m.REMARKS, m.CARGO_ID,
     m.FGFF_VENDORID, m.SHIPPER, m.OWNER, m.BROKER, m.DISPONENT_OWNER,
     m.LAYCANSTART, m.LAYCANEND, m.LAYCAN_START_DATE, m.LAYCAN_FINISH_DATE`,
    `c.COMID, c.FCAID,
     c.CARGO_ID AS CMP_CARGO_ID, c.MATERIALID AS CMP_MATERIALID, c.QTY_VENDORID,
     m.DAILY_EARNING, m.NET_DAILY_EARNING, m.PROFIT_LOSS, m.VESSEL_TYPE,
     m.WS, m.REMARKS, m.CARGO_ID, m.FGFF_VENDORID, m.OWNER, m.BROKER, m.DISPONENT_OWNER`,
    `c.COMID, c.FCAID, m.DAILY_EARNING, m.NET_DAILY_EARNING, m.PROFIT_LOSS,
     m.VESSEL_TYPE, m.WS, m.REMARKS, m.CARGO_ID, m.OWNER, m.BROKER, m.DISPONENT_OWNER`,
  ];

  for (const cols of selectCols) {
    try {
      const [rows] = await pool.query(
        `SELECT ${cols}
         FROM freight_cost_estimate_compare c
         INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
         WHERE c.COMID IN (${placeholders})
           AND c.MODULEID = ? AND c.MCOMPANYID = ?
         ORDER BY c.COMID, c.FCAID DESC`,
        [...ids, MODULE_ID, COMPANY_ID],
      );
      if (rows?.length) return rows;
    } catch {
      /* try next column set */
    }
  }

  // Fallback: latest master FCAID per COMID (same as ops checklist — no SHEET_NO filter).
  try {
    const [latest] = await pool.query(
      `SELECT COMID, MAX(FCAID) AS FCAID
       FROM freight_cost_estimete_master
       WHERE COMID IN (${placeholders})
       GROUP BY COMID`,
      ids,
    );
    const fcaIds = (latest || []).map((row) => row.FCAID).filter(Boolean);
    if (!fcaIds.length) return [];
    const fcaPlaceholders = fcaIds.map(() => '?').join(',');
    const comByFca = new Map(
      (latest || []).map((row) => [String(row.FCAID), row.COMID]),
    );
    try {
      const [rows] = await pool.query(
        `SELECT m.FCAID, m.DAILY_EARNING, m.NET_DAILY_EARNING, m.PROFIT_LOSS, m.ACTUAL_PL,
                m.VESSEL_TYPE, m.PERIODID, m.WS, m.LUMPSUMAMT, m.CHK_LUMPSUM, m.COA_SPOT,
                m.CARGO_RATE, m.HIRE_RATE, m.HIREAGE_AMT, m.REMARKS, m.CARGO_ID,
                m.FGFF_VENDORID, m.SHIPPER, m.OWNER, m.BROKER, m.DISPONENT_OWNER,
                m.LAYCANSTART, m.LAYCANEND, m.LAYCAN_START_DATE, m.LAYCAN_FINISH_DATE
         FROM freight_cost_estimete_master m
         WHERE m.FCAID IN (${fcaPlaceholders})`,
        fcaIds,
      );
      return (rows || []).map((row) => ({
        ...row,
        COMID: comByFca.get(String(row.FCAID)),
      })).filter((row) => row.COMID != null);
    } catch {
      const [rows] = await pool.query(
        `SELECT m.FCAID, m.DAILY_EARNING, m.NET_DAILY_EARNING, m.PROFIT_LOSS,
                m.VESSEL_TYPE, m.WS, m.REMARKS, m.CARGO_ID, m.OWNER, m.BROKER,
                m.DISPONENT_OWNER, m.FGFF_VENDORID
         FROM freight_cost_estimete_master m
         WHERE m.FCAID IN (${fcaPlaceholders})`,
        fcaIds,
      );
      return (rows || []).map((row) => ({
        ...row,
        COMID: comByFca.get(String(row.FCAID)),
      })).filter((row) => row.COMID != null);
    }
  } catch {
    return [];
  }
}

/** Latest VF financials + commercial fields per COMID. */
async function loadCommercialByComId(comIds = []) {
  const enriched = new Map();
  if (!isDbConfigured() || !comIds.length) return enriched;
  const pool = getPool();
  const ids = [...new Set(comIds.map(Number).filter(Boolean))];
  if (!ids.length) return enriched;

  const masters = await loadVcMasterRowsByComId(pool, ids);
  const byCom = new Map();
  const fcaIds = [];
  for (const row of masters) {
    const key = String(row.COMID);
    if (byCom.has(key)) continue;
    if (row.FCAID) fcaIds.push(row.FCAID);
    byCom.set(key, row);
  }

  const vendorCodes = [];
  for (const row of byCom.values()) {
    vendorCodes.push(row.OWNER, row.BROKER, row.FGFF_VENDORID, row.SHIPPER, row.QTY_VENDORID);
  }

  const [cargoByFca, legsByFca, agentsByCom, vendorNames] = await Promise.all([
    loadCargoNamesByFca(pool, fcaIds),
    loadCurrentLegsByFca(pool, fcaIds),
    loadContactsByComId(pool, ids),
    loadVendorNames(pool, vendorCodes),
  ]);

  const cargoNameCache = new Map();

  for (const [comId, row] of byCom.entries()) {
    const fcaKey = row.FCAID != null ? String(row.FCAID) : '';
    const cargoInfo = fcaKey ? cargoByFca.get(fcaKey) : null;
    const legInfo = fcaKey ? legsByFca.get(fcaKey) : null;

    let cargoNames = cargoInfo?.names || [];
    if (!cargoNames.length) {
      const csv = String(
        row.CARGO_ID || row.CMP_CARGO_ID || row.CMP_MATERIALID || row.MATERIALID || '',
      );
      if (csv) {
        if (!cargoNameCache.has(csv)) {
          cargoNameCache.set(csv, await resolveCargoDisplayNames(pool, csv));
        }
        cargoNames = cargoNameCache.get(csv) || [];
      }
    }

    const ownerCode = String(row.OWNER ?? '').trim();
    const brokerCode = String(row.BROKER ?? '').trim();
    const chartererCode = String(
      row.FGFF_VENDORID || row.QTY_VENDORID || row.SHIPPER || '',
    ).trim();
    const ownerName = (ownerCode && vendorNames.get(ownerCode))
      || String(row.DISPONENT_OWNER || '').trim();
    const brokerName = (brokerCode && vendorNames.get(brokerCode)) || '';
    const chartererName = (chartererCode && vendorNames.get(chartererCode))
      || String(cargoInfo?.charterer || '').trim();

    const contacts = [...(agentsByCom.get(comId) || [])];
    if (brokerName && !contacts.some((item) => item.type === 'broker' && item.name === brokerName)) {
      contacts.push({
        name: brokerName,
        company: brokerName,
        role: 'Registered Broker',
        type: 'broker',
        contact: '',
      });
    }

    const tce = resolveTceFromRow(row);
    const pnl = resolvePnlFromRow(row);
    const laycan = formatLaycan(
      formatEstimateDate(row.LAYCANSTART || row.LAYCAN_START_DATE),
      formatEstimateDate(row.LAYCANEND || row.LAYCAN_FINISH_DATE),
    );
    const coaSpot = row.COA_SPOT != null
      ? String(row.COA_SPOT)
      : (row.CMP_COA_SPOT != null ? String(row.CMP_COA_SPOT) : '');

    enriched.set(comId, {
      fcaId: row.FCAID || null,
      vesselType: row.VESSEL_TYPE || '',
      cargo: cargoNames.join(', '),
      charterer: chartererName,
      owner: ownerName,
      rate: formatRate({
        ws: row.WS,
        cargoRate: row.CARGO_RATE,
        lumpsumAmt: row.LUMPSUMAMT,
        chkLumpsum: row.CHK_LUMPSUM,
        hireRate: row.HIRE_RATE,
        hireAmt: row.HIREAGE_AMT,
        isTc: false,
      }),
      laycan,
      terms: String(row.REMARKS || '').trim(),
      tce,
      pnl,
      isPeriod: Number(row.PERIODID) > 0,
      coaSpot,
      legFrom: legInfo?.legFrom || '',
      legTo: legInfo?.legTo || '',
      // Full Passage (all load → all discharge ports from worksheet)
      from: legInfo?.passageFrom || legInfo?.legFrom || '',
      to: legInfo?.passageTo || legInfo?.legTo || '',
      contacts,
    });
  }

  // TC fixtures: charterer / laycan from TC master when VC estimate is absent.
  const missingTc = ids.filter((id) => !enriched.has(String(id)));
  if (missingTc.length) {
    const tcPlaceholders = missingTc.map(() => '?').join(',');
    try {
      const [tcRows] = await pool.query(
        `SELECT c.COMID, m.SEL_CHARTERER, m.LAYCAN_FROM, m.LAYCAN_TO,
                m.HIRE_FIX_PER, charterer.NAME AS CHARTERER_NAME
         FROM chartering_estimate_tc_compare c
         INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
         LEFT JOIN vendor_master charterer ON charterer.CODE = m.SEL_CHARTERER
         WHERE c.COMID IN (${tcPlaceholders}) AND c.MODULEID = ? AND c.MCOMPANYID = ?
         ORDER BY c.COMID, m.TCOUTID DESC`,
        [...missingTc, MODULE_ID, COMPANY_ID],
      );
      for (const row of tcRows || []) {
        const key = String(row.COMID);
        if (enriched.has(key)) continue;
        const agents = agentsByCom.get(key) || [];
        enriched.set(key, {
          fcaId: null,
          vesselType: '',
          cargo: '',
          charterer: String(row.CHARTERER_NAME || '').trim(),
          owner: '',
          rate: formatRate({ hireRate: row.HIRE_FIX_PER, isTc: true }),
          laycan: formatLaycan(
            formatEstimateDate(row.LAYCAN_FROM),
            formatEstimateDate(row.LAYCAN_TO),
          ),
          terms: '',
          tce: null,
          pnl: null,
          isPeriod: false,
          coaSpot: '',
          legFrom: '',
          legTo: '',
          contacts: agents,
        });
      }
    } catch {
      /* optional */
    }
  }

  // Still attach agents for COMIDs that only had empty commercial stubs.
  for (const id of ids) {
    const key = String(id);
    if (enriched.has(key)) continue;
    const agents = agentsByCom.get(key) || [];
    if (!agents.length) continue;
    enriched.set(key, {
      fcaId: null,
      vesselType: '',
      cargo: '',
      charterer: '',
      owner: '',
      rate: '',
      laycan: '',
      terms: '',
      tce: null,
      pnl: null,
      isPeriod: false,
      coaSpot: '',
      legFrom: '',
      legTo: '',
      contacts: agents,
    });
  }

  return enriched;
}

/**
 * Overlay Spot Ops In Ops (VC STATUS=1) vessels on the live map using AIS last positions.
 * Excludes Post Ops / History, COA, and TC.
 */
export async function fetchFleetOverlay() {
  // Lightweight headers only — avoid checklist/SOF enrichment (was a major slowdown).
  const { records } = await listSpotOpsInOpsFleetHeaders({ selBType: '' });
  const byImo = new Map();

  (records || []).forEach((row) => {
    const imoKey = stripImo(row.vesselImoNo || row.imoNo);
    if (!imoKey) return;
    if (byImo.has(imoKey)) return;

    const routeFromFixture = row.fixture
      ? `${row.fixture.loadPort || ''} → ${row.fixture.dischargePort || ''}`
      : '';
    const route = parseRoute(row.route && row.route !== '—' ? row.route : routeFromFixture);
    const from = row.fixture?.loadPort || route.from;
    const to = row.fixture?.dischargePort || route.to;

    byImo.set(imoKey, {
      imo: imoKey,
      shipName: row.vessel || row.vesselName || row.fixture?.vesselName || '',
      voyageNo: row.voy || row.voyageNo || row.tcNo || row.fixture?.voyageNo || '',
      kind: row.kind || 'vc',
      comId: row.comId || '',
      fcaId: row.fcaId || null,
      cpDate: row.cpDate || row.fixture?.cpDate || '',
      routeFrom: from,
      routeTo: to,
      checklistHref: row.checklistHref || '',
    });
  });

  const meta = [...byImo.values()];
  if (!meta.length) {
    return { resultCode: 200, vessels: [], performingCount: 0 };
  }

  const comIds = meta.map((row) => row.comId);
  const [positions, sheetsByCom, commercialByCom] = await Promise.all([
    fetchLastPositionsForImos(meta.map((row) => row.imo), { concurrency: 10, timeoutMs: 8000 }),
    loadWorkingCostSheets(comIds),
    loadCommercialByComId(comIds),
  ]);
  const posByImo = new Map(
    positions.map((vessel) => [stripImo(vessel.ImoNumber), vessel]),
  );

  const identityFcaIds = meta.map((row) => {
    const sheet = sheetsByCom.get(String(row.comId));
    const fin = commercialByCom.get(String(row.comId)) || {};
    return sheet?.fcaId || fin.fcaId || row.fcaId || null;
  }).filter(Boolean);
  // Also include compare / header FCAIDs so passage can resolve from either source.
  const compareFcaIds = meta
    .map((row) => commercialByCom.get(String(row.comId))?.fcaId || row.fcaId)
    .filter(Boolean);
  const passageFcaIds = [...new Set([...identityFcaIds, ...compareFcaIds].map(Number).filter(Boolean))];
  const pool = isDbConfigured() ? getPool() : null;
  const [identityByFca, worksheetCommercialByFca, registeredOwnerByImo, passageByFca] = pool
    ? await Promise.all([
      loadVesselIdentityByFca(pool, identityFcaIds),
      loadWorksheetCommercialByFca(pool, identityFcaIds),
      loadRegisteredOwnersByImo(pool, meta.map((row) => row.imo)),
      loadCurrentLegsByFca(pool, passageFcaIds),
    ])
    : [new Map(), new Map(), new Map(), new Map()];

  const vessels = meta.map((row, index) => {
    const sheet = sheetsByCom.get(String(row.comId));
    const fin = commercialByCom.get(String(row.comId)) || {};
    const fcaKey = String(sheet?.fcaId || fin.fcaId || row.fcaId || '');
    const compareFcaKey = String(fin.fcaId || row.fcaId || '');
    const passage = (fcaKey && passageByFca.get(fcaKey))
      || (compareFcaKey && passageByFca.get(compareFcaKey))
      || {};
    const identity = (fcaKey && identityByFca.get(fcaKey)) || {};
    const wsCommercial = (fcaKey && worksheetCommercialByFca.get(fcaKey)) || {};
    const registeredOwner = registeredOwnerByImo.get(String(row.imo))
      || registeredOwnerByImo.get(stripImo(identity.imoNo))
      || '';
    const worksheetVesselName = identity.vesselName || row.shipName || '';
    const worksheetVesselType = identity.vesselType
      || (fin.vesselType && !/^\d+$/.test(String(fin.vesselType).trim())
        ? String(fin.vesselType).trim()
        : '');
    const sheetKind = row.kind === 'tc' ? 'tc' : (sheet?.sheetKind || 'vc');
    // Prefer Voyage Worksheet financials; fall back to compare/fixture master.
    const sheetTce = sheet ? resolveTceFromRow(sheet) : null;
    const sheetPnl = sheet ? resolvePnlFromRow(sheet) : null;
    let contract = 'spot';
    if (row.kind === 'tc') {
      contract = 'tc';
    } else if (fin.isPeriod) {
      contract = 'period';
    } else if (String(fin.coaSpot) === '2') {
      contract = 'coa';
    } else if (String(fin.coaSpot) === '1') {
      contract = 'spot';
    }

    const useWorksheetCommercial = contract !== 'tc';
    const passageFrom = passage.passageFrom || fin.from || row.routeFrom || '';
    const passageTo = passage.passageTo || fin.to || row.routeTo || '';
    const commercial = {
      contract,
      vesselName: worksheetVesselName,
      vesselType: worksheetVesselType,
      voyageNo: row.voyageNo,
      // Spot/COA/Period: Cargo name, Total Freight, FA Customer from working sheet.
      cargo: useWorksheetCommercial
        ? (wsCommercial.cargo || fin.cargo || '')
        : (fin.cargo || ''),
      laycan: fin.laycan || row.cpDate || '',
      rate: useWorksheetCommercial
        ? (wsCommercial.freightLabel || fin.rate || '')
        : (fin.rate || ''),
      charterer: useWorksheetCommercial
        ? (wsCommercial.charterer || fin.charterer || '')
        : (fin.charterer || ''),
      // Operated Vessels → Ownership and Operation → Registered owner (first line).
      owner: registeredOwner || fin.owner || '',
      terms: fin.terms || '',
      tce: sheetTce ?? fin.tce ?? null,
      pnl: sheetPnl ?? fin.pnl ?? null,
      from: passageFrom,
      to: passageTo,
      legFrom: passage.legFrom || fin.legFrom || passageFrom,
      legTo: passage.legTo || fin.legTo || passageTo,
      contacts: Array.isArray(fin.contacts) ? fin.contacts : [],
      workingCostSheetId: sheet?.costSheetId || null,
      workingSheetName: sheet?.sheetName || '',
      workingVfKind: sheetKind,
      comId: row.comId,
    };

    const ais = posByImo.get(row.imo);
    if (ais) {
      const lat = Number(ais.Latitude ?? ais.latitude ?? ais.Lat ?? ais.lat);
      const lng = Number(ais.Longitude ?? ais.longitude ?? ais.Lon ?? ais.lon ?? ais.Lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          ...ais,
          Latitude: lat,
          Longitude: lng,
          // Prefer Ops / Voyage Worksheet vessel name over AIS broadcast name.
          ShipName: worksheetVesselName || ais.ShipName || row.shipName,
          ImoNumber: identity.imoNo || ais.ImoNumber || row.imo,
          OriginDeclared: commercial.from || ais.OriginDeclared || row.routeFrom || '',
          DestDeclared: commercial.to || ais.DestDeclared || row.routeTo || '',
          isFleet: true,
          fleetKind: row.kind,
          fleetVoyageNo: row.voyageNo,
          fleetComId: row.comId,
          fleetPositionApprox: false,
          commercial,
        };
      }
    }

    // AIS missing / timed out: place near destination (then origin) port — not random hubs.
    const nearPort = approxCoordsForPortLabel(commercial.to || row.routeTo)
      || approxCoordsForPortLabel(commercial.from || row.routeFrom);
    const lat = nearPort
      ? nearPort.lat + ((index % 5) - 2) * 0.04
      : 20 + (index % 7) * 2;
    const lng = nearPort
      ? nearPort.lng + ((index % 4) - 1.5) * 0.04
      : 60 + (index % 6) * 3;
    return {
      ShipName: worksheetVesselName || row.shipName || `Fleet ${row.imo}`,
      ImoNumber: identity.imoNo || row.imo,
      Latitude: lat,
      Longitude: lng,
      OriginDeclared: commercial.from || row.routeFrom,
      DestDeclared: commercial.to || row.routeTo,
      PositionLastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ShipFlag: '',
      DraughtDeclared: '',
      NavigationStatus: 'Under way using engine',
      SpeedOverGround: null,
      isFleet: true,
      fleetKind: row.kind,
      fleetVoyageNo: row.voyageNo,
      fleetComId: row.comId,
      fleetPositionApprox: true,
      commercial,
    };
  });

  return {
    resultCode: 200,
    vessels,
    performingCount: meta.length,
  };
}
