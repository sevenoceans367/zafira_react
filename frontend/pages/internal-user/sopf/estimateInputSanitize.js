/**
 * Strip non-numeric characters from estimate decimal inputs.
 * Allows digits and a single decimal point (optional fraction length).
 */
export function sanitizeDecimalInput(value, { maxDecimals = 2 } = {}) {
  let next = String(value ?? '').replace(/[^\d.]/g, '');
  const firstDot = next.indexOf('.');
  if (firstDot !== -1) {
    next = `${next.slice(0, firstDot + 1)}${next.slice(firstDot + 1).replace(/\./g, '')}`;
    if (maxDecimals === 0) {
      next = next.slice(0, firstDot);
    } else if (maxDecimals > 0) {
      const [whole, fraction = ''] = next.split('.');
      next = `${whole}.${fraction.slice(0, maxDecimals)}`;
    }
  }
  return next;
}

/** Row / form keys that accept decimal numbers only. */
export const ESTIMATE_DECIMAL_FIELDS = new Set([
  // commissions / freight
  'percent',
  'brokeragePercent',
  'addCommPercent',
  'addComm',
  'lumpsum',
  'lumpsumQty',
  'marketRate',
  'freightGross',
  'tankerFreightRate',
  // vessel particulars
  'sdrToUsd',
  'dwtSummer',
  'dwtTropical',
  'gnrt',
  'nrt',
  'loa',
  'tpc',
  'beam',
  'loadable',
  'stowageFactor',
  'grainCap',
  'baleCap',
  // speeds / consumption
  'bFullSpeed',
  'lFullSpeed',
  'bEcoSpeed1',
  'lEcoSpeed1',
  'bEcoSpeed2',
  'lEcoSpeed2',
  'balNonSecaFs',
  'balSecaFs',
  'ladNonSecaFs',
  'ladSecaFs',
  'balNonSecaSs',
  'balSecaSs',
  'ladNonSecaSs',
  'ladSecaSs',
  'balNonSecaMes',
  'balSecaMes',
  'ladNonSecaMes',
  'ladSecaMes',
  'inPortNonSecaWorking',
  'inPortSecaWorking',
  'inPortNonSecaWorkingDp',
  'inPortSecaWorkingDp',
  'inPortNonSecaIdle',
  'inPortSecaIdle',
  'otherSecaTk',
  'otherNonSecaTk',
  'otherSecaInert',
  'otherNonSecaInert',
  'otherSecaGf',
  'otherNonSecaGf',
  'otherSecaHeat',
  'otherNonSecaHeat',
  'otherSecaHeat1',
  'otherNonSecaHeat1',
  // ports / legs
  'seaMargin',
  'distance',
  'secaDistance',
  'loadPortCost',
  'loadQty',
  'loadPortRate',
  'loadPortWorkDays',
  'loadPortIdleDays',
  'discPortCost',
  'dischargeQty',
  'discPortRate',
  'discPortWorkDays',
  'discPortIdleDays',
  'transitPortCost',
  'transitIdleDays',
  'chartererAccountDays',
  'demmDaysLp',
  'demmRateLp',
  'ddcLpReal',
  'demmDaysDp',
  'demmRateDp',
  'ddcDpReal',
  // bunkers / income / hire
  'qty',
  'price',
  'amount',
  'timeAllowed',
  'hireRate',
  'hireAmt',
  'hireDays',
  'ballastBonus',
  'vesselDailyOps',
  'cvePerMonth',
  'offHireCve',
  'co2Price',
  'euaPrice',
  'percentage',
  'days',
  'rate',
  'agreedGrossFreight',
  'quantity',
  'localAgreedFreight',
  'exchangeRate',
  // tanker freight
  'cargoCbm',
  'cargoMt',
  'rateUsdMt',
  'minCargoQty',
  'minFlatRate',
  'minWs',
  'oveCargoQty',
  'oveFlatRate',
  'oveWs',
  'minDistance',
  'oveDistance',
  // gas / float fields
  'gasBaltic',
  'gasBaseRate',
  'addnlPremium',
  'baseRateFloat',
  'baseRateFixed',
  'baseRateAverage',
  'grossFreightFloat',
  'grossFreightFixed',
  'grossFreightAverage',
  'netFreightFloat',
  'netFreightFixed',
  'netFreightAverage',
  'tceFloat',
  'tceFixed',
  'tceAverage',
]);

/** Sanitize decimal keys on a row/form patch (leaves other keys unchanged). */
export function sanitizeEstimatePatch(patch, opts) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  let changed = false;
  const next = { ...patch };
  for (const key of Object.keys(next)) {
    if (!ESTIMATE_DECIMAL_FIELDS.has(key)) continue;
    const raw = next[key];
    if (raw == null || typeof raw === 'boolean' || typeof raw === 'number') continue;
    const cleaned = sanitizeDecimalInput(raw, opts);
    if (cleaned !== raw) {
      next[key] = cleaned;
      changed = true;
    } else {
      next[key] = cleaned;
    }
  }
  return changed ? next : next;
}
