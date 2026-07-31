/** Port of PHP laytime_calculation.php getFinalCalculation / getLaytime_Allowed. */

function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function round4(value) {
  return Number(Number(value).toFixed(4));
}

/** Parse dd-mm-yyyy or dd-mm-yyyy hh:mm display strings. */
export function parseDisplayDateTime(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', min = '0'] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

/** Hours between two display datetimes, fixed to 4 decimals (PHP HH.toFixed(4)). */
export function hoursBetween(start, end) {
  const from = parseDisplayDateTime(start);
  const to = parseDisplayDateTime(end);
  if (!from || !to) return '0.0';
  const hours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
  return hours.toFixed(4);
}

/**
 * Laytime allowed = qty/rate (+ turn time).
 * days: turnTimeToAdd is hours → add turn/24.
 * hours: add turnTimeToAdd raw.
 */
export function calcLaytimeAllowed(loadedQty, loadedRate, turnTimeToAdd, rateUnit = 'days') {
  const qty = num(loadedQty);
  const rate = num(loadedRate);
  if (!qty || !rate) return '';
  const base = qty / rate;
  const turn = num(turnTimeToAdd);
  const allowed = rateUnit === 'hours' ? base + turn : base + (turn / 24);
  return round4(allowed).toFixed(4);
}

/**
 * Recompute durations, cumulatives, actual/demurrage/despatch fields.
 * Follows PHP getFinalCalculation literally (incl. double-subtract of deductions on demurrage).
 * Returns a new draft object (immutable).
 */
export function recomputePortDraft(draft, rateUnit = 'days') {
  const divider = rateUnit === 'hours' ? 1 : 24;
  const divider1 = rateUnit === 'hours' ? 24 : 1;

  const deductions = (draft.deductions || []).map((row) => {
    const hasRange = String(row.start || '').trim() && String(row.end || '').trim();
    const duration = hasRange ? hoursBetween(row.start, row.end) : (row.duration || '0.0');
    const durationNum = num(duration);
    const partialPct = row.ltPartial === '' || row.ltPartial == null ? 0 : num(row.ltPartial);
    const cumulative = round4((durationNum * partialPct) / 100);
    return {
      ...row,
      duration,
      cumulative: cumulative.toFixed(4),
    };
  });

  const sumDeductionPartial = deductions.reduce((acc, row) => acc + num(row.cumulative), 0);
  const daysTode = num((sumDeductionPartial / divider).toFixed(2));

  const laytimeAllowedStr = draft.laytimeAllowed || '';
  const laytimeAllowed = num(laytimeAllowedStr);

  let sum = 0;
  const activities = (draft.activities || []).map((row) => {
    const hasRange = String(row.start || '').trim() && String(row.end || '').trim();
    const duration = hasRange ? hoursBetween(row.start, row.end) : (row.duration || '0.0');
    const durationNum = num(duration);
    const partialPct = row.ltPartial === '' || row.ltPartial == null ? 0 : num(row.ltPartial);
    const weighted = (durationNum * partialPct) / 100;
    let cumulative = '0.00';
    if (row.ltCounts) {
      sum += weighted;
      const remaining = laytimeAllowed - (sum / divider);
      cumulative = Number.isFinite(remaining) ? remaining.toFixed(4) : '';
    }
    return {
      ...row,
      duration,
      cumulative,
    };
  });

  const actualExtra = num(draft.actualLaytimeExtra);
  const actualLaytime = round4((sum / divider) + actualExtra - daysTode);

  let timeToDemurrage = '00.00';
  let timeToDespatch = '00.00';

  const activityCount = (draft.activities || []).length;
  if (activityCount === 0) {
    if (laytimeAllowed > 0) {
      timeToDemurrage = '00.00';
      timeToDespatch = String(laytimeAllowed);
    } else if (laytimeAllowed < 0) {
      timeToDemurrage = '';
      timeToDespatch = '00.00';
    }
  } else if (!Number.isNaN(actualLaytime) && !Number.isNaN(laytimeAllowed)) {
    if (actualLaytime > laytimeAllowed) {
      // PHP: dem = actual - allowed - (deductionPartialSum / divider) — deductions already in actual.
      const deductions2 = sumDeductionPartial / divider;
      const diff = actualLaytime - laytimeAllowed - Number(deductions2.toFixed(4));
      timeToDemurrage = Number(diff).toFixed(4);
      timeToDespatch = '00.00';
    } else if (laytimeAllowed > actualLaytime) {
      timeToDespatch = Number(laytimeAllowed - actualLaytime).toFixed(4);
      timeToDemurrage = '00.00';
    }
  }

  const dem = num(timeToDemurrage);
  const demRate = num(draft.demurrageRate);
  let ttlDemurrage = ((dem / divider1) * demRate).toFixed(2);

  const despatch = num(timeToDespatch);
  const despatchRate = num(draft.despatchRate);
  let ttlDespatch = ((despatch / divider1) * despatchRate).toFixed(2);

  // PHP quirk when actual laytime rounds to 0
  if (Number(actualLaytime.toFixed(4)) === 0) {
    ttlDespatch = String(laytimeAllowed * despatchRate);
  }

  return {
    ...draft,
    activities,
    deductions,
    actualLaytime: actualLaytime.toFixed(4),
    timeToDemurrage,
    timeToDespatch,
    ttlDemurrage,
    ttlDespatch,
  };
}
