import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';
import { deriveTcChecklist, deriveVcChecklist, formatRoute } from './opsChecklist.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || value.getUTCFullYear() < 1971) return '';
    return `${pad2(value.getUTCDate())}-${pad2(value.getUTCMonth() + 1)}-${value.getUTCFullYear()} ${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
  }
  const str = String(value).trim();
  if (!str || str.startsWith('0000-00-00') || str.startsWith('1970-01-01')) return '';
  if (/^\d{1,2}-\d{1,2}-\d{4}/.test(str)) {
    return str.replace(/:\d{2}$/, '').slice(0, 16);
  }
  const date = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1971) return '';
  return `${pad2(date.getUTCDate())}-${pad2(date.getUTCMonth() + 1)}-${date.getUTCFullYear()} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function formatDate(value) {
  const dmy = formatDateDMY(value);
  if (!dmy || dmy === '01-01-1970') return '';
  const withTime = formatDateTime(value);
  return withTime || dmy;
}

function firstDate(...values) {
  for (const value of values) {
    const formatted = formatDate(value);
    if (formatted) return formatted;
  }
  return '';
}

function activityKey(name) {
  return String(name || '').trim().toLowerCase();
}

function inList(ids) {
  const list = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
  return list;
}

async function getPortShortName(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
    [portId],
  ).catch(() => [[null]]);
  const name = row?.PortName ?? '';
  return name.split('/')[0] ?? name;
}

async function loadPortsForFca(pool, fcaId) {
  if (!fcaId) return { load: '', discharge: '' };
  const [legs] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY, PASSAGE_TYPE
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?`,
    [fcaId],
  ).catch(() => [[]]);
  const load = [];
  const discharge = [];
  for (const leg of legs || []) {
    if (Number(leg.PASSAGE_TYPE) === 2 || leg.PASSAGE_TYPE == null) {
      if (Number(leg.LOAD_PORT_QTY) > 0) {
        const name = await getPortShortName(pool, leg.FROM_PORT);
        if (name) load.push(name);
      }
      if (Number(leg.DISC_PORT_QTY) > 0) {
        const name = await getPortShortName(pool, leg.TO_PORT);
        if (name) discharge.push(name);
      }
    }
  }
  return {
    load: [...new Set(load)].join(', '),
    discharge: [...new Set(discharge)].join(', '),
  };
}

function pickSofField(rows, portType, field) {
  const match = (rows || []).find((row) => String(row.PORT || '').toUpperCase() === portType && formatDate(row[field]));
  return match ? { at: formatDate(match[field]), sofId: match.SOFID } : { at: '', sofId: null };
}

function pickKeyOp(opsBySof, sofId, names) {
  const wanted = new Set(names.map(activityKey));
  const rows = opsBySof.get(String(sofId)) || [];
  const hit = rows.find((row) => wanted.has(activityKey(row.ACTIVITY)) && formatDate(row.ACTIVITYDATETIME));
  return hit ? formatDate(hit.ACTIVITYDATETIME) : '';
}

function pickCargo(cargoBySof, sofId, name) {
  const rows = cargoBySof.get(String(sofId)) || [];
  const hit = rows.find((row) => activityKey(row.ACTIVITY) === activityKey(name));
  if (!hit) return '';
  const qty = String(hit.SHIPFIGURE || hit.BLFIGURE || '').trim();
  return qty || 'Recorded';
}

function pickChecklistEvent(events, comId, portType, names) {
  const wanted = new Set(names.map(activityKey));
  const rows = (events || []).filter(
    (row) => String(row.COMID) === String(comId) && String(row.PORT_TYPE || '').toUpperCase() === portType,
  );
  const hit = rows.find((row) => wanted.has(activityKey(row.EVENT_NAME)) && formatDate(row.ACTUAL_DATE));
  return hit ? formatDate(hit.ACTUAL_DATE) : '';
}

function latestReport(reports, imo) {
  const rows = reports.get(String(imo)) || [];
  return rows[0] || null;
}

function buildVcEvents({ header, ports, sofRows, opsBySof, cargoBySof, oldEvents, report }) {
  const lp = (sofRows || []).filter((row) => String(row.PORT || '').toUpperCase() === 'LP');
  const dp = (sofRows || []).filter((row) => String(row.PORT || '').toUpperCase() === 'DP');
  const lpSof = lp[0]?.SOFID;
  const dpSof = dp[0]?.SOFID;

  const arrivalLoad = firstDate(
    pickSofField(sofRows, 'LP', 'VAPS_1').at,
    pickKeyOp(opsBySof, lpSof, ['Arrived at NOR tendering area']),
    pickChecklistEvent(oldEvents, header.comId, 'LP', ['ACTUAL ARRIVAL', 'VESSEL ARRIVED']),
  );
  const norLoad = firstDate(
    pickSofField(sofRows, 'LP', 'NT_1').at,
    pickKeyOp(opsBySof, lpSof, ['NOR tendered']),
    pickChecklistEvent(oldEvents, header.comId, 'LP', ['NOR TENDERED', 'NOR']),
  );
  const loadingStart = firstDate(
    pickSofField(sofRows, 'LP', 'LC').at,
    pickKeyOp(opsBySof, lpSof, ['Commenced cargo operations']),
  );
  const loadingEnd = firstDate(
    pickSofField(sofRows, 'LP', 'LC1').at,
    pickKeyOp(opsBySof, lpSof, ['Completed cargo operations']),
    pickCargo(cargoBySof, lpSof, 'Cargo Loaded') ? pickSofField(sofRows, 'LP', 'LC1').at : '',
  );
  const cargoLoaded = pickCargo(cargoBySof, lpSof, 'Cargo Loaded');
  const loadingDone = Boolean(loadingEnd || cargoLoaded);
  const sailedLoad = firstDate(
    pickSofField(sofRows, 'LP', 'VS').at,
    pickKeyOp(opsBySof, lpSof, ['Full away on passage', 'EOSP']),
    pickChecklistEvent(oldEvents, header.comId, 'LP', ['VESSEL SAILED', 'ETC/D']),
    (loadingDone || loadingStart || arrivalLoad)
      && (report?.kind === 'DEPARTURE' || report?.kind === 'NOON')
      ? report.at
      : '',
  );
  const bunkers = pickCargo(cargoBySof, lpSof, 'Bunkers taken') || pickCargo(cargoBySof, dpSof, 'Bunkers taken');
  const arrivalDisch = firstDate(
    pickSofField(sofRows, 'DP', 'VAPS_1').at,
    pickKeyOp(opsBySof, dpSof, ['Arrived at NOR tendering area']),
    pickChecklistEvent(oldEvents, header.comId, 'DP', ['ACTUAL ARRIVAL', 'VESSEL ARRIVED']),
  );
  const norDisch = firstDate(
    pickSofField(sofRows, 'DP', 'NT_1').at,
    pickKeyOp(opsBySof, dpSof, ['NOR tendered']),
    pickChecklistEvent(oldEvents, header.comId, 'DP', ['NOR TENDERED', 'NOR']),
  );
  const dischargingStart = firstDate(
    pickSofField(sofRows, 'DP', 'LC').at,
    pickKeyOp(opsBySof, dpSof, ['Commenced cargo operations']),
  );
  const dischargingEnd = firstDate(
    pickSofField(sofRows, 'DP', 'LC1').at,
    pickKeyOp(opsBySof, dpSof, ['Completed cargo operations']),
  );
  const sailedDisch = firstDate(
    pickSofField(sofRows, 'DP', 'VS').at,
    pickKeyOp(opsBySof, dpSof, ['Full away on passage', 'EOSP']),
    pickChecklistEvent(oldEvents, header.comId, 'DP', ['VESSEL SAILED', 'ETC/D']),
  );

  const loadingStarted = Boolean(loadingStart || loadingDone);
  const dischargingDone = Boolean(dischargingEnd);
  const dischargingStarted = Boolean(dischargingStart || dischargingDone);

  return {
    fixture: { at: header.cpDate, source: 'Voyage Financials', done: Boolean(header.cpDate) },
    laycan: {
      at: [header.laycanFrom, header.laycanTo].filter(Boolean).join(' – '),
      source: 'Voyage Financials',
      done: Boolean(header.laycanFrom || header.laycanTo),
    },
    arrivalLoad: { at: arrivalLoad, source: arrivalLoad ? 'SOF / reports' : '', done: Boolean(arrivalLoad) },
    norLoad: { at: norLoad, source: norLoad ? 'SOF' : '', done: Boolean(norLoad) },
    loading: {
      at: loadingEnd || loadingStart,
      source: loadingStarted ? 'SOF' : '',
      started: loadingStarted,
      done: loadingDone,
      detail: cargoLoaded && cargoLoaded !== 'Recorded' ? cargoLoaded : '',
    },
    sailedLoad: { at: sailedLoad, source: sailedLoad ? 'SOF / reports' : '', done: Boolean(sailedLoad) },
    bunkering: {
      at: bunkers && bunkers !== 'Recorded' ? bunkers : (bunkers ? 'Recorded' : ''),
      source: bunkers ? 'SOF' : '',
      started: Boolean(bunkers),
      done: Boolean(bunkers),
    },
    arrivalDisch: { at: arrivalDisch, source: arrivalDisch ? 'SOF / reports' : '', done: Boolean(arrivalDisch) },
    norDisch: { at: norDisch, source: norDisch ? 'SOF' : '', done: Boolean(norDisch) },
    discharging: {
      at: dischargingEnd || dischargingStart,
      source: dischargingStarted ? 'SOF' : '',
      started: dischargingStarted,
      done: dischargingDone,
    },
    sailedDisch: { at: sailedDisch, source: sailedDisch ? 'SOF / reports' : '', done: Boolean(sailedDisch) },
    completed: {
      at: header.completed ? (sailedDisch || header.cpDate) : '',
      source: header.completed ? 'Ops status' : '',
      done: Boolean(header.completed),
    },
    loadPort: ports.load,
    dischargePort: ports.discharge,
  };
}

function buildTcEvents(header, checklist) {
  const arrivalDel = firstDate(checklist?.DEL_ARRI_DATA);
  const norDel = firstDate(checklist?.DEL_NORTEN_DATA);
  const deliveryAt = firstDate(header.delDate, checklist?.DEL_DATETIM_DATA);
  const arrivalRedel = firstDate(checklist?.RDEL_ARRI_DATA);
  const norRedel = firstDate(checklist?.RDEL_NORTEN_DATE, checklist?.RDEL_NORTEN_DATA);
  const redeliveryAt = firstDate(header.reDelDate, checklist?.RDEL_DATETIM_DATA);
  const delivered = Boolean(deliveryAt);
  const redelivered = Boolean(redeliveryAt);

  return {
    fixture: { at: header.cpDate, source: 'Voyage Financials', done: Boolean(header.cpDate) },
    laycan: {
      at: [header.laycanFrom || firstDate(checklist?.LAYCAN_FROM), header.laycanTo || firstDate(checklist?.LAYCAN_TO)]
        .filter(Boolean)
        .join(' – '),
      source: 'Voyage Financials',
      done: Boolean(header.laycanFrom || header.laycanTo || checklist?.LAYCAN_FROM || checklist?.LAYCAN_TO),
    },
    arrivalDel: { at: arrivalDel, source: arrivalDel ? 'ACT checklist' : '', done: Boolean(arrivalDel) },
    norDel: { at: norDel, source: norDel ? 'ACT checklist' : '', done: Boolean(norDel) },
    delivery: {
      at: deliveryAt,
      source: deliveryAt ? 'Voyage Financials' : '',
      detail: header.delPort || firstDate(checklist?.DEL_FO_DO_DATA) || '',
      done: delivered,
    },
    performing: {
      at: delivered && !redelivered ? deliveryAt : '',
      source: delivered ? 'Voyage Financials' : '',
      started: delivered && !redelivered,
      done: delivered && !redelivered,
    },
    arrivalRedel: { at: arrivalRedel, source: arrivalRedel ? 'ACT checklist' : '', done: Boolean(arrivalRedel) },
    norRedel: { at: norRedel, source: norRedel ? 'ACT checklist' : '', done: Boolean(norRedel) },
    redelivery: {
      at: redeliveryAt,
      source: redeliveryAt ? 'Voyage Financials' : '',
      detail: header.reDelPort || '',
      done: redelivered,
    },
  };
}

async function loadSofBundle(pool, comIds) {
  const ids = inList(comIds);
  if (!ids.length) {
    return { sofRows: [], opsBySof: new Map(), cargoBySof: new Map() };
  }
  const placeholders = ids.map(() => '?').join(',');
  const [sofRows] = await pool.query(
    `SELECT SOFID, COMID, PORT, PORTID, VAPS_1, NT_1, LC, LC1, VS
     FROM sof_master
     WHERE COMID IN (${placeholders}) AND MODULEID = ?
       AND LOGIN IN ('INTERNAL_USER', 'AGENT')
     ORDER BY FIELD(LOGIN, 'INTERNAL_USER', 'AGENT'), SOFID DESC`,
    [...ids, MODULE_ID],
  ).catch(() => [[]]);

  const seen = new Set();
  const unique = [];
  for (const row of sofRows || []) {
    const key = `${row.COMID}|${row.PORT}|${row.PORTID}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  const sofIds = unique.map((row) => row.SOFID).filter(Boolean);
  const opsBySof = new Map();
  const cargoBySof = new Map();
  if (sofIds.length) {
    const sofPlace = sofIds.map(() => '?').join(',');
    const [ops] = await pool.query(
      `SELECT SOFID, ACTIVITY, ACTIVITYDATETIME FROM sof_slave_6 WHERE SOFID IN (${sofPlace})`,
      sofIds,
    ).catch(() => [[]]);
    for (const row of ops || []) {
      const key = String(row.SOFID);
      if (!opsBySof.has(key)) opsBySof.set(key, []);
      opsBySof.get(key).push(row);
    }
    const [cargo] = await pool.query(
      `SELECT SOFID, ACTIVITY, SHIPFIGURE, BLFIGURE FROM sof_slave_7 WHERE SOFID IN (${sofPlace})`,
      sofIds,
    ).catch(() => [[]]);
    for (const row of cargo || []) {
      const key = String(row.SOFID);
      if (!cargoBySof.has(key)) cargoBySof.set(key, []);
      cargoBySof.get(key).push(row);
    }
  }

  return { sofRows: unique, opsBySof, cargoBySof };
}

async function loadOldChecklistEvents(pool, comIds) {
  const ids = inList(comIds);
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT CM.COMID, CPD.PORT_TYPE, CPD.EVENT_NAME, CPD.ACTUAL_DATE
     FROM checklist_port_data CPD
     INNER JOIN checklist_master CM ON CM.CHECKLIST_ID = CPD.CHECKLIST_ID
     WHERE CM.COMID IN (${placeholders})
       AND CPD.ACTUAL_DATE IS NOT NULL
       AND CPD.ACTUAL_DATE > '1970-01-01'`,
    ids,
  ).catch(() => [[]]);
  return rows || [];
}

async function loadLatestReports(pool, imoNos) {
  const imos = inList(imoNos);
  const byImo = new Map();
  if (!imos.length) return byImo;
  const placeholders = imos.map(() => '?').join(',');
  const queries = [
    [`SELECT IMO_NO, 'NOON' AS kind, REPORTING_DATETIME_LT AS at FROM sa_noon_master WHERE IMO_NO IN (${placeholders})`, imos],
    [`SELECT IMO_NO, 'DEPARTURE' AS kind, REPORTING_DATETIME_LT AS at FROM sa_departure_master WHERE IMO_NO IN (${placeholders})`, imos],
    [`SELECT IMO_NO, 'ARRIVAL' AS kind, REPORTING_DATETIME_LT AS at FROM sa_arrival_master WHERE IMO_NO IN (${placeholders})`, imos],
    [`SELECT IMO_NO, 'PORTMESSAGE' AS kind, REPORTING_DATETIME_LT AS at FROM sa_portmessage_master WHERE IMO_NO IN (${placeholders})`, imos],
  ];
  const all = [];
  for (const [sql, params] of queries) {
    const [rows] = await pool.query(sql, params).catch(() => [[]]);
    all.push(...(rows || []));
  }
  all.sort((a, b) => {
    const ta = a.at instanceof Date ? a.at.getTime() : Date.parse(a.at || 0) || 0;
    const tb = b.at instanceof Date ? b.at.getTime() : Date.parse(b.at || 0) || 0;
    return tb - ta;
  });
  for (const row of all) {
    const key = String(row.IMO_NO || '');
    if (!key || byImo.has(key)) continue;
    byImo.set(key, { kind: row.kind, at: formatDate(row.at) });
  }
  return byImo;
}

async function loadVcInOpsHeaders(pool, { selBType, comId } = {}) {
  const conditions = [
    'c.MODULEID = ?',
    'c.MCOMPANYID = ?',
    "c.FINAL_ID != ''",
    'm.FIXED = 1',
    'c.STATUS = 1',
  ];
  const params = [MODULE_ID, COMPANY_ID];
  if (selBType) {
    conditions.push('m.ESTIMATE_TYPE = ?');
    params.push(String(selBType));
  }
  if (comId) {
    conditions.push('c.COMID = ?');
    params.push(comId);
  }

  const where = conditions.join(' AND ');
  const sql = `
    SELECT
        c.COMID,
        c.STATUS AS OPS_STATUS,
        m.FCAID,
        m.VOYAGE_NO,
        m.TRANS_DATE,
        m.VESSEL_IMO_ID,
        m.TC_DELIVERY_DATE,
        m.TC_RE_DELIVERY_DATE,
        vim.VESSEL_NAME,
        vim.IMO_NO
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE ${where}
     ORDER BY DATE(m.FINAL_DATETIME) DESC, c.COMID DESC`;

  const [rows] = await pool.query(sql, params).catch(() => [[]]);

  return (rows || []).map((row) => ({
    comId: row.COMID,
    kind: 'vc',
    voyageNo: row.VOYAGE_NO || '',
    vesselName: row.VESSEL_NAME || '',
    vesselImoNo: row.IMO_NO || '',
    fcaId: row.FCAID,
    cpDate: formatDateDMY(row.TRANS_DATE),
    laycanFrom: '',
    laycanTo: '',
    vfDelivery: firstDate(row.TC_DELIVERY_DATE),
    vfRedelivery: firstDate(row.TC_RE_DELIVERY_DATE),
    completed: Number(row.OPS_STATUS) >= 2,
  }));
}

async function loadTcInOpsHeaders(pool, { selBType, comId } = {}) {
  const conditions = [
    'c.MODULEID = ?',
    'c.MCOMPANYID = ?',
    "c.FINAL_ID != ''",
    'm.FIXED = 1',
    'c.STATUS = 1',
  ];
  const params = [MODULE_ID, COMPANY_ID];
  if (selBType) {
    conditions.push('m.ESTIMATE_TYPE = ?');
    params.push(String(selBType));
  }
  if (comId) {
    conditions.push('c.COMID = ?');
    params.push(comId);
  }

  const [rows] = await pool.query(
    `SELECT
        c.COMID,
        m.TC_NO,
        m.CP_DATE1,
        m.DEL_DATE,
        m.RE_DEL_DATE,
        m.DEL_RANGE_PORT,
        m.RE_DEL_RANGE,
        m.LAYCAN_FROM,
        m.LAYCAN_TO,
        m.VESSEL_IMO_ID,
        vim.VESSEL_NAME,
        vim.IMO_NO
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE ${conditions.join(' AND ')}
     ORDER BY DATE(m.FINAL_DATETIME) DESC, c.COMID DESC`,
    params,
  ).catch(() => [[]]);

  return (rows || []).map((row) => ({
    comId: row.COMID,
    kind: 'tc',
    voyageNo: row.TC_NO || '',
    tcNo: row.TC_NO || '',
    vesselName: row.VESSEL_NAME || '',
    vesselImoNo: row.IMO_NO || '',
    cpDate: formatDateDMY(row.CP_DATE1),
    delDate: firstDate(row.DEL_DATE),
    reDelDate: firstDate(row.RE_DEL_DATE),
    delPort: row.DEL_RANGE_PORT || '',
    reDelPort: row.RE_DEL_RANGE || '',
    laycanFrom: firstDate(row.LAYCAN_FROM),
    laycanTo: firstDate(row.LAYCAN_TO),
  }));
}

async function loadTcChecklists(pool, comIds) {
  const ids = inList(comIds);
  const byCom = new Map();
  if (!ids.length) return byCom;
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT * FROM check_list_tc
     WHERE COMID IN (${placeholders}) AND MODULEID = ? AND MCOMPANYID = ?`,
    [...ids, MODULE_ID, COMPANY_ID],
  ).catch(() => [[]]);
  for (const row of rows || []) {
    byCom.set(String(row.COMID), row);
  }
  return byCom;
}

async function enrichVcRows(pool, headers) {
  if (!headers.length) return [];
  const comIds = headers.map((row) => row.comId);
  const { sofRows, opsBySof, cargoBySof } = await loadSofBundle(pool, comIds);
  const oldEvents = await loadOldChecklistEvents(pool, comIds);
  const reports = await loadLatestReports(pool, headers.map((row) => row.vesselImoNo));
  const sofByCom = new Map();
  for (const row of sofRows) {
    const key = String(row.COMID);
    if (!sofByCom.has(key)) sofByCom.set(key, []);
    sofByCom.get(key).push(row);
  }

  const latestByCom = new Map();
  const placeholders = inList(comIds).map(() => '?').join(',');
  if (placeholders) {
    const [latest] = await pool.query(
      `SELECT COMID, MAX(FCAID) AS FCAID
       FROM freight_cost_estimete_master
       WHERE COMID IN (${placeholders})
       GROUP BY COMID`,
      inList(comIds),
    ).catch(() => [[]]);
    for (const row of latest || []) {
      latestByCom.set(String(row.COMID), row.FCAID);
    }
  }

  const out = [];
  for (const header of headers) {
    const fcaId = latestByCom.get(String(header.comId)) || header.fcaId;
    if (headers.length === 1 && !header.laycanFrom && !header.laycanTo && fcaId) {
      try {
        const [[laycan]] = await pool.query(
          `SELECT LAYCANSTART, LAYCANEND, LAYCAN_START_DATE, LAYCAN_FINISH_DATE
           FROM freight_cost_estimete_master WHERE FCAID = ? LIMIT 1`,
          [fcaId],
        );
        header.laycanFrom = firstDate(laycan?.LAYCANSTART, laycan?.LAYCAN_START_DATE);
        header.laycanTo = firstDate(laycan?.LAYCANEND, laycan?.LAYCAN_FINISH_DATE);
      } catch {
        /* optional VF columns */
      }
    }
    const ports = await loadPortsForFca(pool, fcaId);
    const events = buildVcEvents({
      header,
      ports,
      sofRows: sofByCom.get(String(header.comId)) || [],
      opsBySof,
      cargoBySof,
      oldEvents,
      report: latestReport(reports, header.vesselImoNo),
    });
    const derived = deriveVcChecklist(events);
    const route = formatRoute(ports.load, ports.discharge, formatRoute(header.vfDelivery, header.vfRedelivery));
    out.push({
      id: `vc-${header.comId}`,
      kind: 'vc',
      comId: header.comId,
      vessel: header.vesselName || '—',
      voy: header.voyageNo || '—',
      tcNo: '',
      cpDate: header.cpDate || '—',
      route,
      status: derived.status,
      statusLabel: derived.statusLabel,
      wipId: derived.wipId,
      checklistHref: `/internal-user/vc/ops/checklist?comid=${encodeURIComponent(header.comId)}`,
      fixture: {
        vesselName: header.vesselName || '',
        voyageNo: header.voyageNo || '',
        cpDate: header.cpDate || '',
        loadPort: ports.load,
        dischargePort: ports.discharge,
      },
      steps: derived.steps,
    });
  }
  return out;
}

async function enrichTcRows(pool, headers) {
  if (!headers.length) return [];
  const checklists = await loadTcChecklists(pool, headers.map((row) => row.comId));
  return headers.map((header) => {
    const events = buildTcEvents(header, checklists.get(String(header.comId)));
    const derived = deriveTcChecklist(events);
    const route = formatRoute(header.delDate, header.reDelDate, formatRoute(header.delPort, header.reDelPort));
    return {
      id: `tc-${header.comId}`,
      kind: 'tc',
      comId: header.comId,
      vessel: header.vesselName || '—',
      voy: header.tcNo || '—',
      tcNo: header.tcNo || '—',
      cpDate: header.cpDate || '—',
      route,
      status: derived.status,
      statusLabel: derived.statusLabel,
      wipId: derived.wipId,
      checklistHref: `/internal-user/vc/ops-tc/checklist?comid=${encodeURIComponent(header.comId)}`,
      fixture: {
        vesselName: header.vesselName || '',
        voyageNo: header.tcNo || '',
        tcNo: header.tcNo || '',
        cpDate: header.cpDate || '',
        loadPort: header.delPort,
        dischargePort: header.reDelPort,
      },
      steps: derived.steps,
    };
  });
}

export async function dbListPerformingVessels({ kind = 'all', selBType = '2' } = {}) {
  const pool = getPool();
  const wantVc = kind === 'all' || kind === 'vc';
  const wantTc = kind === 'all' || kind === 'tc';
  const vcHeaders = wantVc ? await loadVcInOpsHeaders(pool, { selBType }) : [];
  const tcHeaders = wantTc ? await loadTcInOpsHeaders(pool, { selBType }) : [];
  const [vcRows, tcRows] = await Promise.all([
    enrichVcRows(pool, vcHeaders),
    enrichTcRows(pool, tcHeaders),
  ]);
  return { records: [...vcRows, ...tcRows] };
}

export async function dbGetOpsChecklist(comId, kindHint = '') {
  if (!comId) {
    const error = new Error('comId is required.');
    error.status = 400;
    throw error;
  }
  const pool = getPool();
  const hint = String(kindHint || '').toLowerCase();

  if (hint !== 'tc') {
    const vcHeaders = await loadVcInOpsHeaders(pool, { comId });
    if (vcHeaders.length) {
      const [row] = await enrichVcRows(pool, vcHeaders);
      return row;
    }
    // Also allow post-ops / history lookup for the page itself.
    const [[anyVc]] = await pool.query(
      `SELECT c.COMID FROM freight_cost_estimate_compare c
       WHERE c.COMID = ? AND c.MODULEID = ? LIMIT 1`,
      [comId, MODULE_ID],
    ).catch(() => [[null]]);
    if (anyVc?.COMID) {
      const [[row]] = await pool.query(
        `SELECT
            c.COMID, c.STATUS AS OPS_STATUS, m.FCAID, m.VOYAGE_NO, m.TRANS_DATE,
            m.VESSEL_IMO_ID, m.TC_DELIVERY_DATE, m.TC_RE_DELIVERY_DATE,
            vim.VESSEL_NAME, vim.IMO_NO
         FROM freight_cost_estimate_compare c
         INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
         LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
         WHERE c.COMID = ? AND c.MODULEID = ?
         ORDER BY m.FCAID DESC
         LIMIT 1`,
        [comId, MODULE_ID],
      ).catch(() => [[null]]);
      if (row) {
        const header = {
          comId: row.COMID,
          kind: 'vc',
          voyageNo: row.VOYAGE_NO || '',
          vesselName: row.VESSEL_NAME || '',
          vesselImoNo: row.IMO_NO || '',
          fcaId: row.FCAID,
          cpDate: formatDateDMY(row.TRANS_DATE),
          laycanFrom: '',
          laycanTo: '',
          vfDelivery: firstDate(row.TC_DELIVERY_DATE),
          vfRedelivery: firstDate(row.TC_RE_DELIVERY_DATE),
          completed: Number(row.OPS_STATUS) >= 2,
        };
        const [enriched] = await enrichVcRows(pool, [header]);
        return enriched;
      }
    }
  }

  const tcHeaders = await loadTcInOpsHeaders(pool, { comId });
  if (tcHeaders.length) {
    const [row] = await enrichTcRows(pool, tcHeaders);
    return row;
  }

  const [[anyTc]] = await pool.query(
    `SELECT c.COMID FROM chartering_estimate_tc_compare c
     WHERE c.COMID = ? AND c.MODULEID = ? LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);
  if (anyTc?.COMID) {
    const [[row]] = await pool.query(
      `SELECT
          c.COMID, m.TC_NO, m.CP_DATE1, m.DEL_DATE, m.RE_DEL_DATE,
          m.DEL_RANGE_PORT, m.RE_DEL_RANGE, m.LAYCAN_FROM, m.LAYCAN_TO,
          vim.VESSEL_NAME, vim.IMO_NO
       FROM chartering_estimate_tc_compare c
       INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
       LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       WHERE c.COMID = ? AND c.MODULEID = ?
       ORDER BY m.TCOUTID DESC
       LIMIT 1`,
      [comId, MODULE_ID],
    ).catch(() => [[null]]);
    if (row) {
      const header = {
        comId: row.COMID,
        kind: 'tc',
        voyageNo: row.TC_NO || '',
        tcNo: row.TC_NO || '',
        vesselName: row.VESSEL_NAME || '',
        vesselImoNo: row.IMO_NO || '',
        cpDate: formatDateDMY(row.CP_DATE1),
        delDate: firstDate(row.DEL_DATE),
        reDelDate: firstDate(row.RE_DEL_DATE),
        delPort: row.DEL_RANGE_PORT || '',
        reDelPort: row.RE_DEL_RANGE || '',
        laycanFrom: firstDate(row.LAYCAN_FROM),
        laycanTo: firstDate(row.LAYCAN_TO),
      };
      const [enriched] = await enrichTcRows(pool, [header]);
      return enriched;
    }
  }

  const error = new Error('Nomination not found.');
  error.status = 404;
  throw error;
}
