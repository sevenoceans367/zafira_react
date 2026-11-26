import { recomputePortDraft } from '../../../frontend/pages/internal-user/ops/laytimeCalculations.js';

/**
 * Laytime editor save-path validation for Tanker and Dry.
 * Mirrors frontend laytimeTankerValidation — strict decimal/date parsing.
 */

export const TANKER_MANDATORY_OPERATIONAL_FIELDS = [
  { key: 'norTendered', label: 'NOR TENDERED' },
  { key: 'loadCommenced', label: 'CARGO COMMENCED' },
  { key: 'loadCompleted', label: 'CARGO COMPLETED' },
];

/** Optional timing — blank OK; non-blank must parse strictly. */
export const TANKER_OPTIONAL_STRICT_DATE_FIELDS = [
  { key: 'norAccepted', label: 'NOR ACCEPTED' },
  { key: 'startCounting', label: 'LAYTIME STARTS' },
];

/**
 * Named laytime_slave2 / SOF point dates shown on Tanker Details.
 * Blank OK; non-blank must parse strictly. Unrelated entity rows are untouched.
 */
export const TANKER_ENTITY_DATE_FIELDS = [
  {
    key: 'allClear',
    label: 'ALL CLEAR',
    canonical: 'All Clear',
    aliases: ['all clear', 'allclear'],
  },
  {
    key: 'laytimeEnds',
    label: 'LAYTIME ENDS',
    canonical: 'Laytime Ends',
    aliases: ['laytime ends', 'laytime end'],
  },
  {
    key: 'demmStarts',
    label: 'DEMM STARTS',
    canonical: 'DEMM Starts',
    aliases: ['demm starts', 'dem starts', 'demurrage starts'],
  },
];

function matchesNamedEntity(name, field) {
  return field.aliases.includes(String(name ?? '').trim().toLowerCase());
}

export function isNamedTankerEntity(name) {
  return TANKER_ENTITY_DATE_FIELDS.some((field) => matchesNamedEntity(name, field));
}

/**
 * Tanker-only: fill missing named dates from SOF candidates.
 * Saved blank/present rows win; first alias match wins; unrelated rows kept.
 */
function fillMissingNamedEntityDates(savedRows, sofCandidates) {
  const result = Array.isArray(savedRows) ? [...savedRows] : [];
  for (const field of TANKER_ENTITY_DATE_FIELDS) {
    if (result.some((row) => matchesNamedEntity(row.name, field))) continue;
    const match = sofCandidates.find((row) => matchesNamedEntity(row.name, field));
    if (match) {
      result.push({ name: field.canonical, value: String(match.value ?? '') });
    }
  }
  return result;
}

/**
 * Fresh / empty-saved: keep ALL sof_slave_6 point events, then add only the
 * three named fields from sof_slave_3 when missing. Saved non-empty: preserve
 * all saved rows and fill only missing named fields (points + slave3).
 */
export function mergeTankerEntityRows(savedRows, pointEvents = [], slave3Rows = []) {
  if (Array.isArray(savedRows) && savedRows.length > 0) {
    return fillMissingNamedEntityDates(savedRows, [...pointEvents, ...slave3Rows]);
  }
  return fillMissingNamedEntityDates(pointEvents || [], slave3Rows || []);
}

/**
 * Validate every recognized named-entity alias row (not just the first).
 * Compare canonical timestamps, treating a cleared date as a distinct value.
 */
export function validateNamedEntityDates(entityRows) {
  for (const field of TANKER_ENTITY_DATE_FIELDS) {
    const values = new Set();
    for (const match of entityRows || []) {
      if (!matchesNamedEntity(match?.name, field)) continue;
      const raw = String(match.value ?? '').trim();
      const timestamp = parseDmyDateTimeMs(raw);
      if (raw && timestamp == null) {
        return {
          ok: false,
          field: field.key,
          message: `${field.label} must be a complete date (DD-MM-YYYY).`,
        };
      }
      values.add(timestamp);
    }
    if (values.size > 1) {
      return {
        ok: false,
        field: field.key,
        message: `${field.label} has conflicting values. Edit or clear the field to use one value.`,
      };
    }
  }
  return { ok: true };
}

/** True when letter is an OPA / protective-agent letter (LP_DP='Yes' when column exists). */
export function isOpaAgencyLetter(row = {}, { hasLpDp = false } = {}) {
  if (hasLpDp && String(row.LP_DP || '').trim().toUpperCase() === 'YES') return true;
  const port = String(row.PORT || '').trim().toUpperCase();
  // Only when PORT still encodes OPA (LPOPA/DPOPA) — stored LP/DP alone is not enough.
  return port.includes('OPA');
}

/**
 * Prefer genuine ordinary Agency Nomination over OPA / pda / bunker / voyage letters.
 * `letters` must be newest-first (GEN_AGENCY_ID DESC).
 */
export function pickOrdinaryNominationLetter(letters = [], { hasLpDp = false } = {}) {
  for (const row of letters || []) {
    if (isOpaAgencyLetter(row, { hasLpDp })) continue;
    const kind = String(row.KIND_ATTN_TO || '').trim().toLowerCase();
    if (kind !== 'nomination') continue;
    return row;
  }
  return null;
}

export function parseStrictDecimal(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return { ok: true, blank: true, value: null };
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return { ok: false, blank: false, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, blank: false, value: null };
  return { ok: true, blank: false, value: n };
}

export function isBlankOrFiniteNumber(value) {
  const parsed = parseStrictDecimal(value);
  if (!parsed.ok) return false;
  if (parsed.blank) return true;
  return parsed.value >= 0;
}

export function isValidLtPartialPercent(value) {
  const parsed = parseStrictDecimal(value);
  if (!parsed.ok) return false;
  if (parsed.blank) return true;
  return parsed.value >= 0 && parsed.value <= 100;
}

/** Strict DMY; reject rollover / hour 25 / trailing junk. */
export function parseDmyDateTimeMs(value) {
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
  return date.getTime();
}

export function validateDateRangeOrder(start, end, { startLabel = 'Start', endLabel = 'Finish' } = {}) {
  const startRaw = String(start ?? '').trim();
  const endRaw = String(end ?? '').trim();
  if (startRaw && !endRaw) {
    return { ok: false, field: 'end', message: `${endLabel} is required when ${startLabel} is set.` };
  }
  if (endRaw && !startRaw) {
    return { ok: false, field: 'start', message: `${startLabel} is required when ${endLabel} is set.` };
  }
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

export function hoursBetweenDmy(start, end) {
  const from = parseDmyDateTimeMs(start);
  const to = parseDmyDateTimeMs(end);
  if (from == null || to == null) return null;
  return Number(((to - from) / (1000 * 60 * 60)).toFixed(4));
}

/**
 * Persist contract: when both dates parse, store derived hours (never blank/stale/negative).
 * Otherwise keep the client-supplied duration string.
 */
export function durationForPersist(row) {
  const start = String(row?.start || '').trim();
  const end = String(row?.end || '').trim();
  if (start && end) {
    const hours = hoursBetweenDmy(start, end);
    if (hours != null && hours >= 0) return Number(hours).toFixed(4);
  }
  return String(row?.duration ?? '').trim();
}

export function verifyRowDurations(rows, kindLabel) {
  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i] || {};
    if (rowIsEmpty(row)) continue;
    const start = String(row.start || '').trim();
    const end = String(row.end || '').trim();
    const rawDur = String(row.duration ?? '').trim();
    if (!start || !end) {
      if (rawDur && !isBlankOrFiniteNumber(rawDur)) {
        return { ok: false, message: `${kindLabel} #${i + 1} duration must be a nonnegative number.` };
      }
      continue;
    }
    const expected = hoursBetweenDmy(start, end);
    if (expected == null) continue;
    if (expected < 0) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: `${kindLabel} #${i + 1} finish must be on or after start.`,
      };
    }
    // Blank duration with valid dates is OK — persistence derives via durationForPersist.
    if (rawDur === '') continue;
    const parsed = parseStrictDecimal(rawDur);
    if (!parsed.ok || parsed.blank) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: `${kindLabel} #${i + 1} duration must be a valid number.`,
      };
    }
    if (Math.abs(parsed.value - expected) > 0.0002) {
      return {
        ok: false,
        field: kindLabel === 'Activity' ? 'activities' : 'deductions',
        message: `${kindLabel} #${i + 1} duration does not match start/finish.`,
      };
    }
  }
  return { ok: true };
}

export function calculateLaytimeForSave(fields, activities, deductions, rateUnit, options = {}) {
  const calculateRows = (rows) => rows.filter((row) => !rowIsEmpty(row));
  const result = recomputePortDraft({
    laytimeAllowed: fields.laytimeAllowed,
    demurrageRate: fields.demurrageRate,
    despatchRate: fields.despatchRate,
    actualLaytimeExtra: options.actualLaytimeExtra,
    activities: calculateRows(activities).map((row) => ({
      ...row,
      ltCounts: Number(row.ltCounts) === 1,
      ltNoCounts: Number(row.ltNoCounts) === 1,
    })),
    deductions: calculateRows(deductions),
  }, rateUnit, { dryLaytime: options.dryLaytime, deductFromActual: false });
  if (Number(result.timeToDemurrage) < 0) {
    throw Object.assign(new Error('Deductions exceed the time on demurrage. Confirm the contractual treatment before saving.'), { status: 422 });
  }
  return result;
}

/**
 * @returns {{ ok: true } | { ok: false, message: string, field?: string }}
 */
export function validateTankerLaytimePayload(payload = {}, { dryLaytime = false } = {}) {
  if (['activities', 'deductions', 'entityRows'].some((key) => payload[key] != null && !Array.isArray(payload[key]))) {
    return { ok: false, message: 'Invalid Laytime rows.' };
  }
  for (const { key, label } of TANKER_MANDATORY_OPERATIONAL_FIELDS) {
    const raw = String(payload[key] ?? '').trim();
    if (!raw) {
      return { ok: false, field: key, message: `Please fill the ${label}.` };
    }
    if (parseDmyDateTimeMs(raw) == null) {
      return { ok: false, field: key, message: `${label} must be a complete date (DD-MM-YYYY).` };
    }
  }

  for (const { key, label } of TANKER_OPTIONAL_STRICT_DATE_FIELDS) {
    const raw = String(payload[key] ?? '').trim();
    if (!raw) continue;
    if (parseDmyDateTimeMs(raw) == null) {
      return { ok: false, field: key, message: `${label} must be a complete date (DD-MM-YYYY).` };
    }
  }

  if (dryLaytime) {
    if (!String(payload.stowageQty ?? '').trim()) {
      return { ok: false, field: 'stowageQty', message: 'Please fill the STOWAGE PLAN QUANTITY.' };
    }
    const arrived = parseDmyDateTimeMs(payload.vesselArrived);
    const sailed = parseDmyDateTimeMs(payload.vesselSailed);
    if (arrived == null) {
      return { ok: false, field: 'vesselArrived', message: 'Please enter a valid VESSEL ARRIVED date.' };
    }
    if (sailed == null || sailed < arrived) {
      return { ok: false, field: 'vesselSailed', message: 'Please enter a valid VESSEL SAILED date on or after vessel arrival.' };
    }
    for (const [key, label] of [['loadedRate', 'Cargo Rate'], ['turnTimeToAdd', 'Turn Time to Add']]) {
      if (!isBlankOrFiniteNumber(payload[key])) {
        return { ok: false, field: key, message: `${label} must be blank or a valid number.` };
      }
    }
    if (!(Number(payload.detention) === 1) && !(Number(payload.loadedQty) > 0 && Number(payload.loadedRate) > 0)) {
      const field = Number(payload.loadedQty) > 0 ? 'loadedRate' : 'loadedQty';
      return { ok: false, field, message: 'Please Check Load Rate Or Quantity' };
    }
  }

  const entityDates = validateNamedEntityDates(payload.entityRows);
  if (!entityDates.ok) return entityDates;

  const contradictory = (payload.activities || []).findIndex((row) => !rowIsEmpty(row)
    && Number(row.ltCounts) === 1 && Number(row.ltNoCounts) === 1);
  if (contradictory >= 0) {
    return { ok: false, field: 'activities', message: `Activity #${contradictory + 1} cannot be both LT(C) and LT(NC).` };
  }

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
