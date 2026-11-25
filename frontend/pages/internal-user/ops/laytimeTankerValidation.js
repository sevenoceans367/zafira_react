/**
 * Tanker-only (estimateType === 2) client validation + safe recompute.
 * Hidden Dry/Gas fields are not required — Legacy getSubmit skips qty/rate when selBType==2.
 * Does not change recomputePortDraft formulas; only gates which draft values feed them.
 */

import { recomputePortDraft } from './laytimeCalculations.js';

export const TANKER_MANDATORY_OPERATIONAL_FIELDS = [
  { key: 'norTendered', label: 'NOR TENDERED' },
  { key: 'loadCommenced', label: 'CARGO COMMENCED' },
  { key: 'loadCompleted', label: 'CARGO COMPLETED' },
];

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
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (!match) return null;
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  const hh = match[4] != null ? Number(match[4]) : 0;
  const min = match[5] != null ? Number(match[5]) : 0;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || min > 59) return null;
  const date = new Date(yyyy, mm - 1, dd, hh, min, 0, 0);
  if (
    date.getFullYear() !== yyyy
    || date.getMonth() !== mm - 1
    || date.getDate() !== dd
    || date.getHours() !== hh
    || date.getMinutes() !== min
  ) {
    return null;
  }
  return date;
}

/**
 * Incomplete blank dates OK on empty rows. Non-blank must parse strictly.
 * If either end is set, both must be set. End must be >= start.
 */
export function validateDateRangeOrder(start, end, { startLabel = 'Start', endLabel = 'Finish' } = {}) {
  const startRaw = String(start ?? '').trim();
  const endRaw = String(end ?? '').trim();
  if (startRaw && !endRaw) {
    return { ok: false, field: 'end', message: `${endLabel} is required when ${startLabel} is set.` };
  }
  if (endRaw && !startRaw) {
    return { ok: false, field: 'start', message: `${startLabel} is required when ${endLabel} is set.` };
  }
  if (startRaw) {
    const parsed = parseStrictDisplayDateTime(startRaw);
    if (!parsed) {
      return { ok: false, field: 'start', message: `${startLabel} must be a complete date (DD-MM-YYYY).` };
    }
  }
  if (endRaw) {
    const parsed = parseStrictDisplayDateTime(endRaw);
    if (!parsed) {
      return { ok: false, field: 'end', message: `${endLabel} must be a complete date (DD-MM-YYYY).` };
    }
  }
  if (startRaw && endRaw) {
    const from = parseStrictDisplayDateTime(startRaw);
    const to = parseStrictDisplayDateTime(endRaw);
    if (from && to && to.getTime() < from.getTime()) {
      return { ok: false, field: 'end', message: `${endLabel} must be on or after ${startLabel}.` };
    }
  }
  return { ok: true };
}

function rowIsEmpty(row) {
  return !String(row?.activity || '').trim()
    && !String(row?.start || '').trim()
    && !String(row?.end || '').trim()
    && !String(row?.notes || '').trim();
}

function firstInvalidRowDate(rows, kindLabel) {
  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i] || {};
    if (rowIsEmpty(row)) continue;
    const check = validateDateRangeOrder(row.start, row.end, {
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

function sanitizeRowForRecompute(row) {
  const datesOk = validateDateRangeOrder(row.start, row.end).ok;
  const partialOk = isValidLtPartialPercent(row.ltPartial);
  return {
    ...row,
    ltPartial: partialOk ? row.ltPartial : '0',
    ...(datesOk ? {} : { start: '', end: '', duration: '0.0' }),
  };
}

/**
 * Calc-only draft: invalid % / dates / rates never feed recomputePortDraft.
 * Raw user values are restored after compute so Save can still reject them.
 */
export function sanitizeTankerDraftForRecompute(draft) {
  if (!draft) return draft;
  return {
    ...draft,
    laytimeAllowed: isBlankOrFiniteNumber(draft.laytimeAllowed) ? draft.laytimeAllowed : '',
    demurrageRate: isBlankOrFiniteNumber(draft.demurrageRate) ? draft.demurrageRate : '',
    despatchRate: isBlankOrFiniteNumber(draft.despatchRate) ? draft.despatchRate : '',
    loadedQty: isBlankOrFiniteNumber(draft.loadedQty) ? draft.loadedQty : '',
    activities: (draft.activities || []).map(sanitizeRowForRecompute),
    deductions: (draft.deductions || []).map(sanitizeRowForRecompute),
  };
}

function restoreRawRowInputs(rawRow, computedRow) {
  if (!rawRow) return computedRow;
  return {
    ...computedRow,
    start: rawRow.start,
    end: rawRow.end,
    ltPartial: rawRow.ltPartial,
    activity: rawRow.activity,
    notes: rawRow.notes,
    ltCounts: rawRow.ltCounts,
    ltNoCounts: rawRow.ltNoCounts,
    sofLoadPortId: rawRow.sofLoadPortId,
  };
}

/** Tanker recompute entry: sanitize → recomputePortDraft → restore raw invalid inputs. */
export function recomputeTankerPortDraft(draft, rateUnit = 'hours') {
  const safe = sanitizeTankerDraftForRecompute(draft);
  const next = recomputePortDraft(safe, rateUnit);
  return {
    ...next,
    laytimeAllowed: draft.laytimeAllowed,
    demurrageRate: draft.demurrageRate,
    despatchRate: draft.despatchRate,
    loadedQty: draft.loadedQty,
    activities: (next.activities || []).map((row, i) => restoreRawRowInputs(draft.activities?.[i], row)),
    deductions: (next.deductions || []).map((row, i) => restoreRawRowInputs(draft.deductions?.[i], row)),
  };
}

/**
 * Validate Tanker draft before save/submit.
 * @returns {{ ok: true } | { ok: false, field: string, message: string, index?: number, focus?: string }}
 */
export function validateTankerLaytimeDraft(draft, { submitId = 0 } = {}) {
  if (!draft) {
    return { ok: false, field: '', message: 'Laytime draft is missing.' };
  }

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

  const actPartial = firstInvalidPartial(draft.activities, 'Activity');
  if (!actPartial.ok) return actPartial;
  const dedPartial = firstInvalidPartial(draft.deductions, 'Deduction');
  if (!dedPartial.ok) return dedPartial;

  const actDates = firstInvalidRowDate(draft.activities, 'Activity');
  if (!actDates.ok) return actDates;
  const dedDates = firstInvalidRowDate(draft.deductions, 'Deduction');
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

  if (Number(submitId) === 1 && !(draft.approvers || []).length) {
    return { ok: false, field: 'approvers', message: 'Please assign an approver first.' };
  }

  return { ok: true };
}
