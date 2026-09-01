import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';
import { VC_CHECKLIST_STEPS } from './opsChecklist.js';
import { dbGetOpsChecklist } from './opsChecklistDb.js';
import { dbGetSofForm } from './sofDb.js';
import { dbGetLaytimeForm } from './laytimeDb.js';
import { dbGetBunkerForm } from './bunkerDb.js';
import { dbListVoyageReports } from './opsVcDb.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function str(value) {
  if (value == null) return '';
  return String(value).trim();
}

function hasText(value) {
  const text = str(value);
  return text !== '' && text !== '—';
}

function formatCpDate(value) {
  const dmy = formatDateDMY(value);
  if (!dmy || dmy === '01-01-1970') return '';
  return dmy;
}

async function getVendorName(pool, code) {
  const vendorId = str(code);
  if (!vendorId || vendorId === '0') return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1`,
    [vendorId],
  ).catch(() => [[null]]);
  return str(row?.NAME);
}

function pickLatestEta(preArrival = {}) {
  const keys = ['eta1', 'eta2', 'eta3', 'eta5', 'eta7', 'eta10', 'eta15', 'eta20', 'eta25', 'eta30'];
  for (const key of keys) {
    if (hasText(preArrival[key])) return preArrival[key];
  }
  return preArrival.actualArrival || '';
}

function buildCargoWork(dailyQty = [], totalQty = '') {
  const rows = Array.isArray(dailyQty) ? dailyQty.filter((row) => (
    hasText(row?.date)
    || hasText(row?.engagementQty)
    || hasText(row?.ttlLoad)
    || hasText(row?.balance)
    || hasText(row?.etcd)
  )) : [];
  const latest = rows.length ? rows[rows.length - 1] : null;
  if (!latest) {
    return {
      cwDate: '',
      cwTotalQty: totalQty,
      cwLddSoFar: '',
      cwBalance: totalQty,
      cwEtc: '',
      cwStatus: 'Pending',
      cwStatusTone: 'amber',
    };
  }
  const balance = str(latest.balance);
  const done = balance === '0' || balance === '0.00';
  return {
    cwDate: latest.date || '',
    cwTotalQty: totalQty || latest.ttlLoad || '',
    cwLddSoFar: latest.ttlLoad || latest.loadLast || '',
    cwBalance: balance || totalQty || '',
    cwEtc: latest.etcd || '',
    cwStatus: done ? 'Completed' : 'In Progress',
    cwStatusTone: done ? 'green' : 'amber',
  };
}

function buildLaytimeNote(laytimePort) {
  if (!laytimePort) {
    return { laytimeNote: 'Not yet commenced', laytimeMuted: true };
  }
  const allowed = str(laytimePort.laytimeAllowed);
  const actual = str(laytimePort.actualLaytime);
  if (actual) {
    const note = allowed
      ? `Actual laytime: ${actual} days (allowed: ${allowed})`
      : `Actual laytime: ${actual} days`;
    return { laytimeNote: note, laytimeMuted: false };
  }
  if (allowed) {
    return { laytimeNote: `Laytime allowed: ${allowed} days`, laytimeMuted: false };
  }
  return { laytimeNote: 'Not yet commenced', laytimeMuted: true };
}

function computeRouteProgress(steps = []) {
  const track = VC_CHECKLIST_STEPS.map((step) => step.id);
  let lastDoneIndex = 0;
  let currentIndex = 0;
  for (let index = 0; index < track.length; index += 1) {
    const step = steps.find((item) => item.id === track[index]);
    if (!step) continue;
    if (step.done) lastDoneIndex = index;
    if (step.started && !step.done) currentIndex = index;
  }
  const position = Math.max(lastDoneIndex, currentIndex);
  if (track.length <= 1) return 0;
  return Math.min(100, Math.max(0, Math.round((position / (track.length - 1)) * 100)));
}

function formatNoonLine(report) {
  if (!report) {
    return 'Position per Noon Report — unavailable (no live AIS / noon-report feed yet)';
  }
  const parts = [];
  if (hasText(report.nextPort)) parts.push(`Next port: ${report.nextPort}`);
  if (hasText(report.etaNextPort)) parts.push(`ETA: ${report.etaNextPort}`);
  if (hasText(report.latitude) && hasText(report.longitude)) {
    parts.push(`Position: ${report.latitude}, ${report.longitude}`);
  }
  if (hasText(report.distToGo)) parts.push(`Dist to go: ${report.distToGo} NM`);
  if (hasText(report.vesselCondition)) parts.push(report.vesselCondition);
  return parts.length
    ? parts.join(' · ')
    : 'Noon report on file';
}

function summarizePaymentRows(rows = []) {
  if (!rows.length) {
    return { chip: 'Draft', tone: 'grey', remarks: 'Not yet raised' };
  }
  const active = rows.filter((row) => Number(row.CANCEL_STATUS) !== 1 && Number(row.STATUS) !== 5);
  if (!active.length) {
    return { chip: 'Draft', tone: 'grey', remarks: 'Not yet raised' };
  }
  if (active.some((row) => str(row.PAYMENT_STATUS) === 'payment_hold')) {
    return { chip: 'Hold', tone: 'amber', remarks: 'Payment on hold' };
  }
  const paidCount = active.filter((row) => Number(row.P_AMT) > 0).length;
  if (paidCount === active.length) {
    return { chip: 'Paid', tone: 'green', remarks: `${paidCount} paid` };
  }
  if (paidCount > 0) {
    return { chip: 'Partial', tone: 'amber', remarks: `${paidCount}/${active.length} paid` };
  }
  const raised = active.filter((row) => Number(row.STATUS) >= 5).length;
  if (raised > 0) {
    return { chip: 'Raised', tone: 'blue', remarks: `${raised} invoice(s) raised` };
  }
  return { chip: 'Draft', tone: 'grey', remarks: 'Awaiting invoice' };
}

async function loadOwnerBroker(pool, fcaId) {
  if (!fcaId) return { owner: '', broker: '' };
  const [[row]] = await pool.query(
    `SELECT m.OWNER, m.BROKER,
            vo.NAME AS OWNER_NAME,
            vb.NAME AS BROKER_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vendor_master vo ON vo.CODE = m.OWNER
     LEFT JOIN vendor_master vb ON vb.CODE = m.BROKER
     WHERE m.FCAID = ?
     LIMIT 1`,
    [fcaId],
  ).catch(() => [[null]]);
  return {
    owner: str(row?.OWNER_NAME || row?.OWNER),
    broker: str(row?.BROKER_NAME || row?.BROKER),
  };
}

async function loadLegMap(pool, fcaId) {
  const map = new Map();
  if (!fcaId) return map;
  const [legs] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, RANDOMID, LOAD_PORT_QTY, DISC_PORT_QTY,
            LOAD_PORT_COST, DISC_PORT_COST, PORT_COSTLP_VENDOR, PORT_COSTDP_VENDOR
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
     ORDER BY FCA_SLAVEID ASC`,
    [fcaId],
  ).catch(() => [[]]);

  for (const leg of legs || []) {
    const randomId = str(leg.RANDOMID);
    map.set(`LP-${leg.FROM_PORT}-${randomId}`, {
      qty: leg.LOAD_PORT_QTY != null ? String(leg.LOAD_PORT_QTY) : '',
      vendorId: str(leg.PORT_COSTLP_VENDOR),
      portId: str(leg.FROM_PORT),
      randomId,
      requestName: 'Load Port Costs',
      daPort: 'LP',
    });
    map.set(`DP-${leg.TO_PORT}-${randomId}`, {
      qty: leg.DISC_PORT_QTY != null ? String(leg.DISC_PORT_QTY) : '',
      vendorId: str(leg.PORT_COSTDP_VENDOR),
      portId: str(leg.TO_PORT),
      randomId,
      requestName: 'Discharge Port Costs',
      daPort: 'DP',
    });
  }
  return map;
}

async function loadAgencyStatusByPort(pool, comId) {
  const map = new Map();
  const [rows] = await pool.query(
    `SELECT PORT, PORTID, RANDOMID, STATUS
     FROM generate_agency_letter
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     ORDER BY GEN_AGENCY_ID DESC`,
    [comId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[]]);
  for (const row of rows || []) {
    const key = `${str(row.PORT)}-${str(row.PORTID)}-${str(row.RANDOMID)}`;
    if (!map.has(key)) map.set(key, Number(row.STATUS || 0));
  }
  return map;
}

async function buildPdaStatus(pool, comId, portType, legMeta = {}, agencyByPort = new Map()) {
  const agencyKey = `${portType}-${legMeta.portId}-${legMeta.randomId}`;
  const agencyStatus = agencyByPort.get(agencyKey) || 0;
  let chip = 'Pending';
  let tone = 'amber';
  let remarks = 'Agent not nominated';

  if (agencyStatus >= 2) {
    chip = 'PDA Rcvd';
    remarks = 'Agent nominated';
    tone = 'green';
  } else if (agencyStatus > 0) {
    chip = 'PDA Draft';
    remarks = 'Agency letter in progress';
    tone = 'grey';
  }

  if (legMeta.vendorId && legMeta.portId && legMeta.requestName) {
    const [[payment]] = await pool.query(
      `SELECT SUM(P_AMT) AS P_AMT, COUNT(*) AS CNT
       FROM request_master
       WHERE GRADEID = ? AND NAME = ? AND COMID = ? AND VENDOR = ? AND STATUS >= 5`,
      [legMeta.portId, legMeta.requestName, comId, legMeta.vendorId],
    ).catch(() => [[null]]);
    if (Number(payment?.CNT) > 0) {
      if (Number(payment?.P_AMT) > 0) {
        chip = 'Paid';
        tone = 'green';
        remarks = 'Port cost paid';
      } else {
        chip = 'FDA Pending';
        tone = 'amber';
        remarks = 'Port cost raised, payment pending';
      }
    }
  }

  if (legMeta.daPort && legMeta.vendorId && legMeta.portId && legMeta.randomId) {
    const daClubbed = await pool.query(
      `SELECT COUNT(*) AS count FROM freight_invoice_slave_da
       WHERE PORTID = ? AND RANDOMID = ? AND PORT = ? AND VENDORID = ?`,
      [legMeta.portId, legMeta.randomId, legMeta.daPort, legMeta.vendorId],
    ).then(([result]) => Number(result?.[0]?.count || 0)).catch(() => 0);
    if (daClubbed > 0) {
      chip = 'FDA Rcvd';
      tone = 'green';
      remarks = 'FDA on file';
    }
  }

  return { pdaStatus: chip, pdaRemarks: remarks, pdaTone: tone };
}

function buildBunkerPayload(bunkerForm) {
  const nameById = new Map();
  for (const grade of bunkerForm?.lookups?.foGrades || []) {
    nameById.set(str(grade.id), str(grade.name));
  }
  for (const grade of bunkerForm?.lookups?.doGrades || []) {
    nameById.set(str(grade.id), str(grade.name));
  }

  const grades = [];
  let stemmed = false;
  for (const port of bunkerForm?.ports || []) {
    const rows = [...(port.foRows || []), ...(port.doRows || [])];
    for (const row of rows) {
      if (!str(row.bunkerId)) continue;
      if (Number(row.qtyStemmed) > 0) stemmed = true;
      grades.push({
        grade: nameById.get(str(row.bunkerId)) || str(row.bunkerId),
        date: port.sospDate || '',
        shipFig: row.robSosp || '',
        rcptFig: row.qtyStemmed || '',
        supplier: '—',
        barge: '—',
        price: row.supplyPrice || row.effectivePrice || '',
        remarks: row.remarks || '',
        muted: false,
      });
    }
  }
  return { bunkersStemmed: stemmed, bunkerGrades: grades };
}

async function loadFinancials(pool, comId) {
  const [freightRows] = await pool.query(
    `SELECT STATUS, P_AMT, PAYMENT_STATUS, CANCEL_STATUS
     FROM freight_invoice_master
     WHERE COMID = ?`,
    [comId],
  ).catch(() => [[]]);
  const [demRows] = await pool.query(
    `SELECT STATUS, P_AMT, PAYMENT_STATUS, CANCEL_STATUS, P_TYPE
     FROM other_invoice_master
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       AND (P_TYPE LIKE '%Demurrage%' OR P_TYPE LIKE '%Dispatch%')`,
    [comId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[]]);
  const [brokerRows] = await pool.query(
    `SELECT STATUS, P_AMT, PAYMENT_STATUS, CANCEL_STATUS, COST_DESC
     FROM request_master
     WHERE COMID = ? AND COST_DESC LIKE '%brokerage%'`,
    [comId],
  ).catch(() => [[]]);
  const [bunkerRows] = await pool.query(
    `SELECT STATUS, P_AMT, PAYMENT_STATUS, CANCEL_STATUS, COST_DESC
     FROM request_master
     WHERE COMID = ? AND (COST_DESC LIKE '%Bunker%' OR NAME LIKE '%Bunker%')`,
    [comId],
  ).catch(() => [[]]);
  const [hireRows] = await pool.query(
    `SELECT STATUS, P_AMT, PAYMENT_STATUS, CANCEL_STATUS
     FROM invoice_hire_master
     WHERE COMID = ?`,
    [comId],
  ).catch(() => [[]]);

  return [
    { name: 'Freight Invoice', ...summarizePaymentRows(freightRows), linkKey: 'cashflow' },
    {
      name: 'Demurrage Invoice',
      ...summarizePaymentRows(demRows),
      remarks: demRows.length ? summarizePaymentRows(demRows).remarks : 'Awaiting SOF from DP',
      linkKey: 'cashflow',
    },
    { divider: true },
    { name: 'Brokerage', ...summarizePaymentRows(brokerRows), linkKey: 'payment' },
    { name: 'Bunkers', ...summarizePaymentRows(bunkerRows), linkKey: 'bunker' },
    {
      name: 'Hire',
      ...summarizePaymentRows(hireRows),
      remarksMuted: !hireRows.length,
      linkKey: 'payment',
    },
  ];
}

function mapSofPort(port, legMeta, laytimePort, cargoName, charterer, laycan, poolMeta) {
  const preArrival = port.preArrival || {};
  const cargoWork = buildCargoWork(port.dailyQty, legMeta?.qty || port.stowageQty || '');
  const laytime = buildLaytimeNote(laytimePort);
  const agent = str(port.entityRows?.[0]?.value)
    || str(port.entityRows?.[0]?.name)
    || poolMeta?.agentName
    || '';

  return {
    key: port.key,
    kind: port.portType,
    name: port.portName,
    cargo: cargoName,
    qty: legMeta?.qty || port.stowageQty || '',
    laycan,
    shipper: charterer,
    agent,
    draftRestriction: '',
    cargoRate: str(laytimePort?.loadedRate),
    arrDraft: preArrival.spArrDraft || '',
    depDraft: preArrival.spDeptDraft || '',
    eta: pickLatestEta(preArrival),
    etb: '',
    arrived: port.vesselArrived || preArrival.actualArrival || '',
    nor: port.norTendered || preArrival.norTendered || '',
    commenced: port.loadCommenced || '',
    completed: port.loadCompleted || '',
    sailed: port.vesselSailed || '',
    ...cargoWork,
    ...laytime,
    masterSignedCargo: Boolean(preArrival.cargoDecl),
  };
}

export async function dbGetVoyageStatus(comId, options = {}) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const kind = str(options.kind || options.mode || 'vc').toLowerCase() || 'vc';
  const checklist = await dbGetOpsChecklist(comId, kind === 'tc' ? 'tc' : '');
  const steps = checklist?.steps || [];
  const progressPercent = computeRouteProgress(steps);

  let sofForm = null;
  let laytimeForm = null;
  let bunkerForm = null;
  let noonReport = null;

  if (kind !== 'tc') {
    [sofForm, laytimeForm, bunkerForm] = await Promise.all([
      dbGetSofForm(comId).catch(() => null),
      dbGetLaytimeForm(comId).catch(() => null),
      dbGetBunkerForm(comId).catch(() => null),
    ]);
  }

  const vesselImoNo = sofForm?.vesselParticulars?.imoNo
    || bunkerForm?.vesselImoNo
    || '';
  let resolvedImo = vesselImoNo;
  if (!resolvedImo) {
    const [[imoRow]] = await pool.query(
      `SELECT vim.IMO_NO
       FROM freight_cost_estimate_compare c
       LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
       LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       WHERE c.COMID = ? AND c.MODULEID = ?
       LIMIT 1`,
      [comId, MODULE_ID],
    ).catch(() => [[null]]);
    resolvedImo = str(imoRow?.IMO_NO);
  }
  if (resolvedImo) {
    const reports = await dbListVoyageReports({ vesselImoNo: resolvedImo, comId }).catch(() => null);
    const latestNoon = (reports?.records || []).find((row) => row.reportType === 'NOON')
      || (reports?.records || [])[0];
    noonReport = latestNoon || null;
  }

  const fcaId = sofForm?.fcaId || laytimeForm?.fcaId || bunkerForm?.fcaId || checklist?.fixture?.fcaId;
  const ownerBroker = await loadOwnerBroker(pool, fcaId);
  const legMap = await loadLegMap(pool, fcaId);
  const agencyByPort = await loadAgencyStatusByPort(pool, comId);
  const laycan = steps.find((step) => step.id === 'laycan')?.at || '';

  const cargoName = (sofForm?.cargo || laytimeForm?.cargo || []).join(', ')
    || checklist?.fixture?.cargo
    || '';
  const charterer = bunkerForm?.charterer || laytimeForm?.charterer || checklist?.fixture?.charterer || '';

  const ports = [];
  const sofPorts = sofForm?.ports || [];
  for (const port of sofPorts) {
    const legMeta = legMap.get(`${port.portType}-${port.portId}-${port.randomId}`) || {};
    const laytimePort = (laytimeForm?.ports || []).find((item) => item.key === port.key)
      || (laytimeForm?.ports || []).find((item) => (
        item.portType === port.portType && String(item.portId) === String(port.portId)
      ));
    const pda = await buildPdaStatus(pool, comId, port.portType, legMeta, agencyByPort);
    ports.push({
      ...mapSofPort(
        port,
        legMeta,
        laytimePort,
        cargoName,
        charterer,
        laycan,
        { agentName: '' },
      ),
      ...pda,
    });
  }

  if (!ports.length && kind === 'tc') {
    const delName = checklist?.fixture?.loadPort || '';
    const reDelName = checklist?.fixture?.dischargePort || '';
    if (delName) {
      ports.push({
        key: `Del-${delName}`,
        kind: 'Del',
        name: delName,
        laytimeNote: 'Not yet commenced',
        laytimeMuted: true,
        pdaStatus: 'Pending',
        pdaRemarks: '—',
        pdaTone: 'amber',
      });
    }
    if (reDelName) {
      ports.push({
        key: `ReDel-${reDelName}`,
        kind: 'Re-Del',
        name: reDelName,
        laytimeNote: 'Not yet commenced',
        laytimeMuted: true,
        pdaStatus: 'Pending',
        pdaRemarks: '—',
        pdaTone: 'amber',
      });
    }
  }

  const bunkerPayload = kind === 'tc' ? { bunkersStemmed: false, bunkerGrades: [] } : buildBunkerPayload(bunkerForm);
  const financials = await loadFinancials(pool, comId);
  const dpPort = ports.find((port) => port.kind === 'DP');
  const masterSignedCargo = dpPort?.masterSignedCargo || false;

  const voyageLabel = kind === 'tc'
    ? [checklist?.tcNo || checklist?.voy].filter(hasText).join(' / ')
    : [checklist?.fixture?.voyageNo || checklist?.voy].filter(hasText).join(' / ');

  return {
    comId: String(comId),
    kind,
    identifiers: {
      vesselName: checklist?.fixture?.vesselName || checklist?.vessel || '',
      voyage: voyageLabel,
      cpDate: checklist?.fixture?.cpDate || checklist?.cpDate || formatCpDate(checklist?.cpDate),
      charterer,
      owner: ownerBroker.owner,
      broker: ownerBroker.broker,
      lastPortAgent: ports.length ? (ports[ports.length - 1]?.agent || '') : '',
      statutoryCerts: false,
      insuranceDesk: false,
      charterersPiIdentified: false,
      masterSignedCargo,
      charterersPi: '—',
    },
    route: {
      loadPort: ports[0]?.name || checklist?.fixture?.loadPort || '',
      dischargePort: ports.length > 1 ? ports[ports.length - 1]?.name : (checklist?.fixture?.dischargePort || ''),
      progressPercent,
      noonReport: formatNoonLine(noonReport),
    },
    ports,
    bunkers: bunkerPayload,
    financials,
  };
}
