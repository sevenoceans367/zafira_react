import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { ESTIMATE_TYPE_LABELS, formatDateDMY } from './estimateListMappers.js';
import {
  ensureCommercialParametersFromNavApi,
  loadCommercialParameterRow,
} from './commercialParametersNavApiSeed.js';
import { CANAL_ORC_IDS, getSuezScnt } from './canalOrcService.js';

/** PHP often stores INT_MAX as a placeholder RANDOMID for new/unsaved rows. */
const PLACEHOLDER_RANDOM_ID = '2147483647';

function pickRowId(...candidates) {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const value = String(candidate);
    if (value === PLACEHOLDER_RANDOM_ID) continue;
    return value;
  }
  return null;
}

function toDbDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Accept dd-mm-yyyy or dd-mm-yyyy HH:MM — do not split year on space/time.
  const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

function toDbDateTime(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str.startsWith('0000-00-00')) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const datePart = str.slice(0, 10);
    const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const [, h, mi, s = '00'] = timeMatch;
      return `${datePart} ${h.padStart(2, '0')}:${mi}:${String(s).padStart(2, '0')}`;
    }
    return `${datePart} 00:00:00`;
  }
  const m = str.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    const [, d, mo, y, h = '00', mi = '00', s = '00'] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')} ${String(h).padStart(2, '0')}:${mi}:${String(s).padStart(2, '0')}`;
  }
  return str;
}

/**
 * Format DB datetime as PHP date('d-m-Y H:i') — wall-clock, no timezone shift.
 * mysql2 may return Date objects or 'YYYY-MM-DD HH:mm:ss' strings.
 */
function formatDateTimeDMY(value) {
  if (!value) return '';

  const rejectYear = (y) => {
    const year = Number(y);
    return !Number.isFinite(year) || year < 1971;
  };

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    // mysql2 maps DATETIME to a local Date with the same wall-clock parts.
    const d = String(value.getDate()).padStart(2, '0');
    const mo = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    const hh = String(value.getHours()).padStart(2, '0');
    const mi = String(value.getMinutes()).padStart(2, '0');
    if (rejectYear(y)) return '';
    return `${d}-${mo}-${y} ${hh}:${mi}`;
  }

  const str = String(value).trim();
  if (!str || str.startsWith('0000-00-00') || str.startsWith('1970-01-01')) return '';
  // Already-formatted empty placeholders from legacy PHP / flatpickr
  if (/^0?1[-/]0?1[-/]1970\b/.test(str)) return '';

  // MySQL DATETIME / ISO without relying on Date() timezone conversion.
  const wall = str.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (wall) {
    const [, y, mo, d, h = '00', mi = '00'] = wall;
    if (rejectYear(y)) return '';
    return `${d}-${mo}-${y} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  }

  const dmy = str.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/,
  );
  if (dmy) {
    const [, d, mo, y, h = '00', mi = '00'] = dmy;
    if (rejectYear(y)) return '';
    return `${d.padStart(2, '0')}-${mo.padStart(2, '0')}-${y} ${String(h).padStart(2, '0')}:${mi}`;
  }

  return str;
}

/** Prefer header laycan columns (LAYCANSTART/END); fall back to legacy DATE columns. */
function pickLaycanDateTime(...candidates) {
  for (const candidate of candidates) {
    const formatted = formatDateTimeDMY(candidate);
    if (formatted) return formatted;
  }
  return '';
}

function numOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Idle/portstay day fields — keep as 3dp numeric strings. */
function formatIdleDaysValue(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return '';
  }
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '';
  return (Math.round((n + Number.EPSILON) * 1000) / 1000).toFixed(3);
}

/** PHP: intval(rand(1,9).rand(0,9)... ) — 5-digit, fits MySQL INT. */
function randomId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function resolveTankWsPorts(payload) {
  const firstRow = (payload.tankerWsRows || [])[0];
  const from = payload.tankWsFrom || firstRow?.wsFromPortId || null;
  const to = payload.tankWsTo || firstRow?.wsToPortId || null;
  return { from: from || null, to: to || null };
}

function portNamesFromIds(raw, nameById) {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((id) => nameById[id] || id)
    .join(', ');
}

async function enrichTankerWsPortNames(pool, detail) {
  const ids = new Set();
  const collect = (raw) => {
    String(raw || '').split(',').forEach((part) => {
      const id = part.trim();
      if (id) ids.add(id);
    });
  };

  collect(detail.tankWsFrom);
  collect(detail.tankWsTo);
  for (const row of detail.tankerWsRows || []) {
    collect(row.wsFromPortId);
    collect(row.wsToPortId);
  }
  if (!ids.size) return detail;

  const [portRows] = await pool.query(
    `SELECT PortId, PortName FROM port_master WHERE PortId IN (?)`,
    [[...ids]],
  );
  const nameById = Object.fromEntries(
    portRows.map((row) => [String(row.PortId), row.PortName || '']),
  );

  const tankerWsRows = (detail.tankerWsRows || []).map((row, index) => {
    const fromIds = row.wsFromPortId || (index === 0 ? detail.tankWsFrom : '');
    const toIds = row.wsToPortId || (index === 0 ? detail.tankWsTo : '');
    return {
      ...row,
      wsFromPortName: row.wsFromPortName || portNamesFromIds(fromIds, nameById),
      wsToPortName: row.wsToPortName || portNamesFromIds(toIds, nameById),
    };
  });

  return { ...detail, tankerWsRows };
}

function applyMasterTankWsPorts(detail, master) {
  const tankWsFrom = master.TANK_WS_FROM != null ? String(master.TANK_WS_FROM) : '';
  const tankWsTo = master.TANK_WS_TO != null ? String(master.TANK_WS_TO) : '';
  if (!tankWsFrom && !tankWsTo) return detail;

  const tankerWsRows = [...(detail.tankerWsRows || [])];
  if (tankerWsRows.length) {
    tankerWsRows[0] = {
      ...tankerWsRows[0],
      wsFromPortId: tankerWsRows[0].wsFromPortId || tankWsFrom,
      wsToPortId: tankerWsRows[0].wsToPortId || tankWsTo,
    };
  }

  return {
    ...detail,
    tankWsFrom,
    tankWsTo,
    tankerWsRows,
  };
}

async function resolveScntForDetail(detail) {
  const suezOrc = (detail.orcRows || []).find(
    (row) => String(row.costId) === CANAL_ORC_IDS.suez,
  );
  if (!suezOrc) return detail;

  try {
    const ladenLeg = (detail.portLegs || []).some((leg) => String(leg.passageType) === '2');
    const scnt = await getSuezScnt({
      businessType: detail.estimateType,
      dwt: detail.dwtSummer || detail.loadable || 0,
      passageType: ladenLeg ? '2' : '1',
      vesselType: detail.vesselType,
    });
    return {
      ...detail,
      scnt: String(Math.round(scnt * 100) / 100),
    };
  } catch {
    return detail;
  }
}

function mapPortLeg(row, index) {
  const fromArrivalRaw = row.FROMARRIVAL_DMY ?? row.FROMARRIVAL ?? row.fromarrival ?? row.FromArrival;
  const fromDepartureRaw = row.FROMDEPARTURE_DMY ?? row.FROMDEPARTURE ?? row.fromdeparture ?? row.FromDeparture;
  const toArrivalRaw = row.TOARRIVAL_DMY ?? row.TOARRIVAL ?? row.toarrival ?? row.ToArrival;
  const toDepartureRaw = row.TODEPARTURE_DMY ?? row.TODEPARTURE ?? row.todeparture ?? row.ToDeparture;

  return {
    id: pickRowId(row.RANDOMID, row.FCA_SLAVEID, row.FCA_SLVID) || `${row.FCAID}-${index}`,
    fromPortId: row.FROM_PORT,
    toPortId: row.TO_PORT,
    navMethod: row.DIS_TYPE != null && row.DIS_TYPE !== '' ? String(row.DIS_TYPE) : '',
    fromPortName: row.FROM_PORT_NAME ?? '',
    toPortName: row.TO_PORT_NAME ?? '',
    passageType: row.PASSAGE_TYPE,
    speedType: row.SPEED_TYPE,
    loadQty: row.LOAD_PORT_QTY,
    dischargeQty: row.DISC_PORT_QTY,
    distance: row.DISTANCE ?? '',
    seaDays: row.TOTAL_VOYAGE_DAYS ?? row.SEA_DAYS ?? '',
    seaMargin: row.MARGIN_DISTANCE ?? '0',
    fromArrival: formatDateTimeDMY(fromArrivalRaw),
    fromDeparture: formatDateTimeDMY(fromDepartureRaw),
    toArrival: formatDateTimeDMY(toArrivalRaw),
    toDeparture: formatDateTimeDMY(toDepartureRaw),
    // PHP updatecost_sheet_tci Passage & Ports ROB columns
    fromRobFoArrival: row.FROMROBFOARRIVAL != null ? String(row.FROMROBFOARRIVAL) : '',
    fromRobDoArrival: row.FROMROBDOARRIVAL != null ? String(row.FROMROBDOARRIVAL) : '',
    fromRobFoDeparture: row.FROMROBFODEPARTURE != null ? String(row.FROMROBFODEPARTURE) : '',
    fromRobDoDeparture: row.FROMROBDODEPARTURE != null ? String(row.FROMROBDODEPARTURE) : '',
    toRobFoArrival: row.TOROBFOARRIVAL != null ? String(row.TOROBFOARRIVAL) : '',
    toRobDoArrival: row.TOROBDOARRIVAL != null ? String(row.TOROBDOARRIVAL) : '',
    toRobFoDeparture: row.TOROBFODEPARTURE != null ? String(row.TOROBFODEPARTURE) : '',
    toRobDoDeparture: row.TOROBDODEPARTURE != null ? String(row.TOROBDODEPARTURE) : '',
    loadPortCost: row.LOAD_PORT_COST ?? '',
    discPortCost: row.DISC_PORT_COST ?? '',
    loadPortRate: row.LOAD_PORT_RATE ?? '',
    discPortRate: row.DISC_PORT_RATE ?? '',
    loadPortTerms: row.LOAD_PORT_TERMS != null ? String(row.LOAD_PORT_TERMS) : '1',
    discPortTerms: row.DISC_PORT_TERMS != null ? String(row.DISC_PORT_TERMS) : '1',
    loadPortWorkDays: row.LOAD_PORT_WORK_DAYS ?? '',
    discPortWorkDays: row.DISC_PORT_WORK_DAYS ?? '',
    loadPortIdleDays: formatIdleDaysValue(row.LOAD_PORT_IDEAL_DAYS),
    discPortIdleDays: formatIdleDaysValue(row.DISC_PORT_IDEAL_DATE),
    transitIdleDays: formatIdleDaysValue(row.TRANSIT_PORT_IDLE_DAYS),
    secaDistance: row.SECA_DISTANCE ?? '',
    nonSecaDistance: row.NON_SECA_DISTANCE ?? '',
    secaDays: row.SECA_DAYS ?? '',
    transitPortCost: row.TRANSIT_PORT_COST ?? '',
    ddcLpEst: row.DDCLP_ESTCOST ?? '',
    ddcDpEst: row.DDCDP_ESTCOST ?? '',
    ddcLpReal: row.DDCLP_REALCOST ?? '',
    ddcDpReal: row.DDCDP_REALCOST ?? '',
    ddcLpNett: row.DDCLP_NETCOST ?? '',
    ddcDpNett: row.DDCDP_NETCOST ?? '',
    demmDaysLp: row.DEMMDAYSLP ?? '',
    demmRateLp: row.DEMMRATELP ?? '',
    demmDaysDp: row.DEMMDAYSDP ?? '',
    demmRateDp: row.DEMMRATEDP ?? '',
    chkLpSeca: Number(row.CHK_LP_SECA) === 1,
    chkDpSeca: Number(row.CHK_DP_SECA) === 1,
    chkTpSeca: Number(row.CHK_TP_SECA) === 1,
    // PHP selNSBG / selSBG
    bgNonSeca: row.BG_NON_SECA || 'VLSFO',
    bgSeca: row.BG_SECA || 'LSMGO',
    // PHP targetSelectLp_ / targetSelectDp_ → SEL_CARGO_LP / SEL_CARGO_DP (0 = empty)
    lpCargoId: (() => {
      const raw = row.SEL_CARGO_LP != null ? String(row.SEL_CARGO_LP).trim() : '';
      return raw && raw !== '0' ? raw : '';
    })(),
    dpCargoId: (() => {
      const raw = row.SEL_CARGO_DP != null ? String(row.SEL_CARGO_DP).trim() : '';
      return raw && raw !== '0' ? raw : '';
    })(),
    lpBunkerGrades: (row.BUNKER_GRADE_LP || row.LOAD_PORT_BUNKER_GRADE)
      ? String(row.BUNKER_GRADE_LP || row.LOAD_PORT_BUNKER_GRADE).split(',').map((s) => s.trim()).filter(Boolean)
      : ['VLSFO'],
    dpBunkerGrades: (row.BUNKER_GRADE_DP || row.DISC_PORT_BUNKER_GRADE)
      ? String(row.BUNKER_GRADE_DP || row.DISC_PORT_BUNKER_GRADE).split(',').map((s) => s.trim()).filter(Boolean)
      : ['VLSFO'],
    tpBunkerGrades: (row.BUNKER_GRADE_TP || row.TRANSIT_PORT_BUNKER_GRADE)
      ? String(row.BUNKER_GRADE_TP || row.TRANSIT_PORT_BUNKER_GRADE).split(',').map((s) => s.trim()).filter(Boolean)
      : ['VLSFO'],
    chartererAccountDays: row.CHARTERERACCOUNT ?? row.CHARTERER_ACCOUNT_DAYS ?? row.CA_DAYS ?? '',
    portFunction: row.PORT_FUNCTION ?? row.PORT_FUN ?? row.CHK_MAND ?? '',
    tpPortVendorId: row.PORT_COSTTP_VENDOR != null && String(row.PORT_COSTTP_VENDOR).trim() !== ''
      ? String(row.PORT_COSTTP_VENDOR).trim()
      : '',
    lpPortVendorId: row.PORT_COSTLP_VENDOR != null && String(row.PORT_COSTLP_VENDOR).trim() !== ''
      ? String(row.PORT_COSTLP_VENDOR).trim()
      : '',
    dpPortVendorId: row.PORT_COSTDP_VENDOR != null && String(row.PORT_COSTDP_VENDOR).trim() !== ''
      ? String(row.PORT_COSTDP_VENDOR).trim()
      : '',
    ddcLpVendorId: row.DDCLP_VENDOR != null && String(row.DDCLP_VENDOR).trim() !== ''
      ? String(row.DDCLP_VENDOR).trim()
      : '',
    ddcDpVendorId: row.DDCDP_VENDOR != null && String(row.DDCDP_VENDOR).trim() !== ''
      ? String(row.DDCDP_VENDOR).trim()
      : '',
  };
}

function mapProfitSharingRow(row, index) {
  return {
    id: pickRowId(row.RANDOMID) || `ps-${row.FCAID}-${index}`,
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
    percentage: row.PERCENTAGE != null ? String(row.PERCENTAGE) : '',
  };
}

function mapBrokerRow(row, index) {
  return {
    id: pickRowId(row.RANDOMID) || `brk-${row.FCAID}-${index}`,
    percent: row.BROKAGE_PERCENT ?? '',
    amount: row.BROKAGE_AMT ?? '',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
    demmPercent: row.DEMM_BROKAGE_PERCENT != null && row.DEMM_BROKAGE_PERCENT !== ''
      ? String(row.DEMM_BROKAGE_PERCENT)
      : '',
  };
}

function mapBunkerActivityRow(row, index) {
  return {
    id: pickRowId(row.RANDOMID) || `bact-${row.FCAID}-${index}`,
    activity: row.ACTIVITY ?? 'Cold Wash',
    bunkerGrade: row.BUNKERGRADE ?? 'VLSFO',
    qty: row.QUANTITY ?? '',
    price: row.PRICE ?? '',
    amount: row.AMOUNT ?? '',
  };
}

function mapCargoRow(row, index) {
  const rawCargoId = row.CARGOID != null ? String(row.CARGOID).trim() : '';
  return {
    id: pickRowId(row.RANDOMID) || `cargo-${row.FCAID}-${index}`,
    cargoId: rawCargoId && rawCargoId !== '0' ? rawCargoId : '',
    cargoName: row.CARGO_NAME ?? '',
    cargoCbm: row.CARGO_CBM ?? '',
    cargoMt: row.CARGO_MT ?? '',
    rateUsdMt: row.RATE_USD_MT ?? '',
    amountUsd: row.AMOUNT_USD ?? '',
    charterer: row.SHIPPER_CHARTER ?? '',
    demAmt: row.DEM_AMT ?? '',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
    status: row.STATUS ?? 1,
  };
}

function parseCargoIds(value) {
  if (value == null || value === '') return [];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '0');
}

function mapBunkerRow(row, index) {
  return {
    id: `bunker-${row.FCAID}-${index}`,
    bunkerGradeId: row.BUNKERGRADEID != null
      ? String(row.BUNKERGRADEID)
      : (row.BUNKERID != null ? String(row.BUNKERID) : ''),
    qty: row.QTY ?? '',
    price: row.PRICE ?? '',
    cost: row.COST ?? '',
    identify: row.IDENTIFY || 'CONSUMPTION',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
    portId: row.PORT != null ? String(row.PORT) : '',
    portName: row.PORT_NAME ?? '',
  };
}

function mapOrcRow(row, index) {
  return {
    id: pickRowId(row.RANDOMID) || `orc-${row.FCAID}-${index}`,
    costId: row.IDENTY_ID != null ? String(row.IDENTY_ID) : '',
    costName: row.COST_NAME ?? '',
    amount: row.RAW_AMOUNT ?? '',
    amountMt: row.COST_MT ?? '',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
  };
}

function mapOtherIncomeRow(row, index) {
  return {
    id: pickRowId(row.RANDOMID) || `oi-${row.FCAID}-${index}`,
    description: row.IDENTY_ID ?? '',
    amount: row.COST ?? '',
    addComm: row.ADDCOMM ?? '',
    netAmount: row.RAW_AMOUNT ?? '',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
  };
}

function mapHireRow(row, index) {
  return {
    id: pickRowId(row.RANDOMID) || `hire-${row.FCAID}-${index}`,
    hireFrom: row.HIRE_FROM ? formatDateTimeDMY(row.HIRE_FROM) : '',
    hireTo: row.HIRE_TO ? formatDateTimeDMY(row.HIRE_TO) : '',
    hireDays: row.HIRE_DAYS ?? '',
    hireRate: row.HIRE_RATE ?? '',
    hireAmt: row.HIRE_AMT ?? '',
  };
}

function mapSecaBunkerRow(row, index) {
  return {
    id: `seca-${row.FCAID}-${index}`,
    bunkerGradeId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
    qty: row.EST_MT ?? '',
    price: row.EST_PRICE ?? '',
    cost: row.EST_COST ?? '',
    identify: row.IDENTIFY || 'SECA',
    bunkerType: row.BUNKER_TYPE || 'FO',
    calc: Number(row.CHK_IF_CAL) !== 0,
    actualQty: row.ACTUAL_MT ?? '',
  };
}

function mapFreightQtyRow(row, index) {
  return {
    id: pickRowId(row.RANDOMID) || `fq-${row.FCAID}-${index}`,
    vendorId: row.QTY_VENDORID != null ? String(row.QTY_VENDORID) : '',
    agreedGrossFreight: row.AGREED_GROSS_FREIGHT ?? '',
    quantity: row.QUANTITY ?? '',
    grossFreight: row.GROSS_FREIGHT ?? '',
    brokeragePercent: row.BROKERAGE ?? '',
    netBrokerage: row.NET_BROKERAGE ?? '',
    netFreight: row.NET_FREIGHT ?? '',
    netFreightPerMt: row.NET_FREIGHT_PERMT ?? '',
    currencyId: row.CURRENCYID != null ? String(row.CURRENCYID) : '',
    localAgreedFreight: row.AGREED_GROSS_FREIGHT_LOCAL ?? '',
    exchangeRate: row.EXCHANGE_RATE ?? '',
    cargoId: row.CARGO != null ? String(row.CARGO) : '',
  };
}

function mapTankerWsRow(row, index) {
  return {
    id: `ws-${row.FCAID}-${index}`,
    freightSpecs: row.FREIGHT_SPECS ?? '',
    customerId: row.CUSTOMER != null ? String(row.CUSTOMER) : '',
    minCargoQty: row.MIN_CARGO_QTY ?? '',
    oveCargoQty: row.OVE_CARGO_QTY ?? '',
    minFlatRate: row.MIN_FLAT_RATE ?? '',
    oveFlatRate: row.OVE_FLAT_RATE ?? '',
    minWs: row.MIN_WS ?? '',
    oveWs: row.OVE_WS ?? '',
    minDisLeg: row.MIN_DIS_LEG ?? '',
    oveDisLeg: row.OVE_DIS_LEG ?? '',
    minDistance: row.MIN_DISTANCE ?? '',
    oveDistance: row.OVE_DISTANCE ?? '',
    minAmount: row.MIN_AMOUNT ?? '',
    oveAmount: row.OVE_AMOUNT ?? '',
    totalQty: row.TOTAL_QTY ?? '',
    totalAmount: row.TOTAL_AMOUNT ?? '',
    wsFromPortId: '',
    wsFromPortName: '',
    wsToPortId: '',
    wsToPortName: '',
  };
}

function mapOffHireRow(row, bunkers = [], index = 0) {
  return {
    id: pickRowId(row.RANDOMID, row.FCA_SLAVE14ID) || `off-${row.FCAID}-${index}`,
    slave14Id: row.FCA_SLAVE14ID,
    reason: row.OFF_REASON ?? '',
    from: formatDateTimeDMY(row.OFF_FROM),
    to: formatDateTimeDMY(row.OFF_TO),
    days: row.OFF_DAYS ?? '',
    rate: row.HIRE_RATE ?? '',
    amount: row.OFF_HIRE ?? '',
    bunkers: bunkers.map((b, i) => ({
      id: `offb-${b.FCA_SLAVE15ID || i}`,
      bunkerGradeId: b.BUNKERID != null ? String(b.BUNKERID) : '',
      qty: b.BUNKERQTY ?? '',
      price: b.BUNKERPRICE ?? '',
      amount: b.BUNKERAMT ?? '',
      calc: Number(b.CHECK_BUNKER_CAL) !== 0,
    })),
  };
}

function mapPassageLocationRow(row, index) {
  return {
    id: `loc-${row.FCAID}-${index}`,
    fromLocation: row.LOCATION_FROM ?? '',
    toLocation: row.LOCATION_TO ?? '',
    passageType: row.PASSAGE_TYPE != null ? String(row.PASSAGE_TYPE) : '1',
    speedType: row.SPEED_TYPE != null ? String(row.SPEED_TYPE) : '1',
    distance: row.DISTANCE ?? '',
  };
}

function mapConsumptionRow(row, index) {
  // PHP addestimate At Sea form field names are mismatched on save:
  //   Working DP (NS) → txtFOInPortSECAConspIdle_  → FO_INPORT_SECA_CONSP_IDLE
  //   Working DP (S)  → txtFOInPortSECAConspIdle1_ → FO_INPORT_SECA_CONSP_OTHER
  //   Idle (NS)       → txtFOInPortNONSECAConspIdle_ → FO_INPORT_NONSECA_CONSP_IDLE
  //   Idle (S)        → txtFOInPortNONSECAConspIdle1_ → FO_INPORT_NONSECA_CONSP_OTHER
  // Dedicated WORKING_LP / WORKING_DP columns are often left as 0.
  return {
    id: `cons-${row.FCAID}-${index}`,
    identify: row.IDENTIFY || 'FO',
    bunkerGradeId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    balSecaFs: row.FO_BALAST_ATSEA_SECA_CONSP_FS ?? '',
    ladSecaFs: row.FO_LADEN_ATSEA_SECA_CONSP_FS ?? '',
    balNonSecaFs: row.FO_BALAST_ATSEA_NONSECA_CONSP_FS ?? '',
    ladNonSecaFs: row.FO_LADEN_ATSEA_NONSECA_CONSP_FS ?? '',
    balSecaSs: row.FO_BALAST_ATSEA_SECA_CONSP_SS ?? '',
    ladSecaSs: row.FO_LADEN_ATSEA_SECA_CONSP_SS ?? '',
    balNonSecaSs: row.FO_BALAST_ATSEA_NONSECA_CONSP_SS ?? '',
    ladNonSecaSs: row.FO_LADEN_ATSEA_NONSECA_CONSP_SS ?? '',
    balSecaMes: row.FO_BALAST_ATSEA_SECA_CONSP_MES ?? '',
    ladSecaMes: row.FO_LADEN_ATSEA_SECA_CONSP_MES ?? '',
    balNonSecaMes: row.FO_BALAST_ATSEA_NONSECA_CONSP_MES ?? '',
    ladNonSecaMes: row.FO_LADEN_ATSEA_NONSECA_CONSP_MES ?? '',
    inPortSecaWorking: pickConsRate(
      row.FO_INPORT_SECA_CONSP_WORKING_LP,
      row.FO_INPORT_SECA_CONSP_WORKING,
    ),
    inPortNonSecaWorking: pickConsRate(
      row.FO_INPORT_NONSECA_CONSP_WORKING_LP,
      row.FO_INPORT_NONSECA_CONSP_WORKING,
    ),
    inPortSecaWorkingDp: pickConsRate(
      row.FO_INPORT_SECA_CONSP_WORKING_DP,
      row.FO_INPORT_SECA_CONSP_OTHER,
    ),
    inPortNonSecaWorkingDp: pickConsRate(
      row.FO_INPORT_NONSECA_CONSP_WORKING_DP,
      row.FO_INPORT_SECA_CONSP_IDLE,
      row.FO_INPORT_NONSECA_CONSP_OTHER,
    ),
    inPortSecaIdle: pickConsRate(
      row.FO_INPORT_SECA_CONSP_IDLE_BALLAST,
      row.FO_INPORT_NONSECA_CONSP_OTHER,
    ),
    inPortNonSecaIdle: pickConsRate(
      row.FO_INPORT_NONSECA_CONSP_IDLE_BALLAST,
      row.FO_INPORT_NONSECA_CONSP_IDLE,
    ),
    otherSecaTk: row.FO_OTHER_SECA_CONSP_TK ?? '',
    otherNonSecaTk: row.FO_OTHER_NONSECA_CONSP_TK ?? '',
    otherSecaInert: row.FO_OTHER_SECA_CONSP_INERT ?? '',
    otherNonSecaInert: row.FO_OTHER_NONSECA_CONSP_INERT ?? '',
    otherSecaGf: row.FO_OTHER_SECA_CONSP_GF ?? '',
    otherNonSecaGf: row.FO_OTHER_NONSECA_CONSP_GF ?? '',
    otherSecaHeat: row.FO_OTHER_SECA_CONSP_HEAT ?? '',
    otherNonSecaHeat: row.FO_OTHER_NONSECA_CONSP_HEAT ?? '',
    otherSecaHeat1: row.FO_OTHER_SECA_CONSP_HEAT_1 ?? '',
    otherNonSecaHeat1: row.FO_OTHER_NONSECA_CONSP_HEAT_1 ?? '',
  };
}

function mapInvoiceRow(row, index) {
  return {
    id: `inv-${row.FCAID}-${index}`,
    invoiceId: row.INVOICEID != null ? String(row.INVOICEID) : '',
  };
}

function mapDeliveryBunkerRow(row, index) {
  return {
    id: `delb-${row.FCAID}-${index}`,
    bunkerGradeId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    qty: row.QTY ?? '',
    price: row.PRICE ?? '',
    amount: row.AMOUNT ?? '',
    bunkerDate: row.BUNKER_DATE ? formatDateDMY(row.BUNKER_DATE) : '',
    identity: row.IDENTITY || 'DEL',
  };
}

function mapDisponentRow(row, index) {
  return {
    id: `disp-${row.FCAID}-${index}`,
    name: row.DISPONENT_OWNER ?? '',
  };
}

function mapVoyageEventRow(row, index) {
  return {
    id: `evt-${row.FCAID}-${index}`,
    details: row.EVENT_DETAILS ?? '',
    eventDate: row.EVENT_DATE ? formatDateDMY(row.EVENT_DATE) : '',
  };
}

function parseAttachments(upload, uploadName) {
  const files = String(upload || '').split(',').map((s) => s.trim()).filter(Boolean);
  const names = String(uploadName || '').split(',').map((s) => s.trim());
  return files.map((file, i) => ({
    file,
    name: names[i] || file,
    url: `/attachment/${file}`,
  }));
}

function resolveFixtureTypeId(...candidates) {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const value = String(candidate).trim();
    // PHP getCheckNullValue() stores empty as 0 — treat as missing.
    if (!value || value === '0') continue;
    if (value === '1' || value === '2' || value === '3') return value;
  }
  return null;
}

function mapEstimateDetail(
  master,
  portLegs = [],
  cargoRows = [],
  bunkerRows = [],
  brokerageRows = [],
  orcRows = [],
  otherIncomeRows = [],
  hireRows = [],
  secaBunkerRows = [],
  freightQtyRows = [],
  tankerWsRows = [],
  offHireRows = [],
  passageLocations = [],
  consumptionRows = [],
  invoiceRows = [],
  deliveryBunkerRows = [],
  redeliveryBunkerRows = [],
  disponentRows = [],
  voyageEventRows = [],
  bunkerActivityRows = [],
  profitSharingRows = [],
) {
  const estimateType = Number(master.ESTIMATE_TYPE);
  const mappedCargos = cargoRows.map((row, index) => mapCargoRow(row, index));
  const masterCargoIds = parseCargoIds(master.CARGO_ID);
  // PHP stores selected cargo names on master.CARGO_ID; slave rows sometimes lack CARGOID.
  const cargosWithIds = mappedCargos.map((row, index) => {
    if (row.cargoId) return row;
    const fallbackId = masterCargoIds[index] || '';
    return fallbackId ? { ...row, cargoId: fallbackId, cargoName: row.cargoName || '' } : row;
  });

  // If master has cargo ids but no matching slave rows, still expose them for the multi-select.
  const mainCargoRows = cargosWithIds.filter((row) => Number(row.status) === 1 || !row.status);
  const ensuredMainCargos = masterCargoIds.length
    ? masterCargoIds.map((cargoId, index) => {
      const existing = mainCargoRows.find((row) => String(row.cargoId) === String(cargoId))
        || mainCargoRows[index];
      if (existing) {
        return { ...existing, cargoId: String(cargoId) };
      }
      return {
        id: `cargo-master-${cargoId}`,
        cargoId: String(cargoId),
        cargoName: '',
        cargoCbm: '',
        cargoMt: '',
        rateUsdMt: '',
        amountUsd: '',
        charterer: '',
        demAmt: '',
        vendorId: '',
        status: 1,
      };
    })
    : mainCargoRows;
  const brokerRows = (Array.isArray(brokerageRows) ? brokerageRows : (brokerageRows ? [brokerageRows] : []))
    .map((row, index) => mapBrokerRow(row, index));
  const firstBroker = brokerRows[0] || null;
  const etsFlags = (voyageEventRows || []).find(
    (row) => row.EUETSADDTOF != null || row.FUELEUADDTOF != null
      || row.HSFO != null || row.VLSFOMT != null || row.LSMGO != null,
  ) || {};

  // PHP stores Business Type (TCIN/VCIN/VCOUT) in FIXTURETYPEID and also SEL_BUSI_TYPE.
  // Older/partial rows often have FIXTURETYPEID=0 with the real value only in SEL_BUSI_TYPE.
  const fixtureTypeId = resolveFixtureTypeId(master.FIXTURETYPEID, master.SEL_BUSI_TYPE);

  return {
    id: String(master.FCAID),
    periodId: master.PERIODID != null ? String(master.PERIODID) : '',
    fixtureTypeId,
    estimateType,
    estimateTypeLabel: ESTIMATE_TYPE_LABELS[estimateType] ?? '',
    vesselImoId: master.VESSEL_IMO_ID,
    vesselName: master.VESSEL_NAME ?? '',
    imoNo: master.IMO_NO ?? '',
    vesselType: master.VESSEL_TYPE ?? '',
    flag: master.FLAG ?? '',
    transDate: formatDateDMY(master.TRANS_DATE),
    // Prefer CP_DATE for charter-party date; fall back to TRANS_DATE
    cpDate: formatDateDMY(master.CP_DATE) || formatDateDMY(master.TRANS_DATE),
    voyageNo: master.VOYAGE_NO ?? '',
    voyageName: master.VOYAGE_NAME ?? '',
    dwtSummer: master.DWT_SUMMER ?? master.VESSEL_DWT ?? '',
    dwtTropical: master.DWT_TOPICAL ?? '',
    gnrt: master.GNRT ?? '',
    nrt: master.GNRT ? Number((Number(master.GNRT) * 0.7).toFixed(2)) : '',
    loa: master.LOA ?? '',
    tpc: master.TPC ?? '',
    gear: master.GEAR ?? '',
    builtYear: master.BUILD_YEAR ?? master.BUILT_YEAR ?? '',
    beam: master.BEAM ?? '',
    loadable: master.LODABLE ?? master.LOADABLE ?? '',
    stowageFactor: master.SF ?? master.STOWAGE_FACTOR ?? '',
    grainCap: master.GRAIN_CAP ?? '',
    baleCap: master.BALE_CAP ?? '',
    bFullSpeed: master.BFULLSPEED ?? '',
    bEcoSpeed1: master.BECOSPEED1 ?? '',
    bEcoSpeed2: master.BECOSPEED2 ?? '',
    lFullSpeed: master.LFULLSPEED ?? '',
    lEcoSpeed1: master.LECOSPEED1 ?? '',
    lEcoSpeed2: master.LECOSPEED2 ?? '',
    bFoFullSpeed: master.BFOFULLSPEED ?? '',
    lFoFullSpeed: master.LFOFULLSPEED ?? '',
    bDoFullSpeed: master.BDOFULLSPEED ?? '',
    lDoFullSpeed: master.LDOFULLSPEED ?? '',
    pIfoFullSpeed: master.PIFOFULLSPEED ?? '',
    pWfoFullSpeed: master.PWFOFULLSPEED ?? '',
    pIdoFullSpeed: master.PIDOFULLSPEED ?? '',
    pWdoFullSpeed: master.PWDOFULLSPEED ?? '',
    totalDays: master.TOTAL_DAYS ?? '',
    totalDistance: master.TOTAL_DISTANCE ?? '',
    cargoQuantity: master.QUANTITY ?? master.TANK_QUANTITY ?? master.GAS_QUANTITY ?? '',
    dailyEarning: master.DAILY_EARNING ?? '',
    // PHP txtDailyVesselOperatingExpenses = "Daily Hire ($/Day)" (hidden) — NOT Vessel Daily Ops.
    dailyVesselOperationExp: master.DAILY_VESSEL_OPERATION_EXP ?? '',
    vesselDailyOps: master.VESSELDAILYOPS ?? '',
    // Dry cargo (estimate type 3): Index Linked hire — PHP CHKHIRE / CHKINDEX / BALTIC*
    chkHire: Number(master.CHKHIRE) === 1,
    chkIndex: Number(master.CHKINDEX) === 1,
    balticIndex: master.BALTICINDEX != null ? String(master.BALTICINDEX) : '',
    balticPercent: master.BALTICPERCENT != null ? String(master.BALTICPERCENT) : '100',
    balticRate: master.BALTICRATE != null ? String(master.BALTICRATE) : '',
    cveVendorId: master.CVE_VENDORID != null ? String(master.CVE_VENDORID) : '',
    dtcVendorId: master.DTCVENDORID != null ? String(master.DTCVENDORID) : '',
    brokerageVendorId: master.BROKERAGE_VENDORID != null ? String(master.BROKERAGE_VENDORID) : '',
    tcCpDate: master.TC_CP_DATE ? formatDateDMY(master.TC_CP_DATE) : '',
    tcDeliveryRange: master.TC_DELIVERY_RANGE ?? '',
    tcRedeliveryRange: master.TC_RE_DELIVERY_RANGE ?? '',
    tcDeliveryDate: master.TC_DELIVERY_DATE ? formatDateTimeDMY(master.TC_DELIVERY_DATE) : '',
    tcRedeliveryDate: master.TC_RE_DELIVERY_DATE ? formatDateTimeDMY(master.TC_RE_DELIVERY_DATE) : '',
    profitLoss: master.PROFIT_LOSS ?? '',
    freightGross: master.FREIGHT_GROSS ?? '',
    revenue: master.REVENUES_FREIGHT ?? master.REVENUE ?? master.FREIGHT_GROSS ?? '',
    voyageEarnings: master.VOYAGE_EARNING ?? master.VOYAGE_EARNINGS ?? '',
    totalBunkerCost: master.BUNKER_EXPENSES ?? master.TOTAL_BUNKER_COST ?? '',
    totalPortCost: master.PORT_EXPENSES ?? master.TOTAL_PORT_COST ?? '',
    // Hire / Day: slave17 → master.HIRE_RATE → PHP Daily Hire column
    hireRate: (() => {
      const fromRows = hireRows[0]?.HIRE_RATE ?? hireRows[0]?.hireRate;
      if (fromRows != null && String(fromRows).trim() !== '') return fromRows;
      if (master.HIRE_RATE != null && String(master.HIRE_RATE).trim() !== '') return master.HIRE_RATE;
      return master.DAILY_VESSEL_OPERATION_EXP ?? '';
    })(),
    hireAmt: master.HIREAGE_AMT ?? master.HIRE_AMT ?? '',
    netHireage: master.FINAL_HIERAGE_AMOUNT ?? '',
    brokeragePercent: firstBroker?.percent
      ?? master.BROKERAGE_PER ?? master.BROKERAGE_PERCENT ?? '',
    brokerageAmt: firstBroker?.amount ?? master.BROKERAGE_AMT ?? '',
    brokerRows,
    cvePerMonth: master.CVE_AMT ?? '',
    cveAmt: master.CVE_TOTALAMT ?? '',
    offHireCve: master.OFF_HIRE_CVE ?? '',
    offHireCveAmt: master.OFF_HIRE_CVE_AMOUNT ?? '',
    lessOffHire: master.LESS_OFF_HIRE ?? '',
    ballastBonus: master.BALLAST_BONUS ?? '',
    hireagePercent: master.HIREAGE_PERCENT ?? '',
    hireageBroPercent: master.HIERAGE_BROKER_PERCENT ?? '',
    lumpsum: master.LUMPSUMAMT ?? master.LUMSUM ?? master.LUMPSUM ?? '',
    lumpsumQty: master.WS_QTY ?? master.LUMPSUM_QTY ?? '',
    chkLumpsum: Number(master.CHK_LUMPSUM) === 1
      || !!(master.LUMPSUMAMT ?? master.LUMSUM ?? master.LUMPSUM)
      || !!(master.WS_QTY ?? master.LUMPSUM_QTY),
    lumpsumVendor: master.LUMP_VENDOR != null ? String(master.LUMP_VENDOR) : '',
    marketRate: master.CARGO_RATE ?? master.MARKET_RATE ?? '',
    tankerFreightRate: master.CARGO_RATE ?? master.MARKET_RATE ?? '',
    tankType: master.TANKER_RADIO_SINGLE_DIS != null
      ? String(master.TANKER_RADIO_SINGLE_DIS)
      : '1',
    addCommPercent: master.ADDRESS_COMMISSION_PER ?? master.ADD_COMM ?? '',
    addressCommAmt: master.ADDRESS_COMMISSION_AMT ?? '',
    co2Price: master.CO2PRICE ?? '',
    euaPrice: master.EUAPRICE ?? '',
    sdrToUsd: master.SDR_TO_USD ?? '',
    scnt: '',
    tankWsFrom: master.TANK_WS_FROM != null ? String(master.TANK_WS_FROM) : '',
    tankWsTo: master.TANK_WS_TO != null ? String(master.TANK_WS_TO) : '',
    timeAllowed: master.TIMEALLOWED ?? master.WORKING_DAYS ?? '',
    laycanStart: pickLaycanDateTime(master.LAYCANSTART, master.LAYCAN_START_DATE),
    laycanEnd: pickLaycanDateTime(master.LAYCANEND, master.LAYCAN_FINISH_DATE),
    euEtsAddToFreight: Number(etsFlags.EUETSADDTOF) === 1,
    fuelEuAddToFreight: Number(etsFlags.FUELEUADDTOF) === 1,
    // PHP freight_cost_estimete_slave18 bunker / compliance results
    hsfoMt: etsFlags.HSFO != null ? String(etsFlags.HSFO) : '',
    etsHsfoMt: etsFlags.ETSFUELHSFO != null ? String(etsFlags.ETSFUELHSFO) : '',
    vlsfoMt: etsFlags.VLSFOMT != null ? String(etsFlags.VLSFOMT) : '',
    etsVlsfoMt: etsFlags.FUELVLSFO != null ? String(etsFlags.FUELVLSFO) : '',
    lsmgoMt: etsFlags.LSMGO != null ? String(etsFlags.LSMGO) : '',
    etsLsmgoMt: etsFlags.EUETSLSMGO != null ? String(etsFlags.EUETSLSMGO) : '',
    bunkerResultsCost: etsFlags.BROKTTLCOSTUSD != null ? String(etsFlags.BROKTTLCOSTUSD) : '',
    eeoi: etsFlags.EEOI != null ? String(etsFlags.EEOI) : '',
    cii: etsFlags.CIIGCO != null ? String(etsFlags.CIIGCO) : '',
    eeoiCo2: etsFlags.EEOICO != null ? String(etsFlags.EEOICO) : '',
    co2mt: etsFlags.CO2MT != null ? String(etsFlags.CO2MT) : '',
    co2Cost: etsFlags.CO2COST != null ? String(etsFlags.CO2COST) : '',
    euaCo2mt: etsFlags.EUACO2MT != null ? String(etsFlags.EUACO2MT) : '',
    euaCo2Usd: etsFlags.EUACO2USD != null ? String(etsFlags.EUACO2USD) : '',
    hsfoIntensity: etsFlags.HSFOGHGIN != null ? String(etsFlags.HSFOGHGIN) : '',
    hsfoTarget: etsFlags.TARGET2025 != null ? String(etsFlags.TARGET2025) : '',
    vlsfoIntensity: etsFlags.VLSFOGHGIN != null ? String(etsFlags.VLSFOGHGIN) : '',
    vlsfoTarget: etsFlags.TARGET2025VLSFO != null ? String(etsFlags.TARGET2025VLSFO) : '',
    lsmgoIntensity: etsFlags.LSMGOGHGIN != null ? String(etsFlags.LSMGOGHGIN) : '',
    lsmgoTarget: etsFlags.TARGET2025LGMGO != null ? String(etsFlags.TARGET2025LGMGO) : '',
    hsfoPenalty: etsFlags.HSFOPENAL != null ? String(etsFlags.HSFOPENAL) : '',
    hsfoPenaltyPerMt: etsFlags.DOLLARPERMT != null ? String(etsFlags.DOLLARPERMT) : '',
    vlsfoPenalty: etsFlags.VLSFOPENAL != null ? String(etsFlags.VLSFOPENAL) : '',
    vlsfoPenaltyPerMt: etsFlags.DOLLARPERMTVLSFO != null ? String(etsFlags.DOLLARPERMTVLSFO) : '',
    lsmgoPenalty: etsFlags.LSMGOPENAL != null ? String(etsFlags.LSMGOPENAL) : '',
    lsmgoPenaltyPerMt: etsFlags.DOLLARPERMTLSMGO != null ? String(etsFlags.DOLLARPERMTLSMGO) : '',
    totalCarbonCost: (() => {
      const eua = Number(etsFlags.EUACO2USD) || 0;
      const h = Number(etsFlags.HSFOPENAL) || 0;
      const v = Number(etsFlags.VLSFOPENAL) || 0;
      const l = Number(etsFlags.LSMGOPENAL) || 0;
      const sum = eua + h + v + l;
      return sum ? String(Math.round(sum * 100) / 100) : '';
    })(),
    gasBaltic: master.GAS_BALTIC ?? '',
    gasBaseRate: master.GAS_BASE_RATE ?? '',
    gasMarket: master.GAS_MARKET != null && Number(master.GAS_MARKET) !== 0
      ? String(master.GAS_MARKET)
      : '1',
    gasLumsum: master.GAS_LUMSUM ?? '',
    // PHP rdoMMarket: 1 = Freight $/MT, 2 = LS — infer from saved lumpsum vs cargo rate.
    dryMarket: Number(master.ESTIMATE_TYPE) === 3
      && Number(master.LUMPSUMAMT || master.LUMSUM || 0) > 0
      && !(Number(master.CARGO_RATE || 0) > 0)
      ? '2'
      : '1',
    dfQty: master.DF_QTY ?? master.DEAD_FREIGHT_QTY ?? '',
    addnlPremium: master.ADDNL_PRENIUM ?? '',
    baseRateFloat: master.BASERATE_FLOAT ?? '',
    baseRateFixed: master.BASERATE_FIXED ?? '',
    baseRateAverage: master.BASERATE_AVERAGE ?? '',
    grossFreightFloat: master.GROSS_FREIGHT_FLOAT ?? '',
    grossFreightFixed: master.GROSS_FREIGHT_FIXED ?? '',
    grossFreightAverage: master.GROSS_FREIGHT_AVERAGE ?? '',
    netFreightFloat: master.NETFREIGHT_FLOAT ?? '',
    netFreightFixed: master.NETFREIGHT_FIXED ?? '',
    netFreightAverage: master.NETFREIGHT_AVERAGE ?? '',
    tceFloat: master.TCEEARNING_FLOAT ?? '',
    tceFixed: master.TCEEARNING_FIXED ?? '',
    tceAverage: master.TCEEARNING_AVERAGE ?? '',
    notes: master.REMARKS ?? '',
    openPort: master.OPEN_PORT != null ? String(master.OPEN_PORT) : '',
    openPortName: master.OPEN_PORT_NAME ?? '',
    zoneOpen: master.ZONE_OPEN != null ? String(master.ZONE_OPEN) : '',
    fixtureBroker: master.BROKER != null ? String(master.BROKER) : '',
    coaSpot: master.COA_SPOT != null ? String(master.COA_SPOT) : '',
    coaNumber: master.COA_NUMBER != null ? String(master.COA_NUMBER) : '',
    coaNumberLabel: master.COA_NUMBER_LABEL ?? '',
    coaNumberLift: master.COA_NUMBER_LIFT ?? '',
    noOfShipment: master.NO_OF_SHIPMENT
      || (master.COA_TOTAL_SHIPMENTS != null ? String(master.COA_TOTAL_SHIPMENTS) : ''),
    etaDate: master.ETA_DATE ? formatDateDMY(master.ETA_DATE) : '',
    ownerId: master.OWNER != null ? String(master.OWNER) : '',
    disponentOwner: master.DISPONENT_OWNER ?? '',
    attachments: parseAttachments(master.ATTACHMENT, master.ATTACHMENT_NAME),
    charteringTeam: master.CHARTERING_PIC != null && String(master.CHARTERING_PIC).trim() !== '' && String(master.CHARTERING_PIC) !== '0'
      ? String(master.CHARTERING_PIC)
      : '7',
    charteringPic: master.CHARTERING_PIC_1 != null && String(master.CHARTERING_PIC_1).trim() !== '' && String(master.CHARTERING_PIC_1) !== '0'
      ? String(master.CHARTERING_PIC_1)
      : '',
    charteringPicName: master.CHARTERING_PIC_NAME ?? '',
    comid: master.COMID || null,
    sheetNo: master.SHEET_NO != null ? String(master.SHEET_NO) : '',
    finalStatus: Number(master.FINAL_STATUS || 0),
    fixed: Number(master.FIXED) === 1,
    portLegs: portLegs.map((row, index) => mapPortLeg(row, index)),
    cargoIds: masterCargoIds,
    cargoRows: ensuredMainCargos,
    overageCargoRows: cargosWithIds.filter((row) => Number(row.status) === 2),
    deadfreightCargoRows: cargosWithIds.filter((row) => Number(row.status) === 3),
    bunkerRows: bunkerRows.map((row, index) => mapBunkerRow(row, index)),
    bunkerActivityRows: bunkerActivityRows.map((row, index) => mapBunkerActivityRow(row, index)),
    orcRows: orcRows.map((row, index) => mapOrcRow(row, index)),
    otherIncomeRows: otherIncomeRows.map((row, index) => mapOtherIncomeRow(row, index)),
    hireRows: hireRows.map((row, index) => mapHireRow(row, index)),
    secaBunkerRows: secaBunkerRows.map((row, index) => mapSecaBunkerRow(row, index)),
    freightQtyRows: freightQtyRows.map((row, index) => mapFreightQtyRow(row, index)),
    tankerWsRows: tankerWsRows.map((row, index) => mapTankerWsRow(row, index)),
    offHireRows,
    passageLocations: passageLocations.map((row, index) => mapPassageLocationRow(row, index)),
    consumptionRows: consumptionRows.map((row, index) => mapConsumptionRow(row, index)),
    invoiceRows: invoiceRows.map((row, index) => mapInvoiceRow(row, index)),
    deliveryBunkerRows: deliveryBunkerRows.map((row, index) => mapDeliveryBunkerRow(row, index)),
    redeliveryBunkerRows: redeliveryBunkerRows.map((row, index) => mapDeliveryBunkerRow(row, index)),
    disponentRows: disponentRows.length
      ? disponentRows.map((row, index) => mapDisponentRow(row, index))
      : (master.DISPONENT_OWNER
        ? [{ id: 'disp-master', name: master.DISPONENT_OWNER }]
        : []),
    voyageEventRows: voyageEventRows
      .filter((row) => row.EVENT_DETAILS || row.EVENT_DATE)
      .map((row, index) => mapVoyageEventRow(row, index)),
    profitSharingRows: profitSharingRows.map((row, index) => mapProfitSharingRow(row, index)),
  };
}

const HEADER_UPDATE_FIELDS = {
  fixtureTypeId: 'FIXTURETYPEID',
  vesselType: 'VESSEL_TYPE',
  flag: 'FLAG',
  transDate: 'TRANS_DATE',
  voyageNo: 'VOYAGE_NO',
  voyageName: 'VOYAGE_NAME',
  dwtSummer: 'DWT_SUMMER',
  gnrt: 'GNRT',
};

export async function dbGetEstimateLookups(estimateType = 2) {
  const pool = getPool();
  const type = Number(estimateType) || 2;

  // PHP getCargoNameListForMultiple: MATERIAL_TYPEID = estimate type (1 Gas / 2 Tanker / 3 Dry)
  const [cargos] = await pool.query(
    `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name
     FROM cargo_master
     WHERE CAST(MATERIAL_TYPEID AS CHAR) = ?
     ORDER BY MATERIAL_CODE_DESC`,
    [String(type)],
  );

  let cargoRows = cargos;
  if (!cargoRows.length) {
    const [allCargos] = await pool.query(
      `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name
       FROM cargo_master
       ORDER BY MATERIAL_CODE_DESC
       LIMIT 1000`,
    );
    cargoRows = allCargos;
  }

  const mapCargoOption = (row) => ({
    id: String(row.id ?? row.MATERIALID ?? row.materialid ?? ''),
    name: String(row.name ?? row.MATERIAL_CODE_DESC ?? row.material_code_desc ?? '').trim()
      || String(row.id ?? row.MATERIALID ?? row.materialid ?? ''),
  });


  const [bunkerGrades] = await pool.query(
    `SELECT BUNKERGRADEID AS id, NAME AS name, BUNKERTYPE,
            CO2_FAC, PENALITY, INTENSITY_2026, GHG_2026, RATE_2026,
            INTENSITY_2025, GHG_2025, RATE_2025
     FROM bunker_grade_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  const [ownerCosts] = await pool.query(
    `SELECT OWNER_RCOSTID AS id, NAME AS name
     FROM owner_related_cost_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  const [owners] = await pool.query(
    `SELECT VENDORID AS id, NAME, CODE
     FROM vendor_master
     WHERE STATUS = 1
       AND MCOMPANYID = ?
     ORDER BY NAME
     LIMIT 500`,
    [appContext.companyId],
  );

  const [ownBusiness] = await pool.query(
    `SELECT VENDORID AS id, NAME, CODE
     FROM vendor_master
     WHERE STATUS = 1
       AND VENDOR_TYPEID = 11
       AND MCOMPANYID = ?
     ORDER BY NAME
     LIMIT 500`,
    [appContext.companyId],
  );

  const [charteringPics] = await pool.query(
    `SELECT LOGINID AS id, CONTACT_PERSON AS name
     FROM login
     WHERE STATUS = 1
       AND USER_TYPE IN ('internal_user', 'mgmt_user')
       AND LOGINID != 126
     ORDER BY CONTACT_PERSON`,
  );

  const [periodContracts] = await pool.query(
    `SELECT PERIODID AS id, CONTRACT_ID, CONTRACT_NO
     FROM period_contract_master
     WHERE MODULEID = ?
       AND MCOMPANYID = ?
     ORDER BY CONTRACT_DATE DESC
     LIMIT 500`,
    [appContext.moduleId, appContext.companyId],
  );

  const [zones] = await pool.query(
    `SELECT ZoneId AS id, ZoneName AS name
     FROM ZONE_MASTER
     WHERE STATUS = 1
     ORDER BY ZoneName`,
  );

  const [balticRoutes] = await pool.query(
    `SELECT BALTICID AS id, CODE AS code, NAME AS name, DAILYRATE AS dailyRate
     FROM baltic_master
     WHERE STATUS = 1
     ORDER BY CODE`,
  );

  const [fixtureBrokers] = await pool.query(
    `SELECT CODE AS id, NAME, CODE
     FROM vendor_master
     WHERE STATUS = 1
       AND VENDOR_TYPEID = 12
       AND MCOMPANYID = ?
     ORDER BY NAME
     LIMIT 500`,
    [appContext.companyId],
  );

  const [coaRows] = await pool.query(
    `SELECT c.COAID AS id, c.COA_NO AS name, c.TOTAL_SHIPMENTS AS noOfShipment,
            c.OWNER AS owner, c.BROKER AS broker,
            (SELECT COUNT(*)
             FROM open_vessel_entry_master o
             WHERE o.COA_NO = c.COAID
               AND o.MODULEID = c.MODULEID
               AND o.MCOMPANYID = c.MCOMPANYID
               AND o.STATUS = 1) AS performedCount
     FROM coa_master c
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
     ORDER BY c.COA_DATE DESC
     LIMIT 500`,
    [appContext.moduleId, appContext.companyId],
  );

  const year = new Date().getFullYear();
  const intensityKey = `INTENSITY_${year}`;
  const ghgKey = `GHG_${year}`;
  const rateKey = `RATE_${year}`;

  const complianceFactors = { HSFO: null, VLSFO: null, LSMGO: null };
  for (const row of bunkerGrades) {
    const name = String(row.name || '').trim().toUpperCase();
    // PHP getBunkerGradeData keys by exact NAME (HSFO / VLSFO / LSMGO)
    let key = null;
    if (name === 'HSFO') key = 'HSFO';
    else if (name === 'VLSFO' || name === 'VLFO') key = 'VLSFO';
    else if (name === 'LSMGO') key = 'LSMGO';
    else if (name.includes('HSFO') && !name.includes('SCRUBBER')) key = 'HSFO';
    else if (name.includes('VLSFO') || name.includes('VLFO')) key = 'VLSFO';
    else if (name.includes('LSMGO') || name === 'MGO' || name.includes('MGO')) key = 'LSMGO';
    if (!key || complianceFactors[key]) continue;
    complianceFactors[key] = {
      co2Fac: Number(row.CO2_FAC) || 0,
      penalty: Number(row.PENALITY) || 0,
      intensity: Number(row[intensityKey] ?? row.INTENSITY_2026 ?? row.INTENSITY_2025) || 0,
      ghgRate: Number(row[ghgKey] ?? row.GHG_2026 ?? row.GHG_2025) || 0,
      euaCo2Rate: Number(row[rateKey] ?? row.RATE_2026 ?? row.RATE_2025) || 0,
    };
  }

  const mapVendor = (row) => ({
    id: String(row.id),
    code: row.CODE ?? '',
    name: `${row.NAME ?? ''} ( ${row.CODE ?? ''} )`,
  });

  return {
    cargos: cargoRows.map(mapCargoOption).filter((row) => row.id),
    bunkerGrades: bunkerGrades.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
      bunkerType: row.BUNKERTYPE ?? '',
    })),
    ownerCosts: ownerCosts.map((row) => ({ id: String(row.id), name: row.name ?? '' })),
    owners: owners.map(mapVendor),
    ownBusiness: (ownBusiness.length ? ownBusiness : owners).map(mapVendor),
    charteringTeams: [{ id: '7', name: 'Zafira' }],
    charteringPics: charteringPics.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
    })),
    periodContracts: periodContracts.map((row) => ({
      id: String(row.id),
      label: `${row.CONTRACT_ID || ''}${row.CONTRACT_NO ? ` (${row.CONTRACT_NO})` : ''}`.trim(),
    })),
    zones: zones.map((row) => ({ id: String(row.id), name: row.name ?? '' })),
    balticRoutes: balticRoutes.map((row) => ({
      id: String(row.id),
      code: row.code ?? '',
      name: row.name ?? '',
      label: row.code || row.name || String(row.id),
      dailyRate: row.dailyRate != null ? String(row.dailyRate) : '',
    })),
    fixtureBrokers: fixtureBrokers.map((row) => ({
      id: String(row.id),
      name: `${row.NAME ?? ''} ( ${row.CODE ?? ''} )`,
    })),
    coaContracts: coaRows
      .filter((row) => {
        const performed = Number(row.performedCount) || 0;
        const total = Number(row.noOfShipment) || 0;
        return total === 0 || performed < total;
      })
      .map((row) => ({
        id: String(row.id),
        name: row.name ?? '',
        noOfShipment: row.noOfShipment != null ? String(row.noOfShipment) : '',
        owner: row.owner != null ? String(row.owner) : '',
        broker: row.broker != null ? String(row.broker) : '',
      })),
    complianceFactors,
    complianceYear: year,
    marketPrices: {
      vlsfo: process.env.OIL_PRICE_VLSFO || '',
      marineGasOil: process.env.OIL_PRICE_MGO || '',
      euaPrice: (() => {
        const euCarbon = Number(process.env.EUA_CARBON_EUR) || 0;
        const euToUsd = Number(process.env.EUA_TO_USD) || Number(process.env.EUR_USD) || 0;
        if (euCarbon && euToUsd) return String(Math.round(euCarbon * euToUsd * 100) / 100);
        return process.env.EUA_PRICE_USD || '';
      })(),
      sdrToUsd: process.env.SDR_TO_USD || '1.35',
    },
  };
}

export async function dbGetPeriodPrefill(periodId) {
  const pool = getPool();
  const id = String(periodId || '').trim();
  if (!id) return null;

  const [[period]] = await pool.query(
    `SELECT PERIODID, BROKERAGE, ADD_COMM, VESSEL_IMO_ID, HIRE
     FROM period_contract_master
     WHERE PERIODID = ?
     LIMIT 1`,
    [id],
  );
  if (!period) return null;

  let vesselName = '';
  if (period.VESSEL_IMO_ID) {
    const [[vessel]] = await pool.query(
      `SELECT VESSEL_NAME FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1`,
      [period.VESSEL_IMO_ID],
    );
    vesselName = vessel?.VESSEL_NAME || '';
  }

  const [hireRows] = await pool.query(
    `SELECT HIRE_FROM, HIRE_TO, HIRE_RATE, HIRE_DAYS
     FROM period_contract_master_slave4
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const [bunkerRows] = await pool.query(
    `SELECT BUNKERGRADEID, BUNKER_DATE, BUNKER_QTY, BUNKER_AMT, BUNKER_PRICE, IDENTITY
     FROM period_contract_master_slave1
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const [offHireRows] = await pool.query(
    `SELECT PERIOD_SLAVEID, OFF_REASON, OFF_FROM, OFF_TO,
            OFF_HIRE_DAYS, HIRE_RATE, OFF_HIRE
     FROM period_contract_master_slave2
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const offHireDetails = [];
  for (const row of offHireRows) {
    const [bunkers] = await pool.query(
      `SELECT BUNKERID, BUNKERQTY, BUNKERPRICE, BUNKERAMT, CHK_OWNER_ACCOUNT
       FROM period_contract_master_slave21
       WHERE PERIODID = ? AND PERIOD_SLAVEID = ?
       ORDER BY PERIOD_SUB_SLAVEID ASC`,
      [id, row.PERIOD_SLAVEID],
    );
    offHireDetails.push({
      reason: row.OFF_REASON || '',
      from: formatPeriodDateTime(row.OFF_FROM),
      to: formatPeriodDateTime(row.OFF_TO),
      days: row.OFF_HIRE_DAYS != null ? String(row.OFF_HIRE_DAYS) : '',
      rate: row.HIRE_RATE != null ? String(row.HIRE_RATE) : '',
      amount: row.OFF_HIRE != null ? String(row.OFF_HIRE) : '',
      bunkers: bunkers.map((b) => ({
        bunkerGradeId: b.BUNKERID != null ? String(b.BUNKERID) : '',
        qty: b.BUNKERQTY != null ? String(b.BUNKERQTY) : '',
        price: b.BUNKERPRICE != null ? String(b.BUNKERPRICE) : '',
        amount: b.BUNKERAMT != null ? String(b.BUNKERAMT) : '',
        calc: String(b.CHK_OWNER_ACCOUNT) === '1',
      })),
    });
  }

  const firstHire = hireRows[0];
  return {
    periodId: id,
    vesselImoId: period.VESSEL_IMO_ID != null ? String(period.VESSEL_IMO_ID) : '',
    vesselName,
    brokeragePercent: period.BROKERAGE != null ? String(period.BROKERAGE) : '',
    addCommPercent: period.ADD_COMM != null ? String(period.ADD_COMM) : '',
    hireRate: firstHire?.HIRE_RATE != null
      ? String(firstHire.HIRE_RATE)
      : (period.HIRE != null ? String(period.HIRE) : ''),
    hireRows: hireRows.map((row) => ({
      hireFrom: formatPeriodDateTime(row.HIRE_FROM),
      hireTo: formatPeriodDateTime(row.HIRE_TO),
      hireDays: row.HIRE_DAYS != null ? String(row.HIRE_DAYS) : '',
      hireRate: row.HIRE_RATE != null ? String(row.HIRE_RATE) : '',
      hireAmt: '',
    })),
    deliveryBunkerRows: bunkerRows
      .filter((row) => String(row.IDENTITY || '').toUpperCase() === 'DEL')
      .map((row) => ({
        bunkerGradeId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
        bunkerDate: formatPeriodDate(row.BUNKER_DATE),
        qty: row.BUNKER_QTY != null ? String(row.BUNKER_QTY) : '',
        price: row.BUNKER_PRICE != null ? String(row.BUNKER_PRICE) : '',
        amount: row.BUNKER_AMT != null ? String(row.BUNKER_AMT) : '',
        identity: 'DEL',
      })),
    redeliveryBunkerRows: bunkerRows
      .filter((row) => String(row.IDENTITY || '').toUpperCase() === 'REDEL')
      .map((row) => ({
        bunkerGradeId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
        bunkerDate: formatPeriodDate(row.BUNKER_DATE),
        qty: row.BUNKER_QTY != null ? String(row.BUNKER_QTY) : '',
        price: row.BUNKER_PRICE != null ? String(row.BUNKER_PRICE) : '',
        amount: row.BUNKER_AMT != null ? String(row.BUNKER_AMT) : '',
        identity: 'REDEL',
      })),
    offHireRows: offHireDetails,
  };
}

function formatPeriodDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1972) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPeriodDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1972) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export async function dbGetEstimateDetail(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT m.*, v.VESSEL_NAME, v.IMO_NO, v.DWT AS VESSEL_DWT,
            l.CONTACT_PERSON AS CHARTERING_PIC_NAME,
            op.PortName AS OPEN_PORT_NAME,
            cm.COA_NO AS COA_NUMBER_LABEL,
            cm.TOTAL_SHIPMENTS AS COA_TOTAL_SHIPMENTS
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN login l ON l.LOGINID = m.CHARTERING_PIC_1
     LEFT JOIN port_master op ON op.PortId = m.OPEN_PORT
     LEFT JOIN coa_master cm ON cm.COAID = m.COA_NUMBER
     WHERE m.FCAID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?`,
    [id, appContext.moduleId, appContext.companyId],
  );

  if (!rows.length) return null;

  const [legs] = await pool.query(
    `SELECT s.*,
            DATE_FORMAT(s.FROMARRIVAL, '%d-%m-%Y %H:%i') AS FROMARRIVAL_DMY,
            DATE_FORMAT(s.FROMDEPARTURE, '%d-%m-%Y %H:%i') AS FROMDEPARTURE_DMY,
            DATE_FORMAT(s.TOARRIVAL, '%d-%m-%Y %H:%i') AS TOARRIVAL_DMY,
            DATE_FORMAT(s.TODEPARTURE, '%d-%m-%Y %H:%i') AS TODEPARTURE_DMY,
            CONCAT(COALESCE(fp.PortName, ''), ' (', COALESCE(fp.COUNTRY_KEY, ''), ')') AS FROM_PORT_NAME,
            CONCAT(COALESCE(tp.PortName, ''), ' (', COALESCE(tp.COUNTRY_KEY, ''), ')') AS TO_PORT_NAME
     FROM freight_cost_estimete_slave1 s
     LEFT JOIN port_master fp ON fp.PortId = s.FROM_PORT
     LEFT JOIN port_master tp ON tp.PortId = s.TO_PORT
     WHERE s.FCAID = ?
     ORDER BY s.FCA_SLAVEID ASC`,
    [id],
  );

  const [cargos] = await pool.query(
    `SELECT s.*, cm.MATERIAL_CODE_DESC AS CARGO_NAME
     FROM freight_cost_estimete_slave10 s
     LEFT JOIN cargo_master cm ON cm.MATERIALID = s.CARGOID
     WHERE s.FCAID = ?
     ORDER BY s.STATUS ASC`,
    [id],
  );

  const [bunkers] = await pool.query(
    `SELECT s.*,
            CONCAT(COALESCE(p.PortName, ''), ' (', COALESCE(p.COUNTRY_KEY, ''), ')') AS PORT_NAME
     FROM freight_cost_estimete_slave8 s
     LEFT JOIN port_master p ON p.PortId = s.PORT
     WHERE s.FCAID = ?`,
    [id],
  );

  const [brokerageRows] = await pool.query(
    `SELECT BROKAGE_PERCENT, BROKAGE_AMT, DEMM_BROKAGE_PERCENT, VENDORID, FCAID
     FROM freight_cost_estimete_slave4
     WHERE FCAID = ?`,
    [id],
  );

  const [orcRows] = await pool.query(
    `SELECT s.*, o.NAME AS COST_NAME
     FROM freight_cost_estimete_slave3 s
     LEFT JOIN owner_related_cost_master o ON o.OWNER_RCOSTID = s.IDENTY_ID
     WHERE s.FCAID = ?
       AND s.IDENTIFY = 'ORC'`,
    [id],
  );

  const [otherIncomeRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave3
     WHERE FCAID = ?
       AND IDENTIFY = 'OTHERINCOME'`,
    [id],
  );

  const [hireRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave17 WHERE FCAID = ?`,
    [id],
  );

  const [secaBunkerRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave2 WHERE FCAID = ?`,
    [id],
  );

  const [freightQtyRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave7 WHERE FCAID = ?`,
    [id],
  );

  const [tankerWsRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave12 WHERE FCAID = ?`,
    [id],
  );

  const [offHireMasterRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave14 WHERE FCAID = ?`,
    [id],
  );

  const [offHireBunkerRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave15 WHERE FCAID = ?`,
    [id],
  );

  const offHireRows = offHireMasterRows.map((row, index) => {
    const bunkers = offHireBunkerRows.filter(
      (b) => String(b.FCA_SLAVE14ID) === String(row.FCA_SLAVE14ID),
    );
    return mapOffHireRow(row, bunkers, index);
  });

  const [passageLocations] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave6 WHERE FCAID = ?`,
    [id],
  );

  const [consumptionRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave16 WHERE FCAID = ?`,
    [id],
  );

  const [invoiceRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave11 WHERE FCAID = ?`,
    [id],
  );

  const [deliveryAll] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave13 WHERE FCAID = ?`,
    [id],
  );
  const deliveryBunkerRows = deliveryAll.filter((row) => row.IDENTITY === 'DEL');
  const redeliveryBunkerRows = deliveryAll.filter((row) => row.IDENTITY === 'REDEL');

  const [disponentRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave5 WHERE FCAID = ?`,
    [id],
  );

  const [voyageEventRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave18 WHERE FCAID = ?`,
    [id],
  );

  let bunkerActivityRows = [];
  try {
    const [activityRows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave19 WHERE FCAID = ?`,
      [id],
    );
    bunkerActivityRows = activityRows;
  } catch {
    bunkerActivityRows = [];
  }

  let profitSharingRows = [];
  try {
    const [psRows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave20 WHERE FCAID = ?`,
      [id],
    );
    profitSharingRows = psRows;
  } catch {
    profitSharingRows = [];
  }

  let detail = mapEstimateDetail(
    rows[0],
    legs,
    cargos,
    bunkers,
    brokerageRows,
    orcRows,
    otherIncomeRows,
    hireRows,
    secaBunkerRows,
    freightQtyRows,
    tankerWsRows,
    offHireRows,
    passageLocations,
    consumptionRows,
    invoiceRows,
    deliveryBunkerRows,
    redeliveryBunkerRows,
    disponentRows,
    voyageEventRows,
    bunkerActivityRows,
    profitSharingRows,
  );

  detail = applyMasterTankWsPorts(detail, rows[0]);
  detail = await enrichTankerWsPortNames(pool, detail);
  detail = await resolveScntForDetail(detail);
  return detail;
}

/** Vessel-type bands used when inserting API ships ? mirrors PHP getVesselByImo.php */
const API_VESSEL_TYPE_BANDS = [
  { vesselTypeId: 2, businessType: 2, dwtFrom: 80000, dwtTo: 120000 },
  { vesselTypeId: 3, businessType: 2, dwtFrom: 25000, dwtTo: 40000 },
  { vesselTypeId: 4, businessType: 2, dwtFrom: 55000, dwtTo: 80000 },
  { vesselTypeId: 5, businessType: 2, dwtFrom: 40000, dwtTo: 60000 },
  { vesselTypeId: 10, businessType: 2, dwtFrom: 120000, dwtTo: 200000 },
  { vesselTypeId: 22, businessType: 2, dwtFrom: 200000, dwtTo: 320000 },
  { vesselTypeId: 23, businessType: 2, dwtFrom: 40000, dwtTo: 60000 },
  { vesselTypeId: 24, businessType: 2, dwtFrom: 0, dwtTo: 25000 },
  { vesselTypeId: 1, businessType: 3, dwtFrom: 80000, dwtTo: 85000 },
  { vesselTypeId: 8, businessType: 3, dwtFrom: 50000, dwtTo: 60000 },
  { vesselTypeId: 12, businessType: 3, dwtFrom: 60000, dwtTo: 65000 },
  { vesselTypeId: 16, businessType: 3, dwtFrom: 200000, dwtTo: 300000 },
  { vesselTypeId: 18, businessType: 3, dwtFrom: 60000, dwtTo: 80000 },
  { vesselTypeId: 19, businessType: 3, dwtFrom: 120000, dwtTo: 200000 },
  { vesselTypeId: 20, businessType: 3, dwtFrom: 10000, dwtTo: 35000 },
  { vesselTypeId: 21, businessType: 3, dwtFrom: 35000, dwtTo: 50000 },
];

const TANKER_SHIP_TYPES = new Set([
  'crude oil tanker',
  'product tanker',
  'chemical tanker',
  'oil/chemical tanker',
  'oil and chemical tanker',
  'vegetable oil / edible oil tanker',
  'bitumen / asphalt tanker',
  'other tanker',
]);

function businessTypeFromShipType(shipType) {
  const key = String(shipType || '').trim().toLowerCase();
  if (key === 'bulk carrier') return 3;
  if (TANKER_SHIP_TYPES.has(key)) return 2;
  return 1;
}

function vesselTypeIdFromDwt(businessTypeId, dwt) {
  const n = Number(dwt) || 0;
  const match = API_VESSEL_TYPE_BANDS.find(
    (band) => band.businessType === businessTypeId && band.dwtFrom <= n && band.dwtTo >= n,
  );
  return match?.vesselTypeId || 0;
}

function formatVesselSearchName(vesselName, countryCode, shipType, imoNo) {
  const name = String(vesselName || '').trim();
  const meta = [countryCode, shipType, imoNo].filter(Boolean).join('-');
  return meta ? `${name}(${meta})` : name;
}

/** Empty / non-numeric → null (avoids STRICT mode errors on DECIMAL/FLOAT/INT). */
function toSqlNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function toSqlInt(value) {
  const n = toSqlNumber(value);
  if (n == null) return null;
  return Math.trunc(n);
}

function toSqlText(value, maxLen = 0) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (maxLen > 0 && text.length > maxLen) return text.slice(0, maxLen);
  return text;
}

function mapDbVesselSearchRow(row, status = 'From DB') {
  const shipType = row.VESSEL_TYPE_API || '';
  return {
    id: String(row.VESSEL_IMO_ID),
    name: formatVesselSearchName(row.VESSEL_NAME, row.COUNTRY_CODE, shipType, row.IMO_NO),
    vesselName: row.VESSEL_NAME ?? '',
    imoNo: row.IMO_NO ?? '',
    dwt: row.DWT != null ? String(row.DWT) : '',
    vesselType: row.VESSEL_TYPE != null ? String(row.VESSEL_TYPE) : '',
    shipType,
    flag: row.FLAG != null ? String(row.FLAG) : '',
    loa: row.LOA ?? '',
    gnrt: row.GRT_NRT ?? '',
    status,
  };
}

/**
 * Fallback when DB has no match — mirrors PHP getVesselByImo.php (NavAPI ShipDetails).
 * Upserts into vessel_imo_master so the selected vessel has a VESSEL_IMO_ID.
 */
async function searchVesselsFromNavApi(term) {
  const apiUrl = process.env.NAVAPI_SHIP_DETAILS_URL || 'https://v1.navapi.pro/data/base/ShipDetails';
  const token = process.env.NAVAPI_SHIP_DETAILS_TOKEN
    || '06a7fcf47f827decf942ee99fb05f8a21718038108684';

  async function postShipDetails(query) {
    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ Q: query }),
      });
    } catch (err) {
      throw new Error(`NavAPI unreachable: ${err.message || err}`);
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `Vessel API returned ${response.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ''}`,
      );
    }

    return response.json();
  }

  const queries = [term];
  // NavAPI sometimes matches IMO only with an "IMO" prefix.
  if (/^\d{6,}$/.test(term)) {
    queries.push(`IMO${term}`);
  }

  let payload = null;
  let usedQuery = term;
  let apiResults = [];
  let resultMessage = '';

  for (const query of queries) {
    payload = await postShipDetails(query);
    resultMessage = payload?.Metadata?.ResultMessage || '';
    const batch = Array.isArray(payload?.ApiResults) ? payload.ApiResults : null;
    if (!batch) {
      throw new Error(
        `NavAPI bad payload (ResultMessage=${resultMessage || 'n/a'}, ApiResults missing)`,
      );
    }
    usedQuery = query;
    apiResults = batch;
    if (apiResults.length) break;
  }

  if (resultMessage && String(resultMessage).toLowerCase() !== 'success' && apiResults.length === 0) {
    throw new Error(`NavAPI ResultMessage=${resultMessage}`);
  }
  if (!apiResults.length) {
    console.warn('NavAPI ShipDetails returned 0 ApiResults for:', queries.join(' / '));
    const err = new Error(
      `NavAPI returned no vessels for "${term}"`
      + (usedQuery !== term ? ` (also tried "${usedQuery}")` : '')
      + (resultMessage ? ` [ResultMessage=${resultMessage}]` : ''),
    );
    err.code = 'NAVAPI_EMPTY';
    throw err;
  }

  const pool = getPool();
  const results = [];
  let upsertFailures = 0;
  let firstUpsertError = '';

  for (const ship of apiResults) {
    try {
      const shipName = String(ship.ShipName || '').trim();
      const imoNo = String(ship.ImoNumber || '').replace(/^IMO/i, '').trim();
      if (!shipName && !imoNo) continue;

      const shipType = String(ship.ShipType || '').trim();
      const countryCode = String(ship.CountryCode || '').trim();
      const dwt = toSqlNumber(ship.DeadWeight);
      const businessTypeId = businessTypeFromShipType(shipType);
      const vesselTypeId = vesselTypeIdFromDwt(businessTypeId, dwt) || null;
      const grossTon = toSqlNumber(ship.GrossTonnage);
      const mmsiNo = toSqlInt(ship.MmsiNumber);

      const [existing] = imoNo
        ? await pool.query(
          `SELECT VESSEL_IMO_ID, VESSEL_NAME, IMO_NO, DWT, VESSEL_TYPE, VESSEL_TYPE_API,
                  COUNTRY_CODE, FLAG, LOA, GRT_NRT
           FROM vessel_imo_master
           WHERE IMO_NO = ?
           LIMIT 1`,
          [imoNo],
        )
        : [[]];

      if (!existing.length) {
        // ATTACHMENT / ATTACHMENT_NAME are NOT NULL with no default on legacy schema.
        // Numeric columns must not get '' under MySQL STRICT mode.
        const [insertResult] = await pool.query(
          `INSERT INTO vessel_imo_master (
            VESSEL_NAME, VESSEL_TYPE_API, COUNTRY_CODE, SHIP_FLAG, DWT, YEARBUILT,
            CALL_SIGN, GROSS_TON, MMSI_NO, SHIP_MANAGER, SHIP_OWNER, OPERATION_STAT,
            IMO_NO, BUSINESSTYPEID, MCOMPANYID, GRT_NRT, VESSEL_TYPE,
            ATTACHMENT, ATTACHMENT_NAME
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            toSqlText(shipName, 200),
            toSqlText(shipType, 1500),
            toSqlText(countryCode, 200),
            toSqlText(ship.ShipFlag ?? '', 200),
            dwt,
            toSqlText(ship.YearOfBuilt ?? '', 50),
            toSqlText(ship.CallSign ?? '', 100),
            grossTon,
            mmsiNo,
            toSqlText(ship.ShipManager ?? ''),
            toSqlText(ship.ShipOwner ?? ''),
            toSqlText(ship.OperationStatus ?? ''),
            imoNo || null,
            businessTypeId != null ? String(businessTypeId) : null,
            toSqlInt(appContext.companyId),
            grossTon != null ? String(grossTon) : '',
            vesselTypeId,
            '',
            '',
          ],
        );
        const newId = insertResult.insertId;
        results.push({
          id: String(newId),
          name: formatVesselSearchName(shipName, countryCode, shipType, imoNo),
          vesselName: shipName,
          imoNo,
          dwt: dwt != null ? String(dwt) : '',
          vesselType: vesselTypeId != null ? String(vesselTypeId) : '',
          shipType,
          flag: '',
          loa: '',
          gnrt: grossTon != null ? String(grossTon) : '',
          status: 'From API',
        });
      } else {
        const row = existing[0];
        await pool.query(
          `UPDATE vessel_imo_master
           SET VESSEL_TYPE_API = ?, DWT = ?, GRT_NRT = ?
           WHERE VESSEL_IMO_ID = ?`,
          [
            toSqlText(shipType, 1500),
            dwt,
            grossTon != null ? String(grossTon) : '',
            row.VESSEL_IMO_ID,
          ],
        );
        results.push({
          id: String(row.VESSEL_IMO_ID),
          name: formatVesselSearchName(row.VESSEL_NAME || shipName, countryCode, shipType, imoNo),
          vesselName: row.VESSEL_NAME || shipName,
          imoNo: row.IMO_NO || imoNo,
          dwt: dwt != null ? String(dwt) : String(row.DWT ?? ''),
          vesselType: row.VESSEL_TYPE != null ? String(row.VESSEL_TYPE) : '',
          shipType,
          flag: row.FLAG != null ? String(row.FLAG) : '',
          loa: row.LOA ?? '',
          gnrt: grossTon != null ? String(grossTon) : String(row.GRT_NRT ?? ''),
          status: 'From API',
        });
      }
    } catch (shipErr) {
      upsertFailures += 1;
      const detail = shipErr.sqlMessage || shipErr.message || String(shipErr);
      if (!firstUpsertError) firstUpsertError = detail;
      console.error(
        'NavAPI vessel upsert failed for',
        ship?.ShipName || ship?.ImoNumber || 'unknown',
        ':',
        detail,
      );
    }
  }

  if (!results.length && apiResults.length) {
    throw new Error(
      `NavAPI returned ${apiResults.length} vessel(s) for "${term}" but DB insert failed`
      + (upsertFailures ? ` (${upsertFailures} error(s)` : '')
      + (firstUpsertError ? `: ${firstUpsertError}` : '')
      + (upsertFailures ? ')' : ''),
    );
  }

  return results;
}

/**
 * Vessel search for Add Estimate — mirrors PHP getVesselByImo.php:
 * 1) Search vessel_imo_master
 * 2) If empty, query NavAPI ShipDetails and upsert into DB
 */
/** Normalize UI display labels like "NAME(COUNTRY-TYPE-IMO)" before DB/API search. */
function normalizeVesselSearchTerm(raw) {
  const term = String(raw || '').trim();
  if (!term) return '';
  const withMeta = term.match(/^(.*?)\(([^)]*)\)\s*$/);
  if (withMeta) {
    const baseName = withMeta[1].trim();
    const imo = withMeta[2].split('-').pop()?.trim();
    if (imo && /^\d{6,}$/.test(imo)) return imo;
    if (baseName) return baseName;
  }
  return term;
}

/**
 * @returns {Promise<{ rows: object[], warning?: string }>}
 */
export async function dbSearchVessels(query) {
  const term = normalizeVesselSearchTerm(query);
  if (term.length < 2) return { rows: [] };

  // Temporary testing flag: skip vessel_imo_master and always query NavAPI.
  const navApiOnly = String(process.env.VESSEL_SEARCH_NAVAPI_ONLY || '').toLowerCase();
  const skipLocalDb = navApiOnly === '1' || navApiOnly === 'true' || navApiOnly === 'yes';

  if (!skipLocalDb) {
    const pool = getPool();
    const like = `%${term}%`;
    const [rows] = await pool.query(
      `SELECT VESSEL_IMO_ID, VESSEL_NAME, IMO_NO, DWT, VESSEL_TYPE, VESSEL_TYPE_API,
              COUNTRY_CODE, FLAG, LOA, GRT_NRT
       FROM vessel_imo_master
       WHERE VESSEL_NAME LIKE ? OR IMO_NO LIKE ?
       ORDER BY VESSEL_NAME
       LIMIT 25`,
      [like, like],
    );

    if (rows.length) {
      return {
        rows: rows.map((row) => mapDbVesselSearchRow(row, 'From DB')),
        source: 'db',
      };
    }
  } else {
    console.info('Vessel search: VESSEL_SEARCH_NAVAPI_ONLY enabled — skipping local DB for:', term);
  }

  // PHP transport waits until 3+ chars before calling the external API
  if (term.length < 3) {
    return { rows: [], source: 'navapi', warning: 'Type at least 3 characters to search NavAPI.' };
  }

  try {
    console.info('NavAPI ShipDetails search for:', term);
    const apiRows = await searchVesselsFromNavApi(term);
    if (!apiRows.length) {
      return {
        rows: [],
        source: 'navapi',
        warning: `NavAPI returned no vessels for "${term}".`,
      };
    }
    return { rows: apiRows, source: 'navapi' };
  } catch (err) {
    const message = err.message || String(err);
    console.error('NavAPI ShipDetails vessel search failed:', message);
    return {
      rows: [],
      source: 'navapi',
      warning: message,
    };
  }
}

function strOrEmpty(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Pick first meaningful consumption rate.
 * Treats null/''/0 like PHP's truthy checks so legacy 0 placeholders
 * fall through to WORKING_LP / WORKING_DP / IDLE_BALLAST columns.
 */
function pickConsRate(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(String(value).replace(/,/g, ''));
    if (Number.isFinite(n) && n === 0) continue;
    return String(value);
  }
  return '';
}

/**
 * Prefill estimate header / speed / consumption from fleet vessel + commercial parameters.
 * Mirrors PHP options.php?id=42 used by addestimate.php getData().
 */
export async function dbGetVesselEstimatePrefill(vesselId) {
  const pool = getPool();
  const id = String(vesselId || '').trim();
  if (!id) return null;

  const [vesselRows] = await pool.query(
    `SELECT vim.VESSEL_IMO_ID, vim.VESSEL_NAME, vim.IMO_NO, vim.DWT, vim.VESSEL_TYPE,
            vim.VESSEL_TYPE_API, vim.BUSINESSTYPEID, vim.FLAG, vim.SHIP_FLAG, vim.LOA, vim.EXT_BREADTH,
            vim.GRT_NRT, vim.NRT, vim.YEARBUILT, vim.CARGO_GEAR, vim.GRAIN, vim.BALE,
            vim.DRAFTM, vt.VesselType AS vesselTypeName, cm.COUNTRY_NAME AS flagName
     FROM vessel_imo_master vim
     LEFT JOIN vessel_type_master vt ON vt.VesselTypeId = vim.VESSEL_TYPE
     LEFT JOIN country_master cm ON cm.COUNTRYID = vim.FLAG
     WHERE vim.VESSEL_IMO_ID = ?
     LIMIT 1`,
    [id],
  );
  const vessel = vesselRows[0];
  if (!vessel) return null;

  const businessTypeId = Number(vessel.BUSINESSTYPEID) || 2;

  // PHP getVesselDetails() auto-seeds vessel_commercial_parameters from NavAPI ShipProfile.
  await ensureCommercialParametersFromNavApi(pool, id, vessel);

  let tpc = '';
  let dwtTropical = '';
  if (businessTypeId === 3) {
    const [dryRows] = await pool.query(
      `SELECT TPC_MT, TROPICAL_1, SUMMER_3
       FROM vessel_master_1
       WHERE VESSEL_IMO_ID = ?
       LIMIT 1`,
      [id],
    );
    tpc = strOrEmpty(dryRows[0]?.TPC_MT || dryRows[0]?.SUMMER_3);
    dwtTropical = strOrEmpty(dryRows[0]?.TROPICAL_1);
  } else {
    const [tankerRows] = await pool.query(
      `SELECT TPC_SUMMER
       FROM vessel_master_tankers
       WHERE VESSEL_IMO_ID = ?
       LIMIT 1`,
      [id],
    );
    tpc = strOrEmpty(tankerRows[0]?.TPC_SUMMER);
  }

  const param = await loadCommercialParameterRow(pool, id, appContext.moduleId);
  const commercialParameterId = param?.COMMERCIAL_PARAMETERID || null;

  const [anyParamRows] = await pool.query(
    `SELECT COMMERCIAL_PARAMETERID FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ?
     LIMIT 1`,
    [id],
  );

  let atSea = [];
  let inPort = [];
  let various = [];
  if (commercialParameterId) {
    const [slaveRows] = await pool.query(
      `SELECT *
       FROM vessel_commercial_parameters_slave1
       WHERE COMMERCIAL_PARAMETERID = ?
       ORDER BY BUNKERID, FO_TYPE, ZONE`,
      [commercialParameterId],
    );
    atSea = slaveRows.filter((row) => row.FO_TYPE === 'AT SEA');
    inPort = slaveRows.filter((row) => row.FO_TYPE === 'IN PORT');
    various = slaveRows.filter((row) => row.FO_TYPE === 'VARIOUS');
  }

  const variousBunkerIds = [...new Set(various.map((row) => row.BUNKERID).filter(Boolean))];
  let bunkerNameById = {};
  if (variousBunkerIds.length) {
    const [gradeRows] = await pool.query(
      `SELECT BUNKERGRADEID, NAME FROM bunker_grade_master WHERE BUNKERGRADEID IN (?)`,
      [variousBunkerIds],
    );
    bunkerNameById = Object.fromEntries(
      gradeRows.map((row) => [String(row.BUNKERGRADEID), row.NAME || '']),
    );
  }

  const pickVarious = (row, secaField, nonSecaField) => {
    const isSeca = String(row.ZONE || '').toLowerCase() === 'seca';
    return strOrEmpty(isSeca ? row[secaField] : row[nonSecaField]);
  };

  const variousBunkerRates = various.map((row) => ({
    bunkerId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    bunkerName: bunkerNameById[String(row.BUNKERID)] || '',
    zone: row.ZONE || 'Non Seca',
    coldWash: pickVarious(row, 'FO_OTHER_SECA_CONSP_TK', 'FO_OTHER_NONSECA_CONSP_TK'),
    hotWash: pickVarious(row, 'FO_OTHER_SECA_CONSP_INERT', 'FO_OTHER_NONSECA_CONSP_INERT'),
    inertGasFree: pickVarious(row, 'FO_OTHER_SECA_CONSP_GF', 'FO_OTHER_NONSECA_CONSP_GF'),
    purgeGasFree: pickVarious(row, 'FO_OTHER_SECA_CONSP_HEAT', 'FO_OTHER_NONSECA_CONSP_HEAT'),
    heatingMaintain: strOrEmpty(row.FO_OTHER_SECA_CONSP_HEAT_1),
    heatingRaise: strOrEmpty(row.FO_OTHER_NONSECA_CONSP_HEAT_1),
  }));

  // Merge Non-Seca + Seca AT SEA / IN PORT by bunker+identify (PHP laden_balast_consp + working_idle_consp).
  const bunkerKeys = new Map();
  for (const row of [...atSea, ...inPort]) {
    const key = `${row.BUNKERID || ''}|${row.IDENTIFY || 'FO'}`;
    if (!bunkerKeys.has(key)) {
      bunkerKeys.set(key, {
        bunkerGradeId: row.BUNKERID != null ? String(row.BUNKERID) : '',
        identify: row.IDENTIFY || 'FO',
        balSecaFs: '',
        ladSecaFs: '',
        balNonSecaFs: '',
        ladNonSecaFs: '',
        balSecaSs: '',
        ladSecaSs: '',
        balNonSecaSs: '',
        ladNonSecaSs: '',
        balSecaMes: '',
        ladSecaMes: '',
        balNonSecaMes: '',
        ladNonSecaMes: '',
        inPortSecaWorking: '',
        inPortNonSecaWorking: '',
        inPortSecaWorkingDp: '',
        inPortNonSecaWorkingDp: '',
        inPortSecaIdle: '',
        inPortNonSecaIdle: '',
      });
    }
    const target = bunkerKeys.get(key);
    const isSeca = String(row.ZONE || '').toLowerCase() === 'seca';
    if (row.FO_TYPE === 'AT SEA') {
      if (isSeca) {
        target.balSecaFs = strOrEmpty(row.FO_BALAST_ATSEA_SECA_CONSP_FS);
        target.ladSecaFs = strOrEmpty(row.FO_LADEN_ATSEA_SECA_CONSP_FS);
        target.balSecaSs = strOrEmpty(row.FO_BALAST_ATSEA_SECA_CONSP_SS);
        target.ladSecaSs = strOrEmpty(row.FO_LADEN_ATSEA_SECA_CONSP_SS);
        target.balSecaMes = strOrEmpty(row.FO_BALAST_ATSEA_SECA_CONSP_MES);
        target.ladSecaMes = strOrEmpty(row.FO_LADEN_ATSEA_SECA_CONSP_MES);
      } else {
        target.balNonSecaFs = strOrEmpty(row.FO_BALAST_ATSEA_NONSECA_CONSP_FS);
        target.ladNonSecaFs = strOrEmpty(row.FO_LADEN_ATSEA_NONSECA_CONSP_FS);
        target.balNonSecaSs = strOrEmpty(row.FO_BALAST_ATSEA_NONSECA_CONSP_SS);
        target.ladNonSecaSs = strOrEmpty(row.FO_LADEN_ATSEA_NONSECA_CONSP_SS);
        target.balNonSecaMes = strOrEmpty(row.FO_BALAST_ATSEA_NONSECA_CONSP_MES);
        target.ladNonSecaMes = strOrEmpty(row.FO_LADEN_ATSEA_NONSECA_CONSP_MES);
      }
    }
    if (row.FO_TYPE === 'IN PORT') {
      if (isSeca) {
        target.inPortSecaWorking = pickConsRate(
          row.FO_INPORT_SECA_CONSP_WORKING_LP,
          row.FO_INPORT_SECA_CONSP_WORKING,
        );
        target.inPortSecaWorkingDp = pickConsRate(
          row.FO_INPORT_SECA_CONSP_WORKING_DP,
          row.FO_INPORT_SECA_CONSP_OTHER,
        );
        target.inPortSecaIdle = pickConsRate(
          row.FO_INPORT_SECA_CONSP_IDLE_BALLAST,
          row.FO_INPORT_SECA_CONSP_IDLE,
        );
      } else {
        target.inPortNonSecaWorking = pickConsRate(
          row.FO_INPORT_NONSECA_CONSP_WORKING_LP,
          row.FO_INPORT_NONSECA_CONSP_WORKING,
        );
        target.inPortNonSecaWorkingDp = pickConsRate(
          row.FO_INPORT_NONSECA_CONSP_WORKING_DP,
          row.FO_INPORT_NONSECA_CONSP_OTHER,
        );
        target.inPortNonSecaIdle = pickConsRate(
          row.FO_INPORT_NONSECA_CONSP_IDLE_BALLAST,
          row.FO_INPORT_NONSECA_CONSP_IDLE,
        );
      }
    }
  }

  const consumptionRows = [...bunkerKeys.values()].map((row, index) => ({
    id: `cons-prefill-${index}`,
    ...row,
  }));

  const foRow = consumptionRows.find((row) => row.identify === 'FO') || consumptionRows[0] || null;
  const doRow = consumptionRows.find((row) => row.identify === 'DO') || null;

  let gnrt = strOrEmpty(vessel.GRT_NRT);
  let nrt = strOrEmpty(vessel.NRT);
  if (!nrt && gnrt.includes('/')) {
    const parts = gnrt.split('/');
    gnrt = strOrEmpty(parts[0]);
    nrt = strOrEmpty(parts[1]);
  } else if (!nrt && gnrt) {
    const g = Number(String(gnrt).replace(/,/g, ''));
    if (Number.isFinite(g) && g > 0) nrt = String(Math.round(g * 0.7 * 100) / 100);
  }

  const flag = strOrEmpty(vessel.flagName || vessel.SHIP_FLAG || vessel.FLAG);

  // Last estimate To-Port ? seed From Port of first leg (PHP options.php?id=42)
  const [lastLegRows] = await pool.query(
    `SELECT a.TO_PORT AS toPort,
            CONCAT(COALESCE(c.PortName, ''), ' (', COALESCE(c.COUNTRY_KEY, ''), ')') AS toPortName,
            a.TODEPARTURE AS lastDepartureDate
     FROM freight_cost_estimete_slave1 a
     INNER JOIN freight_cost_estimete_master b ON b.FCAID = a.FCAID
     LEFT JOIN port_master c ON c.PortId = a.TO_PORT
     WHERE b.VESSEL_IMO_ID = ?
       AND b.SHEET_NO IS NOT NULL
       AND a.TO_PORT IS NOT NULL
       AND a.TO_PORT <> ''
     ORDER BY a.FCA_SLAVEID DESC
     LIMIT 1`,
    [id],
  );
  const lastLeg = lastLegRows[0] || null;
  let lastDepartureDate = '';
  if (lastLeg?.lastDepartureDate) {
    const d = new Date(lastLeg.lastDepartureDate);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1971) {
      const pad = (n) => String(n).padStart(2, '0');
      lastDepartureDate = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  return {
    vesselImoId: String(vessel.VESSEL_IMO_ID),
    vesselName: strOrEmpty(vessel.VESSEL_NAME),
    imoNo: strOrEmpty(vessel.IMO_NO),
    vesselType: strOrEmpty(vessel.vesselTypeName)
      || (vessel.VESSEL_TYPE && Number(vessel.VESSEL_TYPE) !== 0 ? String(vessel.VESSEL_TYPE) : ''),
    vesselTypeId: strOrEmpty(vessel.VESSEL_TYPE),
    businessTypeId,
    flag,
    dwtSummer: strOrEmpty(vessel.DWT),
    dwtTropical,
    gnrt,
    nrt,
    loa: strOrEmpty(vessel.LOA),
    beam: strOrEmpty(vessel.EXT_BREADTH),
    gear: strOrEmpty(vessel.CARGO_GEAR),
    builtYear: strOrEmpty(vessel.YEARBUILT),
    tpc,
    grainCap: strOrEmpty(vessel.GRAIN),
    baleCap: strOrEmpty(vessel.BALE),
    loadable: strOrEmpty(vessel.DWT),
    hasCommercialParameters: anyParamRows.length > 0,
    toPort: lastLeg?.toPort != null ? String(lastLeg.toPort) : '',
    toPortName: lastLeg?.toPortName && lastLeg.toPortName !== ' ()' ? String(lastLeg.toPortName) : '',
    lastDepartureDate,

    // Speeds from vessel_commercial_parameters (PHP bfs/bes1/lfs/les1)
    bFullSpeed: strOrEmpty(param?.B_FULL_SPEED),
    bEcoSpeed1: strOrEmpty(param?.B_ECO_SPEED1),
    bEcoSpeed2: strOrEmpty(param?.B_ECO_SPEED2),
    lFullSpeed: strOrEmpty(param?.L_FULL_SPEED),
    lEcoSpeed1: strOrEmpty(param?.L_ECO_SPEED1),
    lEcoSpeed2: strOrEmpty(param?.L_ECO_SPEED2),

    // Simplified Speed/Consumption scalars (Non-SECA full-speed FO/DO + in-port)
    bFoFullSpeed: strOrEmpty(foRow?.balNonSecaFs),
    lFoFullSpeed: strOrEmpty(foRow?.ladNonSecaFs),
    bDoFullSpeed: strOrEmpty(doRow?.balNonSecaFs),
    lDoFullSpeed: strOrEmpty(doRow?.ladNonSecaFs),
    pIfoFullSpeed: strOrEmpty(foRow?.inPortNonSecaIdle),
    pWfoFullSpeed: strOrEmpty(foRow?.inPortNonSecaWorking),
    pIdoFullSpeed: strOrEmpty(doRow?.inPortNonSecaIdle),
    pWdoFullSpeed: strOrEmpty(doRow?.inPortNonSecaWorking),

    consumptionRows,

    // Bunkers Various rates (Cold/Hot Wash etc.) from commercial parameters
    variousBunkerRates,
  };
}

export async function dbCreateEstimateDetail(payload, upload = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const transDate = toDbDate(payload.transDate) || new Date().toISOString().slice(0, 10);
  const estimateType = Number(payload.estimateType) || 2;
  const now = new Date();
  const attachment = upload.attachment || '';
  const attachmentName = upload.attachmentName || '';

  try {
    await connection.beginTransaction();

    const quantity = numOrNull(payload.cargoQuantity);
    const [result] = await connection.query(
      `INSERT INTO freight_cost_estimete_master (
        FIXTURETYPEID, TRANS_DATE, MODULEID, MCOMPANYID, ADDED_BY, ADD_ON_DATE,
        L_UPDATED_BY, L_UP_TIME,
        VESSEL_IMO_ID, VESSEL_TYPE, FLAG, VOYAGE_NO, VOYAGE_NAME,
        DWT_SUMMER, DWT_TOPICAL, GNRT, LOA, TPC, ESTIMATE_TYPE, FIXED, CP_DATE,
        GROSS_BREAKDOWN, BREAKDOWN_MT, SEL_BUSI_TYPE, PERIODID,
        QUANTITY, TOTAL_DAYS, TOTAL_DISTANCE, DAILY_EARNING, PROFIT_LOSS, FREIGHT_GROSS,
        BFULLSPEED, LFULLSPEED, LUMSUM, LUMPSUMAMT, WS_QTY,
        BUNKER_EXPENSES, PORT_EXPENSES, REVENUES_FREIGHT, VOYAGE_EARNING,
        CVE_TOTALAMT, BALLAST_BONUS, HIREAGE_AMT, BROKERAGE_PER, BROKERAGE_AMT,
        ADDRESS_COMMISSION_PER, REMARKS, OWNER, DISPONENT_OWNER,
        ATTACHMENT, ATTACHMENT_NAME
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', ?, 0, 0, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        payload.fixtureTypeId,
        transDate,
        appContext.moduleId,
        appContext.companyId,
        appContext.userId,
        now,
        appContext.userId,
        now,
        payload.vesselImoId,
        payload.vesselType || null,
        payload.flag || null,
        payload.voyageNo || null,
        payload.voyageName || null,
        payload.dwtSummer || null,
        payload.dwtTropical || null,
        payload.gnrt || null,
        payload.loa || null,
        payload.tpc || null,
        estimateType,
        toDbDate(payload.cpDate) || transDate,
        payload.fixtureTypeId != null && payload.fixtureTypeId !== ''
          ? Number(payload.fixtureTypeId)
          : null,
        payload.periodId || null,
        quantity,
        numOrNull(payload.totalDays),
        numOrNull(payload.totalDistance),
        numOrNull(payload.dailyEarning),
        numOrNull(payload.profitLoss),
        numOrNull(payload.freightGross),
        numOrNull(payload.bFullSpeed),
        numOrNull(payload.lFullSpeed),
        numOrNull(payload.lumpsum),
        numOrNull(payload.lumpsum),
        numOrNull(payload.lumpsumQty),
        numOrNull(payload.totalBunkerCost),
        numOrNull(payload.totalPortCost),
        numOrNull(payload.revenue),
        numOrNull(payload.voyageEarnings),
        numOrNull(payload.cveAmt),
        numOrNull(payload.ballastBonus),
        numOrNull(payload.hireAmt),
        numOrNull(payload.brokeragePercent),
        numOrNull(payload.brokerageAmt),
        numOrNull(payload.addCommPercent),
        payload.notes || null,
        payload.ownerId || null,
        payload.disponentOwner || null,
        attachment || null,
        attachmentName || null,
      ],
    );

    const fcaId = result.insertId;
    await updateMasterEstimateFields(connection, fcaId, payload, {
      attachment,
      attachmentName,
      includeAttachment: Boolean(attachment),
    });
    await insertEstimateSlaves(connection, fcaId, payload);
    await finalizeCoaEstimateCompare(connection, fcaId, payload);

    await connection.commit();
    return { msg: 0, id: String(fcaId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Legacy COA nomination: when COA Spot = COA and a COA number is supplied,
 * create freight_cost_estimate_compare with COAAID and mark the voyage fixed/In Ops.
 */
async function finalizeCoaEstimateCompare(connection, fcaId, payload) {
  const coaSpot = String(payload.coaSpot ?? '');
  const coaId = payload.coaNumber != null && String(payload.coaNumber).trim() !== ''
    ? String(payload.coaNumber).trim()
    : '';
  if (coaSpot !== '2' || !coaId) return;

  const year = new Date().getFullYear();
  const [maxRows] = await connection.query(
    `SELECT (MAX(MESSAGE_NO) + 1) AS MESSAGE_NO
     FROM freight_cost_estimate_compare
     WHERE YEAR(ADD_ON_DATE) = ? AND MCOMPANYID = ? AND COAAID IS NOT NULL`,
    [year, appContext.companyId],
  );
  let messageNo = maxRows[0]?.MESSAGE_NO;
  if (!messageNo) messageNo = 1;
  const padded = String(messageNo).padStart(3, '0');
  const message = `${String(year).slice(-2)}-${padded}`;

  const [compareResult] = await connection.query(
    `INSERT INTO freight_cost_estimate_compare
      (FCAID, FINAL_ID, MESSAGE_NO, USERID, ADD_ON_DATE, MESSAGE, MODULEID, MCOMPANYID, COAAID, OPERATOR, STATUS)
     VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, 1)`,
    [
      fcaId,
      fcaId,
      padded,
      appContext.userId,
      message,
      appContext.moduleId,
      appContext.companyId,
      coaId,
      payload.operatorId || appContext.userId || null,
    ],
  );

  await connection.query(
    `UPDATE freight_cost_estimete_master
     SET COMID = ?, FIXED = 1, FINAL_DATETIME = NOW(), FINAL_STATUS = 1
     WHERE FCAID = ?`,
    [compareResult.insertId, fcaId],
  );
}

const ESTIMATE_SLAVE_DELETE_ORDER = [
  'freight_cost_estimete_slave15',
  'freight_cost_estimete_slave1',
  'freight_cost_estimete_slave2',
  'freight_cost_estimete_slave3',
  'freight_cost_estimete_slave4',
  'freight_cost_estimete_slave5',
  'freight_cost_estimete_slave6',
  'freight_cost_estimete_slave7',
  'freight_cost_estimete_slave8',
  'freight_cost_estimete_slave10',
  'freight_cost_estimete_slave11',
  'freight_cost_estimete_slave12',
  'freight_cost_estimete_slave13',
  'freight_cost_estimete_slave14',
  'freight_cost_estimete_slave16',
  'freight_cost_estimete_slave17',
  'freight_cost_estimete_slave18',
  'freight_cost_estimete_slave19',
  'freight_cost_estimete_slave20',
];

async function deleteEstimateSlaves(connection, fcaId) {
  for (const table of ESTIMATE_SLAVE_DELETE_ORDER) {
    try {
      await connection.query(`DELETE FROM ${table} WHERE FCAID = ?`, [fcaId]);
    } catch {
      // Some slave tables (e.g. slave19) may not exist on older schemas.
    }
  }
}

async function updateMasterEstimateFields(connection, fcaId, payload, opts = {}) {
  const sets = [
    'FIXTURETYPEID = ?',
    'SEL_BUSI_TYPE = ?',
    'TRANS_DATE = ?',
    'VESSEL_IMO_ID = ?',
    'VESSEL_TYPE = ?',
    'FLAG = ?',
    'VOYAGE_NO = ?',
    'VOYAGE_NAME = ?',
    'DWT_SUMMER = ?',
    'DWT_TOPICAL = ?',
    'GNRT = ?',
    'LOA = ?',
    'TPC = ?',
    'GEAR = ?',
    'BUILD_YEAR = ?',
    'BEAM = ?',
    'LODABLE = ?',
    'SF = ?',
    'GRAIN_CAP = ?',
    'BALE_CAP = ?',
    'BFULLSPEED = ?',
    'BECOSPEED1 = ?',
    'BECOSPEED2 = ?',
    'LFULLSPEED = ?',
    'LECOSPEED1 = ?',
    'LECOSPEED2 = ?',
    'BFOFULLSPEED = ?',
    'LFOFULLSPEED = ?',
    'BDOFULLSPEED = ?',
    'LDOFULLSPEED = ?',
    'PIFOFULLSPEED = ?',
    'PWFOFULLSPEED = ?',
    'PIDOFULLSPEED = ?',
    'PWDOFULLSPEED = ?',
    'QUANTITY = ?',
    'TANK_QUANTITY = ?',
    'GAS_QUANTITY = ?',
    'TOTAL_DAYS = ?',
    'TOTAL_DISTANCE = ?',
    'DAILY_EARNING = ?',
    'PROFIT_LOSS = ?',
    'FREIGHT_GROSS = ?',
    'LUMSUM = ?',
    'LUMPSUMAMT = ?',
    'WS_QTY = ?',
    'BUNKER_EXPENSES = ?',
    'PORT_EXPENSES = ?',
    'REVENUES_FREIGHT = ?',
    'VOYAGE_EARNING = ?',
    'CVE_AMT = ?',
    'CVE_TOTALAMT = ?',
    'BALLAST_BONUS = ?',
    'HIREAGE_AMT = ?',
    'HIREAGE_PERCENT = ?',
    'HIERAGE_BROKER_PERCENT = ?',
    'BROKERAGE_PER = ?',
    'BROKERAGE_AMT = ?',
    'ADDRESS_COMMISSION_PER = ?',
    'ADDRESS_COMMISSION_AMT = ?',
    'CARGO_RATE = ?',
    'CARGO_ID = ?',
    'DAILY_VESSEL_OPERATION_EXP = ?',
    'LAYCANSTART = ?',
    'LAYCANEND = ?',
    'WORKING_DAYS = ?',
    'PERIODID = ?',
    'CHARTERING_PIC = ?',
    'CHARTERING_PIC_1 = ?',
    'TANKER_RADIO_SINGLE_DIS = ?',
    'CHK_LUMPSUM = ?',
    'LUMP_VENDOR = ?',
    'REMARKS = ?',
    'OWNER = ?',
    'DISPONENT_OWNER = ?',
    'GAS_BALTIC = ?',
    'GAS_BASE_RATE = ?',
    'GAS_MARKET = ?',
    'GAS_LUMSUM = ?',
    'ADDNL_PRENIUM = ?',
    'BASERATE_FLOAT = ?',
    'BASERATE_FIXED = ?',
    'BASERATE_AVERAGE = ?',
    'GROSS_FREIGHT_FLOAT = ?',
    'GROSS_FREIGHT_FIXED = ?',
    'GROSS_FREIGHT_AVERAGE = ?',
    'NETFREIGHT_FLOAT = ?',
    'NETFREIGHT_FIXED = ?',
    'NETFREIGHT_AVERAGE = ?',
    'TCEEARNING_FLOAT = ?',
    'TCEEARNING_FIXED = ?',
    'TCEEARNING_AVERAGE = ?',
    'TANK_WS_FROM = ?',
    'TANK_WS_TO = ?',
    'SDR_TO_USD = ?',
    'OFF_HIRE_CVE = ?',
    'OFF_HIRE_CVE_AMOUNT = ?',
    'LESS_OFF_HIRE = ?',
    'OPEN_PORT = ?',
    'ZONE_OPEN = ?',
    'BROKER = ?',
    'COA_SPOT = ?',
    'COA_NUMBER = ?',
    'COA_NUMBER_LIFT = ?',
    'NO_OF_SHIPMENT = ?',
    'CP_DATE = ?',
    'ETA_DATE = ?',
    'VESSELDAILYOPS = ?',
    'CVE_VENDORID = ?',
    'CHKHIRE = ?',
    'CHKINDEX = ?',
    'BALTICINDEX = ?',
    'BALTICPERCENT = ?',
    'BALTICRATE = ?',
    'DTCVENDORID = ?',
    'BROKERAGE_VENDORID = ?',
    'TC_CP_DATE = ?',
    'TC_DELIVERY_RANGE = ?',
    'TC_RE_DELIVERY_RANGE = ?',
    'TC_DELIVERY_DATE = ?',
    'TC_RE_DELIVERY_DATE = ?',
  ];

  const tankWs = resolveTankWsPorts(payload);
  const fixtureTypeId = payload.fixtureTypeId != null && payload.fixtureTypeId !== ''
    ? Number(payload.fixtureTypeId)
    : null;
  const values = [
    fixtureTypeId,
    fixtureTypeId,
    toDbDate(payload.transDate),
    payload.vesselImoId || null,
    payload.vesselType || null,
    payload.flag || null,
    payload.voyageNo || null,
    payload.voyageName || null,
    payload.dwtSummer || null,
    payload.dwtTropical || null,
    payload.gnrt || null,
    payload.loa || null,
    payload.tpc || null,
    payload.gear || null,
    payload.builtYear || null,
    payload.beam || null,
    payload.loadable || null,
    payload.stowageFactor || null,
    payload.grainCap || null,
    payload.baleCap || null,
    numOrNull(payload.bFullSpeed),
    numOrNull(payload.bEcoSpeed1),
    numOrNull(payload.bEcoSpeed2),
    numOrNull(payload.lFullSpeed),
    numOrNull(payload.lEcoSpeed1),
    numOrNull(payload.lEcoSpeed2),
    numOrNull(payload.bFoFullSpeed),
    numOrNull(payload.lFoFullSpeed),
    numOrNull(payload.bDoFullSpeed),
    numOrNull(payload.lDoFullSpeed),
    numOrNull(payload.pIfoFullSpeed),
    numOrNull(payload.pWfoFullSpeed),
    numOrNull(payload.pIdoFullSpeed),
    numOrNull(payload.pWdoFullSpeed),
    numOrNull(payload.cargoQuantity),
    // Dashboard Cargo column uses TANK_QUANTITY (tankers) / GAS_QUANTITY (gas)
    Number(payload.estimateType) === 2 ? numOrNull(payload.cargoQuantity) : null,
    Number(payload.estimateType) === 1 ? numOrNull(payload.cargoQuantity) : null,
    numOrNull(payload.totalDays),
    numOrNull(payload.totalDistance),
    numOrNull(payload.dailyEarning),
    numOrNull(payload.profitLoss),
    numOrNull(payload.freightGross),
    numOrNull(payload.lumpsum),
    numOrNull(payload.lumpsum),
    numOrNull(payload.lumpsumQty),
    numOrNull(payload.totalBunkerCost),
    numOrNull(payload.totalPortCost),
    numOrNull(payload.revenue),
    numOrNull(payload.voyageEarnings),
    numOrNull(payload.cvePerMonth),
    numOrNull(payload.cveAmt),
    numOrNull(payload.ballastBonus),
    numOrNull(payload.hireAmt),
    numOrNull(payload.hireagePercent),
    numOrNull(payload.hireageBroPercent),
    numOrNull(payload.brokeragePercent),
    numOrNull(payload.brokerageAmt),
    numOrNull(payload.addCommPercent),
    numOrNull(payload.addressCommAmt),
    numOrNull(payload.tankerFreightRate || payload.marketRate),
    Array.isArray(payload.cargoIds) && payload.cargoIds.length
      ? payload.cargoIds.join(',')
      : (payload.cargoIds || null),
    // PHP DAILY_VESSEL_OPERATION_EXP = Daily Hire ($/Day), not Vessel Daily Ops
    numOrNull(payload.hireRate || payload.dailyVesselOperationExp),
    toDbDateTime(payload.laycanStart),
    toDbDateTime(payload.laycanEnd),
    numOrNull(payload.timeAllowed),
    payload.periodId || null,
    payload.charteringTeam || '7',
    payload.charteringPic || null,
    payload.tankType != null && payload.tankType !== '' ? Number(payload.tankType) : 1,
    payload.chkLumpsum ? 1 : 0,
    payload.lumpsumVendor || null,
    payload.notes || null,
    payload.ownerId || null,
    payload.disponentOwner
      || (payload.disponentRows || []).map((r) => r.name).filter(Boolean).join(', ')
      || null,
    numOrNull(payload.gasBaltic),
    numOrNull(payload.gasBaseRate),
    Number(payload.estimateType) === 1
      ? (Number(payload.gasMarket) === 2 ? 2 : 1)
      : null,
    Number(payload.estimateType) === 1
      ? numOrNull(payload.gasLumsum || payload.lumpsum)
      : null,
    numOrNull(payload.addnlPremium),
    numOrNull(payload.baseRateFloat),
    numOrNull(payload.baseRateFixed),
    numOrNull(payload.baseRateAverage),
    numOrNull(payload.grossFreightFloat),
    numOrNull(payload.grossFreightFixed),
    numOrNull(payload.grossFreightAverage),
    numOrNull(payload.netFreightFloat),
    numOrNull(payload.netFreightFixed),
    numOrNull(payload.netFreightAverage),
    numOrNull(payload.tceFloat),
    numOrNull(payload.tceFixed),
    numOrNull(payload.tceAverage),
    tankWs.from,
    tankWs.to,
    numOrNull(payload.sdrToUsd),
    numOrNull(payload.offHireCve),
    numOrNull(payload.offHireCveAmt),
    numOrNull(payload.lessOffHire),
    payload.openPort || null,
    payload.zoneOpen || null,
    payload.fixtureBroker || null,
    payload.coaSpot || null,
    payload.coaNumber || null,
    payload.coaNumberLift || null,
    payload.noOfShipment || null,
    toDbDate(payload.cpDate),
    toDbDate(payload.etaDate),
    numOrNull(payload.vesselDailyOps),
    payload.cveVendorId || null,
    payload.chkHire ? 1 : 0,
    payload.chkIndex ? 1 : 0,
    payload.balticIndex || null,
    numOrNull(payload.balticPercent),
    numOrNull(payload.balticRate),
    payload.dtcVendorId || null,
    payload.brokerageVendorId || null,
    toDbDate(payload.tcCpDate),
    payload.tcDeliveryRange || null,
    payload.tcRedeliveryRange || null,
    toDbDateTime(payload.tcDeliveryDate),
    toDbDateTime(payload.tcRedeliveryDate),
  ];

  if (opts.includeAttachment) {
    sets.push('ATTACHMENT = ?', 'ATTACHMENT_NAME = ?');
    values.push(opts.attachment || null, opts.attachmentName || null);
  }

  // Voyage Financials (updatecost_sheet_tci) — Submit to Edit (0) / Submit to Close (1)
  if (payload.finalStatus != null && payload.finalStatus !== '') {
    sets.push('FINAL_STATUS = ?', 'FIXED = 1');
    values.push(Number(payload.finalStatus) === 1 ? 1 : 0);
  }

  sets.push('L_UPDATED_BY = ?', 'L_UP_TIME = NOW()');
  values.push(appContext.userId);

  values.push(fcaId, appContext.moduleId, appContext.companyId);

  await connection.query(
    `UPDATE freight_cost_estimete_master
     SET ${sets.join(', ')}
     WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
    values,
  );
}

async function insertEstimateSlaves(connection, fcaId, payload) {
  for (const leg of payload.portLegs || []) {
    if (!leg.fromPortId && !leg.toPortId) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave1 (
        FCAID, FROM_PORT, TO_PORT, DIS_TYPE, PASSAGE_TYPE, SPEED_TYPE, DISTANCE,
        MARGIN_DISTANCE, FROMARRIVAL, FROMDEPARTURE, TOARRIVAL, TODEPARTURE,
        FROMROBFOARRIVAL, FROMROBDOARRIVAL, FROMROBFODEPARTURE, FROMROBDODEPARTURE,
        TOROBFOARRIVAL, TOROBDOARRIVAL, TOROBFODEPARTURE, TOROBDODEPARTURE,
        LOAD_PORT_QTY, DISC_PORT_QTY, LOAD_PORT_COST, DISC_PORT_COST,
        LOAD_PORT_RATE, DISC_PORT_RATE, LOAD_PORT_TERMS, DISC_PORT_TERMS,
        LOAD_PORT_WORK_DAYS, DISC_PORT_WORK_DAYS, LOAD_PORT_IDEAL_DAYS, DISC_PORT_IDEAL_DATE,
        TRANSIT_PORT_IDLE_DAYS, TOTAL_VOYAGE_DAYS, RANDOMID,
        SECA_DISTANCE, SECA_DAYS, TRANSIT_PORT_COST, DDCLP_ESTCOST, DDCDP_ESTCOST,
        DDCLP_REALCOST, DDCDP_REALCOST, DDCLP_NETCOST, DDCDP_NETCOST,
        DEMMDAYSLP, DEMMRATELP, DEMMDAYSDP, DEMMRATEDP,
        CHK_LP_SECA, CHK_DP_SECA, CHK_TP_SECA,
        BG_NON_SECA, BG_SECA, BUNKER_GRADE_LP, BUNKER_GRADE_DP, BUNKER_GRADE_TP,
        CHARTERERACCOUNT, CHK_MAND, SEL_CARGO_LP, SEL_CARGO_DP,
        PORT_COSTTP_VENDOR, PORT_COSTLP_VENDOR, PORT_COSTDP_VENDOR,
        DDCLP_VENDOR, DDCDP_VENDOR
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        leg.fromPortId || null,
        leg.toPortId || null,
        leg.navMethod || null,
        leg.passageType || null,
        leg.speedType || null,
        numOrNull(leg.distance),
        numOrNull(leg.seaMargin != null && leg.seaMargin !== '' ? leg.seaMargin : 0),
        toDbDateTime(leg.fromArrival),
        toDbDateTime(leg.fromDeparture),
        toDbDateTime(leg.toArrival),
        toDbDateTime(leg.toDeparture),
        numOrNull(leg.fromRobFoArrival),
        numOrNull(leg.fromRobDoArrival),
        numOrNull(leg.fromRobFoDeparture),
        numOrNull(leg.fromRobDoDeparture),
        numOrNull(leg.toRobFoArrival),
        numOrNull(leg.toRobDoArrival),
        numOrNull(leg.toRobFoDeparture),
        numOrNull(leg.toRobDoDeparture),
        numOrNull(leg.loadQty),
        numOrNull(leg.dischargeQty),
        numOrNull(leg.loadPortCost),
        numOrNull(leg.discPortCost),
        numOrNull(leg.loadPortRate),
        numOrNull(leg.discPortRate),
        numOrNull(leg.loadPortTerms),
        numOrNull(leg.discPortTerms),
        numOrNull(leg.loadPortWorkDays),
        numOrNull(leg.discPortWorkDays),
        numOrNull(leg.loadPortIdleDays),
        numOrNull(leg.discPortIdleDays),
        numOrNull(leg.transitIdleDays),
        numOrNull(leg.seaDays),
        randomId(),
        numOrNull(leg.secaDistance),
        numOrNull(leg.secaDays),
        numOrNull(leg.transitPortCost),
        numOrNull(leg.ddcLpEst),
        numOrNull(leg.ddcDpEst),
        numOrNull(leg.ddcLpReal != null && leg.ddcLpReal !== '' ? leg.ddcLpReal : leg.ddcLpEst),
        numOrNull(leg.ddcDpReal != null && leg.ddcDpReal !== '' ? leg.ddcDpReal : leg.ddcDpEst),
        numOrNull(leg.ddcLpNett),
        numOrNull(leg.ddcDpNett),
        numOrNull(leg.demmDaysLp),
        numOrNull(leg.demmRateLp),
        numOrNull(leg.demmDaysDp),
        numOrNull(leg.demmRateDp),
        leg.chkLpSeca ? 1 : 0,
        leg.chkDpSeca ? 1 : 0,
        leg.chkTpSeca ? 1 : 0,
        leg.bgNonSeca || 'VLSFO',
        leg.bgSeca || 'LSMGO',
        Array.isArray(leg.lpBunkerGrades) ? leg.lpBunkerGrades.join(',') : (leg.lpBunkerGrades || 'VLSFO'),
        Array.isArray(leg.dpBunkerGrades) ? leg.dpBunkerGrades.join(',') : (leg.dpBunkerGrades || 'VLSFO'),
        Array.isArray(leg.tpBunkerGrades) ? leg.tpBunkerGrades.join(',') : (leg.tpBunkerGrades || 'VLSFO'),
        numOrNull(leg.chartererAccountDays),
        leg.portFunction || null,
        leg.lpCargoId || null,
        leg.dpCargoId || null,
        leg.tpPortVendorId || null,
        leg.lpPortVendorId || null,
        leg.dpPortVendorId || null,
        leg.ddcLpVendorId || null,
        leg.ddcDpVendorId || null,
      ],
    );
  }

  const allCargos = [
    ...(payload.cargoRows || []).map((row) => ({ ...row, status: row.status || 1 })),
    ...(payload.overageCargoRows || []).map((row) => ({ ...row, status: 2 })),
    ...(payload.deadfreightCargoRows || []).map((row) => ({ ...row, status: 3 })),
  ];

  for (const cargo of allCargos) {
    if (!cargo.cargoId && !cargo.cargoMt) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave10 (
        FCAID, SHIPPER_CHARTER, CARGO_CBM, CARGO_MT, RATE_USD_MT, AMOUNT_USD,
        STATUS, CARGOID, RANDOMID, DEM_AMT, VENDORID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        cargo.charterer || null,
        numOrNull(cargo.cargoCbm),
        numOrNull(cargo.cargoMt),
        numOrNull(cargo.rateUsdMt),
        numOrNull(cargo.amountUsd),
        cargo.status || 1,
        cargo.cargoId || null,
        randomId(),
        numOrNull(cargo.demAmt),
        cargo.vendorId || null,
      ],
    );
  }

  for (const bunker of payload.bunkerRows || []) {
    if (!bunker.bunkerGradeId && !bunker.qty) continue;
    const identify = bunker.identify || 'CONSUMPTION';
    if (String(identify).toUpperCase() === 'SUPPLY') {
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave8 (
          FCAID, BUNKERGRADEID, COST, VENDORID, COST_MT, QTY, PRICE, PORT, IDENTIFY
        ) VALUES (?, ?, ?, ?, '0.00', ?, ?, ?, 'SUPPLY')`,
        [
          fcaId,
          bunker.bunkerGradeId || null,
          numOrNull(bunker.cost),
          bunker.vendorId || null,
          numOrNull(bunker.qty),
          numOrNull(bunker.price),
          bunker.portId || null,
        ],
      );
      continue;
    }
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave8 (
        FCAID, BUNKERGRADEID, COST, COST_MT, QTY, PRICE, IDENTIFY
      ) VALUES (?, ?, ?, '0.00', ?, ?, ?)`,
      [
        fcaId,
        bunker.bunkerGradeId || null,
        numOrNull(bunker.cost),
        numOrNull(bunker.qty),
        numOrNull(bunker.price),
        identify,
      ],
    );
  }

  for (const row of payload.bunkerActivityRows || []) {
    if (!row.qty && !row.amount && !row.activity) continue;
    try {
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave19 (
          FCAID, ACTIVITY, BUNKERGRADE, QUANTITY, PRICE, AMOUNT
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          fcaId,
          row.activity || null,
          row.bunkerGrade || null,
          numOrNull(row.qty),
          numOrNull(row.price),
          numOrNull(row.amount),
        ],
      );
    } catch {
      // slave19 may be absent on older schemas
    }
  }

  for (const row of payload.profitSharingRows || []) {
    if (!row.vendorId && !row.percentage) continue;
    try {
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave20 (
          FCAID, VENDORID, PERCENTAGE
        ) VALUES (?, ?, ?)`,
        [
          fcaId,
          row.vendorId || null,
          numOrNull(row.percentage),
        ],
      );
    } catch {
      // slave20 may be absent on older schemas
    }
  }

  const brokerRows = (payload.brokerRows && payload.brokerRows.length)
    ? payload.brokerRows
    : ((payload.brokeragePercent || payload.brokerageAmt)
      ? [{ percent: payload.brokeragePercent, amount: payload.brokerageAmt, vendorId: '' }]
      : []);
  for (const broker of brokerRows) {
    if (!broker.percent && !broker.amount && !broker.vendorId) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave4 (
        FCAID, BROKAGE_PERCENT, BROKAGE_AMT, DEMM_BROKAGE_PERCENT, VENDORID
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        fcaId,
        numOrNull(broker.percent),
        numOrNull(broker.amount),
        numOrNull(broker.demmPercent),
        broker.vendorId || null,
      ],
    );
  }

  for (const orc of payload.orcRows || []) {
    if (!orc.costId && !orc.amount) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave3 (
        FCAID, IDENTY_ID, IDENTIFY, RAW_AMOUNT, COST_MT, VENDORID, RANDOMID
      ) VALUES (?, ?, 'ORC', ?, ?, ?, ?)`,
      [
        fcaId,
        orc.costId || null,
        numOrNull(orc.amount),
        numOrNull(orc.amountMt),
        orc.vendorId || null,
        randomId(),
      ],
    );
  }

  for (const income of payload.otherIncomeRows || []) {
    if (!income.description && !income.amount) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave3 (
        FCAID, IDENTY_ID, IDENTIFY, COST, ADDCOMM, RAW_AMOUNT, VENDORID, RANDOMID
      ) VALUES (?, ?, 'OTHERINCOME', ?, ?, ?, ?, ?)`,
      [
        fcaId,
        income.description || null,
        numOrNull(income.amount),
        numOrNull(income.addComm),
        numOrNull(income.netAmount),
        income.vendorId || null,
        randomId(),
      ],
    );
  }

  for (const hire of payload.hireRows || []) {
    if (!hire.hireDays && !hire.hireRate && !hire.hireAmt) continue;
    // PHP: only insert slave17 when both HIRE_FROM and HIRE_TO are provided.
    // Rate/days/amt still persist on master (HIREAGE_AMT / hire calc).
    const hireFrom = toDbDateTime(hire.hireFrom);
    const hireTo = toDbDateTime(hire.hireTo);
    if (!hireFrom || !hireTo) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave17 (
        FCAID, HIRE_FROM, HIRE_TO, HIRE_DAYS, HIRE_RATE, HIRE_AMT, RANDOMID
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        hireFrom,
        hireTo,
        numOrNull(hire.hireDays),
        numOrNull(hire.hireRate),
        numOrNull(hire.hireAmt),
        randomId(),
      ],
    );
  }

  for (const seca of payload.secaBunkerRows || []) {
    if (!seca.bunkerGradeId && !seca.qty) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave2 (
        FCAID, BUNKERGRADEID, EST_MT, EST_PRICE, EST_COST, IDENTIFY, CHK_IF_CAL, BUNKER_TYPE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        seca.bunkerGradeId || null,
        numOrNull(seca.qty),
        numOrNull(seca.price),
        numOrNull(seca.cost),
        seca.identify || 'SECA',
        seca.calc === false ? 0 : 1,
        seca.bunkerType || 'FO',
      ],
    );
  }

  for (const row of payload.consumptionRows || []) {
    if (!row.bunkerGradeId && !row.balSecaFs && !row.ladSecaFs && !row.balNonSecaFs) continue;
    // Mirror PHP slave16 insert column layout from functions_internal_user_sopf.inc.php.
    // Also write the At Sea form's misnamed IDLE/OTHER slots so PHP edit pages
    // that read those fields still see Working DP / Idle correctly.
    const workingLpS = numOrNull(row.inPortSecaWorking);
    const workingLpNs = numOrNull(row.inPortNonSecaWorking);
    const workingDpS = numOrNull(row.inPortSecaWorkingDp);
    const workingDpNs = numOrNull(row.inPortNonSecaWorkingDp);
    const idleS = numOrNull(row.inPortSecaIdle);
    const idleNs = numOrNull(row.inPortNonSecaIdle);
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave16 (
        FCAID, BUNKERID, IDENTIFY,
        FO_BALAST_ATSEA_SECA_CONSP_FS, FO_LADEN_ATSEA_SECA_CONSP_FS,
        FO_BALAST_ATSEA_NONSECA_CONSP_FS, FO_LADEN_ATSEA_NONSECA_CONSP_FS,
        FO_BALAST_ATSEA_SECA_CONSP_SS, FO_LADEN_ATSEA_SECA_CONSP_SS,
        FO_BALAST_ATSEA_NONSECA_CONSP_SS, FO_LADEN_ATSEA_NONSECA_CONSP_SS,
        FO_BALAST_ATSEA_SECA_CONSP_MES, FO_LADEN_ATSEA_SECA_CONSP_MES,
        FO_BALAST_ATSEA_NONSECA_CONSP_MES, FO_LADEN_ATSEA_NONSECA_CONSP_MES,
        FO_INPORT_SECA_CONSP_WORKING, FO_INPORT_NONSECA_CONSP_WORKING,
        FO_INPORT_SECA_CONSP_IDLE, FO_INPORT_NONSECA_CONSP_IDLE,
        FO_INPORT_SECA_CONSP_OTHER, FO_INPORT_NONSECA_CONSP_OTHER,
        FO_INPORT_SECA_CONSP_IDLE_BALLAST, FO_INPORT_NONSECA_CONSP_IDLE_BALLAST,
        FO_INPORT_SECA_CONSP_IDLE_LADEN, FO_INPORT_NONSECA_CONSP_IDLE_LADEN,
        FO_INPORT_SECA_CONSP_WORKING_LP, FO_INPORT_NONSECA_CONSP_WORKING_LP,
        FO_INPORT_SECA_CONSP_WORKING_DP, FO_INPORT_NONSECA_CONSP_WORKING_DP,
        FO_OTHER_SECA_CONSP_TK, FO_OTHER_NONSECA_CONSP_TK,
        FO_OTHER_SECA_CONSP_INERT, FO_OTHER_NONSECA_CONSP_INERT,
        FO_OTHER_SECA_CONSP_GF, FO_OTHER_NONSECA_CONSP_GF,
        FO_OTHER_SECA_CONSP_HEAT, FO_OTHER_NONSECA_CONSP_HEAT,
        FO_OTHER_SECA_CONSP_HEAT_1, FO_OTHER_NONSECA_CONSP_HEAT_1
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        row.bunkerGradeId || null,
        row.identify || 'FO',
        numOrNull(row.balSecaFs),
        numOrNull(row.ladSecaFs),
        numOrNull(row.balNonSecaFs),
        numOrNull(row.ladNonSecaFs),
        numOrNull(row.balSecaSs),
        numOrNull(row.ladSecaSs),
        numOrNull(row.balNonSecaSs),
        numOrNull(row.ladNonSecaSs),
        numOrNull(row.balSecaMes),
        numOrNull(row.ladSecaMes),
        numOrNull(row.balNonSecaMes),
        numOrNull(row.ladNonSecaMes),
        workingLpS,
        workingLpNs,
        // PHP At Sea form stores Working DP NS in SECA_IDLE
        workingDpNs,
        idleNs,
        // PHP At Sea form stores Working DP S in SECA_OTHER, Idle S in NONSECA_OTHER
        workingDpS,
        idleS,
        idleS,
        idleNs,
        idleS,
        idleNs,
        workingLpS,
        workingLpNs,
        workingDpS,
        workingDpNs,
        numOrNull(row.otherSecaTk),
        numOrNull(row.otherNonSecaTk),
        numOrNull(row.otherSecaInert),
        numOrNull(row.otherNonSecaInert),
        numOrNull(row.otherSecaGf),
        numOrNull(row.otherNonSecaGf),
        numOrNull(row.otherSecaHeat),
        numOrNull(row.otherNonSecaHeat),
        numOrNull(row.otherSecaHeat1),
        numOrNull(row.otherNonSecaHeat1),
      ],
    );
  }

  for (const loc of payload.passageLocations || []) {
    if (!loc.fromLocation && !loc.toLocation) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave6 (
        FCAID, LOCATION_FROM, LOCATION_TO, PASSAGE_TYPE, SPEED_TYPE, DISTANCE
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        loc.fromLocation || null,
        loc.toLocation || null,
        loc.passageType || null,
        loc.speedType || null,
        numOrNull(loc.distance),
      ],
    );
  }

  for (const fq of payload.freightQtyRows || []) {
    if (!fq.vendorId && !fq.quantity && !fq.agreedGrossFreight) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave7 (
        FCAID, QTY_VENDORID, AGREED_GROSS_FREIGHT, QUANTITY, GROSS_FREIGHT,
        BROKERAGE, NET_BROKERAGE, NET_FREIGHT, NET_FREIGHT_PERMT,
        CURRENCYID, AGREED_GROSS_FREIGHT_LOCAL, EXCHANGE_RATE, CARGO, RANDOMID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        fq.vendorId || null,
        numOrNull(fq.agreedGrossFreight),
        numOrNull(fq.quantity),
        numOrNull(fq.grossFreight),
        numOrNull(fq.brokeragePercent),
        numOrNull(fq.netBrokerage),
        numOrNull(fq.netFreight),
        numOrNull(fq.netFreightPerMt),
        fq.currencyId || null,
        numOrNull(fq.localAgreedFreight),
        numOrNull(fq.exchangeRate),
        fq.cargoId || null,
        randomId(),
      ],
    );
  }

  for (const inv of payload.invoiceRows || []) {
    if (!inv.invoiceId) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave11 (INVOICEID, FCAID) VALUES (?, ?)`,
      [String(inv.invoiceId).trim(), fcaId],
    );
  }

  for (const ws of payload.tankerWsRows || []) {
    if (!ws.freightSpecs && !ws.minCargoQty && !ws.totalAmount) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave12 (
        FCAID, FREIGHT_SPECS, CUSTOMER, MIN_CARGO_QTY, OVE_CARGO_QTY,
        MIN_FLAT_RATE, OVE_FLAT_RATE, MIN_WS, OVE_WS, MIN_DIS_LEG, OVE_DIS_LEG,
        MIN_DISTANCE, OVE_DISTANCE, MIN_AMOUNT, OVE_AMOUNT, TOTAL_QTY, TOTAL_AMOUNT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        ws.freightSpecs || null,
        ws.customerId || null,
        numOrNull(ws.minCargoQty),
        numOrNull(ws.oveCargoQty),
        numOrNull(ws.minFlatRate),
        numOrNull(ws.oveFlatRate),
        numOrNull(ws.minWs),
        numOrNull(ws.oveWs),
        numOrNull(ws.minDisLeg),
        numOrNull(ws.oveDisLeg),
        numOrNull(ws.minDistance),
        numOrNull(ws.oveDistance),
        numOrNull(ws.minAmount),
        numOrNull(ws.oveAmount),
        numOrNull(ws.totalQty),
        numOrNull(ws.totalAmount),
      ],
    );
  }

  for (const off of payload.offHireRows || []) {
    if (!off.reason && !off.days && !off.amount) continue;
    const [offResult] = await connection.query(
      `INSERT INTO freight_cost_estimete_slave14 (
        FCAID, OFF_REASON, OFF_FROM, OFF_TO, OFF_DAYS, HIRE_RATE, OFF_HIRE, RANDOMID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        off.reason || null,
        toDbDateTime(off.from) || '1970-01-01 00:00:00',
        toDbDateTime(off.to) || '1970-01-01 00:00:00',
        numOrNull(off.days),
        numOrNull(off.rate),
        numOrNull(off.amount),
        randomId(),
      ],
    );
    const slave14Id = offResult.insertId;
    for (const bunker of off.bunkers || []) {
      if (!bunker.bunkerGradeId && !bunker.qty && !bunker.amount) continue;
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave15 (
          FCA_SLAVE14ID, FCAID, BUNKERID, BUNKERQTY, BUNKERPRICE, BUNKERAMT, CHECK_BUNKER_CAL
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          slave14Id,
          fcaId,
          bunker.bunkerGradeId || null,
          numOrNull(bunker.qty),
          numOrNull(bunker.price),
          numOrNull(bunker.amount),
          bunker.calc === false ? 0 : 1,
        ],
      );
    }
  }

  for (const row of payload.deliveryBunkerRows || []) {
    if (!row.bunkerGradeId && !row.qty) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave13 (
        FCAID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY
      ) VALUES (?, ?, ?, ?, ?, ?, 'DEL')`,
      [
        fcaId,
        row.bunkerGradeId || null,
        numOrNull(row.amount),
        toDbDate(row.bunkerDate) || '1970-01-01',
        numOrNull(row.qty),
        numOrNull(row.price),
      ],
    );
  }

  for (const row of payload.redeliveryBunkerRows || []) {
    if (!row.bunkerGradeId && !row.qty) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave13 (
        FCAID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY
      ) VALUES (?, ?, ?, ?, ?, ?, 'REDEL')`,
      [
        fcaId,
        row.bunkerGradeId || null,
        numOrNull(row.amount),
        toDbDate(row.bunkerDate) || '1970-01-01',
        numOrNull(row.qty),
        numOrNull(row.price),
      ],
    );
  }

  for (const row of payload.disponentRows || []) {
    if (!row.name) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave5 (FCAID, DISPONENT_OWNER) VALUES (?, ?)`,
      [fcaId, row.name],
    );
  }

  for (const row of payload.voyageEventRows || []) {
    if (!row.details && !row.eventDate) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave18 (FCAID, EVENT_DETAILS, EVENT_DATE)
       VALUES (?, ?, ?)`,
      [fcaId, row.details || null, toDbDate(row.eventDate) || '1970-01-01'],
    );
  }

  try {
    const [[existingEvent]] = await connection.query(
      `SELECT FCAID FROM freight_cost_estimete_slave18 WHERE FCAID = ? LIMIT 1`,
      [fcaId],
    );
    if (existingEvent) {
      await connection.query(
        `UPDATE freight_cost_estimete_slave18
         SET EUETSADDTOF = ?, FUELEUADDTOF = ?,
             HSFO = ?, ETSFUELHSFO = ?, VLSFOMT = ?, FUELVLSFO = ?,
             LSMGO = ?, EUETSLSMGO = ?, BROKTTLCOSTUSD = ?,
             EEOI = ?, CIIGCO = ?, EEOICO = ?, CO2MT = ?, CO2COST = ?,
             EUACO2MT = ?, EUACO2USD = ?,
             HSFOGHGIN = ?, TARGET2025 = ?, VLSFOGHGIN = ?, TARGET2025VLSFO = ?,
             LSMGOGHGIN = ?, TARGET2025LGMGO = ?,
             HSFOPENAL = ?, DOLLARPERMT = ?, VLSFOPENAL = ?, DOLLARPERMTVLSFO = ?,
             LSMGOPENAL = ?, DOLLARPERMTLSMGO = ?
         WHERE FCAID = ?`,
        [
          payload.euEtsAddToFreight ? 1 : 0,
          payload.fuelEuAddToFreight ? 1 : 0,
          numOrNull(payload.hsfoMt),
          numOrNull(payload.etsHsfoMt),
          numOrNull(payload.vlsfoMt),
          numOrNull(payload.etsVlsfoMt),
          numOrNull(payload.lsmgoMt),
          numOrNull(payload.etsLsmgoMt),
          numOrNull(payload.bunkerResultsCost || payload.totalBunkerCost),
          numOrNull(payload.eeoi),
          numOrNull(payload.cii),
          numOrNull(payload.eeoiCo2),
          numOrNull(payload.co2mt),
          numOrNull(payload.co2Cost),
          numOrNull(payload.euaCo2mt),
          numOrNull(payload.euaCo2Usd),
          numOrNull(payload.hsfoIntensity),
          numOrNull(payload.hsfoTarget),
          numOrNull(payload.vlsfoIntensity),
          numOrNull(payload.vlsfoTarget),
          numOrNull(payload.lsmgoIntensity),
          numOrNull(payload.lsmgoTarget),
          numOrNull(payload.hsfoPenalty),
          numOrNull(payload.hsfoPenaltyPerMt),
          numOrNull(payload.vlsfoPenalty),
          numOrNull(payload.vlsfoPenaltyPerMt),
          numOrNull(payload.lsmgoPenalty),
          numOrNull(payload.lsmgoPenaltyPerMt),
          fcaId,
        ],
      );
    } else {
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave18 (
          FCAID, EVENT_DETAILS, EVENT_DATE, EUETSADDTOF, FUELEUADDTOF,
          HSFO, ETSFUELHSFO, VLSFOMT, FUELVLSFO, LSMGO, EUETSLSMGO, BROKTTLCOSTUSD,
          EEOI, CIIGCO, EEOICO, CO2MT, CO2COST, EUACO2MT, EUACO2USD,
          HSFOGHGIN, TARGET2025, VLSFOGHGIN, TARGET2025VLSFO,
          LSMGOGHGIN, TARGET2025LGMGO,
          HSFOPENAL, DOLLARPERMT, VLSFOPENAL, DOLLARPERMTVLSFO,
          LSMGOPENAL, DOLLARPERMTLSMGO
        ) VALUES (?, NULL, '1970-01-01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fcaId,
          payload.euEtsAddToFreight ? 1 : 0,
          payload.fuelEuAddToFreight ? 1 : 0,
          numOrNull(payload.hsfoMt),
          numOrNull(payload.etsHsfoMt),
          numOrNull(payload.vlsfoMt),
          numOrNull(payload.etsVlsfoMt),
          numOrNull(payload.lsmgoMt),
          numOrNull(payload.etsLsmgoMt),
          numOrNull(payload.bunkerResultsCost || payload.totalBunkerCost),
          numOrNull(payload.eeoi),
          numOrNull(payload.cii),
          numOrNull(payload.eeoiCo2),
          numOrNull(payload.co2mt),
          numOrNull(payload.co2Cost),
          numOrNull(payload.euaCo2mt),
          numOrNull(payload.euaCo2Usd),
          numOrNull(payload.hsfoIntensity),
          numOrNull(payload.hsfoTarget),
          numOrNull(payload.vlsfoIntensity),
          numOrNull(payload.vlsfoTarget),
          numOrNull(payload.lsmgoIntensity),
          numOrNull(payload.lsmgoTarget),
          numOrNull(payload.hsfoPenalty),
          numOrNull(payload.hsfoPenaltyPerMt),
          numOrNull(payload.vlsfoPenalty),
          numOrNull(payload.vlsfoPenaltyPerMt),
          numOrNull(payload.lsmgoPenalty),
          numOrNull(payload.lsmgoPenaltyPerMt),
        ],
      );
    }
  } catch {
    // Optional EU ETS / FuelEU columns may be absent on older schemas.
  }
}

export async function dbUpdateEstimateDetail(id, payload, upload = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const fcaId = Number(id);
  const hasNewAttachment = Boolean(upload.attachment);

  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.query(
      `SELECT FCAID, ATTACHMENT, ATTACHMENT_NAME
       FROM freight_cost_estimete_master
       WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ?
       LIMIT 1`,
      [fcaId, appContext.moduleId, appContext.companyId],
    );
    if (!existing) {
      await connection.rollback();
      return null;
    }

    let attachment = existing.ATTACHMENT || '';
    let attachmentName = existing.ATTACHMENT_NAME || '';
    if (hasNewAttachment) {
      const prevFiles = String(attachment || '').split(',').map((s) => s.trim()).filter(Boolean);
      const prevNames = String(attachmentName || '').split(',').map((s) => s.trim()).filter(Boolean);
      const nextFiles = String(upload.attachment || '').split(',').map((s) => s.trim()).filter(Boolean);
      const nextNames = String(upload.attachmentName || '').split(',').map((s) => s.trim()).filter(Boolean);
      attachment = [...prevFiles, ...nextFiles].join(',');
      attachmentName = [...prevNames, ...nextNames].join(',');
    }

    await updateMasterEstimateFields(connection, fcaId, payload, {
      attachment,
      attachmentName,
      includeAttachment: hasNewAttachment,
    });
    await deleteEstimateSlaves(connection, fcaId);
    await insertEstimateSlaves(connection, fcaId, payload);

    await connection.commit();
    return { msg: 0, id: String(fcaId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** PHP options.php id=149 checkVoyageno() ? voyage/TC number uniqueness. */
export async function dbCheckVoyageNoExists(voyageNo, { excludeFcaId = null } = {}) {
  const value = String(voyageNo || '').trim();
  if (!value) return false;

  const pool = getPool();
  const params = [value];
  let voyageSql = `SELECT FCAID FROM freight_cost_estimete_master WHERE VOYAGE_NO = ?`;
  if (excludeFcaId != null && excludeFcaId !== '') {
    voyageSql += ' AND FCAID <> ?';
    params.push(Number(excludeFcaId));
  }
  voyageSql += ' LIMIT 1';

  const [voyageRows] = await pool.query(voyageSql, params);
  if (voyageRows.length > 0) return true;

  const [tcRows] = await pool.query(
    `SELECT 1 AS ok FROM chartering_estimate_tc_master WHERE TC_NO = ? LIMIT 1`,
    [value],
  );
  return tcRows.length > 0;
}
