/**
 * Single source of truth for SOPF estimate calculations.
 * Port dates / laycan / demurrage schedule logic ported from php/common.js.
 * Voyage roll-ups ported from php/addestimate.php (getVoyageTime / getFinalCalculation).
 */

function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** PHP getVoyageTime uses .toFixed(3) for sea / SECA days. */
function round3(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Port schedule / laycan / demurrage (php/common.js)
// Date format: "dd-mm-yyyy HH:MM"
// ---------------------------------------------------------------------------

/** PHP parseDateTime — parse "dd-mm-yyyy HH:MM" as local wall-clock. */
export function parseDateTime(str) {
  const raw = String(str || '').trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/);
  if (parts.length < 2) return null;
  const date = parts[0].split(/[-/]/);
  const time = parts[1].split(':');
  if (date.length < 3 || time.length < 2) return null;
  const day = parseInt(date[0], 10);
  const month = parseInt(date[1], 10) - 1;
  const year = parseInt(date[2], 10);
  const hour = parseInt(time[0], 10);
  const minute = parseInt(time[1], 10);
  if (![day, month, year, hour, minute].every((n) => Number.isFinite(n))) return null;
  const dt = new Date(year, month, day, hour, minute);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Format Date → "dd-mm-yyyy HH:MM". */
export function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

/** PHP addDecimalDays — add fractional days to "dd-mm-yyyy HH:MM". */
export function addDecimalDays(dateStr, days) {
  const dt = parseDateTime(dateStr);
  if (!dt) return dateStr || '';
  const add = num(days);
  if (!add) return formatDateTime(dt);
  return formatDateTime(new Date(dt.getTime() + add * 24 * 60 * 60 * 1000));
}

/** PHP minusDecimalDays — subtract fractional days (uses minutes for DST safety). */
export function minusDecimalDays(dateStr, days) {
  const dt = parseDateTime(dateStr);
  if (!dt) return dateStr || '';
  const sub = num(days);
  if (!sub) return formatDateTime(dt);
  const next = new Date(dt.getTime());
  next.setMinutes(next.getMinutes() - sub * 24 * 60);
  return formatDateTime(next);
}

/** Difference in days (date2 - date1), fractional. */
export function diffDays(dateStr1, dateStr2) {
  const d1 = parseDateTime(dateStr1);
  const d2 = parseDateTime(dateStr2);
  if (!d1 || !d2) return 0;
  return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * PHP getIdleDaysByLaycan:
 * If Laycan Start > first laden (passageType=2) from-arrival,
 * set that leg's loadPortIdleDays to the positive day difference.
 */
export function applyIdleDaysByLaycan(portLegs, laycanStart) {
  const legs = (portLegs || []).map((leg) => ({ ...leg }));
  if (!laycanStart) return legs;

  const ladenIndex = legs.findIndex((leg) => String(leg.passageType) === '2');
  if (ladenIndex < 0) return legs;

  const arrival = legs[ladenIndex].fromArrival;
  if (!arrival) return legs;

  const d1 = parseDateTime(laycanStart);
  const d2 = parseDateTime(arrival);
  if (!d1 || !d2) return legs;

  if (d1 > d2) {
    const days = (d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
    legs[ladenIndex] = {
      ...legs[ladenIndex],
      loadPortIdleDays: days.toFixed(2),
    };
  } else {
    legs[ladenIndex] = {
      ...legs[ladenIndex],
      loadPortIdleDays: '',
    };
  }
  return legs;
}

/**
 * Cascade one leg's schedule from its fromArrival (PHP calculatePortDates core).
 * PHP currently uses idleDays = 0 when deriving departure from arrival.
 */
function cascadeLegFromArrival(leg) {
  const next = { ...leg };
  const fromArrival = next.fromArrival || '';
  const loadWork = num(next.loadPortWorkDays);
  // PHP hardcodes idleDays = 0 in calculatePortDates departure math
  const fromStay = loadWork;

  if (fromArrival && fromStay) {
    next.fromDeparture = addDecimalDays(fromArrival, fromStay);
  } else {
    next.fromDeparture = fromArrival;
  }

  const seaDays = num(next.seaDays);
  if (next.fromDeparture && seaDays) {
    next.toArrival = addDecimalDays(next.fromDeparture, seaDays);
  } else {
    next.toArrival = next.fromDeparture || '';
  }

  const discQty = num(next.dischargeQty);
  const passageType = String(next.passageType || '1');
  let toStay = 0;
  if (passageType === '1' || discQty === 0) {
    toStay = num(next.transitIdleDays);
  } else {
    toStay = num(next.discPortWorkDays);
  }

  if (next.toArrival && toStay) {
    next.toDeparture = addDecimalDays(next.toArrival, toStay);
  } else {
    next.toDeparture = next.toArrival || '';
  }

  return next;
}

/**
 * PHP calculatePortDates — cascade dates forward from startIndex.
 * @param {object[]} portLegs
 * @param {{ startIndex?: number }} options
 */
export function applyPortDateCascade(portLegs, options = {}) {
  const startIndex = Math.max(0, Number(options.startIndex) || 0);
  const legs = (portLegs || []).map((leg) => ({ ...leg }));
  if (!legs.length) return legs;

  for (let i = startIndex; i < legs.length; i += 1) {
    if (i > 0) {
      legs[i] = {
        ...legs[i],
        fromArrival: legs[i - 1].toDeparture || legs[i].fromArrival || '',
      };
    }
    legs[i] = cascadeLegFromArrival(legs[i]);
  }
  return legs;
}

/** Keep edited fromDeparture; recompute toArrival / toDeparture and cascade later legs. */
export function cascadeFromDeparture(portLegs, legIndex) {
  const legs = (portLegs || []).map((leg) => ({ ...leg }));
  const i = Number(legIndex);
  if (!legs[i]) return legs;

  const leg = { ...legs[i] };
  const seaDays = num(leg.seaDays);
  if (leg.fromDeparture && seaDays) {
    leg.toArrival = addDecimalDays(leg.fromDeparture, seaDays);
  } else {
    leg.toArrival = leg.fromDeparture || '';
  }

  const discQty = num(leg.dischargeQty);
  const passageType = String(leg.passageType || '1');
  let toStay = 0;
  if (passageType === '1' || discQty === 0) {
    toStay = num(leg.transitIdleDays);
  } else {
    toStay = num(leg.discPortWorkDays);
  }
  if (leg.toArrival && toStay) {
    leg.toDeparture = addDecimalDays(leg.toArrival, toStay);
  } else {
    leg.toDeparture = leg.toArrival || '';
  }
  legs[i] = leg;

  return applyPortDateCascade(legs, { startIndex: i + 1 });
}

/** Cascade from toArrival → toDeparture, then later legs. */
export function cascadeFromToArrival(portLegs, legIndex) {
  const legs = (portLegs || []).map((leg) => ({ ...leg }));
  const i = Number(legIndex);
  if (!legs[i]) return legs;

  const leg = { ...legs[i] };
  const discQty = num(leg.dischargeQty);
  const passageType = String(leg.passageType || '1');
  let toStay = 0;
  if (passageType === '1' || discQty === 0) {
    toStay = num(leg.transitIdleDays);
  } else {
    toStay = num(leg.discPortWorkDays);
  }
  if (leg.toArrival && toStay) {
    leg.toDeparture = addDecimalDays(leg.toArrival, toStay);
  } else {
    leg.toDeparture = leg.toArrival || '';
  }
  legs[i] = leg;
  return applyPortDateCascade(legs, { startIndex: i + 1 });
}

/** PHP calculateDemurrageCost — days × rate. */
export function calculateDemurrageCost(days, rate) {
  return round2(num(days) * num(rate));
}

/**
 * PHP putDaysToDemurrageDispatch:
 * Sum (LP working − idle) + (DP CA + working − idle), subtract timeAllowed (hrs → days),
 * put remainder on last DP demm days.
 */
export function applyDemurrageDaysFromLaytime(portLegs, timeAllowedHrs) {
  const legs = (portLegs || []).map((leg) => ({ ...leg }));
  if (!legs.length) return legs;

  let demmDaysTotal = 0;
  for (const leg of legs) {
    demmDaysTotal += num(leg.loadPortWorkDays) - num(leg.loadPortIdleDays);
    demmDaysTotal += num(leg.chartererAccountDays)
      + num(leg.discPortWorkDays)
      - num(leg.discPortIdleDays);
  }

  const timeAllowedDays = Number((num(timeAllowedHrs) / 24).toFixed(2));
  const remaining = Number((demmDaysTotal - timeAllowedDays).toFixed(2));
  const lastIndex = legs.length - 1;
  const est = calculateDemurrageCost(remaining, legs[lastIndex].demmRateDp);

  legs[lastIndex] = {
    ...legs[lastIndex],
    demmDaysDp: remaining ? remaining.toFixed(2) : '0.00',
    ddcDpEst: est ? String(est) : '0.00',
    ddcDpReal: est ? String(est) : '0.00',
  };

  return legs;
}

/**
 * Orchestrate PHP common.js schedule side-effects after sea/laytime days are known.
 *
 * form._portScheduleMode (optional):
 *   - 'fromArrival' (default) — cascade from arrival + work/sea days
 *   - 'fromDeparture' — keep edited departure, cascade toArrival onward
 *   - 'toArrival' — keep edited toArrival, cascade toDeparture onward
 *   - 'toDeparture' — keep edited toDeparture, cascade later legs only
 *   - 'laycanOnly' — idle-by-laycan + demurrage only (no date rewrite)
 */
export function applyPortScheduleCalculations(form) {
  let portLegs = (form.portLegs || []).map((leg) => ({ ...leg }));
  const mode = form._portScheduleMode || 'fromArrival';
  const legId = form._portScheduleLegId;
  const legIndex = legId != null
    ? portLegs.findIndex((leg) => String(leg.id) === String(legId))
    : -1;

  portLegs = applyIdleDaysByLaycan(portLegs, form.laycanStart);

  if (mode !== 'laycanOnly') {
    if (mode === 'fromDeparture' && legIndex >= 0) {
      portLegs = cascadeFromDeparture(portLegs, legIndex);
    } else if (mode === 'toArrival' && legIndex >= 0) {
      portLegs = cascadeFromToArrival(portLegs, legIndex);
    } else if (mode === 'toDeparture' && legIndex >= 0) {
      portLegs = applyPortDateCascade(portLegs, { startIndex: legIndex + 1 });
    } else {
      const startIndex = legIndex >= 0 && mode === 'fromArrival'
        ? legIndex
        : portLegs.findIndex((leg) => leg.fromArrival);
      if (startIndex >= 0) {
        portLegs = applyPortDateCascade(portLegs, { startIndex });
      }
    }
  }

  portLegs = applyDemurrageDaysFromLaytime(portLegs, form.timeAllowed);

  return {
    ...form,
    portLegs,
    _portScheduleMode: undefined,
    _portScheduleLegId: undefined,
  };
}

/** Sea days from distance (nm), speed (kn), optional weather margin %. */
export function calcSeaDays(distance, speed, marginPercent = 0) {
  const d = num(distance);
  const s = num(speed);
  if (!d || !s) return 0;
  const base = d / (s * 24);
  const margin = num(marginPercent);
  return round3(base + ((base * margin) / 100));
}

/** PHP getVoyageTime: SECA and non-SECA legs calculated separately, then summed. */
export function calcSeaDaysWithSeca(distance, secaDistance, speed, marginPercent = 0) {
  const total = num(distance);
  const s = num(speed);
  if (!total || !s) return 0;
  const seca = Math.min(num(secaDistance), total);
  const nonSeca = Math.max(0, total - seca);
  const margin = num(marginPercent);
  const partDays = (dist) => {
    if (!dist) return 0;
    const base = dist / (s * 24);
    const withMargin = base + ((base * margin) / 100);
    return round3(withMargin);
  };
  return round3(partDays(nonSeca) + partDays(seca));
}

/** PHP getLPTermsList factors for MT/Day laytime. */
export const LAYTIME_TERM_FACTORS = {
  1: 1,
  2: 1.555555,
  3: 1.405,
  4: null,
  5: 1,
  6: 1.272727,
  7: 1.333333,
};

export function calcLaytimeWorkingDays(qty, rateMtDay, termsId) {
  const q = num(qty);
  const r = num(rateMtDay);
  const factor = LAYTIME_TERM_FACTORS[String(termsId)];
  if (factor == null || !q || !r) return 0;
  return round2((q / r) * factor);
}

export function calcDemurrageEst(days, rate) {
  return calculateDemurrageCost(days, rate);
}

export function calcBunkerCost(qty, price) {
  return round2(num(qty) * num(price));
}

export function calcCargoAmount(mt, rate) {
  return round2(num(mt) * num(rate));
}

/** PHP: use NRT if set; else GNRT "gross/nrt" second part; else GNRT × 0.7. */
export function resolveNrtFromGnrt(nrt, gnrt) {
  const explicit = num(nrt);
  if (explicit > 0) return explicit;
  const raw = String(gnrt || '');
  if (raw.includes('/')) {
    const part = num(raw.split('/')[1]);
    if (part > 0) return part;
  }
  const g = num(raw.replace(/,/g, ''));
  if (g > 0) return round2(g * 0.7);
  return 0;
}

export function classifyBunkerGradeName(gradeName) {
  const name = String(gradeName || '').toUpperCase();
  if (name.includes('SCRUBBER') || name.includes('HSFO')) return 'HSFO';
  if (name.includes('LSMGO') || name.includes('MGO')) return 'LSMGO';
  if (name.includes('VLSFO')) return 'VLSFO';
  return '';
}

/**
 * PHP Bunkers summary: qty from consumption MT, price from SECA row (slave2 EST_PRICE).
 * @param {object} form
 * @param {(gradeId: string) => string} resolveGradeName
 */
export function buildBunkerSummaryRows(form, resolveGradeName) {
  const classify = (gradeId) => classifyBunkerGradeName(resolveGradeName(gradeId));

  return ['VLSFO', 'LSMGO', 'HSFO'].map((grade) => {
    const pickPrice = (rows, preferSeca = false) => (rows || []).reduce((acc, row) => {
      const value = num(row.price);
      if (!(value > 0)) return acc;
      const id = String(row.identify || '').toUpperCase();
      if (preferSeca && (id === 'SECA' || id === '1')) return value;
      return acc > 0 ? acc : value;
    }, 0);

    const secaMatches = (form.secaBunkerRows || []).filter(
      (row) => classify(row.bunkerGradeId) === grade,
    );
    const entryMatches = (form.bunkerRows || []).filter((row) => (
      String(row.identify || '').toUpperCase() !== 'SUPPLY'
      && classify(row.bunkerGradeId) === grade
    ));

    const price = pickPrice(secaMatches, true)
      || pickPrice(secaMatches, false)
      || pickPrice(entryMatches, false);

    const qty = num(
      grade === 'HSFO' ? form.hsfoMt : grade === 'LSMGO' ? form.lsmgoMt : form.vlsfoMt,
    );
    const amount = round2(qty * price);
    return {
      grade,
      qty: qty ? qty.toFixed(2) : '',
      price: price ? price.toFixed(2) : '',
      amount: amount ? amount.toFixed(2) : '',
    };
  }).filter((row) => row.qty || row.price || row.amount);
}

/** Demurrage address + broker commission display totals. */
export function calcDemurrageCommissionDisplay(form) {
  const demurrageRevenue = num(form.demurrageRevenue);
  const addCommPercent = num(form.addCommPercent);
  const addressDemmComm = round2((demurrageRevenue * addCommPercent) / 100);
  const brokerDemmCommTotal = (form.brokerRows || []).reduce(
    (sum, row) => sum + num(row.demmPercent),
    0,
  );
  return {
    addressDemmComm,
    brokerDemmCommTotal,
    totalDemmComm: round2(addressDemmComm + brokerDemmCommTotal),
  };
}

/** PHP: 1=Full (txtB/LFullSpeed), 2=Service (EcoSpeed1), 3=Most Eco (EcoSpeed2). */
export function pickPassageSpeedKnots(form, passageType, speedType) {
  const st = String(speedType || '1');
  const laden = String(passageType) === '2';
  if (laden) {
    if (st === '2') return num(form.lEcoSpeed1) || num(form.lFullSpeed) || 11;
    if (st === '3') return num(form.lEcoSpeed2) || num(form.lEcoSpeed1) || num(form.lFullSpeed) || 11;
    return num(form.lFullSpeed) || num(form.lEcoSpeed1) || 12;
  }
  if (st === '2') return num(form.bEcoSpeed1) || num(form.bFullSpeed) || 12;
  if (st === '3') return num(form.bEcoSpeed2) || num(form.bEcoSpeed1) || num(form.bFullSpeed) || 12;
  return num(form.bFullSpeed) || num(form.bEcoSpeed1) || 12;
}

/** PHP euCountries + calculateSeaLegPercentage. */
const EU_COUNTRIES = new Set([
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE',
  'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC',
  'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX',
  'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK',
  'SVN', 'ESP', 'SWE', 'ISL', 'LIE', 'NOR',
]);

export function extractCountryCode(portName) {
  const match = String(portName || '').match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim().toUpperCase() : '';
}

export function calculateSeaLegPercentage(fromCountry, toCountry) {
  const fromEU = EU_COUNTRIES.has(String(fromCountry || '').toUpperCase());
  const toEU = EU_COUNTRIES.has(String(toCountry || '').toUpperCase());
  if (fromEU && toEU) return 1;
  if ((!fromEU && toEU) || (fromEU && !toEU)) return 0.5;
  return 0;
}

export function calculatePortLegPercentage(country) {
  return EU_COUNTRIES.has(String(country || '').toUpperCase()) ? 1 : 0;
}

/**
 * Core voyage roll-up (simplified from PHP getVoyageTime / getFinalCalculation).
 */
export function computeEstimateTotals(form) {
  const portLegs = form.portLegs || [];
  const bunkerRows = form.bunkerRows || [];
  const bunkerActivityRows = form.bunkerActivityRows || [];
  const orcRows = form.orcRows || [];
  const otherIncomeRows = form.otherIncomeRows || [];
  const hireRows = form.hireRows || [];
  const secaBunkerRows = form.secaBunkerRows || [];
  const freightQtyRows = form.freightQtyRows || [];
  const tankerWsRows = form.tankerWsRows || [];
  const offHireRows = form.offHireRows || [];
  const deliveryBunkerRows = form.deliveryBunkerRows || [];
  const redeliveryBunkerRows = form.redeliveryBunkerRows || [];

  const totalDistance = round2(
    portLegs.reduce((sum, leg) => sum + num(leg.distance), 0),
  );

  let seaDays = 0;
  let legsWithDays = portLegs.map((leg) => {
    const speed = pickPassageSpeedKnots(form, leg.passageType, leg.speedType);
    // PHP: empty margin = 0 (not 5)
    const margin = leg.seaMargin != null && leg.seaMargin !== '' ? leg.seaMargin : 0;
    const days = calcSeaDaysWithSeca(leg.distance, leg.secaDistance, speed, margin);
    const secaDays = calcSeaDays(leg.secaDistance, speed, margin);

    const loadWork = String(leg.loadPortTerms) === '4'
      ? num(leg.loadPortWorkDays)
      : (num(leg.loadPortWorkDays)
        || calcLaytimeWorkingDays(leg.loadQty, leg.loadPortRate, leg.loadPortTerms));
    const discWork = String(leg.discPortTerms) === '4'
      ? num(leg.discPortWorkDays)
      : (num(leg.discPortWorkDays)
        || calcLaytimeWorkingDays(leg.dischargeQty, leg.discPortRate, leg.discPortTerms));
    const loadIdle = num(leg.loadPortIdleDays);
    const discIdle = num(leg.discPortIdleDays);
    const transitIdle = num(leg.transitIdleDays);
    const portStayDays = round2(loadWork + discWork + loadIdle + discIdle + transitIdle);
    const portIdleDays = round2(loadIdle + discIdle + transitIdle);
    const ddcLpEst = num(leg.ddcLpEst) || calcDemurrageEst(leg.demmDaysLp, leg.demmRateLp);
    const ddcDpEst = num(leg.ddcDpEst) || calcDemurrageEst(leg.demmDaysDp, leg.demmRateDp);
    const nonSecaDistance = Math.max(0, num(leg.distance) - num(leg.secaDistance));
    const nonSecaDays = Math.max(0, round3(days - secaDays));

    seaDays += days;
    return {
      ...leg,
      seaDays: days ? String(days) : '',
      seaMargin: String(margin),
      loadPortWorkDays: loadWork ? String(loadWork) : (leg.loadPortWorkDays || ''),
      discPortWorkDays: discWork ? String(discWork) : (leg.discPortWorkDays || ''),
      portStayDays: portStayDays ? String(portStayDays) : '',
      portIdleDays: portIdleDays ? String(portIdleDays) : '',
      nonSecaDistance: String(round2(nonSecaDistance)),
      secaDays: secaDays ? String(secaDays) : '',
      nonSecaDays: nonSecaDays ? String(nonSecaDays) : '',
      ddcLpEst: ddcLpEst ? String(ddcLpEst) : (leg.ddcLpEst || ''),
      ddcDpEst: ddcDpEst ? String(ddcDpEst) : (leg.ddcDpEst || ''),
    };
  });

  // PHP common.js: idle-by-laycan → port date cascade → demurrage days
  const scheduled = applyPortScheduleCalculations({
    ...form,
    portLegs: legsWithDays,
  });
  legsWithDays = (scheduled.portLegs || []).map((leg) => {
    const loadIdle = num(leg.loadPortIdleDays);
    const discIdle = num(leg.discPortIdleDays);
    const transitIdle = num(leg.transitIdleDays);
    const loadWork = num(leg.loadPortWorkDays);
    const discWork = num(leg.discPortWorkDays);
    const portStayDays = round2(loadWork + discWork + loadIdle + discIdle + transitIdle);
    const portIdleDays = round2(loadIdle + discIdle + transitIdle);
    return {
      ...leg,
      portStayDays: portStayDays ? String(portStayDays) : '',
      portIdleDays: portIdleDays ? String(portIdleDays) : '',
    };
  });

  const totalPortCost = round2(
    legsWithDays.reduce(
      (sum, leg) => sum + num(leg.loadPortCost) + num(leg.discPortCost) + num(leg.transitPortCost),
      0,
    ),
  );

  const bunkers = bunkerRows.map((row) => {
    const cost = num(row.cost) || calcBunkerCost(row.qty, row.price);
    return { ...row, cost: cost ? String(cost) : row.cost };
  });
  const bunkerActivities = bunkerActivityRows.map((row) => {
    const amount = num(row.amount) || calcBunkerCost(row.qty, row.price);
    return { ...row, amount: amount ? String(amount) : (row.amount || '') };
  });
  const totalBunkerActivityCost = round2(
    bunkerActivities.reduce((sum, row) => sum + num(row.amount), 0),
  );
  const totalBunkerCost = round2(
    bunkers.reduce((sum, row) => sum + num(row.cost), 0) + totalBunkerActivityCost,
  );

  // PHP getBunkerCalculation: always sum SECA + NON-SECA amounts (calc flag only gates price edit / FO-DO mt)
  const secaBunkers = secaBunkerRows.map((row) => {
    const cost = num(row.cost) || calcBunkerCost(row.qty, row.price);
    return { ...row, cost: cost ? String(cost) : row.cost };
  });

  const mapAmount = (rows) => (rows || []).map((row) => {
    const amount = num(row.amountUsd) || calcCargoAmount(row.cargoMt, row.rateUsdMt);
    return { ...row, amountUsd: amount ? String(amount) : row.amountUsd };
  });
  const cargoRows = mapAmount(form.cargoRows);
  const overageCargoRows = mapAmount(form.overageCargoRows);
  const deadfreightCargoRows = mapAmount(form.deadfreightCargoRows);
  const allCargos = [...cargoRows, ...overageCargoRows, ...deadfreightCargoRows];
  const cargoQuantity = round2(allCargos.reduce((sum, row) => sum + num(row.cargoMt), 0));

  const orcs = orcRows.map((row) => {
    const amountMt = cargoQuantity > 0
      ? round2(num(row.amount) / cargoQuantity)
      : num(row.amountMt);
    return {
      ...row,
      amountMt: amountMt ? String(amountMt) : row.amountMt,
    };
  });
  const totalOrcCost = round2(orcs.reduce((sum, row) => sum + num(row.amount), 0));

  const otherIncomes = otherIncomeRows.map((row) => {
    const net = num(row.netAmount) || round2(num(row.amount) - num(row.addComm));
    return { ...row, netAmount: net ? String(net) : row.netAmount };
  });
  const totalOtherIncome = round2(
    otherIncomes.reduce((sum, row) => sum + num(row.netAmount || row.amount), 0),
  );

  const hires = hireRows.map((row) => {
    const amt = num(row.hireAmt) || round2(num(row.hireDays) * num(row.hireRate));
    return { ...row, hireAmt: amt ? String(amt) : row.hireAmt };
  });
  const totalHireFromRows = round2(hires.reduce((sum, row) => sum + num(row.hireAmt), 0));

  const freightQtys = freightQtyRows.map((row) => {
    const quantity = num(row.quantity);
    const agreed = num(row.agreedGrossFreight);
    const grossFreight = num(row.grossFreight) || round2(agreed * quantity);
    const brokeragePercent = num(row.brokeragePercent);
    const netBrokerage = num(row.netBrokerage) || round2((grossFreight * brokeragePercent) / 100);
    const netFreight = num(row.netFreight) || round2(grossFreight - netBrokerage);
    const netFreightPerMt = quantity > 0
      ? (num(row.netFreightPerMt) || round2(netFreight / quantity))
      : num(row.netFreightPerMt);
    return {
      ...row,
      grossFreight: grossFreight ? String(grossFreight) : row.grossFreight,
      netBrokerage: netBrokerage ? String(netBrokerage) : row.netBrokerage,
      netFreight: netFreight ? String(netFreight) : row.netFreight,
      netFreightPerMt: netFreightPerMt ? String(netFreightPerMt) : row.netFreightPerMt,
    };
  });
  const totalFreightQty = round2(
    freightQtys.reduce((sum, row) => sum + num(row.netFreight), 0),
  );

  const tankerWs = tankerWsRows.map((row) => {
    const minAmount = num(row.minAmount) || round2(
      num(row.minCargoQty) * num(row.minFlatRate) * (num(row.minWs) / 100),
    );
    const oveAmount = num(row.oveAmount) || round2(
      num(row.oveCargoQty) * num(row.oveFlatRate) * (num(row.oveWs) / 100),
    );
    const totalQty = num(row.totalQty) || round2(num(row.minCargoQty) + num(row.oveCargoQty));
    const totalAmount = num(row.totalAmount) || round2(minAmount + oveAmount);
    return {
      ...row,
      minAmount: minAmount ? String(minAmount) : row.minAmount,
      oveAmount: oveAmount ? String(oveAmount) : row.oveAmount,
      totalQty: totalQty ? String(totalQty) : row.totalQty,
      totalAmount: totalAmount ? String(totalAmount) : row.totalAmount,
    };
  });
  const totalTankerWs = round2(
    tankerWs.reduce((sum, row) => sum + num(row.totalAmount), 0),
  );

  const offHires = offHireRows.map((row) => {
    const amount = num(row.amount) || round2(num(row.days) * num(row.rate));
    const bunkersMapped = (row.bunkers || []).map((b) => {
      const bunkerAmt = num(b.amount) || calcBunkerCost(b.qty, b.price);
      return { ...b, amount: bunkerAmt ? String(bunkerAmt) : b.amount };
    });
    const bunkerTotal = bunkersMapped.reduce(
      (sum, b) => (b.calc === false ? sum : sum + num(b.amount)),
      0,
    );
    return {
      ...row,
      amount: amount ? String(amount) : row.amount,
      bunkers: bunkersMapped,
      bunkerTotal,
    };
  });
  const totalOffHireAmt = round2(
    offHires.reduce((sum, row) => sum + num(row.amount) + num(row.bunkerTotal), 0),
  );

  const deliveryBunkers = deliveryBunkerRows.map((row) => {
    const amount = num(row.amount) || calcBunkerCost(row.qty, row.price);
    return { ...row, amount: amount ? String(amount) : row.amount };
  });
  const redeliveryBunkers = redeliveryBunkerRows.map((row) => {
    const amount = num(row.amount) || calcBunkerCost(row.qty, row.price);
    return { ...row, amount: amount ? String(amount) : row.amount };
  });

  const freightFromCargo = round2(allCargos.reduce((sum, row) => sum + num(row.amountUsd), 0));
  const isTanker = Number(form.estimateType) === 2;
  const lumpsum = isTanker
    ? (form.chkLumpsum ? num(form.lumpsum) : 0)
    : num(form.lumpsum);
  const cargoQtyTotal = round2(
    allCargos.reduce((sum, row) => sum + num(row.cargoMt), 0)
    || num(form.cargoQuantity),
  );
  // PHP: tankType 1 = Single → lumpsum OR WS (qty×flat×WS/100); tankType 2 = Distributed → cargo MT×rate
  const tankType = String(form.tankType || '1');
  const tankerFreightRate = num(form.tankerFreightRate || form.marketRate);
  const rateTimesQty = tankerFreightRate > 0 && cargoQtyTotal > 0
    ? round2(tankerFreightRate * cargoQtyTotal)
    : 0;
  let freightGross = 0;
  if (tankType === '1') {
    freightGross = round2(
      lumpsum
      || totalTankerWs
      || num(form.freightGross)
      || rateTimesQty
      || freightFromCargo
      || totalFreightQty,
    );
  } else {
    freightGross = round2(
      freightFromCargo
      || totalFreightQty
      || num(form.freightGross)
      || totalTankerWs
      || lumpsum,
    );
  }

  const brokerRows = form.brokerRows || [];
  const brokers = (brokerRows.length
    ? brokerRows
    : [{ percent: form.brokeragePercent, amount: form.brokerageAmt }]
  ).map((row) => {
    const percent = num(row.percent ?? row.brokeragePercent);
    const amount = num(row.amount ?? row.brokerageAmt) || round2((freightGross * percent) / 100);
    return {
      ...row,
      percent: percent ? String(percent) : (row.percent ?? ''),
      amount: amount ? String(amount) : (row.amount ?? ''),
    };
  });
  const brokeragePercent = round2(
    brokers.reduce((sum, row) => sum + num(row.percent), 0),
  ) || num(form.brokeragePercent);
  const brokerageAmt = round2(
    brokers.reduce((sum, row) => sum + num(row.amount), 0)
    || num(form.brokerageAmt)
    || (freightGross * brokeragePercent) / 100,
  );
  const addCommPercent = num(form.addCommPercent);
  const addressCommAmt = round2((freightGross * addCommPercent) / 100);

  const hireRate = num(form.hireRate);
  const portIdleDays = round2(legsWithDays.reduce((sum, leg) => sum + num(leg.portIdleDays), 0));
  const portStayDays = round2(legsWithDays.reduce((sum, leg) => sum + num(leg.portStayDays), 0));
  const hireDays = seaDays + portStayDays || num(form.totalDays);
  const hireAmt = round2(
    totalHireFromRows || num(form.hireAmt) || hireRate * hireDays,
  );

  let ladenDist = 0;
  let ballastDist = 0;
  let ladenDays = 0;
  let ballastDays = 0;
  for (const leg of legsWithDays) {
    const dist = num(leg.distance);
    const days = num(leg.seaDays);
    if (String(leg.passageType) === '2') {
      ladenDist += dist;
      ladenDays += days;
    } else {
      ballastDist += dist;
      ballastDays += days;
    }
  }
  ladenDist = round2(ladenDist);
  ballastDist = round2(ballastDist);
  ladenDays = round2(ladenDays);
  ballastDays = round2(ballastDays);
  const totalSeaDays = round2(ladenDays + ballastDays);
  const totalDays = round2(totalSeaDays + portIdleDays + portStayDays || num(form.totalDays) || 0);

  // PHP: CVE ($) = (CVE/Month × 12 / 365) × total voyage days
  const cvePerMonth = num(form.cvePerMonth);
  const cveAmt = cvePerMonth > 0
    ? round2(((cvePerMonth * 12) / 365) * (totalDays || 0))
    : num(form.cveAmt);
  const ballastBonus = num(form.ballastBonus);

  const demurrageBrokerPercent = num(form.demurrageBrokerPercent)
    || round2(brokeragePercent + addCommPercent);
  const legsWithDemurrage = legsWithDays.map((leg) => {
    const ddcLpEst = num(leg.ddcLpEst) || calcDemurrageEst(leg.demmDaysLp, leg.demmRateLp);
    const ddcDpEst = num(leg.ddcDpEst) || calcDemurrageEst(leg.demmDaysDp, leg.demmRateDp);
    const ddcLpReal = num(leg.ddcLpReal) || ddcLpEst;
    const ddcDpReal = num(leg.ddcDpReal) || ddcDpEst;
    const ddcLpNett = round2(ddcLpReal - (ddcLpReal * demurrageBrokerPercent) / 100);
    const ddcDpNett = round2(ddcDpReal - (ddcDpReal * demurrageBrokerPercent) / 100);
    return {
      ...leg,
      ddcLpEst: ddcLpEst ? String(ddcLpEst) : (leg.ddcLpEst || ''),
      ddcDpEst: ddcDpEst ? String(ddcDpEst) : (leg.ddcDpEst || ''),
      ddcLpReal: ddcLpReal ? String(ddcLpReal) : (leg.ddcLpReal || ''),
      ddcDpReal: ddcDpReal ? String(ddcDpReal) : (leg.ddcDpReal || ''),
      ddcLpNett: ddcLpNett ? String(ddcLpNett) : '',
      ddcDpNett: ddcDpNett ? String(ddcDpNett) : '',
    };
  });

  const demurrageRevenue = round2(
    legsWithDemurrage.reduce((sum, leg) => sum + num(leg.ddcLpReal) + num(leg.ddcDpReal), 0)
    + allCargos.reduce((sum, row) => sum + num(row.demAmt), 0),
  );
  const demurrageBrokerAmt = round2((demurrageRevenue * demurrageBrokerPercent) / 100);
  const demurrageNett = round2(demurrageRevenue - demurrageBrokerAmt);
  const brokersWithDemm = brokers.map((row) => {
    const pct = num(row.percent);
    const demmAmt = round2((demurrageRevenue * pct) / 100);
    return {
      ...row,
      demmPercent: demmAmt ? String(demmAmt) : (row.demmPercent || ''),
    };
  });

  const deliveryTotal = round2(deliveryBunkers.reduce((sum, row) => sum + num(row.amount), 0));
  const redeliveryTotal = round2(redeliveryBunkers.reduce((sum, row) => sum + num(row.amount), 0));
  const netHireage = round2(hireAmt + deliveryTotal + cveAmt - redeliveryTotal - totalOffHireAmt);

  const vesselDailyOps = num(form.vesselDailyOps);
  const vesselDailyOpsAmt = round2(vesselDailyOps * (totalDays || 0));

  const gradeById = {};
  for (const g of (form._bunkerGrades || [])) {
    gradeById[String(g.id)] = g;
  }
  const classify = (gradeIdOrName) => {
    const fromId = gradeById[String(gradeIdOrName)]?.name;
    const name = String(fromId || gradeIdOrName || '').toUpperCase();
    if (name.includes('SCRUBBER')) return 'HSFO+SCRUBBER';
    if (name.includes('HSFO')) return 'HSFO';
    if (name.includes('VLSFO') || name.includes('VLFO')) return 'VLSFO';
    if (name.includes('LSMGO') || name.includes('MGO') || name.includes('MDO')) return 'LSMGO';
    return null;
  };
  const gradeMatches = (legGrade, key, gradeName) => {
    const legKey = classify(legGrade);
    if (legKey && key && legKey === key) return true;
    return String(legGrade || '').toUpperCase() === String(gradeName || '').toUpperCase();
  };
  const pickAtSeaRate = (cons, passageType, speedType, seca) => {
    const laden = String(passageType) === '2';
    const speed = String(speedType || '1');
    const side = laden ? 'lad' : 'bal';
    const zone = seca ? 'Seca' : 'NonSeca';
    const mode = speed === '2' ? 'Ss' : speed === '3' ? 'Mes' : 'Fs';
    return num(cons[`${side}${zone}${mode}`]);
  };
  const isNonSecaIdentify = (identify) => {
    const id = String(identify || '').toUpperCase().replace(/\s+/g, '_');
    return id === 'NON_SECA' || id === 'NONSECA' || id === '2';
  };
  const isSecaIdentify = (identify) => {
    const id = String(identify || '').toUpperCase().replace(/\s+/g, '_');
    return id === 'SECA' || id === '1';
  };

  /**
   * PHP getVoyageTime bunker MT + getEuConsp ETS MT.
   * FO total (NSBG match): nonSecaDays×NS rate + secaDays×S rate
   * DO total (SBG match): secaDays×S rate + (totalDays−secaDays)×NS rate
   * ETS FO VLSFO: nonSecaDays×NS rate × EU% (overwrites SECA FO ETS)
   * ETS DO LSMGO: secaDays × NS DO rate × EU% (NON-SECA DO ETS path is commented out in PHP)
   */
  const computeFromConsumption = () => {
    const rows = (form.consumptionRows || []).filter((r) => r.bunkerGradeId);
    if (!rows.length || !legsWithDemurrage.length) return null;
    const totals = { HSFO: 0, VLSFO: 0, LSMGO: 0, 'HSFO+SCRUBBER': 0 };
    const ets = { HSFO: 0, VLSFO: 0, LSMGO: 0, 'HSFO+SCRUBBER': 0 };
    let any = false;

    for (const cons of rows) {
      const gradeName = gradeById[String(cons.bunkerGradeId)]?.name || '';
      const key = classify(cons.bunkerGradeId);
      if (!key) continue;
      const identify = String(cons.identify || 'FO').toUpperCase();
      let total = 0;
      let etsQty = 0;

      for (const leg of legsWithDemurrage) {
        const seaDays = num(leg.seaDays);
        const secaDays = num(leg.secaDays);
        const nonSecaDays = Math.max(0, seaDays - secaDays);
        const nsGrade = leg.bgNonSeca || 'VLSFO';
        const sGrade = leg.bgSeca || 'LSMGO';
        const secaRate = pickAtSeaRate(cons, leg.passageType, leg.speedType, true);
        const nonSecaRate = pickAtSeaRate(cons, leg.passageType, leg.speedType, false);
        const euPct = calculateSeaLegPercentage(
          extractCountryCode(leg.fromPortName),
          extractCountryCode(leg.toPortName),
        );

        if (identify === 'FO') {
          // PHP NON-SECA FO qty when selNSBG matches bunker name
          if (gradeMatches(nsGrade, key, gradeName)) {
            total += (nonSecaDays * nonSecaRate) + (secaDays * secaRate);
            // getEuConsp NON-SECA FO: nonSecaDays × NS rate × EU%
            etsQty += nonSecaDays * nonSecaRate * euPct;
            any = true;
          }
        } else if (gradeMatches(sGrade, key, gradeName)) {
          // PHP NON-SECA DO qty when selSBG matches
          total += (secaDays * secaRate) + (nonSecaDays * nonSecaRate);
          // getEuConsp SECA DO: secaDays × DO NON-SECA rate × EU%
          etsQty += secaDays * nonSecaRate * euPct;
          any = true;
        }

        // In-port (working / idle) — gated by port bunker grade + SECA checkbox
        const lpOk = (leg.lpBunkerGrades || []).some((g) => gradeMatches(g, key, gradeName));
        const dpOk = (leg.dpBunkerGrades || []).some((g) => gradeMatches(g, key, gradeName));
        const lw = num(leg.loadPortWorkDays);
        const li = num(leg.loadPortIdleDays);
        const dw = num(leg.discPortWorkDays);
        const di = num(leg.discPortIdleDays);
        const lpEu = calculatePortLegPercentage(extractCountryCode(leg.fromPortName));
        const dpEu = calculatePortLegPercentage(extractCountryCode(leg.toPortName));

        if (lpOk) {
          if (leg.chkLpSeca) {
            const w = num(cons.inPortSecaWorking);
            const idle = num(cons.inPortSecaIdle);
            total += lw * w + li * idle;
            etsQty += (lw * w + li * idle) * lpEu;
            any = true;
          } else {
            const w = num(cons.inPortNonSecaWorking);
            const idle = num(cons.inPortNonSecaIdle);
            total += lw * w + li * idle;
            // PHP getEuConsp NON-SECA in-port is included via totalconspfo2 for FO grades
            if (identify === 'FO') etsQty += (lw * w + li * idle) * lpEu;
            any = true;
          }
        }
        if (dpOk) {
          if (leg.chkDpSeca) {
            const w = num(cons.inPortSecaWorkingDp || cons.inPortSecaWorking);
            const idle = num(cons.inPortSecaIdle);
            total += dw * w + di * idle;
            etsQty += (dw * w + di * idle) * dpEu;
            any = true;
          } else {
            const w = num(cons.inPortNonSecaWorkingDp || cons.inPortNonSecaWorking);
            const idle = num(cons.inPortNonSecaIdle);
            total += dw * w + di * idle;
            if (identify === 'FO') etsQty += (dw * w + di * idle) * dpEu;
            any = true;
          }
        }
      }

      totals[key] = (totals[key] || 0) + total;
      ets[key] = (ets[key] || 0) + etsQty;
    }

    if (!any) return null;
    const bunkerMt = { HSFO: 0, VLSFO: 0, LSMGO: 0 };
    const etsMt = { HSFO: 0, VLSFO: 0, LSMGO: 0 };
    // Fold scrubber into HSFO bunker results display (PHP has separate fields for scrubber in some UIs)
    bunkerMt.HSFO = round2((totals.HSFO || 0) + (totals['HSFO+SCRUBBER'] || 0));
    bunkerMt.VLSFO = round2(totals.VLSFO || 0);
    bunkerMt.LSMGO = round2(totals.LSMGO || 0);
    etsMt.HSFO = round2((ets.HSFO || 0) + (ets['HSFO+SCRUBBER'] || 0));
    etsMt.VLSFO = round2(ets.VLSFO || 0);
    etsMt.LSMGO = round2(ets.LSMGO || 0);
    return { bunkerMt: bunkerMt, etsMt, rawTotals: totals };
  };

  const fromConsumption = computeFromConsumption();

  const storedTotals = {
    HSFO: num(form.hsfoMt),
    VLSFO: num(form.vlsfoMt),
    LSMGO: num(form.lsmgoMt),
  };
  const storedEts = {
    HSFO: num(form.etsHsfoMt),
    VLSFO: num(form.etsVlsfoMt),
    LSMGO: num(form.etsLsmgoMt),
  };
  const storedSum = storedTotals.HSFO + storedTotals.VLSFO + storedTotals.LSMGO;
  const storedEtsSum = storedEts.HSFO + storedEts.VLSFO + storedEts.LSMGO;

  const bunkerMt = { HSFO: 0, VLSFO: 0, LSMGO: 0 };
  const etsMt = { HSFO: 0, VLSFO: 0, LSMGO: 0 };
  if (fromConsumption) {
    Object.assign(bunkerMt, fromConsumption.bunkerMt);
    Object.assign(etsMt, fromConsumption.etsMt);
  } else if (storedSum > 0 || storedEtsSum > 0) {
    Object.assign(bunkerMt, storedTotals);
    Object.assign(etsMt, storedEts);
  } else {
    for (const row of bunkers) {
      if (String(row.identify).toUpperCase() === 'SUPPLY') continue;
      const key = classify(row.bunkerGradeId);
      if (key === 'HSFO' || key === 'HSFO+SCRUBBER') bunkerMt.HSFO += num(row.qty);
      else if (key === 'VLSFO') bunkerMt.VLSFO += num(row.qty);
      else if (key === 'LSMGO') bunkerMt.LSMGO += num(row.qty);
    }
    for (const row of secaBunkers) {
      const rawKey = classify(row.bunkerGradeId)
        || (String(row.bunkerType).toUpperCase() === 'DO' ? 'LSMGO' : 'VLSFO');
      const key = rawKey === 'HSFO+SCRUBBER' ? 'HSFO' : rawKey;
      const qty = num(row.qty);
      const id = String(row.identify || '').toUpperCase();
      if (id === 'SECA' || id === '1') {
        etsMt[key] = (etsMt[key] || 0) + qty;
      } else {
        bunkerMt[key] = (bunkerMt[key] || 0) + qty;
      }
    }
    for (const k of Object.keys(bunkerMt)) bunkerMt[k] = round2(bunkerMt[k]);
    for (const k of Object.keys(etsMt)) etsMt[k] = round2(etsMt[k]);
  }

  // PHP stores $/MT on SECA row (txtSECABunkerPrice); NON_SECA row often has empty EST_PRICE
  const priceByGrade = {};
  const rememberPrice = (gradeKey, price, prefer) => {
    if (!gradeKey || !(price > 0)) return;
    const key = gradeKey === 'HSFO+SCRUBBER' ? 'HSFO' : gradeKey;
    if (prefer || !priceByGrade[key]) priceByGrade[key] = price;
  };
  // Capture DB amounts before sync (SECA EST_COST often holds the full $ amount)
  const storedSecaExpense = round2(
    secaBunkers.reduce((sum, row) => sum + num(row.cost), 0),
  );
  for (const row of secaBunkers) {
    const key = classify(row.bunkerGradeId);
    // Prefer SECA-row price — that is the visible Price column in PHP Bunkers table
    rememberPrice(key, num(row.price), isSecaIdentify(row.identify));
  }
  for (const row of bunkers) {
    if (String(row.identify).toUpperCase() === 'SUPPLY') continue;
    rememberPrice(classify(row.bunkerGradeId), num(row.price), false);
  }

  // Sync bunker estimate qty/cost from live consumption (PHP: amount = qty × SECA price)
  let secaBunkersSynced = secaBunkers;
  if (fromConsumption) {
    const mtByKey = {
      HSFO: bunkerMt.HSFO,
      VLSFO: bunkerMt.VLSFO,
      LSMGO: bunkerMt.LSMGO,
      ...(fromConsumption.rawTotals || {}),
    };
    const rowsByKey = {};
    for (const row of secaBunkers) {
      const key = classify(row.bunkerGradeId);
      if (!key) continue;
      if (!rowsByKey[key]) rowsByKey[key] = [];
      rowsByKey[key].push(row);
    }
    secaBunkersSynced = secaBunkers.map((row) => {
      const key = classify(row.bunkerGradeId);
      if (!key) return row;
      const displayKey = key === 'HSFO+SCRUBBER' ? 'HSFO' : key;
      const siblings = rowsByKey[key] || [];
      const hasNonSeca = siblings.some((r) => isNonSecaIdentify(r.identify));
      const siblingPrice = siblings.reduce((p, r) => (num(r.price) > 0 ? num(r.price) : p), 0);
      let qtyVal = 0;
      if (mtByKey[key] != null || mtByKey[displayKey] != null) {
        const mt = mtByKey[key] != null ? mtByKey[key] : mtByKey[displayKey];
        if (hasNonSeca) {
          // PHP: qty lives on NON_SECA; SECA qty field is hidden/0
          qtyVal = isNonSecaIdentify(row.identify) ? mt : 0;
        } else {
          qtyVal = mt;
        }
      }
      const qty = round2(qtyVal);
      const price = num(row.price) || siblingPrice || priceByGrade[displayKey] || 0;
      if (price > 0) rememberPrice(displayKey, price, true);
      const cost = calcBunkerCost(qty, price);
      return {
        ...row,
        qty: String(qty || 0),
        price: price ? String(price) : (row.price || ''),
        cost: cost ? String(cost) : '0',
      };
    });
  }

  // PHP Bunker Expenses = Σ (NONSECA qty × price) with price from Bunkers table
  const expenseFromMtPrices = round2(
    (bunkerMt.HSFO * (priceByGrade.HSFO || 0))
    + (bunkerMt.VLSFO * (priceByGrade.VLSFO || 0))
    + (bunkerMt.LSMGO * (priceByGrade.LSMGO || 0)),
  );
  const totalSecaBunkerCostSynced = round2(
    secaBunkersSynced.reduce((sum, row) => sum + num(row.cost), 0),
  );

  const factors = form._complianceFactors || {};
  const fac = (key) => factors[key] || { co2Fac: 0, penalty: 0, intensity: 0, ghgRate: 0, euaCo2Rate: 0 };
  // PHP Fuel EU penalties use TOTAL bunker MT (txtHsfo / txtVlfoMT / txtLsmgo)
  const hsfoPenal = round2(bunkerMt.HSFO * fac('HSFO').penalty);
  const vlsfoPenal = round2(bunkerMt.VLSFO * fac('VLSFO').penalty);
  const lsmgoPenal = round2(bunkerMt.LSMGO * fac('LSMGO').penalty);

  // PHP Total CO2 uses totals
  const co2mt = round2(
    bunkerMt.HSFO * fac('HSFO').co2Fac
    + bunkerMt.VLSFO * fac('VLSFO').co2Fac
    + bunkerMt.LSMGO * fac('LSMGO').co2Fac,
  );
  const co2Price = num(form.co2Price);
  const co2Cost = round2(co2mt * co2Price);
  // PHP EEOI CO2 / EUA use ETS fields (txtEtsFuelHsfo / txtFuelVlsfo / txtEuEtslsmgo)
  const eeoiCo2 = round2(
    etsMt.HSFO * fac('HSFO').co2Fac
    + etsMt.VLSFO * fac('VLSFO').co2Fac
    + etsMt.LSMGO * fac('LSMGO').co2Fac,
  );
  const euaCo2mtRaw =
    etsMt.HSFO * fac('HSFO').co2Fac * (fac('HSFO').euaCo2Rate / 100)
    + etsMt.VLSFO * fac('VLSFO').co2Fac * (fac('VLSFO').euaCo2Rate / 100)
    + etsMt.LSMGO * fac('LSMGO').co2Fac * (fac('LSMGO').euaCo2Rate / 100);
  // PHP: txtEuaCo2mt shows toFixed(2), but txteuaCo2Usd uses unrounded euaco2 × price
  const euaCo2mt = round2(euaCo2mtRaw);
  const euaPrice = num(form.euaPrice);
  const euaCo2Usd = euaCo2mtRaw > 0 && euaPrice > 0 ? Math.ceil(euaCo2mtRaw * euaPrice) : 0;
  const sailedDist = totalDistance;
  const dwtQty = num(form.dwtSummer);
  let eeoi = 0;
  let cii = 0;
  // PHP EEOI/CII formulas use TOTAL fuel MT (txtHsfo/Vlfo/Lsmgo), gated on ETS > 0
  const hasEts = etsMt.HSFO > 0 || etsMt.VLSFO > 0 || etsMt.LSMGO > 0;
  if (hasEts && co2mt > 0 && cargoQtyTotal > 0 && sailedDist > 0) {
    eeoi = round2((co2mt * 1e6) / (cargoQtyTotal * sailedDist));
  }
  if (hasEts && co2mt > 0 && dwtQty > 0 && sailedDist > 0) {
    cii = round2((co2mt * 1e6) / (dwtQty * sailedDist));
  }

  const totalCarbonCost = round2(euaCo2Usd + hsfoPenal + vlsfoPenal + lsmgoPenal);

  // PHP ops = ORC + brokerage + vessel daily ops + demurrage commission (address comm is NOT in ops)
  let operationalExpenses = round2(
    totalOrcCost + brokerageAmt + vesselDailyOpsAmt + demurrageBrokerAmt,
  );
  if (form.euEtsAddToFreight) operationalExpenses = round2(operationalExpenses + euaCo2Usd);
  if (form.fuelEuAddToFreight) {
    operationalExpenses = round2(operationalExpenses + hsfoPenal + vlsfoPenal + lsmgoPenal);
  }

  // PHP txtTotalBunkerCost = sum of Bunkers table amounts (not supply/activity rows)
  const bunkerExpenseComputed = expenseFromMtPrices > 0
    ? expenseFromMtPrices
    : (totalSecaBunkerCostSynced > 0 ? totalSecaBunkerCostSynced : 0);
  const bunkerExpenseSaved = num(form.bunkerResultsCost) || num(form.totalBunkerCost);
  // Live MT×price → synced row costs → DB EST_COST sum → PHP-saved total
  const bunkerExpenseTotal = bunkerExpenseComputed > 0
    ? bunkerExpenseComputed
    : (storedSecaExpense > 0
      ? storedSecaExpense
      : (bunkerExpenseSaved > 0 ? round2(bunkerExpenseSaved) : 0));
  // PHP: revenue = freight − address commission + other income (lumpsum already in freight when used)
  const revenue = round2(Math.max(0, freightGross - addressCommAmt) + totalOtherIncome);
  const totalExpenses = round2(operationalExpenses + totalPortCost + bunkerExpenseTotal);
  const voyageEarnings = round2(revenue - totalExpenses - cveAmt + demurrageNett);
  const gTotalVoyageEarnings = round2(revenue - totalExpenses - netHireage);
  const daysForTce = totalDays > 0 ? totalDays : 1;
  const nettDailyTce = round2((gTotalVoyageEarnings + demurrageNett) / daysForTce);
  const profitLoss = round2(gTotalVoyageEarnings + demurrageNett);
  const dailyEarning = nettDailyTce;

  return {
    portLegs: legsWithDemurrage,
    brokerRows: brokersWithDemm,
    cargoRows,
    overageCargoRows,
    deadfreightCargoRows,
    bunkerRows: bunkers,
    bunkerActivityRows: bunkerActivities,
    orcRows: orcs,
    otherIncomeRows: otherIncomes,
    hireRows: hires,
    secaBunkerRows: secaBunkersSynced,
    freightQtyRows: freightQtys,
    tankerWsRows: tankerWs,
    offHireRows: offHires.map(({ bunkerTotal, ...row }) => row),
    deliveryBunkerRows: deliveryBunkers,
    redeliveryBunkerRows: redeliveryBunkers,
    totalDistance: String(totalDistance || ''),
    ladenDist: String(ladenDist || ''),
    ballastDist: String(ballastDist || ''),
    ladenDays: String(ladenDays || ''),
    ballastDays: String(ballastDays || ''),
    totalSeaDays: String(totalSeaDays || ''),
    portIdleDays: String(portIdleDays || ''),
    portStayDays: String(portStayDays || ''),
    totalDays: String(totalDays || ''),
    totalPortCost: String(totalPortCost || ''),
    totalBunkerCost: String(bunkerExpenseTotal || ''),
    totalSecaBunkerCost: String(totalSecaBunkerCostSynced || ''),
    totalOrcCost: String(totalOrcCost || ''),
    totalOtherIncome: String(totalOtherIncome || ''),
    totalHireAmt: String(hireAmt || ''),
    totalOffHireAmt: String(totalOffHireAmt || ''),
    totalFreightQty: String(totalFreightQty || ''),
    cargoQuantity: String(cargoQuantity || ''),
    freightGross: String(freightGross || ''),
    brokeragePercent: String(brokeragePercent || ''),
    brokerageAmt: String(brokerageAmt || ''),
    addressCommAmt: String(addressCommAmt || ''),
    hireAmt: String(hireAmt || ''),
    cvePerMonth: form.cvePerMonth != null ? String(form.cvePerMonth) : '',
    cveAmt: String(cveAmt || ''),
    demurrageRevenue: String(demurrageRevenue || ''),
    demurrageBrokerPercent: String(demurrageBrokerPercent || ''),
    demurrageBrokerAmt: String(demurrageBrokerAmt || ''),
    demurrageNett: String(demurrageNett || ''),
    operationalExpenses: String(operationalExpenses || ''),
    netHireage: String(netHireage || ''),
    vesselDailyOpsAmt: String(vesselDailyOpsAmt || ''),
    hsfoMt: String(bunkerMt.HSFO || ''),
    vlsfoMt: String(bunkerMt.VLSFO || ''),
    lsmgoMt: String(bunkerMt.LSMGO || ''),
    etsHsfoMt: String(etsMt.HSFO || ''),
    etsVlsfoMt: String(etsMt.VLSFO || ''),
    etsLsmgoMt: String(etsMt.LSMGO || ''),
    bunkerResultsCost: String(bunkerExpenseTotal || ''),
    eeoi: String(eeoi || ''),
    cii: String(cii || ''),
    eeoiCo2: String(eeoiCo2 || ''),
    co2mt: String(co2mt || ''),
    co2Cost: String(co2Cost || ''),
    euaCo2mt: String(euaCo2mt || ''),
    euaCo2Usd: String(euaCo2Usd || ''),
    hsfoIntensity: String(fac('HSFO').intensity || ''),
    hsfoTarget: String(fac('HSFO').ghgRate || ''),
    vlsfoIntensity: String(fac('VLSFO').intensity || ''),
    vlsfoTarget: String(fac('VLSFO').ghgRate || ''),
    lsmgoIntensity: String(fac('LSMGO').intensity || ''),
    lsmgoTarget: String(fac('LSMGO').ghgRate || ''),
    hsfoPenalty: String(hsfoPenal || ''),
    vlsfoPenalty: String(vlsfoPenal || ''),
    lsmgoPenalty: String(lsmgoPenal || ''),
    hsfoPenaltyPerMt: String(fac('HSFO').penalty || ''),
    vlsfoPenaltyPerMt: String(fac('VLSFO').penalty || ''),
    lsmgoPenaltyPerMt: String(fac('LSMGO').penalty || ''),
    totalCarbonCost: String(totalCarbonCost || ''),
    revenue: String(revenue || ''),
    voyageEarnings: String(voyageEarnings || ''),
    nettDailyTce: String(nettDailyTce || ''),
    dailyEarning: String(dailyEarning || ''),
    profitLoss: String(profitLoss || ''),
  };
}

/** Merge computed totals into form state. */
export function applyEstimateCalculations(form, lookups = null) {
  const next = {
    ...form,
    _bunkerGrades: lookups?.bunkerGrades || form._bunkerGrades || [],
    _complianceFactors: lookups?.complianceFactors || form._complianceFactors || {},
  };
  const totals = computeEstimateTotals(next);
  return {
    ...next,
    ...totals,
    // ephemeral schedule hints — do not persist in form state
    _portScheduleMode: undefined,
    _portScheduleLegId: undefined,
  };
}
