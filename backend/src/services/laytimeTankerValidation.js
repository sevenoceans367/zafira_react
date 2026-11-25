/**
 * Tanker-only (estimateType === 2) save-path validation.
 * Mirrors frontend laytimeTankerValidation — do not require hidden Dry fields
 * or Legacy-skipped qty/rate for Tanker.
 */

function parseDmyDateTimeMs(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', min = '0'] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export const TANKER_MANDATORY_OPERATIONAL_FIELDS = [
  { key: 'norTendered', label: 'NOR TENDERED' },
  { key: 'loadCommenced', label: 'CARGO COMMENCED' },
  { key: 'loadCompleted', label: 'CARGO COMPLETED' },
];

export function isBlankOrFiniteNumber(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '');
  if (raw === '') return true;
  return Number.isFinite(Number(raw));
}

export function isValidLtPartialPercent(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '');
  if (raw === '') return true;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

export function validateDateRangeOrder(start, end, { startLabel = 'Start', endLabel = 'Finish' } = {}) {
  const startRaw = String(start ?? '').trim();
  const endRaw = String(end ?? '').trim();
  if (startRaw && parseDmyDateTimeMs(startRaw) == null) {
    return { ok: false, field: 'start', message: `${startLabel} must be a complete date (DD-MM-YYYY).` };
  }
  if (endRaw && parseDmyDateTimeMs(endRaw) == null) {
    return { ok: false, field: 'end', message: `${endLabel} must be a complete date (DD-MM-YYYY).` };
  }
  if (startRaw && endRaw) {
    const from = parseDmyDateTimeMs(startRaw);
    const to = parseDmyDateTimeMs(endRaw);
    if (from != null && to != null && to < from) {
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
      return { ok: false, field: kindLabel === 'Activity' ? 'activities' : 'deductions', message: check.message };
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
      };
    }
  }
  return { ok: true };
}

/**
 * Hours between two DMY display strings (4dp), or null if either missing/invalid.
 * Used to verify client-supplied duration rather than inventing demurrage formulas.
 */
export function hoursBetweenDmy(start, end) {
  const from = parseDmyDateTimeMs(start);
  const to = parseDmyDateTimeMs(end);
  if (from == null || to == null) return null;
  return Number(((to - from) / (1000 * 60 * 60)).toFixed(4));
}

/**
 * Verify activity/deduction duration matches dates when both ends are set.
 * Tolerates tiny float drift; rejects junk duration text when dates exist.
 */
export function verifyRowDurations(rows, kindLabel) {
  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i] || {};
    if (rowIsEmpty(row)) continue;
    const start = String(row.start || '').trim();
    const end = String(row.end || '').trim();
    if (!start || !end) continue;
    const expected = hoursBetweenDmy(start, end);
    if (expected == null) continue;
    const rawDur = String(row.duration ?? '').trim().replace(/,/g, '');
    if (rawDur === '') continue;
    const reported = Number(rawDur);
    if (!Number.isFinite(reported)) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: `${kindLabel} #${i + 1} duration must be a valid number.`,
      };
    }
    if (Math.abs(reported - expected) > 0.0002) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: `${kindLabel} #${i + 1} duration does not match start/finish.`,
      };
    }
  }
  return { ok: true };
}

/** Tanker saves must fail closed on full LT INSERT (no truncated fallback). */
export function tankerLtInsertFailClosed(estimateType) {
  return Number(estimateType) === 2;
}

/**
 * @returns {{ ok: true } | { ok: false, message: string, field?: string }}
 */
export function validateTankerLaytimePayload(payload = {}) {
  for (const { key, label } of TANKER_MANDATORY_OPERATIONAL_FIELDS) {
    if (!String(payload[key] ?? '').trim()) {
      return { ok: false, field: key, message: `Please fill the ${label}.` };
    }
  }

  // Legacy Tanker getSubmit does not gate on loadedRate / stowage / arrive / sail.
  const actPartial = firstInvalidPartial(payload.activities, 'Activity');
  if (!actPartial.ok) return actPartial;
  const dedPartial = firstInvalidPartial(payload.deductions, 'Deduction');
  if (!dedPartial.ok) return dedPartial;

  const actDates = firstInvalidRowDate(payload.activities, 'Activity');
  if (!actDates.ok) return actDates;
  const dedDates = firstInvalidRowDate(payload.deductions, 'Deduction');
  if (!dedDates.ok) return dedDates;

  const actDur = verifyRowDurations(payload.activities, 'Activity');
  if (!actDur.ok) return actDur;
  const dedDur = verifyRowDurations(payload.deductions, 'Deduction');
  if (!dedDur.ok) return dedDur;

  if (!isBlankOrFiniteNumber(payload.laytimeAllowed)) {
    return { ok: false, field: 'laytimeAllowed', message: 'Laytime Allowed must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(payload.demurrageRate)) {
    return { ok: false, field: 'demurrageRate', message: 'Demurrage Rate must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(payload.despatchRate)) {
    return { ok: false, field: 'despatchRate', message: 'Dispatch Rate must be blank or a valid number.' };
  }
  if (!isBlankOrFiniteNumber(payload.loadedQty)) {
    return { ok: false, field: 'loadedQty', message: 'QTY (MT) must be blank or a valid number.' };
  }

  const submitId = Number(payload.submitId ?? payload.submitid ?? 0);
  if (submitId === 1) {
    const approvers = Array.isArray(payload.approvers)
      ? payload.approvers.map((v) => String(v || '').trim()).filter(Boolean)
      : String(payload.approvers || '').split(',').map((p) => p.trim()).filter(Boolean);
    if (!approvers.length) {
      return { ok: false, field: 'approvers', message: 'Please assign an approver first.' };
    }
  }

  return { ok: true };
}
