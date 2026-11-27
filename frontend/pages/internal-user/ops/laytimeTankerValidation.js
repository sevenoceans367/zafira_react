/**
 * Laytime editor validation and safe recompute for Tanker and Dry.
 */

import { hoursBetweenDmy, parseDmyDateTimeMs, recomputePortDraft, rowIsEmpty } from './laytimeCalculations.js';
import { listTankerEntityMatches } from './laytimeTankerHelpers.js';

export const TANKER_MANDATORY_OPERATIONAL_FIELDS = [
  { key: 'norTendered', label: 'NOR TENDERED' },
  { key: 'loadCommenced', label: 'CARGO COMMENCED' },
  { key: 'loadCompleted', label: 'CARGO COMPLETED' },
];

/** Optional timing fields — blank OK; non-blank must parse strictly. */
export const TANKER_OPTIONAL_STRICT_DATE_FIELDS = [
  { key: 'norAccepted', label: 'NOR ACCEPTED' },
  { key: 'startCounting', label: 'LAYTIME STARTS' },
];

/** Named entity dates (All Clear / Laytime Ends / DEMM Starts) — blank OK. */
export const TANKER_ENTITY_DATE_FIELDS = [
  { key: 'allClear', label: 'ALL CLEAR' },
  { key: 'laytimeEnds', label: 'LAYTIME ENDS' },
  { key: 'demmStarts', label: 'DEMM STARTS' },
];

export function validateNamedEntityDates(entityRows) {
  for (const { key, label } of TANKER_ENTITY_DATE_FIELDS) {
    const values = new Set();
    for (const match of listTankerEntityMatches(entityRows, key)) {
      const raw = String(match.value ?? '').trim();
      const date = parseStrictDisplayDateTime(raw);
      if (raw && !date) {
        return {
          ok: false,
          field: key,
          message: `${label} must be a complete date (DD-MM-YYYY).`,
        };
      }
      values.add(date?.getTime() ?? null);
    }
    if (values.size > 1) {
      return {
        ok: false,
        field: key,
        message: `${label} has conflicting values. Edit or clear the field to use one value.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Strict decimal: blank, or optional leading `-` + digits with optional `.` fraction.
 * Rejects commas, hex (`0x10`), trailing junk (`10abc`), empty fractions.
 */
export function parseStrictDecimal(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return { ok: true, blank: true, value: null };
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return { ok: false, blank: false, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, blank: false, value: null };
  return { ok: true, blank: false, value: n };
}

/** Blank OK; otherwise strict non-negative decimal (rates, allowance, qty). */
export function isBlankOrFiniteNumber(value) {
  const parsed = parseStrictDecimal(value);
  if (!parsed.ok) return false;
  if (parsed.blank) return true;
  return parsed.value >= 0;
}

/** LT Partial %: blank OK; otherwise strict decimal in 0–100. */
export function isValidLtPartialPercent(value) {
  const parsed = parseStrictDecimal(value);
  if (!parsed.ok) return false;
  if (parsed.blank) return true;
  return parsed.value >= 0 && parsed.value <= 100;
}

/**
 * Strict DMY datetime. End-anchored. Rejects Date rollover (31-02), hour 25, trailing junk.
 * Accepts `DD-MM-YYYY` or `DD-MM-YYYY HH:MM` (1–2 digit day/month/hour/minute allowed).
 */
export function parseStrictDisplayDateTime(value) {
  const timestamp = parseDmyDateTimeMs(value);
  return timestamp == null ? null : new Date(timestamp);
}

/**
 * Validate any entered date and reject reversed ranges. Save requires both dates when either is set.
 */
export function validateDateRangeOrder(start, end, {
  startLabel = 'Start', endLabel = 'Finish', allowIncomplete = false,
} = {}) {
  const startRaw = String(start ?? '').trim();
  const endRaw = String(end ?? '').trim();
  if (!allowIncomplete && startRaw && !endRaw) {
    return { ok: false, field: 'end', message: `${endLabel} is required when ${startLabel} is set.` };
  }
  if (!allowIncomplete && endRaw && !startRaw) {
    return { ok: false, field: 'start', message: `${startLabel} is required when ${endLabel} is set.` };
  }
  const from = startRaw ? parseStrictDisplayDateTime(startRaw) : null;
  const to = endRaw ? parseStrictDisplayDateTime(endRaw) : null;
  if (startRaw && !from) {
    return { ok: false, field: 'start', message: `${startLabel} must be a complete date (DD-MM-YYYY).` };
  }
  if (endRaw && !to) {
    return { ok: false, field: 'end', message: `${endLabel} must be a complete date (DD-MM-YYYY).` };
  }
  if (from && to && to < from) {
    return { ok: false, field: 'end', message: `${endLabel} must be on or after ${startLabel}.` };
  }
  return { ok: true };
}

function firstInvalidRowDate(rows, kindLabel, { allowIncomplete = false } = {}) {
  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i] || {};
    if (rowIsEmpty(row)) continue;
    const check = validateDateRangeOrder(row.start, row.end, {
      allowIncomplete,
      startLabel: `${kindLabel} #${i + 1} start`,
      endLabel: `${kindLabel} #${i + 1} finish`,
    });
    if (!check.ok) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: check.message,
        index: i,
        focus: check.field === 'start' ? 'start' : 'end',
      };
    }
  }
  return { ok: true };
}

function firstInvalidPartial(rows, kindLabel) {
  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i] || {};
    if (rowIsEmpty(row)) continue;
    if (!isValidLtPartialPercent(row.ltPartial)) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: `${kindLabel} #${i + 1} LT Partial % must be a number from 0 to 100.`,
        index: i,
        focus: 'ltPartial',
      };
    }
  }
  return { ok: true };
}

/** Hours between strict DMY datetimes, or null if either end is missing/invalid. */
export { hoursBetweenDmy as hoursBetweenStrict };

/**
 * Duration from strict dates only. Never keep stale or negative values when
 * dates are missing, unparseable, or reversed.
 */
export function durationFromStrictDates(row) {
  const start = String(row?.start || '').trim();
  const end = String(row?.end || '').trim();
  if (!start || !end) return '';
  const hours = hoursBetweenDmy(start, end);
  if (hours == null || hours < 0) return '';
  return hours.toFixed(4);
}

/** Blank duration OK (auto); supplied duration must match strict start/finish. */
export function verifyRowDurations(rows, kindLabel) {
  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i] || {};
    if (rowIsEmpty(row)) continue;
    const start = String(row.start || '').trim();
    const end = String(row.end || '').trim();
    if (!start || !end) continue;
    const expected = hoursBetweenStrict(start, end);
    if (expected == null) continue;
    const rawDur = String(row.duration ?? '').trim();
    if (rawDur === '') continue;
    const parsed = parseStrictDecimal(rawDur);
    if (!parsed.ok || parsed.blank) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: `${kindLabel} #${i + 1} duration must be a valid number.`,
        index: i,
        focus: 'start',
      };
    }
    if (Math.abs(parsed.value - expected) > 0.0002) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: `${kindLabel} #${i + 1} duration does not match start/finish.`,
        index: i,
        focus: 'start',
      };
    }
  }
  return { ok: true };
}

/**
 * Calc-input gate (not save-mandatory NOR/cargo). Invalid → calculations unavailable.
 */
export function tankerCalcInputsValid(draft, { dryLaytime = false } = {}) {
  if (!draft) return { ok: false, message: 'Laytime draft is missing.' };

  const actPartial = firstInvalidPartial(draft.activities, 'Activity');
  if (!actPartial.ok) return actPartial;
  const dedPartial = firstInvalidPartial(draft.deductions, 'Deduction');
  if (!dedPartial.ok) return dedPartial;

  const actDates = firstInvalidRowDate(draft.activities, 'Activity', { allowIncomplete: true });
  if (!actDates.ok) return actDates;
  const dedDates = firstInvalidRowDate(draft.deductions, 'Deduction', { allowIncomplete: true });
  if (!dedDates.ok) return dedDates;

  if (!isBlankOrFiniteNumber(draft.laytimeAllowed)) {
    return { ok: false, field: 'laytimeAllowed', message: 'Laytime Allowed must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(draft.demurrageRate)) {
    return { ok: false, field: 'demurrageRate', message: 'Demurrage Rate must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(draft.despatchRate)) {
    return { ok: false, field: 'despatchRate', message: 'Dispatch Rate must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(draft.loadedQty)) {
    return { ok: false, field: 'loadedQty', message: 'QTY (MT) must be blank or a valid number.' };
  }

  if (dryLaytime) {
    for (const [key, label] of [['loadedRate', 'Cargo Rate'], ['turnTimeToAdd', 'Turn Time to Add']]) {
      if (!isBlankOrFiniteNumber(draft[key])) {
        return { ok: false, field: key, message: `${label} must be blank or a valid number.` };
      }
    }
  }

  return { ok: true };
}

function markRowsDurationOnly(rows) {
  return (rows || []).map((row) => ({
    ...row,
    duration: durationFromStrictDates(row),
    cumulative: '',
  }));
}

/**
 * Tanker recompute entry.
 * Valid calc inputs → recomputePortDraft.
 * Invalid stored values → do not invent zero/fake financials; mark unavailable.
 * Durations still refresh from strict dates so the Duration column stays truthful.
 */
export function recomputeTankerPortDraft(draft, rateUnit = 'hours', { dryLaytime = false } = {}) {
  if (!draft) return draft;
  const check = tankerCalcInputsValid(draft, { dryLaytime });
  const next = check.ok ? recomputePortDraft(draft, rateUnit, { editor: true, dryLaytime, deductFromActual: false }) : draft;
  const calcError = check.ok ? next.calcError : '';
  if (!check.ok || calcError) {
    return {
      ...next,
      calcUnavailable: true,
      calcError,
      activities: calcError ? next.activities : markRowsDurationOnly(draft.activities),
      deductions: calcError ? next.deductions : markRowsDurationOnly(draft.deductions),
      actualLaytime: '',
      timeToDemurrage: '',
      timeToDespatch: '',
      ttlDemurrage: '',
      ttlDespatch: '',
    };
  }
  if (dryLaytime) {
    const from = parseStrictDisplayDateTime(draft.vesselArrived);
    const to = parseStrictDisplayDateTime(draft.vesselSailed);
    next.totalDaysAtPort = from && to && to >= from
      ? ((to - from) / 86400000).toFixed(4)
      : '0.00';
  }
  return {
    ...next,
    calcUnavailable: false,
    calcError: '',
  };
}

/**
 * Validate Tanker draft before save/submit.
 * @returns {{ ok: true } | { ok: false, field: string, message: string, index?: number, focus?: string }}
 */
export function validateTankerLaytimeDraft(draft, { submitId = 0, dryLaytime = false } = {}) {
  if (!draft) {
    return { ok: false, field: '', message: 'Laytime draft is missing.' };
  }
  if (draft.calcError) return { ok: false, field: '', message: draft.calcError };

  for (const { key, label } of TANKER_MANDATORY_OPERATIONAL_FIELDS) {
    const raw = String(draft[key] || '').trim();
    if (!raw) {
      return { ok: false, field: key, message: `Please fill the ${label}.` };
    }
    if (!parseStrictDisplayDateTime(raw)) {
      return {
        ok: false,
        field: key,
        message: `${label} must be a complete date (DD-MM-YYYY).`,
      };
    }
  }

  for (const { key, label } of TANKER_OPTIONAL_STRICT_DATE_FIELDS) {
    const raw = String(draft[key] || '').trim();
    if (!raw) continue;
    if (!parseStrictDisplayDateTime(raw)) {
      return {
        ok: false,
        field: key,
        message: `${label} must be a complete date (DD-MM-YYYY).`,
      };
    }
  }

  if (dryLaytime) {
    if (!String(draft.stowageQty ?? '').trim()) {
      return { ok: false, field: 'stowageQty', message: 'Please fill the STOWAGE PLAN QUANTITY.' };
    }
    const arrived = parseStrictDisplayDateTime(draft.vesselArrived);
    const sailed = parseStrictDisplayDateTime(draft.vesselSailed);
    if (arrived == null) {
      return { ok: false, field: 'vesselArrived', message: 'Please enter a valid VESSEL ARRIVED date.' };
    }
    if (sailed == null || sailed < arrived) {
      return { ok: false, field: 'vesselSailed', message: 'Please enter a valid VESSEL SAILED date on or after vessel arrival.' };
    }
    for (const [key, label] of [['loadedRate', 'Cargo Rate'], ['turnTimeToAdd', 'Turn Time to Add']]) {
      if (!isBlankOrFiniteNumber(draft[key])) {
        return { ok: false, field: key, message: `${label} must be blank or a valid number.` };
      }
    }
    if (!(draft.detention) && !(Number(draft.loadedQty) > 0 && Number(draft.loadedRate) > 0)) {
      const field = Number(draft.loadedQty) > 0 ? 'loadedRate' : 'loadedQty';
      return { ok: false, field, message: 'Please Check Load Rate Or Quantity' };
    }
  }

  const entityDates = validateNamedEntityDates(draft.entityRows);
  if (!entityDates.ok) return entityDates;

  const actPartial = firstInvalidPartial(draft.activities, 'Activity');
  if (!actPartial.ok) return actPartial;
  const dedPartial = firstInvalidPartial(draft.deductions, 'Deduction');
  if (!dedPartial.ok) return dedPartial;

  const actDates = firstInvalidRowDate(draft.activities, 'Activity');
  if (!actDates.ok) return actDates;
  const dedDates = firstInvalidRowDate(draft.deductions, 'Deduction');
  if (!dedDates.ok) return dedDates;

  const actDur = verifyRowDurations(draft.activities, 'Activity');
  if (!actDur.ok) return actDur;
  const dedDur = verifyRowDurations(draft.deductions, 'Deduction');
  if (!dedDur.ok) return dedDur;

  if (!isBlankOrFiniteNumber(draft.laytimeAllowed)) {
    return { ok: false, field: 'laytimeAllowed', message: 'Laytime Allowed must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(draft.demurrageRate)) {
    return { ok: false, field: 'demurrageRate', message: 'Demurrage Rate must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(draft.despatchRate)) {
    return { ok: false, field: 'despatchRate', message: 'Dispatch Rate must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(draft.loadedQty)) {
    return { ok: false, field: 'loadedQty', message: 'QTY (MT) must be blank or a valid number.' };
  }

  if (Number(submitId) === 1 && !(draft.approvers || []).length) {
    return { ok: false, field: 'approvers', message: 'Please assign an approver first.' };
  }

  return { ok: true };
}
