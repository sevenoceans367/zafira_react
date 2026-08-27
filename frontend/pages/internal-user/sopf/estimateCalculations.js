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
export function round3(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/** Format a day value for display/storage with exactly 3 decimal places. */
export function formatDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return round3(n).toFixed(3);
}

/**
 * Idle / transit idle days — always 3 decimal places when set (including 0.000).
 * Empty string stays empty so the field can be cleared.
 */
export function formatIdleDays(value) {
  if (value == null || String(value).trim() === '') return '';
  const n = num(value);
  if (!Number.isFinite(n)) return '';
  return round3(n).toFixed(3);
}

/** Format a distance (nm) for display/storage with exactly 3 decimal places. */
export function formatDistance(value) {
  if (value == null || String(value).trim() === '') return '';
  const n = num(value);
  if (!Number.isFinite(n)) return '';
  return round3(n).toFixed(3);
}

// ---------------------------------------------------------------------------
// Port schedule / laycan / demurrage (php/common.js)
// Date format: "dd-mm-yyyy HH:MM"
// ---------------------------------------------------------------------------

/** PHP parseDateTime — parse "dd-mm-yyyy HH:MM" (time optional → 00:00). */
export function parseDateTime(str) {
  const raw = String(str || '').trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/);
  const date = parts[0].split(/[-/]/);
  if (date.length < 3) return null;
  const day = parseInt(date[0], 10);
  const month = parseInt(date[1], 10) - 1;
  const year = parseInt(date[2], 10);
  let hour = 0;
  let minute = 0;
  if (parts[1]) {
    const time = parts[1].split(':');
    if (time.length >= 2) {
      hour = parseInt(time[0], 10);
      minute = parseInt(time[1], 10);
    }
  }
  if (![day, month, year, hour, minute].every((n) => Number.isFinite(n))) return null;
  if (month < 0 || month > 11) return null;
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
 * PHP calculatePortDates — when Arrival/Departure both exist, write the gap into
 * Portstay Days (txtWDays_ / txtDWDays_) or transit idle for ballast TP/BP.
 * Only when the matching Terms dropdown has a value (PHP: if selLPTerms/selDPTerms).
 *
 * Runs for every Terms value (SHINC/SSHEX/…/DAP). UI is editable only for DAP.
 */
export function syncPortstayFromPassageDates(leg) {
  if (!leg) return leg;
  const next = { ...leg };
  const passageType = String(next.passageType || '1');
  const discQty = num(next.dischargeQty);
  const isDapDp = String(next.discPortTerms) === '4';
  const isDapLp = String(next.loadPortTerms) === '4';

  // From Arrival/Departure → LP Total Portstay Days (laden, or DAP)
  if (
    next.fromArrival
    && next.fromDeparture
    && (passageType === '2' || isDapLp)
    && String(next.loadPortTerms || '').trim()
  ) {
    const days = diffDays(next.fromArrival, next.fromDeparture);
    next.loadPortWorkDays = Number(days.toFixed(2)).toFixed(2);
  }

  // To Arrival/Departure → DP Portstay Days (or TP/BP idle when ballast/zero qty and not DAP)
  if (next.toArrival && next.toDeparture && String(next.discPortTerms || '').trim()) {
    const days = Number(diffDays(next.toArrival, next.toDeparture).toFixed(2));
    if (!isDapDp && (passageType === '1' || discQty === 0)) {
      next.transitIdleDays = formatIdleDays(days) || '0.000';
      next.discPortWorkDays = '0.00';
    } else {
      next.discPortWorkDays = days.toFixed(2);
      if (!isDapDp) next.transitIdleDays = '0.000';
    }
  }

  return next;
}

/**
 * PHP getDepartureDate('DP'): To Departure = To Arrival + DP Portstay Days, then cascade later legs.
 */
export function cascadeFromDiscPortstay(portLegs, legIndex) {
  const legs = (portLegs || []).map((leg) => ({ ...leg }));
  const i = Number(legIndex);
  if (!legs[i]) return legs;

  const leg = { ...legs[i] };
  const toStay = num(leg.discPortWorkDays);
  if (leg.toArrival && toStay) {
    leg.toDeparture = addDecimalDays(leg.toArrival, toStay);
  } else if (leg.toArrival) {
    leg.toDeparture = leg.toArrival;
  }
  legs[i] = leg;
  return applyPortDateCascade(legs, { startIndex: i + 1 });
}

/**
 * PHP getDepartureDate('LP'): From Departure = From Arrival + LP Portstay Days, then cascade.
 */
export function cascadeFromLoadPortstay(portLegs, legIndex) {
  const legs = (portLegs || []).map((leg) => ({ ...leg }));
  const i = Number(legIndex);
  if (!legs[i]) return legs;

  const leg = { ...legs[i] };
  const fromStay = num(leg.loadPortWorkDays);
  if (leg.fromArrival && fromStay) {
    leg.fromDeparture = addDecimalDays(leg.fromArrival, fromStay);
  } else if (leg.fromArrival) {
    leg.fromDeparture = leg.fromArrival;
  }
  legs[i] = leg;
  return cascadeFromDeparture(legs, i);
}

/**
 * PHP getIdleDaysByLaycan:
 * If Laycan Start > first laden (passageType=2) from-arrival,
 * set that leg's loadPortIdleDays to the positive day difference.
 * When laycan does not apply, leave the field alone so the user can type decimals.
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
      loadPortIdleDays: formatIdleDays(days) || '0.000',
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

/** PHP calculateDemurrageCost — days × rate → Estimated($). */
export function calculateDemurrageCost(days, rate) {
  return round2(num(days) * num(rate));
}

/**
 * Format Estimated/Actual like PHP `.toFixed(2)`.
 * Leave blank when both days and rate are empty (PHP leaves inputs empty until typed / putDays).
 */
export function formatDemurrageCostField(days, rate) {
  const hasDays = String(days ?? '').trim() !== '';
  const hasRate = String(rate ?? '').trim() !== '';
  if (!hasDays && !hasRate) return '';
  return calculateDemurrageCost(days, rate).toFixed(2);
}

/**
 * PHP putDaysToDemurrageDispatch (common.js):
 * Sum (LP working − idle) + (DP CA + working − idle) across all demurrage rows,
 * subtract timeAllowed (hrs → days, 2dp), write remainder onto the LAST DP Demm. Days only.
 * Per-row LP/DP demm-day writes are commented out in PHP — do not auto-fill those.
 */
export function applyDemurrageDaysFromLaytime(portLegs, timeAllowedHrs) {
  const legs = (portLegs || []).map((leg) => ({ ...leg }));
  if (!legs.length) return legs;

  let demmDaysTotal = 0;
  for (const leg of legs) {
    // Mirrors $("[id^=DDCLProw_]") loop — uses laytime working/idle even when LP demm days stay blank
    demmDaysTotal += num(leg.loadPortWorkDays) - num(leg.loadPortIdleDays);
    // Mirrors $("[id^=DDCDProw_]") loop
    demmDaysTotal += num(leg.chartererAccountDays)
      + num(leg.discPortWorkDays)
      - num(leg.discPortIdleDays);
  }

  const timeAllowedDays = Number((num(timeAllowedHrs) / 24).toFixed(2));
  const remaining = Number((demmDaysTotal - timeAllowedDays).toFixed(2));
  const lastIndex = legs.length - 1;
  const demmDaysDp = remaining.toFixed(2);
  const ddcDpEst = formatDemurrageCostField(demmDaysDp, legs[lastIndex].demmRateDp);

  legs[lastIndex] = {
    ...legs[lastIndex],
    demmDaysDp,
    ddcDpEst,
    ddcDpReal: ddcDpEst,
  };

  return legs;
}

/**
 * Orchestrate PHP common.js schedule side-effects after sea/laytime days are known.
 *
 * form._portScheduleMode (optional):
 *   - 'fromArrival' — sync LP portstay from dates, cascade from arrival
 *   - 'fromDeparture' — sync LP portstay from dates, cascade sea/DP onward
 *   - 'toArrival' — sync DP portstay from dates, recompute toDeparture from stay
 *   - 'toDeparture' — sync DP portstay from dates, cascade later legs only
 *   - 'portstayDp' — PHP getDepartureDate('DP'): To Departure from DP Portstay Days
 *   - 'portstayLp' — PHP getDepartureDate('LP'): From Departure from LP Portstay Days
 *   - 'syncPortstayFromDates' — dates → Portstay Days only (e.g. selecting DAP)
 *   - 'laycanOnly' — idle-by-laycan + demurrage only (no date rewrite)
 *   - 'idleManual' — user edited Idle Days; keep typed values (do not re-apply laycan idle)
 *   - 'demurrageLaytime' — Time Allowed change → refresh Demm. Days from laytime
 *   - 'demurrageManual' — user edited Demm. Days/Rate; keep typed values (do not auto-fill)
 *   - omitted on generic recalc — cascade from existing arrivals when present
 *
 * Does NOT invent dates from laycan. Blank/NULL DB dates stay blank
 * (PHP shows 01-01-1970 placeholder for the same empty values).
 */
export function applyPortScheduleCalculations(form) {
  let portLegs = (form.portLegs || []).map((leg) => ({ ...leg }));
  const mode = form._portScheduleMode || null;
  const legId = form._portScheduleLegId;
  const legIndex = legId != null
    ? portLegs.findIndex((leg) => String(leg.id) === String(legId))
    : -1;

  // PHP getIdleDaysByLaycan — only when laycan / arrival schedule changes, not on Idle typing
  // or generic freight recalcs (otherwise Idle Days appear locked after save).
  const applyLaycanIdle = (
    mode === 'laycanOnly'
    || mode === 'fromArrival'
    || mode === 'fromDeparture'
    || mode === 'toArrival'
    || mode === 'toDeparture'
  );
  if (applyLaycanIdle) {
    portLegs = applyIdleDaysByLaycan(portLegs, form.laycanStart);
  }

  // PHP calculatePortDates: whenever Arrival/Departure both exist and Terms are set,
  // write the gap into Portstay Days (all Terms, not only DAP).
  if (
    legIndex >= 0
    && (mode === 'fromArrival' || mode === 'fromDeparture' || mode === 'toArrival' || mode === 'toDeparture'
      || mode === 'syncPortstayFromDates')
  ) {
    portLegs[legIndex] = syncPortstayFromPassageDates(portLegs[legIndex]);
  } else if (!mode || mode === 'laycanOnly' || mode === 'demurrageLaytime') {
    // Keep Portstay aligned with Passage dates on generic recalcs too
    portLegs = portLegs.map((leg) => syncPortstayFromPassageDates(leg));
  }

  if (mode === 'portstayDp' && legIndex >= 0) {
    portLegs = cascadeFromDiscPortstay(portLegs, legIndex);
  } else if (mode === 'portstayLp' && legIndex >= 0) {
    portLegs = cascadeFromLoadPortstay(portLegs, legIndex);
  } else if (
    mode === 'syncPortstayFromDates'
    || mode === 'demurrageManual'
    || mode === 'idleManual'
  ) {
    // Portstay / demurrage / idle days already set — do not rewrite dates
  } else if (mode === 'fromDeparture' && legIndex >= 0) {
    portLegs = cascadeFromDeparture(portLegs, legIndex);
  } else if (mode === 'toArrival' && legIndex >= 0) {
    portLegs = cascadeFromToArrival(portLegs, legIndex);
  } else if (mode === 'toDeparture' && legIndex >= 0) {
    portLegs = applyPortDateCascade(portLegs, { startIndex: legIndex + 1 });
  } else if (mode === 'fromArrival') {
    const startIndex = legIndex >= 0
      ? legIndex
      : portLegs.findIndex((leg) => leg.fromArrival);
    if (startIndex >= 0) {
      portLegs = applyPortDateCascade(portLegs, { startIndex });
    }
  } else if (!mode) {
    // Generic recalc: only cascade when a real arrival already exists
    const startIndex = portLegs.findIndex((leg) => leg.fromArrival);
    if (startIndex >= 0) {
      portLegs = applyPortDateCascade(portLegs, { startIndex });
    }
  }

  // PHP putDaysToDemurrageDispatch — skip when user is typing Demm. Days/Rate
  if (mode !== 'demurrageManual') {
    portLegs = applyDemurrageDaysFromLaytime(portLegs, form.timeAllowed);
  }

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

/** PHP getLPTermsList factors for laytime working days. */
export const LAYTIME_TERM_FACTORS = {
  1: 1,
  2: 1.555555,
  3: 1.405,
  4: null,
  5: 1,
  6: 1.272727,
  7: 1.333333,
};

/**
 * PHP showHideEstimateTypeDiv rate-unit label:
 * Gas(1)=CBM/Hr, Tanker(2)=MT/Hr, Dry(3)=MT/Day.
 */
export function getLaytimeRateUnitLabel(estimateType) {
  const t = Number(estimateType);
  if (t === 1) return '(CBM/Hr)';
  if (t === 2) return '(MT/Hr)';
  return '(MT/Day)';
}

/**
 * PHP getPortCalculation `divideby`:
 * hourly rates (Gas/Tanker) → 24; daily rates (Dry) → 1.
 */
export function getLaytimeRateDivideBy(estimateType) {
  const t = Number(estimateType);
  return (t === 1 || t === 2) ? 24 : 1;
}

/**
 * PHP getPortCalculation (commented but authoritative):
 * workingDays = (qty / rate) / divideby × termFactor
 * Uses toFixed(2) like PHP when writing Portstay Days.
 */
export function calcLaytimeWorkingDays(qty, rate, termsId, estimateType = 2) {
  const q = num(qty);
  const r = num(rate);
  const factor = LAYTIME_TERM_FACTORS[String(termsId)];
  if (factor == null || !q || !r) return 0;
  const divideby = getLaytimeRateDivideBy(estimateType);
  // Match PHP value.toFixed(2) on txtWDays_ / txtDWDays_
  return Number((((q / r) / divideby) * factor).toFixed(2));
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
 * PHP updatecost_sheet_tci getBunkerCalculation Actual Qty. (MT):
 * VLSFO = to_rob_fo_arrival_1 − to_rob_fo_departure_{last} + slave8 SUPPLY qty (grade 29)
 * LSMGO = to_rob_do_arrival_1 − to_rob_do_departure_{last} + slave8 SUPPLY qty (grade 23)
 * HSFO  = slave2 SECA ACTUAL_MT (no ROB overwrite)
 */
function calcCostSheetActualBunkerQty(form, classify) {
  const legs = Array.isArray(form.portLegs) ? form.portLegs : [];
  const first = legs[0] || {};
  const last = legs[legs.length - 1] || {};
  let vlsfoRob = num(first.toRobFoArrival) - num(last.toRobFoDeparture);
  let lsmgoRob = num(first.toRobDoArrival) - num(last.toRobDoDeparture);

  for (const row of form.bunkerRows || []) {
    if (String(row.identify || '').toUpperCase() !== 'SUPPLY') continue;
    const gradeId = String(row.bunkerGradeId || '');
    const key = classify(row.bunkerGradeId);
    const qty = num(row.qty);
    if (key === 'VLSFO' || gradeId === '29') vlsfoRob += qty;
    if (key === 'LSMGO' || gradeId === '23') lsmgoRob += qty;
  }

  return { VLSFO: round2(vlsfoRob), LSMGO: round2(lsmgoRob) };
}

function isSecaBunkerIdentify(identify) {
  const id = String(identify || '').toUpperCase().replace(/\s+/g, '_');
  return id === 'SECA' || id === '1';
}

function isNonSecaBunkerIdentify(identify) {
  const id = String(identify || '').toUpperCase().replace(/\s+/g, '_');
  return id === 'NON_SECA' || id === 'NONSECA' || id === '2';
}

/**
 * PHP Bunkers Qty column = txtNONSECABunkerQty (slave2 NON_SECA EST_MT).
 * Prefer synced secaBunkerRows qty over master VLSFOMT/LSMGO/HSFO fields.
 */
function pickEstimateQtyFromSecaRows(form, grade, classify) {
  const matches = (form.secaBunkerRows || []).filter((row) => {
    const key = classify(row.bunkerGradeId);
    return (key === 'HSFO+SCRUBBER' ? 'HSFO' : key) === grade;
  });
  const nonSeca = matches.find((row) => isNonSecaBunkerIdentify(row.identify));
  if (nonSeca && num(nonSeca.qty)) return num(nonSeca.qty);
  if (matches.length === 1 && num(matches[0].qty)) return num(matches[0].qty);
  return 0;
}

/** PHP getVoyageTime in-port rates (see mapConsumptionRow field cross-map). */
function pickInPortConsumptionRates(cons, { lpSeca, dpSeca, tpSeca, port }) {
  if (port === 'lp') {
    if (lpSeca) {
      return {
        working: num(cons.inPortSecaWorking),
        idle: num(cons.inPortSecaIdle),
      };
    }
    return {
      working: num(cons.inPortNonSecaWorking),
      idle: num(cons.inPortNonSecaIdle),
    };
  }
  if (port === 'dp') {
    if (dpSeca) {
      return {
        working: num(cons.inPortSecaWorkingDp),
        idle: num(cons.inPortSecaIdle),
      };
    }
    return {
      working: num(cons.inPortNonSecaWorkingDp),
      idle: num(cons.inPortNonSecaIdle),
    };
  }
  return {
    working: 0,
    idle: tpSeca ? num(cons.inPortSecaIdle) : num(cons.inPortNonSecaIdle),
  };
}

/**
 * PHP getBunkerCalculation amount MT for one grade:
 * Amount = (SECA_MT + effectiveNonSecaMt) × price
 * effectiveNonSecaMt = ROB when (VLSFO|LSMGO) && ROB != 0, else estimated Qty (NON_SECA / voyage).
 * When only a SECA row exists, its qty is the NON_SECA stand-in (do not add it again with ROB).
 */
function calcCostSheetBunkerAmountMt({
  grade,
  estimateQty,
  actualQty,
  secaMatches,
}) {
  const matches = secaMatches || [];
  const hasNonSeca = matches.some((row) => isNonSecaBunkerIdentify(row.identify));
  const secaQtyPart = hasNonSeca
    ? round2(matches
      .filter((row) => isSecaBunkerIdentify(row.identify))
      .reduce((sum, row) => sum + num(row.qty), 0))
    : 0;
  const useRobForAmount = (grade === 'VLSFO' || grade === 'LSMGO') && actualQty !== 0;
  return useRobForAmount ? round2(secaQtyPart + actualQty) : num(estimateQty);
}

/**
 * PHP txtTotalSECAConsumption / txtBrokTtlCostUsd — bunker expense that feeds voyage results.
 */
function calcCostSheetBunkerExpenseTotal(form, classify, bunkerMt, priceByGrade, secaBunkerRows) {
  const robActual = calcCostSheetActualBunkerQty(form, classify);
  let total = 0;
  for (const grade of ['VLSFO', 'LSMGO', 'HSFO']) {
    const price = num(priceByGrade?.[grade]);
    if (!(price > 0)) continue;
    const secaMatches = (secaBunkerRows || []).filter((row) => {
      const key = classify(row.bunkerGradeId);
      return (key === 'HSFO+SCRUBBER' ? 'HSFO' : key) === grade;
    });
    const estimateQty = num(bunkerMt?.[grade]);
    const actualQty = grade === 'VLSFO' || grade === 'LSMGO'
      ? robActual[grade]
      : round2(secaMatches
        .filter((row) => isSecaBunkerIdentify(row.identify))
        .reduce((sum, row) => sum + num(row.actualQty), 0));
    const amountMt = calcCostSheetBunkerAmountMt({
      grade,
      estimateQty,
      actualQty,
      secaMatches,
    });
    total = round2(total + amountMt * price);
  }
  return {
    total,
    robActual,
    hasRobActual: robActual.VLSFO !== 0 || robActual.LSMGO !== 0,
  };
}

/**
 * PHP Bunkers summary: qty from voyage calc MT, actual qty from ROB + supplied
 * (updatecost_sheet_tci getBunkerCalculation), price from SECA row (slave2 EST_PRICE).
 * @param {object} form
 * @param {(gradeId: string) => string} resolveGradeName
 */
export function buildBunkerSummaryRows(form, resolveGradeName) {
  const classify = (gradeId) => classifyBunkerGradeName(resolveGradeName(gradeId));
  const robActual = calcCostSheetActualBunkerQty(form, classify);

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

    const qtyFromSeca = pickEstimateQtyFromSecaRows(form, grade, classify);
    const qtyField = grade === 'HSFO' ? form.hsfoMt : grade === 'LSMGO' ? form.lsmgoMt : form.vlsfoMt;
    const qty = qtyFromSeca || num(qtyField);
    let actualQty = 0;
    if (grade === 'VLSFO' || grade === 'LSMGO') {
      actualQty = robActual[grade];
    } else {
      actualQty = round2(secaMatches
        .filter((row) => isSecaBunkerIdentify(row.identify))
        .reduce((sum, row) => sum + num(row.actualQty), 0));
    }
    const amountMt = calcCostSheetBunkerAmountMt({
      grade,
      estimateQty: qty,
      actualQty,
      secaMatches,
    });
    const amount = round2(amountMt * price);
    const hasOther = qty || price || amount;
    const actualStr = actualQty
      ? Number(actualQty).toFixed(2)
      : ((grade === 'VLSFO' || grade === 'LSMGO') && hasOther ? '0.00' : '');
    return {
      grade,
      qty: qty ? qty.toFixed(2) : '',
      actualQty: actualStr,
      price: price ? price.toFixed(2) : '',
      amount: amount ? amount.toFixed(2) : '',
    };
  }).filter((row) => row.qty || row.actualQty || row.price || row.amount);
}

/** Brokerage-only totals for the Commissions panel Total row (excludes ADCOM Freight). */
export function calcDemurrageCommissionDisplay(form) {
  const demurrageRevenue = num(form.demurrageRevenue);
  const addCommPercent = num(form.addCommPercent);
  const addressDemmComm = round2((demurrageRevenue * addCommPercent) / 100);

  const brokerRows = Array.isArray(form.brokerRows) && form.brokerRows.length
    ? form.brokerRows
    : [{
      percent: form.brokeragePercent,
      amount: form.brokerageAmt,
      demmPercent: '',
    }];

  const brokerPercentTotal = round2(
    brokerRows.reduce((sum, row) => sum + num(row.percent), 0),
  );
  const brokerFreightTotal = round2(
    brokerRows.reduce((sum, row) => sum + num(row.amount), 0),
  );
  const brokerDemmCommTotal = round2(
    brokerRows.reduce((sum, row) => sum + num(row.demmPercent), 0),
  );

  return {
    addressDemmComm,
    brokerDemmCommTotal,
    /** Total % = brokerage rows only (not ADCOM) */
    totalCommPercent: brokerPercentTotal,
    /** Total freight = brokerage amounts only (not ADCOM) */
    totalFreightComm: brokerFreightTotal,
    /** Total demurrage = brokerage demm only (not ADCOM) */
    totalDemmComm: brokerDemmCommTotal,
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

/**
 * PHP-style short port label: first alias + country.
 * "Kandla / Deendayal / Dindayal (IND)" → "Kandla (IND)"
 */
export function shortPortDisplayName(name, fallback = '') {
  const raw = String(name || '').trim();
  if (!raw) return fallback || '—';
  const country = extractCountryCode(raw);
  const primary = (raw.split(' / ')[0] || raw).trim();
  const primaryName = primary.replace(/\s*\([^)]*\)\s*$/, '').trim() || primary;
  if (country) return `${primaryName} (${country})`;
  return primaryName || raw;
}

/** Demurrage Load Port row label — PHP spanDDCLPort. */
export function formatDemurrageLoadPortLabel(leg) {
  const name = shortPortDisplayName(leg?.fromPortName, '');
  return name ? `Load Port ${name}` : 'Load Port';
}

/**
 * Demurrage Discharge / TP-BP row label — PHP getPortText():
 * Default HTML label is "Discharge Port". After a To Port is chosen,
 * Ballast (passageType=1) or zero discharge qty → rename to "TP/BP".
 */
export function formatDemurrageDischargePortLabel(leg) {
  const name = shortPortDisplayName(leg?.toPortName, '');
  const hasToPort = Boolean(leg?.toPortId) || Boolean(name);
  if (!hasToPort) return 'Discharge Port';
  const qty = num(leg?.dischargeQty);
  const isTpBp = String(leg?.passageType) === '1' || qty === 0;
  const prefix = isTpBp ? 'TP/BP' : 'Discharge Port';
  return `${prefix} ${name}`;
}

/** @deprecated Prefer formatDemurrageLoadPortLabel / formatDemurrageDischargePortLabel. */
export function formatDemurragePortLegLabel(leg, index) {
  const to = shortPortDisplayName(leg?.toPortName, leg?.toPortId || 'To');
  if (index > 0) return `TP/BP ${to}`;
  const from = shortPortDisplayName(leg?.fromPortName, leg?.fromPortId || 'From');
  return `${from} → ${to} (LP/DP)`;
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

  let seaDays = 0; // per-leg sea days still written on each row; roll-up uses laden/ballast below
  let legsWithDays = portLegs.map((leg) => {
    const speed = pickPassageSpeedKnots(form, leg.passageType, leg.speedType);
    // PHP: empty margin = 0 (not 5)
    const margin = leg.seaMargin != null && leg.seaMargin !== '' ? leg.seaMargin : 0;
    const days = calcSeaDaysWithSeca(leg.distance, leg.secaDistance, speed, margin);
    const secaDays = calcSeaDays(leg.secaDistance, speed, margin);

    // PHP getPortCalculation: qty/rate/terms when Passage dates are not both set.
    // When Arrival+Departure exist, PHP calculatePortDates owns Portstay Days (any Terms).
    // DAP (4): always keep stored/manual value (editable in UI).
    const hasLpDates = !!(leg.fromArrival && leg.fromDeparture)
      && String(leg.loadPortTerms || '').trim();
    const hasDpDates = !!(leg.toArrival && leg.toDeparture)
      && String(leg.discPortTerms || '').trim();
    const loadWork = String(leg.loadPortTerms) === '4' || hasLpDates
      ? num(leg.loadPortWorkDays)
      : calcLaytimeWorkingDays(leg.loadQty, leg.loadPortRate, leg.loadPortTerms, form.estimateType);
    const discWork = String(leg.discPortTerms) === '4' || hasDpDates
      ? num(leg.discPortWorkDays)
      : calcLaytimeWorkingDays(leg.dischargeQty, leg.discPortRate, leg.discPortTerms, form.estimateType);
    const loadIdle = num(leg.loadPortIdleDays);
    const discIdle = num(leg.discPortIdleDays);
    const transitIdle = num(leg.transitIdleDays);
    // PHP: txtTtPWDays = working only; txtTtPIDays = idle only; txtTDays = sea+idle+work
    const portWorkDays = round3(loadWork + discWork);
    const portIdleOnly = round3(loadIdle + discIdle + transitIdle);
    const ddcLpEst = formatDemurrageCostField(leg.demmDaysLp, leg.demmRateLp);
    const ddcDpEst = formatDemurrageCostField(leg.demmDaysDp, leg.demmRateDp);
    const nonSecaDistance = Math.max(0, num(leg.distance) - num(leg.secaDistance));
    const nonSecaDays = Math.max(0, round3(days - secaDays));

    seaDays += days;
    return {
      ...leg,
      seaDays: formatDays(days),
      // Keep cleared Wx(%) empty in the input; only treat blank as 0 for sea-day math above.
      seaMargin: leg.seaMargin == null ? '0' : String(leg.seaMargin),
      // DAP or date-driven: keep stored. Else qty/rate (2dp).
      loadPortWorkDays: String(leg.loadPortTerms) === '4' || hasLpDates
        ? (leg.loadPortWorkDays ?? '')
        : (loadWork ? loadWork.toFixed(2) : '0.00'),
      discPortWorkDays: String(leg.discPortTerms) === '4' || hasDpDates
        ? (leg.discPortWorkDays ?? '')
        : (discWork ? discWork.toFixed(2) : '0.00'),
      portStayDays: formatDays(portWorkDays),
      portIdleDays: formatIdleDays(portIdleOnly) || '0.000',
      nonSecaDistance: formatDistance(nonSecaDistance),
      secaDays: formatDays(secaDays),
      nonSecaDays: formatDays(nonSecaDays),
      ddcLpEst,
      ddcDpEst,
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
    const portWorkDays = round3(loadWork + discWork);
    const portIdleOnly = round3(loadIdle + discIdle + transitIdle);
    return {
      ...leg,
      portStayDays: formatDays(portWorkDays),
      portIdleDays: formatIdleDays(portIdleOnly) || '0.000',
    };
  });

  const totalPortCost = round2(
    legsWithDays.reduce(
      (sum, leg) => sum + num(leg.loadPortCost) + num(leg.discPortCost) + num(leg.transitPortCost),
      0,
    ),
  );

  const bunkers = bunkerRows.map((row) => {
    // Per grade: Amount = Qty (MT) × Price ($/MT) — always recompute like PHP
    const computed = calcBunkerCost(row.qty, row.price);
    const cost = (num(row.qty) || num(row.price)) ? computed : num(row.cost);
    return { ...row, cost: cost ? String(cost) : row.cost };
  });
  const bunkerActivities = bunkerActivityRows.map((row) => {
    const qtyEmpty = row.qty == null || String(row.qty).trim() === '';
    const priceEmpty = row.price == null || String(row.price).trim() === '';
    // Don't keep stale amount when Qty or Price is cleared (empty ≠ keep previous).
    if (qtyEmpty || priceEmpty) {
      return { ...row, amount: '' };
    }
    return { ...row, amount: String(calcBunkerCost(row.qty, row.price)) };
  });

  // PHP getBunkerCalculation: always sum SECA + NON-SECA amounts (calc flag only gates price edit / FO-DO mt)
  const secaBunkers = secaBunkerRows.map((row) => {
    const computed = calcBunkerCost(row.qty, row.price);
    const cost = (num(row.qty) || num(row.price)) ? computed : num(row.cost);
    return { ...row, cost: cost ? String(cost) : row.cost };
  });

  // PHP getFinalCalculation: Amount(USD) = Cargo(MT) × Rate USD/MT (always recompute)
  const mapAmount = (rows) => (rows || []).map((row) => {
    const amount = calcCargoAmount(row.cargoMt, row.rateUsdMt);
    return { ...row, amountUsd: String(amount) };
  });
  const cargoRows = mapAmount(form.cargoRows);
  const overageCargoRows = mapAmount(form.overageCargoRows);
  const deadfreightCargoRows = mapAmount(form.deadfreightCargoRows);
  const allCargos = [...cargoRows, ...overageCargoRows, ...deadfreightCargoRows];
  // PHP getFinalCalculation: txtTankQuantity = sum(txtTotalTankQty_) = Min + Overage per WS row
  const tankerWsQtyTotal = round2(
    (form.tankerWsRows || []).reduce(
      (sum, row) => sum + num(row.minCargoQty) + num(row.oveCargoQty),
      0,
    ),
  );
  // Tanker: Lumpsum → txtLumpsumQty; World Scale → Min+Ove (do not fall back across modes)
  const cargoFromCargoRows = round2(
    allCargos.reduce((sum, row) => sum + num(row.cargoMt), 0),
  );
  const estimateTypeForCargoQty = Number(form.estimateType) || 2;
  const tankerCargoQty = estimateTypeForCargoQty === 2
    ? (form.chkLumpsum ? num(form.lumpsumQty) : tankerWsQtyTotal)
    : 0;
  const cargoQuantity = round2(
    cargoFromCargoRows
    || tankerCargoQty
    || (estimateTypeForCargoQty !== 2
      ? (num(form.lumpsumQty) || num(form.cargoQuantity))
      : 0)
    || num(form.cargoQuantity),
  );

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
  // PHP setIlhocForTcDet: txtIlohcForTcDet = txtORCAmt_6 (owner cost id 12 / ILOHC).
  // Included in ops expenses, then added back into voyage_earning for Nett Daily TCE / P&L.
  const ilohcRow = orcs.find((row) => {
    const costId = String(row.costId || '');
    const name = String(row.costName || '').toUpperCase();
    return costId === '12' || name.includes('ILOHC');
  });
  const ilohcAmt = round2(num(ilohcRow?.amount) || num(form.ilohcForTcDet));

  const otherIncomes = otherIncomeRows.map((row) => {
    // PHP Add Comm(%): net = amount − amount × percent / 100 (empty percent → 0%).
    const amount = num(row.amount);
    const addCommPct = num(row.addComm);
    const net = amount > 0
      ? round2(amount - ((amount * addCommPct) / 100))
      : (num(row.netAmount) || 0);
    return { ...row, netAmount: net ? String(net) : '0.00' };
  });
  const totalOtherIncome = round2(
    otherIncomes.reduce((sum, row) => sum + num(row.netAmount || row.amount), 0),
  );

  const hires = hireRows.map((row) => {
    const amt = num(row.hireAmt) || round2(num(row.hireDays) * num(row.hireRate));
    return { ...row, hireAmt: amt ? String(amt) : row.hireAmt };
  });
  let totalHireFromRows = round2(hires.reduce((sum, row) => sum + num(row.hireAmt), 0));

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

  // PHP getFinalCalculation (addestimate.php): always recompute amounts / totals
  // Amount = Qty × Flat Rate × WS / 100; Total Qty = Min + Overage.
  const tankerWs = tankerWsRows.map((row) => {
    const minAmount = round2(
      num(row.minCargoQty) * num(row.minFlatRate) * (num(row.minWs) / 100),
    );
    const oveAmount = round2(
      num(row.oveCargoQty) * num(row.oveFlatRate) * (num(row.oveWs) / 100),
    );
    const totalQty = round2(num(row.minCargoQty) + num(row.oveCargoQty));
    const totalAmount = round2(minAmount + oveAmount);
    return {
      ...row,
      minAmount: String(minAmount),
      oveAmount: String(oveAmount),
      totalQty: String(totalQty),
      totalAmount: String(totalAmount),
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
    // PHP ChkOFFHireCal: only owner-account bunkers enter Less Off Hire
    const ownerBunkerTotal = bunkersMapped.reduce(
      (sum, b) => (b.calc === false ? sum : sum + num(b.amount)),
      0,
    );
    return {
      ...row,
      amount: amount ? String(amount) : row.amount,
      bunkers: bunkersMapped,
      bunkerTotal: ownerBunkerTotal,
    };
  });
  // Off-hire hire amounts + owner bunkers (CVE added later into lessOffHire)
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
  const estimateType = Number(form.estimateType) || 2;
  const isTanker = estimateType === 2;
  const isGas = estimateType === 1;
  const isDry = estimateType === 3;
  const gasMarket = String(form.gasMarket || '1');
  const dryMarket = String(form.dryMarket || '1');
  const gasLumsum = num(form.gasLumsum) || num(form.lumpsum);
  const lumpsum = isTanker
    ? (form.chkLumpsum ? num(form.lumpsum) : 0)
    : isGas
      ? (gasMarket === '2' ? gasLumsum : 0)
      : num(form.lumpsum);
  const cargoQtyTotal = round2(
    cargoFromCargoRows
    || tankerCargoQty
    || (estimateType !== 2
      ? (num(form.lumpsumQty) || num(form.cargoQuantity))
      : 0)
    || num(form.cargoQuantity),
  );
  // PHP: tankType 1 = Single → lumpsum OR WS (qty×flat×WS/100); tankType 2 = Distributed → cargo MT×rate
  const tankType = String(form.tankType || '1');
  const tankerFreightRate = num(form.tankerFreightRate || form.marketRate);
  const rateTimesQty = tankerFreightRate > 0 && cargoQtyTotal > 0
    ? round2(tankerFreightRate * cargoQtyTotal)
    : 0;
  const dryQty = num(form.cargoQuantity) || cargoQtyTotal;
  const dfQty = num(form.dfQty);
  const dryRate = num(form.marketRate);
  const dryGrossFreight = dryMarket === '2'
    ? round2(num(form.lumpsum))
    : round2(dryRate * dryQty);
  const deadFreightAmt = dryMarket === '1' ? round2(dryRate * dfQty) : 0;
  let freightGross = 0;
  if (isGas) {
    // PHP rdoEstimateType==1: base rate × gas qty, or gas lumpsum.
    const gasQty = num(form.cargoQuantity) || cargoQtyTotal;
    const gasBase = num(form.gasBaseRate);
    if (gasMarket === '2') {
      freightGross = round2(gasLumsum || num(form.freightGross) || freightFromCargo);
    } else {
      const gasFromRate = gasQty > 0 && gasBase > 0 ? round2(gasQty * gasBase) : 0;
      freightGross = round2(
        gasFromRate
        || num(form.freightGross)
        || freightFromCargo,
      );
    }
  } else if (isDry) {
    // PHP: Multiple (rdoTankType=2) → sum Main/Overage/Deadfreight cargo amounts.
    // Single → Market freight×qty (+ DF) or LS, plus freight-qty vendor nets.
    if (tankType === '2') {
      freightGross = round2(
        freightFromCargo
        || num(form.freightGross)
        || rateTimesQty
        || totalFreightQty,
      );
    } else {
      const dryTotal = round2(dryGrossFreight + deadFreightAmt + totalFreightQty);
      freightGross = round2(
        dryTotal
        || num(form.freightGross)
        || freightFromCargo,
      );
    }
  } else if (tankType === '1') {
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
  // PHP: brokerage_comm_usd = rev × percent / 100 (always recompute; same base as address commission)
  const brokers = (brokerRows.length
    ? brokerRows
    : [{ percent: form.brokeragePercent, amount: form.brokerageAmt }]
  ).map((row) => {
    // Keep the typed percent string (e.g. "2." / "1.25"); coercing via num()
    // on every recalc strips trailing decimals while the user is typing.
    const rawPercent = row.percent ?? row.brokeragePercent ?? '';
    const percent = num(rawPercent);
    const amount = round2((freightGross * percent) / 100);
    return {
      ...row,
      percent: rawPercent === '' || rawPercent == null ? '' : String(rawPercent),
      amount: amount.toFixed(2),
    };
  });
  const brokeragePercent = round2(
    brokers.reduce((sum, row) => sum + num(row.percent), 0),
  );
  const brokerageAmt = round2(
    brokers.reduce((sum, row) => sum + num(row.amount), 0),
  );
  const addCommPercent = num(form.addCommPercent);
  const addressCommAmt = round2((freightGross * addCommPercent) / 100);

  // Hire / Day: prefer Vessel OpEx field; fall back to hire row 1 (PHP dummyHireRate).
  // `_hireRateCleared` lets the user blank the field without snapping back from hire rows.
  const hireRateCleared = !!form._hireRateCleared;
  const baseHireRate = hireRateCleared
    ? 0
    : (num(form.hireRate) || num(hires[0]?.hireRate));
  // PHP dummyBalticIndex — added to hire rate row 1 when Index Linked is checked (Dry).
  const balticRate = form.chkIndex ? num(form.balticRate) : 0;
  const hireRate = round2(baseHireRate + balticRate);
  const totalHireRate = hireRate;
  // PHP txtTtPIDays / txtTtPWDays — idle vs working kept separate
  const portIdleDays = round3(legsWithDays.reduce((sum, leg) => sum + num(leg.portIdleDays), 0));
  const portStayDays = round3(legsWithDays.reduce((sum, leg) => sum + num(leg.portStayDays), 0));

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
  // PHP Results: distances .toFixed(2); sea/idle/portstay days .toFixed(3); Total Days .toFixed(2)
  ladenDist = round2(ladenDist);
  ballastDist = round2(ballastDist);
  ladenDays = round3(ladenDays);
  ballastDays = round3(ballastDays);
  const totalSeaDays = round3(ladenDays + ballastDays);
  // PHP txtTDays / hire days = sea + idle + working, then .toFixed(2)
  const totalDays = round2(totalSeaDays + portIdleDays + portStayDays || num(form.totalDays) || 0);
  const hireDays = totalDays;
  // PHP getFinalCalculation: hire days from Hire From/To when set; else voyage total days for row 1.
  const hireBaseRows = hires.length
    ? hires
    : [{ hireDays: '', hireRate: baseHireRate ? String(baseHireRate) : '', hireAmt: '', hireFrom: '', hireTo: '' }];
  const hiresSynced = hireBaseRows.map((row, index) => {
    const fromToDays = row.hireFrom && row.hireTo
      ? round2(diffDays(row.hireFrom, row.hireTo))
      : null;
    const rowBaseRate = index === 0
      ? (baseHireRate || num(row.hireRate))
      : num(row.hireRate);
    const effectiveRate = index === 0
      ? round2(rowBaseRate + balticRate)
      : rowBaseRate;
    let days;
    if (fromToDays != null && fromToDays > 0) {
      days = fromToDays;
    } else if (index === 0) {
      days = totalDays;
    } else {
      days = num(row.hireDays);
    }
    const amt = effectiveRate > 0 && days > 0 ? round2(effectiveRate * days) : 0;
    return {
      ...row,
      hireDays: days ? (fromToDays != null && fromToDays > 0 ? days.toFixed(4) : days.toFixed(2)) : (row.hireDays || ''),
      hireRate: rowBaseRate > 0 ? String(rowBaseRate) : '',
      hireAmt: amt ? String(amt) : '',
    };
  });
  totalHireFromRows = round2(hiresSynced.reduce((sum, row) => sum + num(row.hireAmt), 0));
  const hireAmt = round2(
    totalHireFromRows || (hireRate * hireDays) || 0,
  );
  // PHP txtTotalVoyageDays = sum of hire-row days (used for hireage CVE)
  const totalHireDays = round2(
    hiresSynced.reduce((sum, row) => sum + num(row.hireDays), 0),
  ) || hireDays;

  // PHP: CVE ($) display = (CVE/Month × 12 / 365) × total voyage days (txtTDays)
  const cvePerMonth = num(form.cvePerMonth);
  const cveAmt = cvePerMonth > 0
    ? round2(((cvePerMonth * 12) / 365) * (totalDays || 0))
    : num(form.cveAmt);
  const ballastBonus = num(form.ballastBonus);

  // PHP hireage CVE uses hire-days sum (txtTotalVoyageDays)
  const hireageCveAmt = cvePerMonth > 0
    ? round2(((cvePerMonth * 12) / 365) * (totalHireDays || 0))
    : 0;

  // PHP: empty hireage % → 0 (dummyAdcom/dummyBrokerage only copy when setCveAmtInTcDet runs).
  // Hireage Add Comm % on (hire + ballast); Brokerage % on hire amt only.
  // Freight ADCOM (addCommPercent / txtFrAdjPerAC) is independent of hireagePercent.
  const hireageAddCommPct = num(form.hireagePercent);
  const hireageBroPct = num(form.hireageBroPercent);
  const grossHireargeAmt = round2(ballastBonus + hireAmt);
  const hireageAddCommAmt = round2((grossHireargeAmt * hireageAddCommPct) / 100);
  const hireageBroAmt = round2((hireAmt * hireageBroPct) / 100);
  const nettHireargeAmt = round2(grossHireargeAmt - hireageAddCommAmt - hireageBroAmt);

  const offHireDays = round2(offHires.reduce((sum, row) => sum + num(row.days), 0));
  const offHireCvePerMonth = num(form.offHireCve) || cvePerMonth;
  const offHireCveAmt = offHireCvePerMonth > 0 && offHireDays > 0
    ? round2(((offHireCvePerMonth * 12) / 365) * offHireDays)
    : num(form.offHireCveAmt);
  // Off hire hire-amt + owner bunkers (calc/CHECK_BUNKER_CAL); CVE added below.
  const lessOffHire = round2(totalOffHireAmt + offHireCveAmt);

  const demurrageBrokerPercent = num(form.demurrageBrokerPercent)
    || round2(brokeragePercent + addCommPercent);
  const legsWithDemurrage = legsWithDays.map((leg) => {
    // PHP calculateDemurrageCost: Estimated = days × rate (always derived, not sticky stored)
    const ddcLpEst = formatDemurrageCostField(leg.demmDaysLp, leg.demmRateLp);
    const ddcDpEst = formatDemurrageCostField(leg.demmDaysDp, leg.demmRateDp);
    // PHP getDDCOwnerCalculation: Actual tracks Estimated when laytime flag is 0
    const ddcLpReal = ddcLpEst;
    const ddcDpReal = ddcDpEst;
    // PHP Nett = Actual − Actual×ADDComm%/100; ADDComm UI commented out → Nett = Actual
    const ddcLpNett = ddcLpReal;
    const ddcDpNett = ddcDpReal;
    return {
      ...leg,
      ddcLpEst,
      ddcDpEst,
      ddcLpReal,
      ddcDpReal,
      ddcLpNett,
      ddcDpNett,
    };
  });

  // PHP txtDemurrageRevenues / Total Nett = sum of row Nett Values (getDDCOwnerCalculation)
  const demurrageNett = round2(
    legsWithDemurrage.reduce((sum, leg) => sum + num(leg.ddcLpNett) + num(leg.ddcDpNett), 0),
  );
  const demurrageRevenue = demurrageNett;
  const demurrageBrokerAmt = round2((demurrageRevenue * demurrageBrokerPercent) / 100);
  const brokersWithDemm = brokers.map((row) => {
    const pct = num(row.percent);
    const demmAmt = round2((demurrageRevenue * pct) / 100);
    return {
      ...row,
      demmPercent: demmAmt.toFixed(2),
    };
  });

  const deliveryTotal = round2(deliveryBunkers.reduce((sum, row) => sum + num(row.amount), 0));
  const redeliveryTotal = round2(redeliveryBunkers.reduce((sum, row) => sum + num(row.amount), 0));
  // Net Hireage =
  //   (Σ HireDays×HireRate + Ballast Bonus − Add Comm − Brokerage)
  //   + Delivery bunkers + CVE − Redelivery bunkers
  //   − Off Hire (hire + CVE + owner bunkers)
  const netHireage = round2(
    nettHireargeAmt + deliveryTotal + hireageCveAmt - redeliveryTotal - lessOffHire,
  );

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
        const secaDaysVal = num(leg.secaDays);
        const nonSecaDays = num(leg.nonSecaDays) || Math.max(0, seaDays - secaDaysVal);
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
            total += (nonSecaDays * nonSecaRate) + (secaDaysVal * secaRate);
            // getEuConsp NON-SECA FO: nonSecaDays × NS rate × EU%
            etsQty += nonSecaDays * nonSecaRate * euPct;
            any = true;
          }
        } else if (gradeMatches(sGrade, key, gradeName)) {
          // PHP NON-SECA DO qty when selSBG matches
          total += (secaDaysVal * secaRate) + (nonSecaDays * nonSecaRate);
          // getEuConsp SECA DO: secaDays × DO NON-SECA rate × EU%
          etsQty += secaDaysVal * nonSecaRate * euPct;
          any = true;
        }

        // In-port (working / idle) — gated by port bunker grade + SECA checkbox
        const lpOk = (leg.lpBunkerGrades || []).some((g) => gradeMatches(g, key, gradeName));
        const dpOk = (leg.dpBunkerGrades || []).some((g) => gradeMatches(g, key, gradeName));
        const tpOk = (leg.tpBunkerGrades || []).some((g) => gradeMatches(g, key, gradeName));
        const lw = num(leg.loadPortWorkDays);
        const li = num(leg.loadPortIdleDays);
        const dw = num(leg.discPortWorkDays);
        const di = num(leg.discPortIdleDays);
        const ti = num(leg.transitIdleDays);
        const lpEu = calculatePortLegPercentage(extractCountryCode(leg.fromPortName));
        const dpEu = calculatePortLegPercentage(extractCountryCode(leg.toPortName));

        if (lpOk) {
          const rates = pickInPortConsumptionRates(cons, {
            lpSeca: leg.chkLpSeca,
            port: 'lp',
          });
          total += lw * rates.working + li * rates.idle;
          if (leg.chkLpSeca || identify === 'FO') {
            etsQty += (lw * rates.working + li * rates.idle) * lpEu;
          }
          any = true;
        }
        if (dpOk) {
          const rates = pickInPortConsumptionRates(cons, {
            dpSeca: leg.chkDpSeca,
            port: 'dp',
          });
          total += dw * rates.working + di * rates.idle;
          if (leg.chkDpSeca || identify === 'FO') {
            etsQty += (dw * rates.working + di * rates.idle) * dpEu;
          }
          any = true;
        }
        if (tpOk && ti > 0) {
          const rates = pickInPortConsumptionRates(cons, {
            tpSeca: leg.chkTpSeca,
            port: 'tp',
          });
          total += ti * rates.idle;
          any = true;
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
    // Additional Bunker Consumption Qty (MT) → Bunkers Qty by grade
    // (only on live consumption path so stored/seca fallbacks are not double-counted).
    for (const row of bunkerActivities) {
      const keyRaw = classifyBunkerGradeName(row.bunkerGrade);
      if (!keyRaw) continue;
      const key = keyRaw === 'HSFO+SCRUBBER' ? 'HSFO' : keyRaw;
      if (!Object.prototype.hasOwnProperty.call(bunkerMt, key)) continue;
      const q = num(row.qty);
      if (!q) continue;
      bunkerMt[key] = round2(num(bunkerMt[key]) + q);
    }
  } else if (storedSum > 0 || storedEtsSum > 0) {
    for (const g of ['HSFO', 'VLSFO', 'LSMGO']) {
      bunkerMt[g] = pickEstimateQtyFromSecaRows(form, g, classify) || storedTotals[g];
    }
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
    // bunkerMt already includes Additional Bunker Consumption; keep rawTotals only for
    // scrubber-grade keys, then overwrite display grades so activity qty is not dropped.
    const mtByKey = {
      ...(fromConsumption.rawTotals || {}),
      HSFO: bunkerMt.HSFO,
      VLSFO: bunkerMt.VLSFO,
      LSMGO: bunkerMt.LSMGO,
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

  const totalSecaBunkerCostSynced = round2(
    secaBunkersSynced.reduce((sum, row) => sum + num(row.cost), 0),
  );

  // PHP getBunkerCalculation → txtTotalSECAConsumption → txtBrokTtlCostUsd (feeds voyage results).
  // When ROB actual is set for VLSFO/LSMGO, amount uses Actual Qty instead of estimated Qty.
  const costSheetBunker = calcCostSheetBunkerExpenseTotal(
    { ...form, bunkerRows: bunkers },
    classify,
    bunkerMt,
    priceByGrade,
    secaBunkersSynced,
  );
  const totalSecaBunkerCostForResults = costSheetBunker.total > 0
    ? costSheetBunker.total
    : totalSecaBunkerCostSynced;

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

  // PHP Bunker Expenses (getBunkerCalculation):
  //   Default: Σ SECA/NON-SECA grade amounts (qty × price; ROB replaces NON_SECA when set)
  //   If Σ ConBunkerAmt (manual consumed / slave8 CONSUMPTION) > 0 → that sum overrides
  const conBunkerExpense = round2(
    bunkers
      .filter((row) => String(row.identify || '').toUpperCase() === 'CONSUMPTION')
      .reduce((sum, row) => sum + num(row.cost), 0),
  );
  const bunkerExpenseTotal = conBunkerExpense > 0
    ? conBunkerExpense
    : (totalSecaBunkerCostForResults > 0
      ? totalSecaBunkerCostForResults
      : (storedSecaExpense > 0
        ? storedSecaExpense
        : round2(num(form.bunkerResultsCost) || num(form.totalBunkerCost) || 0)));
  // PHP: revenue = freight − address commission + other income (lumpsum already in freight when used)
  const revenue = round2((freightGross - addressCommAmt) + totalOtherIncome);
  // totalExpensesOpsPortBunker = ops + port + bunker
  const totalExpensesOpsPortBunker = round2(
    operationalExpenses + totalPortCost + bunkerExpenseTotal,
  );
  // Voyage Earnings (UI / PHP costbeforebamarage): subtracts hireage CVE only, NOT full hire
  //   revenue − ops − port − bunker − hireageCVE + demurrage
  const voyageEarnings = round2(
    revenue - totalExpensesOpsPortBunker - hireageCveAmt + demurrageRevenue,
  );
  // Internal voyage_earning for TCE / P&L (PHP txtGTTLVoyageEarnings):
  //   revenue − ops − port − bunker − finalHireage + ilohc
  const voyageEarningForTce = round2(
    revenue - totalExpensesOpsPortBunker - netHireage + ilohcAmt,
  );
  // pl = voyage_earning + demurrage; nettDailyTce = pl / max(totalDays, 1)
  const profitLoss = round2(voyageEarningForTce + demurrageRevenue);
  const daysForTce = totalDays > 0 ? totalDays : 1;
  const nettDailyTce = round2(profitLoss / daysForTce);
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
    hireRows: hiresSynced,
    secaBunkerRows: secaBunkersSynced,
    freightQtyRows: freightQtys,
    tankerWsRows: tankerWs,
    offHireRows: offHires.map(({ bunkerTotal, ...row }) => row),
    deliveryBunkerRows: deliveryBunkers,
    redeliveryBunkerRows: redeliveryBunkers,
    totalDistance: totalDistance ? totalDistance.toFixed(2) : '0.00',
    ladenDist: ladenDist ? ladenDist.toFixed(2) : '0.00',
    ballastDist: ballastDist ? ballastDist.toFixed(2) : '0.00',
    ladenDays: formatDays(ladenDays),
    ballastDays: formatDays(ballastDays),
    totalSeaDays: formatDays(totalSeaDays),
    portIdleDays: formatIdleDays(portIdleDays) || '0.000',
    portStayDays: formatDays(portStayDays),
    // PHP txtTDays uses .toFixed(2)
    totalDays: totalDays ? totalDays.toFixed(2) : '0.00',
    totalPortCost: String(totalPortCost || ''),
    totalBunkerCost: String(bunkerExpenseTotal || ''),
    totalSecaBunkerCost: String(totalSecaBunkerCostForResults || ''),
    totalOrcCost: String(totalOrcCost || ''),
    totalOtherIncome: String(totalOtherIncome || ''),
    totalHireAmt: String(hireAmt || ''),
    totalHireDays: totalHireDays ? String(totalHireDays) : '',
    totalOffHireAmt: String(lessOffHire || ''),
    lessOffHire: String(lessOffHire || ''),
    offHireCveAmt: String(offHireCveAmt || ''),
    hireagePercent: form.hireagePercent != null ? String(form.hireagePercent) : '',
    hireageBroPercent: form.hireageBroPercent != null ? String(form.hireageBroPercent) : '',
    hireagePercentAmt: String(hireageAddCommAmt || ''),
    hireageBroPercentAmt: String(hireageBroAmt || ''),
    grossHireargeAmt: String(grossHireargeAmt || ''),
    nettHireargeAmt: String(nettHireargeAmt || ''),
    hireageCveAmt: String(hireageCveAmt || ''),
    totalFreightQty: String(totalFreightQty || ''),
    cargoQuantity: String(cargoQuantity || ''),
    freightGross: String(freightGross || ''),
    dryGrossFreight: String(dryGrossFreight || ''),
    deadFreightAmt: String(deadFreightAmt || ''),
    brokeragePercent: brokeragePercent ? brokeragePercent.toFixed(2) : '',
    brokerageAmt: brokerageAmt ? brokerageAmt.toFixed(2) : '',
    addressCommAmt: addressCommAmt ? addressCommAmt.toFixed(2) : '',
    // Hire Amt is derived (rate × days). Hire / Day: keep typed value, or seed from row when not cleared.
    hireAmt: hireAmt ? hireAmt.toFixed(2) : '',
    hireRate: hireRateCleared
      ? ''
      : (form.hireRate != null && String(form.hireRate).trim() !== ''
        ? String(form.hireRate)
        : (baseHireRate ? String(baseHireRate) : '')),
    _hireRateCleared: hireRateCleared,
    balticRate: form.chkIndex && balticRate ? String(balticRate) : (form.balticRate || ''),
    totalHireRate: totalHireRate ? String(totalHireRate) : '',
    cvePerMonth: form.cvePerMonth != null ? String(form.cvePerMonth) : '',
    cveAmt: String(cveAmt || ''),
    ballastBonus: form.ballastBonus != null ? String(form.ballastBonus) : '',
    demurrageRevenue: String(demurrageRevenue || ''),
    demurrageBrokerPercent: String(demurrageBrokerPercent || ''),
    demurrageBrokerAmt: String(demurrageBrokerAmt || ''),
    demurrageNett: String(demurrageNett || ''),
    operationalExpenses: String(operationalExpenses || ''),
    netHireage: String(netHireage || ''),
    ilohcForTcDet: String(ilohcAmt || ''),
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
