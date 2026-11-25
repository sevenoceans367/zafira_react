const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Treat legacy PHP / epoch placeholders as empty. */
export function sanitizeValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^0?1[-/]0?1[-/]1970\b/.test(raw)) return '';
  if (/^1970[-/]0?1[-/]0?1\b/.test(raw)) return '';
  return raw;
}

/**
 * Parse common pasted/typed date strings into a Date.
 * Supports: dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd, with optional HH:MM / HH:MM:SS.
 */
export function parseFlexibleDate(datestr, strict24Hour = false) {
  const raw = sanitizeValue(datestr);
  if (!raw) return null;

  const timePart = String.raw`(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?`;
  const endOfInput = strict24Hour ? '$' : '';

  let match = raw.match(new RegExp(
    String.raw`^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})${timePart}${endOfInput}`,
  ));
  if (match) {
    const [, d, mo, y, h = '0', mi = '0', sec = '0'] = match;
    if (strict24Hour && match[4] !== undefined
      && (Number(h) > 23 || Number(mi) > 59 || Number(sec) > 59)) return null;
    const year = Number(y);
    if (year < 1971) return null;
    const dt = new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  match = raw.match(new RegExp(
    String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})${timePart}${endOfInput}`,
  ));
  if (match) {
    const [, y, mo, d, h = '0', mi = '0', sec = '0'] = match;
    if (strict24Hour && match[4] !== undefined
      && (Number(h) > 23 || Number(mi) > 59 || Number(sec) > 59)) return null;
    const year = Number(y);
    if (year < 1971) return null;
    const dt = new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

export function formatHeading(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDmy(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  if (date.getFullYear() < 1971) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDmyTime(date) {
  const base = formatDmy(date);
  if (!base) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${base} ${hh}:${mi}`;
}

export function toDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Authoritative blur/typed-commit decision. Display restore must use this same
 * committed string — never Flatpickr's date-only rewrite.
 *
 * enableTime + Flatpickr dateFormat often leave the input as dd-mm-yyyy after
 * blur. If that date matches the committed day, keep the committed HH:mm
 * instead of inventing midnight (which would corrupt submitted values).
 */
export function resolveTypedCommit(raw, {
  committed = '',
  enableTime = false,
  allowClear = true,
  strict24Hour = false,
} = {}) {
  const cleaned = sanitizeValue(raw);
  const committedClean = sanitizeValue(committed);

  if (!cleaned) {
    if (!allowClear && committedClean) {
      return { kind: 'restore', value: committedClean };
    }
    return { kind: 'clear', value: '' };
  }

  const parsed = parseFlexibleDate(cleaned, strict24Hour);
  if (!parsed) {
    return { kind: 'restore', value: committedClean };
  }

  if (!enableTime) {
    parsed.setHours(0, 0, 0, 0);
    return { kind: 'commit', value: formatDmy(parsed) };
  }

  const rawHasTime = /\d{1,2}:\d{2}/.test(cleaned);
  if (!rawHasTime && committedClean) {
    const committedParsed = parseFlexibleDate(committedClean, strict24Hour);
    if (committedParsed && formatDmy(parsed) === formatDmy(committedParsed)) {
      return { kind: 'restore', value: committedClean };
    }
  }

  return { kind: 'commit', value: formatDmyTime(parsed) };
}

/**
 * enableTime picker close: discard pending hour/minute drafts.
 * Never promote drafts into the committed value or onChange payload.
 */
export function resolveTimePickerClose(committed) {
  return { kind: 'restore', value: sanitizeValue(committed) };
}

/**
 * Sync Flatpickr selection + input from a committed string.
 * Calendar stays date-only; input keeps the full committed text (incl. HH:mm).
 */
export function applyCommittedValue(fp, raw, strict24Hour = false) {
  if (!fp) return;
  const next = sanitizeValue(raw);
  try {
    if (!next) {
      fp.clear(false);
      if (fp.input) fp.input.value = '';
      return;
    }
    const parsed = parseFlexibleDate(next, strict24Hour);
    if (parsed) {
      const dateOnly = toDateOnly(parsed);
      fp.setDate(dateOnly, false);
    }
    if (fp.input) fp.input.value = next;
  } catch {
    if (fp.input) fp.input.value = next;
  }
}
