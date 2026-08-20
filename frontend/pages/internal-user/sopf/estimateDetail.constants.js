import { formatDistance, formatIdleDays } from './estimateCalculations.js';

export const FIXTURE_TYPE_OPTIONS = [
  { value: '1', label: 'TCIN-VCOUT' },
  { value: '2', label: 'VCIN-VCOUT' },
  { value: '3', label: 'VCOUT' },
];

/** Format API distance values to 3dp when present. */
function distStr(value) {
  if (value == null || String(value).trim() === '') return '';
  return formatDistance(value) || String(value);
}

/** PHP often stores empty cargo selects as 0 — treat as unset. */
export function normalizeCargoId(value) {
  const id = String(value ?? '').trim();
  if (!id || id === '0') return '';
  return id;
}

/** PHP getCOASpotList() — show COA number row when value is 2. */
export const COA_SPOT_OPTIONS = [
  { value: '1', label: 'SPOT' },
  { value: '2', label: 'COA' },
];

export const ESTIMATE_TYPE_LABELS = {
  1: 'Gas',
  2: 'Tanker',
  3: 'Dry Cargo',
};

export const PASSAGE_TYPE_OPTIONS = [
  { value: '', label: '---Select---' },
  { value: '1', label: 'Ballast' },
  { value: '2', label: 'Laden' },
];

/** PHP getSelectSpeedList: 1=Full, 2=Service Speed, 3=Most Eco Speed. */
export const SPEED_TYPE_OPTIONS = [
  { value: '1', label: 'Full' },
  { value: '2', label: 'Service Speed' },
  { value: '3', label: 'Most Eco Speed' },
];

/** PHP selNSBG — typically VLSFO for non-SECA at-sea. */
export const NSBG_OPTIONS = [
  { value: 'VLSFO', label: 'VLSFO' },
];

/** PHP selSBG — LSMGO / HSFO+scrubber for SECA at-sea. */
export const SBG_OPTIONS = [
  { value: 'LSMGO', label: 'LSMGO' },
  { value: 'HSFO+SCRUBBER', label: 'HSFO+SCRUBBER' },
];

export const LAYTIME_TERM_OPTIONS = [
  { value: '', label: '---Select---' },
  { value: '1', label: 'SHINC' },
  { value: '2', label: 'SSHEX' },
  { value: '3', label: 'FSHEX' },
  { value: '5', label: 'FHINC' },
  { value: '4', label: 'D.A.P.' },
];

export const BUNKER_IDENTIFY_OPTIONS = [
  { value: 'SUPPLY', label: 'Supply' },
  { value: 'CONSUMPTION', label: 'Consumption' },
];

/** PHP bunkerVariousType() — option value is stored; label is UI text (slave19). */
export const BUNKER_ACTIVITY_OPTIONS = [
  { value: 'Cold Wash', label: 'Tank Cleaning (Cold Wash)' },
  { value: 'Hot Wash', label: 'Tank Cleaning (Hot Wash)' },
  { value: 'Inert from Gas Free', label: 'Inert from Gas Free' },
  { value: 'Purge/Gas Free', label: 'Purge/Gas Free' },
  { value: 'Heating (Maintain)', label: 'Heating (Maintain)' },
  { value: 'Heating (Raise 3 Deg)', label: 'Heating (Raise 3 Deg)' },
];

/** Activity → various-rate field; order matches PHP addBunkerVariousItems(). */
export const BUNKER_ACTIVITY_SEED_FIELDS = [
  { activity: 'Cold Wash', field: 'coldWash' },
  { activity: 'Hot Wash', field: 'hotWash' },
  { activity: 'Inert from Gas Free', field: 'inertGasFree' },
  { activity: 'Purge/Gas Free', field: 'purgeGasFree' },
  { activity: 'Heating (Maintain)', field: 'heatingMaintain' },
  { activity: 'Heating (Raise 3 Deg)', field: 'heatingRaise' },
];

export const BUNKER_ACTIVITY_GRADE_OPTIONS = [
  { value: 'VLSFO', label: 'VLSFO' },
  { value: 'LSMGO', label: 'LSMGO' },
  { value: 'HSFO+SCRUBBER', label: 'HSFO+SCRUBBER' },
  { value: 'HSFO', label: 'HSFO' },
];

/** Per-port bunker grade multi-select (PHP selLPBG / selDPBG / selTPBG). */
export const PORT_BUNKER_GRADE_OPTIONS = BUNKER_ACTIVITY_GRADE_OPTIONS;

export const PORT_FUNCTION_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'TP', label: 'Transit Port' },
  { value: 'BP', label: 'Bunkering Port' },
];

/** Map activity → vessel commercial "Bunkers Various" rate field. */
export const BUNKER_ACTIVITY_RATE_FIELD = {
  'Cold Wash': 'coldWash',
  'Hot Wash': 'hotWash',
  'Inert from Gas Free': 'inertGasFree',
  'Purge/Gas Free': 'purgeGasFree',
  'Heating (Maintain)': 'heatingMaintain',
  'Heating (Raise 3 Deg)': 'heatingRaise',
};

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'United States Dollar (USD)' },
  { value: 'EURO', label: 'Euro (EUR)' },
  { value: 'AUD', label: 'Australian dollar (AUD)' },
  { value: 'GBP', label: 'United Kingdom Pound (GBP)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'AED', label: 'Emirati Dirham (AED)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
];

export const SECA_IDENTIFY_OPTIONS = [
  { value: 'SECA', label: 'SECA' },
  { value: 'NON_SECA', label: 'NON SECA' },
];

export const BUNKER_TYPE_OPTIONS = [
  { value: 'FO', label: 'FO' },
  { value: 'DO', label: 'DO' },
];

export function getFixtureTypeLabel(fixtureTypeId) {
  return FIXTURE_TYPE_OPTIONS.find((option) => option.value === String(fixtureTypeId))?.label ?? '';
}

export function formatTodayDmy() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}-${m}-${y}`;
}

function newRowId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** PHP INT_MAX placeholder RANDOMID — treat as missing so rows stay unique in React. */
const PLACEHOLDER_ROW_ID = '2147483647';

function resolveUniqueRowId(rawId, prefix, seen) {
  let id = rawId != null && String(rawId) !== '' ? String(rawId) : '';
  if (!id || id === PLACEHOLDER_ROW_ID || seen.has(id)) {
    id = newRowId(prefix);
  }
  seen.add(id);
  return id;
}

export function createEmptyCargoRow(status = 1) {
  return {
    id: newRowId('cargo'),
    cargoId: '',
    cargoName: '',
    cargoCbm: '',
    cargoMt: '',
    rateUsdMt: '',
    amountUsd: '',
    charterer: '',
    demAmt: '',
    vendorId: '',
    status,
  };
}

/**
 * Keep Port Details Cargo/Qty in sync with the Cargo panel.
 * - Dropdown source of truth = selected Cargo Names.
 * - Removed cargos are cleared from LP/DP (or replaced with the first remaining).
 * - Empty selects are seeded from the first cargo; qty syncs when `syncQty` or selection remaps.
 */
export function seedPortLegsFromFirstCargo(
  portLegs = [],
  cargoRows = [],
  lumpsumQty = '',
  { syncQty = false } = {},
) {
  const selectedIds = [];
  const seen = new Set();
  for (const row of cargoRows || []) {
    const id = normalizeCargoId(row.cargoId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    selectedIds.push(id);
  }

  const firstId = selectedIds[0] || '';
  const first = firstId
    ? (cargoRows || []).find((row) => normalizeCargoId(row.cargoId) === firstId)
    : null;
  const rowQty = first?.cargoMt != null ? String(first.cargoMt).trim() : '';
  const qty = rowQty || String(lumpsumQty || '').trim();
  const isSelected = (raw) => {
    const id = normalizeCargoId(raw);
    return Boolean(id && seen.has(id));
  };

  let changed = false;
  const next = (portLegs || []).map((leg) => {
    const patch = {};
    const lp = normalizeCargoId(leg.lpCargoId);
    const dp = normalizeCargoId(leg.dpCargoId);
    // Treat legacy "0" / missing as empty so we can seed from Cargo panel
    const lpRemoved = Boolean(String(leg.lpCargoId ?? '').trim() && !isSelected(leg.lpCargoId));
    const dpRemoved = Boolean(String(leg.dpCargoId ?? '').trim() && !isSelected(leg.dpCargoId));

    if (lpRemoved) patch.lpCargoId = firstId;
    else if (firstId && !lp) patch.lpCargoId = firstId;
    else if (!lp && String(leg.lpCargoId ?? '').trim()) patch.lpCargoId = '';

    if (dpRemoved) patch.dpCargoId = firstId;
    else if (firstId && !dp) patch.dpCargoId = firstId;
    else if (!dp && String(leg.dpCargoId ?? '').trim()) patch.dpCargoId = '';

    if (!firstId) {
      if (String(leg.lpCargoId ?? '').trim()) patch.lpCargoId = '';
      if (String(leg.dpCargoId ?? '').trim()) patch.dpCargoId = '';
    }

    const shouldSyncQty = syncQty || lpRemoved || dpRemoved;
    if (qty && (shouldSyncQty || !String(leg.loadQty || '').trim())) {
      patch.loadQty = qty;
    }
    if (qty && (shouldSyncQty || !String(leg.dischargeQty || '').trim())) {
      patch.dischargeQty = qty;
    }
    if (!firstId && (shouldSyncQty || lpRemoved || dpRemoved)) {
      if (!String(leg.loadQty || '').trim() || lpRemoved) patch.loadQty = '';
      if (!String(leg.dischargeQty || '').trim() || dpRemoved) patch.dischargeQty = '';
    }

    if (!Object.keys(patch).length) return leg;
    changed = true;
    return { ...leg, ...patch };
  });
  return changed ? next : (portLegs || []);
}

export function createEmptyPortLeg() {
  return {
    id: newRowId('leg'),
    fromPortId: '',
    fromPortName: '',
    toPortId: '',
    toPortName: '',
    passageType: '',
    speedType: '1',
    distance: '',
    seaDays: '',
    seaMargin: '5',
    fromArrival: '',
    fromDeparture: '',
    toArrival: '',
    toDeparture: '',
    // PHP Passage & Ports ROB (freight_cost_estimete_slave1 FROMROB*/TOROB*)
    fromRobFoArrival: '',
    fromRobDoArrival: '',
    fromRobFoDeparture: '',
    fromRobDoDeparture: '',
    toRobFoArrival: '',
    toRobDoArrival: '',
    toRobFoDeparture: '',
    toRobDoDeparture: '',
    loadQty: '',
    dischargeQty: '',
    loadPortCost: '',
    discPortCost: '',
    loadPortRate: '',
    discPortRate: '',
    loadPortTerms: '1',
    discPortTerms: '1',
    loadPortWorkDays: '',
    discPortWorkDays: '',
    loadPortIdleDays: '',
    discPortIdleDays: '',
    transitIdleDays: '',
    portStayDays: '',
    portIdleDays: '',
    secaDistance: '',
    nonSecaDistance: '',
    navMethod: '',
    secaDays: '',
    nonSecaDays: '',
    transitPortCost: '',
    ddcLpEst: '',
    ddcDpEst: '',
    ddcLpReal: '',
    ddcDpReal: '',
    ddcLpNett: '',
    ddcDpNett: '',
    demmDaysLp: '',
    demmRateLp: '',
    demmDaysDp: '',
    demmRateDp: '',
    chkLpSeca: false,
    chkDpSeca: false,
    chkTpSeca: false,
    lpCargoId: '',
    dpCargoId: '',
    lpBunkerGrades: ['VLSFO', 'LSMGO'],
    dpBunkerGrades: ['VLSFO', 'LSMGO'],
    tpBunkerGrades: ['VLSFO', 'LSMGO'],
    bgNonSeca: 'VLSFO',
    bgSeca: 'LSMGO',
    chartererAccountDays: '',
    portFunction: '',
    tpPortVendorId: '',
    lpPortVendorId: '',
    dpPortVendorId: '',
    ddcLpVendorId: '',
    ddcDpVendorId: '',
  };
}

export function createEmptyProfitSharingRow() {
  return {
    id: newRowId('ps'),
    vendorId: '',
    percentage: '',
  };
}

export function createEmptyBrokerRow() {
  return {
    id: newRowId('brk'),
    percent: '',
    amount: '',
    vendorId: '',
    demmPercent: '',
  };
}

export function createEmptyBunkerRow(identify = 'CONSUMPTION') {
  return {
    id: newRowId('bunker'),
    bunkerGradeId: '',
    qty: '',
    price: '',
    cost: '',
    identify,
    vendorId: '',
    portId: '',
    portName: '',
  };
}

export function createEmptyBunkerActivityRow(defaults = {}) {
  return {
    id: newRowId('bact'),
    activity: defaults.activity || 'Cold Wash',
    bunkerGrade: defaults.bunkerGrade || 'VLSFO',
    qty: defaults.qty || '',
    price: defaults.price || '',
    amount: defaults.amount || '',
  };
}

export function createEmptyOrcRow() {
  return {
    id: newRowId('orc'),
    costId: '',
    costName: '',
    amount: '',
    amountMt: '',
    vendorId: '',
    portFlag: '',
  };
}

export function createEmptyOtherIncomeRow() {
  return {
    id: newRowId('oi'),
    description: '',
    amount: '',
    addComm: '',
    netAmount: '',
    vendorId: '',
  };
}

export function createEmptyHireRow() {
  return {
    id: newRowId('hire'),
    hireFrom: '',
    hireTo: '',
    hireDays: '',
    hireRate: '',
    hireAmt: '',
  };
}

export function createEmptySecaBunkerRow(identify = 'SECA', bunkerType = 'FO') {
  return {
    id: newRowId('seca'),
    bunkerGradeId: '',
    qty: '',
    price: '',
    cost: '',
    identify,
    bunkerType,
    calc: true,
    actualQty: '',
  };
}

export function createEmptyFreightQtyRow() {
  return {
    id: newRowId('fq'),
    vendorId: '',
    agreedGrossFreight: '',
    quantity: '',
    grossFreight: '',
    brokeragePercent: '',
    netBrokerage: '',
    netFreight: '',
    netFreightPerMt: '',
    currencyId: '',
    localAgreedFreight: '',
    exchangeRate: '',
    cargoId: '',
  };
}

export function createEmptyTankerWsRow() {
  return {
    id: newRowId('ws'),
    freightSpecs: '',
    customerId: '',
    minCargoQty: '',
    oveCargoQty: '',
    minFlatRate: '',
    oveFlatRate: '',
    minWs: '',
    oveWs: '',
    minDisLeg: '',
    oveDisLeg: '',
    minDistance: '',
    oveDistance: '',
    minAmount: '',
    oveAmount: '',
    totalQty: '',
    totalAmount: '',
    wsFromPortId: '',
    wsFromPortName: '',
    wsToPortId: '',
    wsToPortName: '',
  };
}

export function createEmptyOffHireRow() {
  return {
    id: newRowId('off'),
    reason: '',
    from: '',
    to: '',
    days: '',
    rate: '',
    amount: '',
    bunkers: [{
      id: newRowId('offb'),
      bunkerGradeId: '',
      qty: '',
      price: '',
      amount: '',
      calc: true,
    }],
  };
}

export function createEmptyPassageLocationRow() {
  return {
    id: newRowId('loc'),
    fromLocation: '',
    toLocation: '',
    passageType: '',
    speedType: '1',
    distance: '',
  };
}

export function createEmptyConsumptionRow(identify = 'FO') {
  return {
    id: newRowId('cons'),
    identify,
    bunkerGradeId: '',
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
    otherSecaTk: '',
    otherNonSecaTk: '',
    otherSecaInert: '',
    otherNonSecaInert: '',
    otherSecaGf: '',
    otherNonSecaGf: '',
    otherSecaHeat: '',
    otherNonSecaHeat: '',
    otherSecaHeat1: '',
    otherNonSecaHeat1: '',
  };
}

export const SPEED_DATA_OPTIONS = [
  { value: 'full', label: 'Full Speed' },
  { value: 'service', label: 'Service Speed' },
  { value: 'eco', label: 'Most Eco Speed' },
];

/** PHP FO/DO At Sea column groups — visibility toggled by speedDataType.
 * Short domain labels (S=SECA, NS=non-SECA) to reduce horizontal scroll.
 * Full Speed / Service Speed omit FS/SS prefixes; MES keeps the eco prefix.
 */
export const CONSUMPTION_SPEED_COLUMNS = {
  full: [
    { key: 'balNonSecaFs', label: '(B) NS' },
    { key: 'balSecaFs', label: '(B) S' },
    { key: 'ladNonSecaFs', label: '(L) NS' },
    { key: 'ladSecaFs', label: '(L) S' },
  ],
  service: [
    { key: 'balNonSecaSs', label: '(B) NS' },
    { key: 'balSecaSs', label: '(B) S' },
    { key: 'ladNonSecaSs', label: '(L) NS' },
    { key: 'ladSecaSs', label: '(L) S' },
  ],
  eco: [
    { key: 'balNonSecaMes', label: 'MES (B) NS' },
    { key: 'balSecaMes', label: 'MES (B) S' },
    { key: 'ladNonSecaMes', label: 'MES (L) NS' },
    { key: 'ladSecaMes', label: 'MES (L) S' },
  ],
};

export const CONSUMPTION_PORT_COLUMNS = [
  { key: 'inPortNonSecaWorking', label: 'WKG LP NS' },
  { key: 'inPortSecaWorking', label: 'WKG LP S' },
  { key: 'inPortNonSecaWorkingDp', label: 'WKG DP NS' },
  { key: 'inPortSecaWorkingDp', label: 'WKG DP S' },
  { key: 'inPortNonSecaIdle', label: 'IDLE NS' },
  { key: 'inPortSecaIdle', label: 'IDLE S' },
];

/** PHP FO/DO Consp/day - Others (tank cleaning, inert, gas free, heating). */
export const CONSUMPTION_OTHERS_COLUMNS = [
  { key: 'otherSecaTk', label: 'TK CLN S' },
  { key: 'otherNonSecaTk', label: 'TK CLN NS' },
  { key: 'otherSecaInert', label: 'Inert S' },
  { key: 'otherNonSecaInert', label: 'Inert NS' },
  { key: 'otherSecaGf', label: 'Gas Free S' },
  { key: 'otherNonSecaGf', label: 'Gas Free NS' },
  { key: 'otherSecaHeat', label: 'Heat MNT S' },
  { key: 'otherNonSecaHeat', label: 'Heat MNT NS' },
  { key: 'otherSecaHeat1', label: 'Heat Raise S' },
  { key: 'otherNonSecaHeat1', label: 'Heat Raise NS' },
];

export function createEmptyInvoiceRow() {
  return {
    id: newRowId('inv'),
    invoiceId: '',
  };
}

export function createEmptyDeliveryBunkerRow(identity = 'DEL') {
  return {
    id: newRowId('delb'),
    bunkerGradeId: '',
    qty: '',
    price: '',
    amount: '',
    bunkerDate: '',
    identity,
  };
}

export function createEmptyDisponentRow() {
  return {
    id: newRowId('disp'),
    name: '',
  };
}

export function createEmptyVoyageEventRow() {
  return {
    id: newRowId('evt'),
    details: '',
    eventDate: '',
  };
}

export function createEmptyDetail(estimateType = 2) {
  const type = Number(estimateType) || 2;
  return {
    estimateType: type,
    estimateTypeLabel: ESTIMATE_TYPE_LABELS[type] ?? '',
    portLegs: [],
    cargoRows: [],
    overageCargoRows: [],
    deadfreightCargoRows: [],
    bunkerRows: [],
    orcRows: [],
    otherIncomeRows: [],
    hireRows: [],
    secaBunkerRows: [],
    freightQtyRows: [],
    tankerWsRows: [],
    offHireRows: [],
    passageLocations: [],
    consumptionRows: [],
    invoiceRows: [],
    deliveryBunkerRows: [],
    redeliveryBunkerRows: [],
    disponentRows: [],
    voyageEventRows: [],
    totalDays: '',
    totalDistance: '',
    cargoQuantity: '',
    dailyEarning: '',
    profitLoss: '',
    freightGross: '',
  };
}

export function toFormState(detail = {}) {
  const cargoSeen = new Set();
  const mapCargo = (row) => {
    const rawId = row.cargoId != null ? String(row.cargoId).trim() : '';
    return {
      id: resolveUniqueRowId(row.id, 'cargo', cargoSeen),
      cargoId: rawId && rawId !== '0' ? rawId : '',
      cargoName: row.cargoName ?? '',
      cargoCbm: row.cargoCbm != null ? String(row.cargoCbm) : '',
      cargoMt: row.cargoMt != null ? String(row.cargoMt) : '',
      rateUsdMt: row.rateUsdMt != null ? String(row.rateUsdMt) : '',
      amountUsd: row.amountUsd != null ? String(row.amountUsd) : '',
      charterer: row.charterer ?? '',
      demAmt: row.demAmt != null ? String(row.demAmt) : '',
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
      status: row.status ?? 1,
    };
  };

  const mappedCargoRows = Array.isArray(detail.cargoRows) && detail.cargoRows.length
    ? detail.cargoRows.map(mapCargo)
    : [];

  const masterCargoIds = Array.isArray(detail.cargoIds)
    ? detail.cargoIds.map(String).filter((part) => part && part !== '0')
    : String(detail.cargoId || detail.CARGO_ID || '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && part !== '0');

  // Backfill row cargoId from master CARGO_ID when slave row is missing it.
  mappedCargoRows.forEach((row, index) => {
    if (!row.cargoId) {
      const fallback = masterCargoIds[index] || '';
      if (fallback) row.cargoId = fallback;
    }
  });

  // PHP selCName is driven by master.CARGO_ID — ensure every saved id becomes a selected row.
  let cargoRows;
  if (masterCargoIds.length) {
    cargoRows = masterCargoIds.map((cargoId, index) => {
      const existing = mappedCargoRows.find((row) => String(row.cargoId) === String(cargoId))
        || mappedCargoRows[index];
      if (existing) {
        return {
          ...existing,
          cargoId: String(cargoId),
          cargoName: existing.cargoName || '',
          status: existing.status ?? 1,
        };
      }
      return {
        ...createEmptyCargoRow(1),
        cargoId: String(cargoId),
      };
    });
    // Keep any extra slave rows that already have a cargoId not listed on master.
    for (const row of mappedCargoRows) {
      if (!row.cargoId) continue;
      if (masterCargoIds.some((id) => String(id) === String(row.cargoId))) continue;
      cargoRows.push(row);
    }
  } else if (mappedCargoRows.length) {
    cargoRows = mappedCargoRows;
  } else {
    cargoRows = [createEmptyCargoRow(1)];
  }

  const overageCargoRows = Array.isArray(detail.overageCargoRows) && detail.overageCargoRows.length
    ? detail.overageCargoRows.map(mapCargo)
    : [createEmptyCargoRow(2)];

  const deadfreightCargoRows = Array.isArray(detail.deadfreightCargoRows) && detail.deadfreightCargoRows.length
    ? detail.deadfreightCargoRows.map(mapCargo)
    : [createEmptyCargoRow(3)];

  const legSeen = new Set();
  const mappedPortLegs = Array.isArray(detail.portLegs) && detail.portLegs.length
    ? detail.portLegs.map((row) => ({
      id: resolveUniqueRowId(row.id, 'leg', legSeen),
      fromPortId: row.fromPortId != null ? String(row.fromPortId) : '',
      fromPortName: row.fromPortName ?? '',
      toPortId: row.toPortId != null ? String(row.toPortId) : '',
      toPortName: row.toPortName ?? '',
      passageType: row.passageType != null ? String(row.passageType) : '1',
      speedType: row.speedType != null ? String(row.speedType) : '1',
      distance: distStr(row.distance),
      seaDays: row.seaDays != null ? String(row.seaDays) : '',
      seaMargin: row.seaMargin != null ? String(row.seaMargin) : '0',
      fromArrival: row.fromArrival ?? '',
      fromDeparture: row.fromDeparture ?? '',
      toArrival: row.toArrival ?? '',
      toDeparture: row.toDeparture ?? '',
      fromRobFoArrival: row.fromRobFoArrival != null ? String(row.fromRobFoArrival) : '',
      fromRobDoArrival: row.fromRobDoArrival != null ? String(row.fromRobDoArrival) : '',
      fromRobFoDeparture: row.fromRobFoDeparture != null ? String(row.fromRobFoDeparture) : '',
      fromRobDoDeparture: row.fromRobDoDeparture != null ? String(row.fromRobDoDeparture) : '',
      toRobFoArrival: row.toRobFoArrival != null ? String(row.toRobFoArrival) : '',
      toRobDoArrival: row.toRobDoArrival != null ? String(row.toRobDoArrival) : '',
      toRobFoDeparture: row.toRobFoDeparture != null ? String(row.toRobFoDeparture) : '',
      toRobDoDeparture: row.toRobDoDeparture != null ? String(row.toRobDoDeparture) : '',
      loadQty: row.loadQty != null ? String(row.loadQty) : '',
      dischargeQty: row.dischargeQty != null ? String(row.dischargeQty) : '',
      loadPortCost: row.loadPortCost != null ? String(row.loadPortCost) : '',
      discPortCost: row.discPortCost != null ? String(row.discPortCost) : '',
      loadPortRate: row.loadPortRate != null ? String(row.loadPortRate) : '',
      discPortRate: row.discPortRate != null ? String(row.discPortRate) : '',
      loadPortTerms: row.loadPortTerms != null ? String(row.loadPortTerms) : '1',
      discPortTerms: row.discPortTerms != null ? String(row.discPortTerms) : '1',
      loadPortWorkDays: row.loadPortWorkDays != null ? String(row.loadPortWorkDays) : '',
      discPortWorkDays: row.discPortWorkDays != null ? String(row.discPortWorkDays) : '',
      loadPortIdleDays: formatIdleDays(row.loadPortIdleDays),
      discPortIdleDays: formatIdleDays(row.discPortIdleDays),
      transitIdleDays: formatIdleDays(row.transitIdleDays),
      portStayDays: row.portStayDays != null ? String(row.portStayDays) : '',
      portIdleDays: formatIdleDays(row.portIdleDays),
      secaDistance: distStr(row.secaDistance),
      nonSecaDistance: distStr(row.nonSecaDistance),
      navMethod: row.navMethod != null ? String(row.navMethod) : '',
      secaDays: row.secaDays != null ? String(row.secaDays) : '',
      nonSecaDays: row.nonSecaDays != null ? String(row.nonSecaDays) : '',
      transitPortCost: row.transitPortCost != null ? String(row.transitPortCost) : '',
      ddcLpEst: row.ddcLpEst != null ? String(row.ddcLpEst) : '',
      ddcDpEst: row.ddcDpEst != null ? String(row.ddcDpEst) : '',
      ddcLpReal: row.ddcLpReal != null ? String(row.ddcLpReal) : '',
      ddcDpReal: row.ddcDpReal != null ? String(row.ddcDpReal) : '',
      ddcLpNett: row.ddcLpNett != null ? String(row.ddcLpNett) : '',
      ddcDpNett: row.ddcDpNett != null ? String(row.ddcDpNett) : '',
      demmDaysLp: row.demmDaysLp != null ? String(row.demmDaysLp) : '',
      demmRateLp: row.demmRateLp != null ? String(row.demmRateLp) : '',
      demmDaysDp: row.demmDaysDp != null ? String(row.demmDaysDp) : '',
      demmRateDp: row.demmRateDp != null ? String(row.demmRateDp) : '',
      chkLpSeca: !!row.chkLpSeca,
      chkDpSeca: !!row.chkDpSeca,
      chkTpSeca: !!row.chkTpSeca,
      lpCargoId: normalizeCargoId(row.lpCargoId),
      dpCargoId: normalizeCargoId(row.dpCargoId),
      lpBunkerGrades: Array.isArray(row.lpBunkerGrades) && row.lpBunkerGrades.length
        ? row.lpBunkerGrades
        : ['VLSFO', 'LSMGO'],
      dpBunkerGrades: Array.isArray(row.dpBunkerGrades) && row.dpBunkerGrades.length
        ? row.dpBunkerGrades
        : ['VLSFO', 'LSMGO'],
      tpBunkerGrades: Array.isArray(row.tpBunkerGrades) && row.tpBunkerGrades.length
        ? row.tpBunkerGrades
        : ['VLSFO', 'LSMGO'],
      bgNonSeca: row.bgNonSeca || 'VLSFO',
      bgSeca: row.bgSeca || 'LSMGO',
      chartererAccountDays: formatIdleDays(row.chartererAccountDays),
      portFunction: row.portFunction != null ? String(row.portFunction) : '',
      tpPortVendorId: row.tpPortVendorId != null ? String(row.tpPortVendorId) : '',
      lpPortVendorId: row.lpPortVendorId != null ? String(row.lpPortVendorId) : '',
      dpPortVendorId: row.dpPortVendorId != null ? String(row.dpPortVendorId) : '',
      ddcLpVendorId: row.ddcLpVendorId != null ? String(row.ddcLpVendorId) : '',
      ddcDpVendorId: row.ddcDpVendorId != null ? String(row.ddcDpVendorId) : '',
    }))
    : [createEmptyPortLeg()];

  // Replace legacy "0" empties and seed LP/DP from Cargo panel selection
  const portLegs = seedPortLegsFromFirstCargo(
    mappedPortLegs,
    cargoRows,
    detail.lumpsumQty,
  );

  const bunkerSeen = new Set();
  const bunkerRows = Array.isArray(detail.bunkerRows) && detail.bunkerRows.length
    ? detail.bunkerRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'bunker', bunkerSeen),
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      cost: row.cost != null ? String(row.cost) : '',
      identify: row.identify || 'CONSUMPTION',
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
      portId: row.portId != null ? String(row.portId) : '',
      portName: row.portName ?? '',
    }))
    : [createEmptyBunkerRow('CONSUMPTION'), createEmptyBunkerRow('SUPPLY')];

  const bactSeen = new Set();
  const bunkerActivityRows = Array.isArray(detail.bunkerActivityRows) && detail.bunkerActivityRows.length
    ? detail.bunkerActivityRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'bact', bactSeen),
      activity: row.activity || 'Cold Wash',
      bunkerGrade: row.bunkerGrade || 'VLSFO',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      amount: row.amount != null ? String(row.amount) : '',
    }))
    : [createEmptyBunkerActivityRow()];

  const orcSeen = new Set();
  const orcRows = Array.isArray(detail.orcRows) && detail.orcRows.length
    ? detail.orcRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'orc', orcSeen),
      costId: row.costId != null ? String(row.costId) : '',
      costName: row.costName ?? '',
      amount: row.amount != null ? String(row.amount) : '',
      amountMt: row.amountMt != null ? String(row.amountMt) : '',
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
      portFlag: row.portFlag != null ? String(row.portFlag) : '',
    }))
    : [createEmptyOrcRow()];

  const oiSeen = new Set();
  const otherIncomeRows = Array.isArray(detail.otherIncomeRows) && detail.otherIncomeRows.length
    ? detail.otherIncomeRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'oi', oiSeen),
      description: row.description ?? '',
      amount: row.amount != null ? String(row.amount) : '',
      addComm: row.addComm != null ? String(row.addComm) : '',
      netAmount: row.netAmount != null ? String(row.netAmount) : '',
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
    }))
    : [createEmptyOtherIncomeRow()];

  const brkSeen = new Set();
  const brokerRows = Array.isArray(detail.brokerRows) && detail.brokerRows.length
    ? detail.brokerRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'brk', brkSeen),
      percent: row.percent != null ? String(row.percent) : '',
      amount: row.amount != null ? String(row.amount) : '',
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
      demmPercent: row.demmPercent != null ? String(row.demmPercent) : '',
    }))
    : (detail.brokeragePercent || detail.brokerageAmt
      ? [{
        id: newRowId('brk'),
        percent: detail.brokeragePercent != null ? String(detail.brokeragePercent) : '',
        amount: detail.brokerageAmt != null ? String(detail.brokerageAmt) : '',
        vendorId: '',
        demmPercent: '',
      }]
      : [createEmptyBrokerRow()]);

  const hireSeen = new Set();
  const hireRows = Array.isArray(detail.hireRows) && detail.hireRows.length
    ? detail.hireRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'hire', hireSeen),
      hireFrom: row.hireFrom ?? '',
      hireTo: row.hireTo ?? '',
      hireDays: row.hireDays != null ? String(row.hireDays) : '',
      hireRate: row.hireRate != null ? String(row.hireRate) : '',
      hireAmt: row.hireAmt != null ? String(row.hireAmt) : '',
    }))
    : [createEmptyHireRow()];

  const secaSeen = new Set();
  const secaBunkerRows = Array.isArray(detail.secaBunkerRows) && detail.secaBunkerRows.length
    ? detail.secaBunkerRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'seca', secaSeen),
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      cost: row.cost != null ? String(row.cost) : '',
      identify: row.identify || 'SECA',
      bunkerType: row.bunkerType || 'FO',
      calc: row.calc !== false,
      actualQty: row.actualQty != null ? String(row.actualQty) : '',
    }))
    : [
      createEmptySecaBunkerRow('SECA', 'FO'),
      createEmptySecaBunkerRow('NON_SECA', 'FO'),
    ];

  const fqSeen = new Set();
  const freightQtyRows = Array.isArray(detail.freightQtyRows) && detail.freightQtyRows.length
    ? detail.freightQtyRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'fq', fqSeen),
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
      agreedGrossFreight: row.agreedGrossFreight != null ? String(row.agreedGrossFreight) : '',
      quantity: row.quantity != null ? String(row.quantity) : '',
      grossFreight: row.grossFreight != null ? String(row.grossFreight) : '',
      brokeragePercent: row.brokeragePercent != null ? String(row.brokeragePercent) : '',
      netBrokerage: row.netBrokerage != null ? String(row.netBrokerage) : '',
      netFreight: row.netFreight != null ? String(row.netFreight) : '',
      netFreightPerMt: row.netFreightPerMt != null ? String(row.netFreightPerMt) : '',
      currencyId: row.currencyId != null ? String(row.currencyId) : '',
      localAgreedFreight: row.localAgreedFreight != null ? String(row.localAgreedFreight) : '',
      exchangeRate: row.exchangeRate != null ? String(row.exchangeRate) : '',
      cargoId: row.cargoId != null ? String(row.cargoId) : '',
    }))
    : [createEmptyFreightQtyRow()];

  const tankWsFrom = detail.tankWsFrom != null ? String(detail.tankWsFrom) : '';
  const tankWsTo = detail.tankWsTo != null ? String(detail.tankWsTo) : '';

  const wsSeen = new Set();
  const tankerWsRows = Array.isArray(detail.tankerWsRows) && detail.tankerWsRows.length
    ? detail.tankerWsRows.map((row, index) => ({
      id: resolveUniqueRowId(row.id, 'ws', wsSeen),
      freightSpecs: row.freightSpecs ?? '',
      customerId: row.customerId != null ? String(row.customerId) : '',
      minCargoQty: row.minCargoQty != null ? String(row.minCargoQty) : '',
      oveCargoQty: row.oveCargoQty != null ? String(row.oveCargoQty) : '',
      minFlatRate: row.minFlatRate != null ? String(row.minFlatRate) : '',
      oveFlatRate: row.oveFlatRate != null ? String(row.oveFlatRate) : '',
      minWs: row.minWs != null ? String(row.minWs) : '',
      oveWs: row.oveWs != null ? String(row.oveWs) : '',
      minDisLeg: row.minDisLeg != null ? String(row.minDisLeg) : '',
      oveDisLeg: row.oveDisLeg != null ? String(row.oveDisLeg) : '',
      minDistance: row.minDistance != null ? String(row.minDistance) : '',
      oveDistance: row.oveDistance != null ? String(row.oveDistance) : '',
      minAmount: row.minAmount != null ? String(row.minAmount) : '',
      oveAmount: row.oveAmount != null ? String(row.oveAmount) : '',
      totalQty: row.totalQty != null ? String(row.totalQty) : '',
      totalAmount: row.totalAmount != null ? String(row.totalAmount) : '',
      wsFromPortId: row.wsFromPortId != null
        ? String(row.wsFromPortId)
        : (index === 0 ? tankWsFrom : ''),
      wsFromPortName: row.wsFromPortName ?? '',
      wsToPortId: row.wsToPortId != null
        ? String(row.wsToPortId)
        : (index === 0 ? tankWsTo : ''),
      wsToPortName: row.wsToPortName ?? '',
    }))
    : [createEmptyTankerWsRow()];

  const offSeen = new Set();
  const offbSeen = new Set();
  const offHireRows = Array.isArray(detail.offHireRows) && detail.offHireRows.length
    ? detail.offHireRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'off', offSeen),
      reason: row.reason ?? '',
      from: row.from ?? '',
      to: row.to ?? '',
      days: row.days != null ? String(row.days) : '',
      rate: row.rate != null ? String(row.rate) : '',
      amount: row.amount != null ? String(row.amount) : '',
      bunkers: Array.isArray(row.bunkers) && row.bunkers.length
        ? row.bunkers.map((b) => ({
          id: resolveUniqueRowId(b.id, 'offb', offbSeen),
          bunkerGradeId: b.bunkerGradeId != null ? String(b.bunkerGradeId) : '',
          qty: b.qty != null ? String(b.qty) : '',
          price: b.price != null ? String(b.price) : '',
          amount: b.amount != null ? String(b.amount) : '',
          calc: b.calc !== false,
        }))
        : [{
          id: resolveUniqueRowId(null, 'offb', offbSeen),
          bunkerGradeId: '',
          qty: '',
          price: '',
          amount: '',
          calc: true,
        }],
    }))
    : [createEmptyOffHireRow()];

  const locSeen = new Set();
  const passageLocations = Array.isArray(detail.passageLocations) && detail.passageLocations.length
    ? detail.passageLocations.map((row) => ({
      id: resolveUniqueRowId(row.id, 'loc', locSeen),
      fromLocation: row.fromLocation ?? '',
      toLocation: row.toLocation ?? '',
      passageType: row.passageType != null ? String(row.passageType) : '1',
      speedType: row.speedType != null ? String(row.speedType) : '1',
      distance: distStr(row.distance),
    }))
    : [createEmptyPassageLocationRow()];

  const consSeen = new Set();
  const consumptionRows = Array.isArray(detail.consumptionRows) && detail.consumptionRows.length
    ? detail.consumptionRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'cons', consSeen),
      identify: row.identify || 'FO',
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      balSecaFs: row.balSecaFs != null ? String(row.balSecaFs) : '',
      ladSecaFs: row.ladSecaFs != null ? String(row.ladSecaFs) : '',
      balNonSecaFs: row.balNonSecaFs != null ? String(row.balNonSecaFs) : '',
      ladNonSecaFs: row.ladNonSecaFs != null ? String(row.ladNonSecaFs) : '',
      balSecaSs: row.balSecaSs != null ? String(row.balSecaSs) : '',
      ladSecaSs: row.ladSecaSs != null ? String(row.ladSecaSs) : '',
      balNonSecaSs: row.balNonSecaSs != null ? String(row.balNonSecaSs) : '',
      ladNonSecaSs: row.ladNonSecaSs != null ? String(row.ladNonSecaSs) : '',
      balSecaMes: row.balSecaMes != null ? String(row.balSecaMes) : '',
      ladSecaMes: row.ladSecaMes != null ? String(row.ladSecaMes) : '',
      balNonSecaMes: row.balNonSecaMes != null ? String(row.balNonSecaMes) : '',
      ladNonSecaMes: row.ladNonSecaMes != null ? String(row.ladNonSecaMes) : '',
      inPortSecaWorking: row.inPortSecaWorking != null ? String(row.inPortSecaWorking) : '',
      inPortNonSecaWorking: row.inPortNonSecaWorking != null ? String(row.inPortNonSecaWorking) : '',
      inPortSecaWorkingDp: row.inPortSecaWorkingDp != null ? String(row.inPortSecaWorkingDp) : '',
      inPortNonSecaWorkingDp: row.inPortNonSecaWorkingDp != null ? String(row.inPortNonSecaWorkingDp) : '',
      inPortSecaIdle: row.inPortSecaIdle != null ? String(row.inPortSecaIdle) : '',
      inPortNonSecaIdle: row.inPortNonSecaIdle != null ? String(row.inPortNonSecaIdle) : '',
      otherSecaTk: row.otherSecaTk != null ? String(row.otherSecaTk) : '',
      otherNonSecaTk: row.otherNonSecaTk != null ? String(row.otherNonSecaTk) : '',
      otherSecaInert: row.otherSecaInert != null ? String(row.otherSecaInert) : '',
      otherNonSecaInert: row.otherNonSecaInert != null ? String(row.otherNonSecaInert) : '',
      otherSecaGf: row.otherSecaGf != null ? String(row.otherSecaGf) : '',
      otherNonSecaGf: row.otherNonSecaGf != null ? String(row.otherNonSecaGf) : '',
      otherSecaHeat: row.otherSecaHeat != null ? String(row.otherSecaHeat) : '',
      otherNonSecaHeat: row.otherNonSecaHeat != null ? String(row.otherNonSecaHeat) : '',
      otherSecaHeat1: row.otherSecaHeat1 != null ? String(row.otherSecaHeat1) : '',
      otherNonSecaHeat1: row.otherNonSecaHeat1 != null ? String(row.otherNonSecaHeat1) : '',
    }))
    : [createEmptyConsumptionRow('FO'), createEmptyConsumptionRow('DO')];

  const invSeen = new Set();
  const invoiceRows = Array.isArray(detail.invoiceRows) && detail.invoiceRows.length
    ? detail.invoiceRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'inv', invSeen),
      invoiceId: row.invoiceId != null ? String(row.invoiceId) : '',
    }))
    : [createEmptyInvoiceRow()];

  const delSeen = new Set();
  const deliveryBunkerRows = Array.isArray(detail.deliveryBunkerRows) && detail.deliveryBunkerRows.length
    ? detail.deliveryBunkerRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'delb', delSeen),
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      amount: row.amount != null ? String(row.amount) : '',
      bunkerDate: row.bunkerDate ?? '',
      identity: row.identity || 'DEL',
    }))
    : [createEmptyDeliveryBunkerRow('DEL')];

  const redelSeen = new Set();
  const redeliveryBunkerRows = Array.isArray(detail.redeliveryBunkerRows) && detail.redeliveryBunkerRows.length
    ? detail.redeliveryBunkerRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'delb', redelSeen),
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      amount: row.amount != null ? String(row.amount) : '',
      bunkerDate: row.bunkerDate ?? '',
      identity: row.identity || 'REDEL',
    }))
    : [createEmptyDeliveryBunkerRow('REDEL')];

  const dispSeen = new Set();
  const disponentRows = Array.isArray(detail.disponentRows) && detail.disponentRows.length
    ? detail.disponentRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'disp', dispSeen),
      name: row.name ?? '',
    }))
    : detail.disponentOwner
      ? [{ id: resolveUniqueRowId(null, 'disp', dispSeen), name: detail.disponentOwner }]
      : [createEmptyDisponentRow()];

  const evtSeen = new Set();
  const voyageEventRows = Array.isArray(detail.voyageEventRows) && detail.voyageEventRows.length
    ? detail.voyageEventRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'evt', evtSeen),
      details: row.details ?? '',
      eventDate: row.eventDate ?? '',
    }))
    : [createEmptyVoyageEventRow()];

  const psSeen = new Set();
  const profitSharingRows = Array.isArray(detail.profitSharingRows) && detail.profitSharingRows.length
    ? detail.profitSharingRows.map((row) => ({
      id: resolveUniqueRowId(row.id, 'ps', psSeen),
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
      percentage: row.percentage != null ? String(row.percentage) : '',
    }))
    : [createEmptyProfitSharingRow()];

  return {
    estimateType: Number(detail.estimateType) || 2,
    periodId: detail.periodId != null ? String(detail.periodId) : '',
    fixtureTypeId: (() => {
      const raw = detail.fixtureTypeId;
      if (raw == null || String(raw).trim() === '' || String(raw).trim() === '0') return '';
      return String(raw).trim();
    })(),
    vesselImoId: detail.vesselImoId ? String(detail.vesselImoId) : '',
    vesselName: detail.vesselName ?? '',
    vesselType: detail.vesselType ?? '',
    flag: detail.flag ?? '',
    transDate: detail.transDate || detail.cpDate || formatTodayDmy(),
    // CP Date field prefers charter-party date
    cpDate: detail.cpDate || detail.transDate || (!detail.id ? formatTodayDmy() : ''),
    voyageNo: detail.voyageNo ?? '',
    comid: detail.comid != null ? String(detail.comid) : '',
    voyageName: detail.voyageName ?? '',
    dwtSummer: detail.dwtSummer != null ? String(detail.dwtSummer) : '',
    dwtTropical: detail.dwtTropical != null ? String(detail.dwtTropical) : '',
    gnrt: detail.gnrt != null ? String(detail.gnrt) : '',
    nrt: detail.nrt != null ? String(detail.nrt) : '',
    loa: detail.loa != null ? String(detail.loa) : '',
    tpc: detail.tpc != null ? String(detail.tpc) : '',
    scnt: detail.scnt != null ? String(detail.scnt) : '',
    tankWsFrom,
    tankWsTo,
    gear: detail.gear != null ? String(detail.gear) : '',
    builtYear: detail.builtYear != null ? String(detail.builtYear) : '',
    beam: detail.beam != null ? String(detail.beam) : '',
    loadable: detail.loadable != null ? String(detail.loadable) : '',
    stowageFactor: detail.stowageFactor != null ? String(detail.stowageFactor) : '',
    grainCap: detail.grainCap != null ? String(detail.grainCap) : '',
    baleCap: detail.baleCap != null ? String(detail.baleCap) : '',

    bFullSpeed: detail.bFullSpeed != null ? String(detail.bFullSpeed) : '',
    bEcoSpeed1: detail.bEcoSpeed1 != null ? String(detail.bEcoSpeed1) : '',
    bEcoSpeed2: detail.bEcoSpeed2 != null ? String(detail.bEcoSpeed2) : '',
    lFullSpeed: detail.lFullSpeed != null ? String(detail.lFullSpeed) : '',
    lEcoSpeed1: detail.lEcoSpeed1 != null ? String(detail.lEcoSpeed1) : '',
    lEcoSpeed2: detail.lEcoSpeed2 != null ? String(detail.lEcoSpeed2) : '',
    speedDataType: detail.speedDataType || 'full',
    bFoFullSpeed: detail.bFoFullSpeed != null ? String(detail.bFoFullSpeed) : '',
    lFoFullSpeed: detail.lFoFullSpeed != null ? String(detail.lFoFullSpeed) : '',
    bDoFullSpeed: detail.bDoFullSpeed != null ? String(detail.bDoFullSpeed) : '',
    lDoFullSpeed: detail.lDoFullSpeed != null ? String(detail.lDoFullSpeed) : '',
    pIfoFullSpeed: detail.pIfoFullSpeed != null ? String(detail.pIfoFullSpeed) : '',
    pWfoFullSpeed: detail.pWfoFullSpeed != null ? String(detail.pWfoFullSpeed) : '',
    pIdoFullSpeed: detail.pIdoFullSpeed != null ? String(detail.pIdoFullSpeed) : '',
    pWdoFullSpeed: detail.pWdoFullSpeed != null ? String(detail.pWdoFullSpeed) : '',

    cargoRows,
    overageCargoRows,
    deadfreightCargoRows,
    cargoIds: masterCargoIds,
    portLegs,
    bunkerRows,
    bunkerActivityRows,
    orcRows,
    otherIncomeRows,
    hireRows,
    brokerRows,
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
    profitSharingRows,

    notes: detail.notes ?? '',
    openPort: detail.openPort != null ? String(detail.openPort) : '',
    openPortName: detail.openPortName ?? '',
    zoneOpen: detail.zoneOpen != null ? String(detail.zoneOpen) : '',
    fixtureBroker: detail.fixtureBroker != null ? String(detail.fixtureBroker) : '',
    coaSpot: detail.coaSpot != null ? String(detail.coaSpot) : '',
    coaNumber: detail.coaNumber != null ? String(detail.coaNumber) : '',
    coaNumberLabel: detail.coaNumberLabel ?? '',
    coaNumberLift: detail.coaNumberLift != null ? String(detail.coaNumberLift) : '',
    noOfShipment: detail.noOfShipment != null ? String(detail.noOfShipment) : '',
    etaDate: detail.etaDate || (!detail.id ? formatTodayDmy() : ''),
    ownerId: detail.ownerId != null ? String(detail.ownerId) : '',
    disponentOwner: detail.disponentOwner ?? '',
    attachments: detail.attachments ?? [],
    charteringTeam: detail.charteringTeam != null ? String(detail.charteringTeam) : '7',
    charteringPic: detail.charteringPic != null ? String(detail.charteringPic) : '',
    charteringPicName: detail.charteringPicName ?? '',

    lumpsumQty: detail.lumpsumQty != null ? String(detail.lumpsumQty) : '',
    lumpsum: detail.lumpsum != null ? String(detail.lumpsum) : '',
    chkLumpsum: !!detail.chkLumpsum,
    lumpsumVendor: detail.lumpsumVendor != null ? String(detail.lumpsumVendor) : '',
    marketRate: detail.marketRate != null ? String(detail.marketRate) : '',
    tankerFreightRate: detail.tankerFreightRate != null
      ? String(detail.tankerFreightRate)
      : (detail.marketRate != null ? String(detail.marketRate) : ''),
    tankType: detail.tankType != null ? String(detail.tankType) : '1',
    freightGross: detail.freightGross != null ? String(detail.freightGross) : '',
    brokeragePercent: detail.brokeragePercent != null ? String(detail.brokeragePercent) : '',
    brokerageAmt: detail.brokerageAmt != null ? String(detail.brokerageAmt) : '',
    hireRate: (() => {
      if (detail.hireRate != null && String(detail.hireRate).trim() !== '') {
        return String(detail.hireRate);
      }
      const fromRow = hireRows[0]?.hireRate;
      if (fromRow != null && String(fromRow).trim() !== '') return String(fromRow);
      if (detail.dailyVesselOperationExp != null && String(detail.dailyVesselOperationExp).trim() !== '') {
        return String(detail.dailyVesselOperationExp);
      }
      return '';
    })(),
    hireAmt: detail.hireAmt != null ? String(detail.hireAmt) : '',
    netHireage: detail.netHireage != null ? String(detail.netHireage) : '',
    cvePerMonth: detail.cvePerMonth != null ? String(detail.cvePerMonth) : '',
    cveAmt: detail.cveAmt != null ? String(detail.cveAmt) : '',
    offHireCve: detail.offHireCve != null ? String(detail.offHireCve) : '',
    offHireCveAmt: detail.offHireCveAmt != null ? String(detail.offHireCveAmt) : '',
    lessOffHire: detail.lessOffHire != null ? String(detail.lessOffHire) : '',
    ballastBonus: detail.ballastBonus != null ? String(detail.ballastBonus) : '',
    hireagePercent: detail.hireagePercent != null ? String(detail.hireagePercent) : '',
    hireageBroPercent: detail.hireageBroPercent != null ? String(detail.hireageBroPercent) : '',
    addCommPercent: detail.addCommPercent != null ? String(detail.addCommPercent) : '',
    addressCommAmt: detail.addressCommAmt != null ? String(detail.addressCommAmt) : '',
    gasBaltic: detail.gasBaltic != null ? String(detail.gasBaltic) : '',
    gasBaseRate: detail.gasBaseRate != null ? String(detail.gasBaseRate) : '',
    gasMarket: detail.gasMarket != null && String(detail.gasMarket) !== '0'
      ? String(detail.gasMarket)
      : '1',
    gasLumsum: detail.gasLumsum != null
      ? String(detail.gasLumsum)
      : (detail.lumpsum != null && Number(detail.estimateType) === 1 ? String(detail.lumpsum) : ''),
    dryMarket: detail.dryMarket != null && String(detail.dryMarket) !== '0'
      ? String(detail.dryMarket)
      : '1',
    dfQty: detail.dfQty != null ? String(detail.dfQty) : '',
    addnlPremium: detail.addnlPremium != null ? String(detail.addnlPremium) : '',
    co2Price: detail.co2Price != null ? String(detail.co2Price) : '',
    euaPrice: detail.euaPrice != null ? String(detail.euaPrice) : '',
    sdrToUsd: detail.sdrToUsd != null ? String(detail.sdrToUsd) : '',
    // Do not seed from dailyVesselOperationExp (PHP Daily Hire) — that inflated OpEx.
    vesselDailyOps: detail.vesselDailyOps != null ? String(detail.vesselDailyOps) : '',
    dailyVesselOperationExp: detail.dailyVesselOperationExp != null
      ? String(detail.dailyVesselOperationExp)
      : '',
    chkHire: !!detail.chkHire,
    chkIndex: !!detail.chkIndex,
    balticIndex: detail.balticIndex != null ? String(detail.balticIndex) : '',
    balticPercent: detail.balticPercent != null && String(detail.balticPercent).trim() !== ''
      ? String(detail.balticPercent)
      : '100',
    balticRate: detail.balticRate != null ? String(detail.balticRate) : '',
    totalHireRate: detail.totalHireRate != null ? String(detail.totalHireRate) : '',
    cveVendorId: detail.cveVendorId != null ? String(detail.cveVendorId) : '',
    dtcVendorId: detail.dtcVendorId != null ? String(detail.dtcVendorId) : '',
    brokerageVendorId: detail.brokerageVendorId != null ? String(detail.brokerageVendorId) : '',
    tcCpDate: detail.tcCpDate ?? '',
    tcDeliveryRange: detail.tcDeliveryRange ?? '',
    tcRedeliveryRange: detail.tcRedeliveryRange ?? '',
    tcDeliveryDate: detail.tcDeliveryDate ?? '',
    tcRedeliveryDate: detail.tcRedeliveryDate ?? '',
    timeAllowed: detail.timeAllowed != null ? String(detail.timeAllowed) : '',
    laycanStart: detail.laycanStart ?? '',
    laycanEnd: detail.laycanEnd ?? '',
    demurrageBrokerPercent: detail.demurrageBrokerPercent != null
      ? String(detail.demurrageBrokerPercent)
      : '',
    euEtsAddToFreight: !!detail.euEtsAddToFreight,
    fuelEuAddToFreight: !!detail.fuelEuAddToFreight,
    baseRateFloat: detail.baseRateFloat != null ? String(detail.baseRateFloat) : '',
    baseRateFixed: detail.baseRateFixed != null ? String(detail.baseRateFixed) : '',
    baseRateAverage: detail.baseRateAverage != null ? String(detail.baseRateAverage) : '',
    grossFreightFloat: detail.grossFreightFloat != null ? String(detail.grossFreightFloat) : '',
    grossFreightFixed: detail.grossFreightFixed != null ? String(detail.grossFreightFixed) : '',
    grossFreightAverage: detail.grossFreightAverage != null ? String(detail.grossFreightAverage) : '',
    netFreightFloat: detail.netFreightFloat != null ? String(detail.netFreightFloat) : '',
    netFreightFixed: detail.netFreightFixed != null ? String(detail.netFreightFixed) : '',
    netFreightAverage: detail.netFreightAverage != null ? String(detail.netFreightAverage) : '',
    tceFloat: detail.tceFloat != null ? String(detail.tceFloat) : '',
    tceFixed: detail.tceFixed != null ? String(detail.tceFixed) : '',
    tceAverage: detail.tceAverage != null ? String(detail.tceAverage) : '',
    totalPortCost: detail.totalPortCost != null ? String(detail.totalPortCost) : '',
    totalBunkerCost: detail.totalBunkerCost != null ? String(detail.totalBunkerCost) : '',
    totalSecaBunkerCost: detail.totalSecaBunkerCost != null ? String(detail.totalSecaBunkerCost) : '',
    totalOrcCost: detail.totalOrcCost != null ? String(detail.totalOrcCost) : '',
    totalOtherIncome: detail.totalOtherIncome != null ? String(detail.totalOtherIncome) : '',
    totalHireAmt: detail.totalHireAmt != null ? String(detail.totalHireAmt) : '',
    totalOffHireAmt: detail.totalOffHireAmt != null ? String(detail.totalOffHireAmt) : '',
    totalFreightQty: detail.totalFreightQty != null ? String(detail.totalFreightQty) : '',
    totalDays: detail.totalDays != null ? String(detail.totalDays) : '',
    totalDistance: distStr(detail.totalDistance),
    cargoQuantity: detail.cargoQuantity != null ? String(detail.cargoQuantity) : '',
    revenue: detail.revenue != null ? String(detail.revenue) : '',
    voyageEarnings: detail.voyageEarnings != null ? String(detail.voyageEarnings) : '',
    dailyEarning: detail.dailyEarning != null ? String(detail.dailyEarning) : '',
    profitLoss: detail.profitLoss != null ? String(detail.profitLoss) : '',
    // PHP slave18 bunker / compliance (seed before recalc)
    hsfoMt: detail.hsfoMt != null ? String(detail.hsfoMt) : '',
    etsHsfoMt: detail.etsHsfoMt != null ? String(detail.etsHsfoMt) : '',
    vlsfoMt: detail.vlsfoMt != null ? String(detail.vlsfoMt) : '',
    etsVlsfoMt: detail.etsVlsfoMt != null ? String(detail.etsVlsfoMt) : '',
    lsmgoMt: detail.lsmgoMt != null ? String(detail.lsmgoMt) : '',
    etsLsmgoMt: detail.etsLsmgoMt != null ? String(detail.etsLsmgoMt) : '',
    bunkerResultsCost: detail.bunkerResultsCost != null ? String(detail.bunkerResultsCost) : '',
    eeoi: detail.eeoi != null ? String(detail.eeoi) : '',
    cii: detail.cii != null ? String(detail.cii) : '',
    eeoiCo2: detail.eeoiCo2 != null ? String(detail.eeoiCo2) : '',
    co2mt: detail.co2mt != null ? String(detail.co2mt) : '',
    co2Cost: detail.co2Cost != null ? String(detail.co2Cost) : '',
    euaCo2mt: detail.euaCo2mt != null ? String(detail.euaCo2mt) : '',
    euaCo2Usd: detail.euaCo2Usd != null ? String(detail.euaCo2Usd) : '',
    hsfoIntensity: detail.hsfoIntensity != null ? String(detail.hsfoIntensity) : '',
    hsfoTarget: detail.hsfoTarget != null ? String(detail.hsfoTarget) : '',
    vlsfoIntensity: detail.vlsfoIntensity != null ? String(detail.vlsfoIntensity) : '',
    vlsfoTarget: detail.vlsfoTarget != null ? String(detail.vlsfoTarget) : '',
    lsmgoIntensity: detail.lsmgoIntensity != null ? String(detail.lsmgoIntensity) : '',
    lsmgoTarget: detail.lsmgoTarget != null ? String(detail.lsmgoTarget) : '',
    hsfoPenalty: detail.hsfoPenalty != null ? String(detail.hsfoPenalty) : '',
    hsfoPenaltyPerMt: detail.hsfoPenaltyPerMt != null ? String(detail.hsfoPenaltyPerMt) : '',
    vlsfoPenalty: detail.vlsfoPenalty != null ? String(detail.vlsfoPenalty) : '',
    vlsfoPenaltyPerMt: detail.vlsfoPenaltyPerMt != null ? String(detail.vlsfoPenaltyPerMt) : '',
    lsmgoPenalty: detail.lsmgoPenalty != null ? String(detail.lsmgoPenalty) : '',
    lsmgoPenaltyPerMt: detail.lsmgoPenaltyPerMt != null ? String(detail.lsmgoPenaltyPerMt) : '',
    totalCarbonCost: detail.totalCarbonCost != null ? String(detail.totalCarbonCost) : '',
  };
}

/** Prefill Add Estimate from a source row without persisting until Submit. */
export function toReplicateFormState(detail = {}) {
  const form = toFormState(detail);
  const sheetName = String(form.voyageName || '').trim();
  return {
    ...form,
    voyageNo: '',
    voyageName: sheetName
      ? (sheetName.endsWith('(Copy)') ? sheetName : `${sheetName} (Copy)`)
      : '',
    attachments: [],
    attachmentFiles: [],
  };
}
