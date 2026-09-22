import { isDbConfigured, appContext } from '../config.js';
import { getPool } from '../db.js';
import { listPerformingVessels } from './opsChecklistService.js';
import { fetchLastPositionsForImos } from './vesselPositionService.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function stripImo(value) {
  return String(value || '').replace(/^IMO/i, '').replace(/\D/g, '').trim();
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

/** Prefer latest named cost sheet that has an estimate (Ops "working" sheet). */
async function loadWorkingCostSheets(comIds = []) {
  const byCom = new Map();
  if (!isDbConfigured() || !comIds.length) return byCom;
  const pool = getPool();
  const ids = [...new Set(comIds.map(Number).filter(Boolean))];
  if (!ids.length) return byCom;
  const placeholders = ids.map(() => '?').join(',');

  try {
    const [vcSheets] = await pool.query(
      `SELECT m.COMID, m.COST_SHEETID, m.SHEET_NAME, e.FCAID
       FROM cost_sheet_name_master m
       LEFT JOIN freight_cost_estimete_master e
         ON e.COMID = m.COMID AND e.SHEET_NO = m.COST_SHEETID
       WHERE m.COMID IN (${placeholders}) AND m.MODULEID = ? AND m.MCOMPANYID = ?
       ORDER BY m.COMID, m.COST_SHEETID DESC`,
      [...ids, MODULE_ID, COMPANY_ID],
    );
    for (const row of vcSheets || []) {
      const key = String(row.COMID);
      if (byCom.has(key)) continue;
      // Prefer sheets that already have a worksheet estimate
      if (row.FCAID == null) {
        // Keep looking for one with FCAID; fall back later
        continue;
      }
      byCom.set(key, {
        costSheetId: row.COST_SHEETID,
        sheetName: row.SHEET_NAME || `Sheet ${row.COST_SHEETID}`,
        sheetKind: 'vc',
      });
    }
    // Fall back to newest named sheet even without estimate
    for (const row of vcSheets || []) {
      const key = String(row.COMID);
      if (byCom.has(key)) continue;
      byCom.set(key, {
        costSheetId: row.COST_SHEETID,
        sheetName: row.SHEET_NAME || `Sheet ${row.COST_SHEETID}`,
        sheetKind: 'vc',
      });
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
      });
    }
  } catch {
    /* optional */
  }

  return byCom;
}

/** Latest VF financials + commercial fields per COMID. */
async function loadCommercialByComId(comIds = []) {
  const byCom = new Map();
  if (!isDbConfigured() || !comIds.length) return byCom;
  const pool = getPool();
  const ids = [...new Set(comIds.map(Number).filter(Boolean))];
  if (!ids.length) return byCom;
  const placeholders = ids.map(() => '?').join(',');

  try {
    const [rows] = await pool.query(
      `SELECT m.COMID, m.DAILY_EARNING, m.NET_DAILY_EARNING, m.PROFIT_LOSS, m.ACTUAL_PL,
              m.VESSEL_TYPE, m.PERIODID, m.WS, m.LUMPSUMAMT, m.CHK_LUMPSUM
       FROM freight_cost_estimete_master m
       WHERE m.MODULEID = ? AND m.MCOMPANYID = ?
         AND m.COMID IN (${placeholders})
         AND m.SHEET_NO IS NOT NULL AND m.SHEET_NO != '' AND m.SHEET_NO != 0
       ORDER BY m.COMID, CAST(m.SHEET_NO AS UNSIGNED) DESC, m.FCAID DESC`,
      [MODULE_ID, COMPANY_ID, ...ids],
    );
    for (const row of rows || []) {
      const key = String(row.COMID);
      if (byCom.has(key)) continue;
      const tce = toNumberOrNull(row.DAILY_EARNING)
        ?? toNumberOrNull(row.NET_DAILY_EARNING);
      const pnl = toNumberOrNull(row.ACTUAL_PL) ?? toNumberOrNull(row.PROFIT_LOSS);
      byCom.set(key, {
        vesselType: row.VESSEL_TYPE || '',
        cargo: '',
        charterer: '',
        owner: '',
        rate: row.WS ? `WS ${row.WS}` : '',
        laycan: '',
        tce,
        pnl,
        isPeriod: Number(row.PERIODID) > 0,
      });
    }
  } catch {
    /* optional — ACTUAL_PL / PERIODID may be missing */
    try {
      const [rows] = await pool.query(
        `SELECT m.COMID, m.DAILY_EARNING, m.NET_DAILY_EARNING, m.PROFIT_LOSS, m.VESSEL_TYPE
         FROM freight_cost_estimete_master m
         WHERE m.MODULEID = ? AND m.MCOMPANYID = ?
           AND m.COMID IN (${placeholders})
           AND m.SHEET_NO IS NOT NULL AND m.SHEET_NO != '' AND m.SHEET_NO != 0
         ORDER BY m.COMID, CAST(m.SHEET_NO AS UNSIGNED) DESC, m.FCAID DESC`,
        [MODULE_ID, COMPANY_ID, ...ids],
      );
      for (const row of rows || []) {
        const key = String(row.COMID);
        if (byCom.has(key)) continue;
        byCom.set(key, {
          vesselType: row.VESSEL_TYPE || '',
          cargo: '',
          charterer: '',
          owner: '',
          rate: '',
          laycan: '',
          tce: toNumberOrNull(row.DAILY_EARNING) ?? toNumberOrNull(row.NET_DAILY_EARNING),
          pnl: toNumberOrNull(row.PROFIT_LOSS),
          isPeriod: false,
        });
      }
    } catch {
      /* ignore */
    }
  }

  return byCom;
}

/**
 * Overlay Zafira performing (in-ops) vessels on the live map using AIS last positions.
 */
export async function fetchFleetOverlay() {
  const { records } = await listPerformingVessels({ kind: 'all' });
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
    fetchLastPositionsForImos(meta.map((row) => row.imo)),
    loadWorkingCostSheets(comIds),
    loadCommercialByComId(comIds),
  ]);
  const posByImo = new Map(
    positions.map((vessel) => [stripImo(vessel.ImoNumber), vessel]),
  );

  const vessels = meta.map((row, index) => {
    const sheet = sheetsByCom.get(String(row.comId));
    const fin = commercialByCom.get(String(row.comId)) || {};
    const sheetKind = row.kind === 'tc' ? 'tc' : (sheet?.sheetKind || 'vc');
    let contract = row.kind === 'tc' ? 'tc' : 'spot';
    if (fin.isPeriod) contract = 'period';

    const commercial = {
      contract,
      vesselType: fin.vesselType || '',
      voyageNo: row.voyageNo,
      cargo: fin.cargo || '',
      laycan: fin.laycan || row.cpDate || '',
      rate: fin.rate || '',
      charterer: fin.charterer || '',
      owner: fin.owner || '',
      terms: '',
      tce: fin.tce ?? null,
      pnl: fin.pnl ?? null,
      from: row.routeFrom,
      to: row.routeTo,
      legFrom: row.routeFrom,
      legTo: row.routeTo,
      contacts: [],
      workingCostSheetId: sheet?.costSheetId || null,
      workingSheetName: sheet?.sheetName || '',
      workingVfKind: sheetKind,
      comId: row.comId,
    };

    const ais = posByImo.get(row.imo);
    if (ais) {
      return {
        ...ais,
        ShipName: ais.ShipName || row.shipName,
        ImoNumber: ais.ImoNumber || row.imo,
        OriginDeclared: ais.OriginDeclared || row.routeFrom || '',
        DestDeclared: ais.DestDeclared || row.routeTo || '',
        isFleet: true,
        fleetKind: row.kind,
        fleetVoyageNo: row.voyageNo,
        fleetComId: row.comId,
        commercial,
      };
    }

    const hubs = [
      [1.26, 103.82],
      [51.95, 4.14],
      [25.27, 55.3],
      [29.45, -94.7],
      [31.23, 121.47],
    ];
    const [lat, lng] = hubs[index % hubs.length];
    return {
      ShipName: row.shipName || `Fleet ${row.imo}`,
      ImoNumber: row.imo,
      Latitude: lat + (index % 5) * 0.12,
      Longitude: lng + (index % 4) * 0.12,
      OriginDeclared: row.routeFrom,
      DestDeclared: row.routeTo,
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
