/**
 * Tanker-only (estimateType === 2) client validation for Laytime save/submit.
 * Hidden Dry/Gas fields (stowageQty, vesselArrived, vesselSailed, loadedRate)
 * are not required — Legacy getSubmit skips qty/rate when selBType==2.
 */

import { parseDisplayDateTime } from './laytimeCalculations.js';

export const TANKER_MANDATORY_OPERATIONAL_FIELDS = [
  { key: 'norTendered', label: 'NOR TENDERED' },
  { key: 'loadCommenced', label: 'CARGO COMMENCED' },
  { key: 'loadCompleted', label: 'CARGO COMPLETED' },
];

/** Blank OK; otherwise must be a finite number (rates, allowance, qty). */
export function isBlankOrFiniteNumber(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '');
  if (raw === '') return true;
  return Number.isFinite(Number(raw));
}

/** LT Partial %: blank treated as 0; otherwise finite 0–100. */
export function isValidLtPartialPercent(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '');
  if (raw === '') return true;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

/**
 * Whether a Tanker field edit may safely trigger recomputePortDraft.
 * Invalid % / rates / date ranges stay in the draft for Save to reject —
 * they must not silently inflate demurrage while typing.
 */
export function mayRecomputeTankerField(kind, value, peerValue) {
  if (kind === 'ltPartial') return isValidLtPartialPercent(value);
  if (kind === 'number') return isBlankOrFiniteNumber(value);
  if (kind === 'dateRange') return validateDateRangeOrder(value, peerValue).ok;
  return true;
}

/**
 * Incomplete blank dates are OK. Non-blank must parse as full DMY (optional time).
 * When both start and end are set, end must be >= start.
 */
export function validateDateRangeOrder(start, end, { startLabel = 'Start', endLabel = 'Finish' } = {}) {
  const startRaw = String(start ?? '').trim();
  const endRaw = String(end ?? '').trim();
  if (startRaw) {
    const parsed = parseDisplayDateTime(startRaw);
    if (!parsed) {
      return { ok: false, field: 'start', message: `${startLabel} must be a complete date (DD-MM-YYYY).` };
    }
  }
  if (endRaw) {
    const parsed = parseDisplayDateTime(endRaw);
    if (!parsed) {
      return { ok: false, field: 'end', message: `${endLabel} must be a complete date (DD-MM-YYYY).` };
    }
  }
  if (startRaw && endRaw) {
    const from = parseDisplayDateTime(startRaw);
    const to = parseDisplayDateTime(endRaw);
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
      };
    }
  }
  return { ok: true };
}

/**
 * Validate Tanker draft before save/submit.
 * @returns {{ ok: true } | { ok: false, field: string, message: string }}
 */
export function validateTankerLaytimeDraft(draft, { submitId = 0 } = {}) {
  if (!draft) {
    return { ok: false, field: '', message: 'Laytime draft is missing.' };
  }

  for (const { key, label } of TANKER_MANDATORY_OPERATIONAL_FIELDS) {
    if (!String(draft[key] || '').trim()) {
      return {
        ok: false,
        field: key,
        message: `Please fill the ${label}.`,
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
