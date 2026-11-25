import { recomputePortDraft } from './laytimeCalculations.js';

export const SOF_ROW_SIZE_OPTIONS = [5, 10, 25];
export const DEFAULT_SOF_ROW_SIZE = 5;

/** Dry Key Operations presets — mirrors backend DEFAULT_KEY_OPERATIONS_DRY order/labels. */
export const DEFAULT_KEY_OPERATIONS_DRY = [
  'EOSP',
  'Arrived',
  'Anchored / Commenced Drifting',
  'NOR tendered',
  'Anchor aweigh',
  'Pilot on board',
  'First line',
  'All fast',
  'Gangway ashore',
  'Commenced draft survey',
  'Completed draft survey',
  'Commenced cargo operations',
  'Completed cargo operations',
  'Commenced draft survey',
  'Completed draft survey',
  'Completed cargo calculation',
  'Cargo samples taken',
  'Cargo docs onboard',
  'Pilot on board',
  'All clear',
  'Pilot away',
  'FAOP',
];

/** Redesigned OpsVcSofPage layout: Tanker (2) + Dry (3). Gas (1) stays on legacy. */
export function usesRedesignedSofLayout(estimateType) {
  const type = Number(estimateType);
  return type === 2 || type === 3;
}

export function isDrySofEstimate(estimateType) {
  return Number(estimateType) === 3;
}

/** Read-only Identifiers display; blank worksheet values render as an em dash. */
export function displaySofReadonlyValue(value) {
  const raw = String(value ?? '').trim();
  return raw || '—';
}

export function displaySofDraftPair(fore, aft) {
  const f = String(fore ?? '').trim();
  const a = String(aft ?? '').trim();
  if (!f && !a) return '—';
  return `${f || '—'} / ${a || '—'}`;
}

/** Preserve intentional blank cumulative; only default when the value is missing. */
export function coalesceActivityCumulative(computed) {
  if (computed === '') return '';
  return computed ?? '0.0000';
}

const CANONICAL_CARGO_LOADED = 'Cargo Loaded';
const CANONICAL_LOP_ISSUED = 'Lop Issued (Pls specify)';
const CANONICAL_LOP_RECEIVED = 'Lop received (Pls Specify)';

export function emptyKeyOp() {
  return {
    activity: '',
    activityDateTime: '',
    activityDateTimeTo: '',
    robIfo: '',
    robMdo: '',
    comments: '',
    tDefault: 0,
  };
}

export function isBlankKeyOp(row) {
  return Number(row?.tDefault) !== 1 && !String(row?.activity || '').trim();
}

export function emptyPortActivityRow() {
  return {
    activity: '',
    from: '',
    to: '',
    duration: '',
    // Default LT(C): counts toward laytime (Legacy mutual C/NC).
    layTimeCount: true,
    portTimeCount: false,
    ltPartial: '100',
    cumulative: '',
    laytimeActivityId: '',
    notes: '',
  };
}

/**
 * Mutual LT(C) / LT(NC) toggle — mirrors Legacy iCheck exclusivity.
 * counts=true  → LT(C), partial defaults to 100 when empty/0
 * counts=false → LT(NC), partial forced to 0 (non-counting)
 */
export function applyLtCountToggle(row = {}, counts = true) {
  if (counts) {
    const partial = String(row.ltPartial ?? '').trim();
    const nextPartial = partial === '' || partial === '0' ? '100' : partial;
    return {
      ...row,
      layTimeCount: true,
      portTimeCount: false,
      ltPartial: nextPartial,
    };
  }
  return {
    ...row,
    layTimeCount: false,
    portTimeCount: true,
    ltPartial: '0',
  };
}

/** Toggle ON when LT(C) is set. */
export function isLtCounting(row = {}) {
  return row.layTimeCount === true || Number(row.layTimeCount) === 1;
}

/** True when From/To are both set (SOF Duration is derived from the range). */
export function hasActivityTimeRange(row = {}) {
  return Boolean(String(row.from || '').trim() && String(row.to || '').trim());
}

/**
 * Recompute SOF Activity cumulative hours from Laytime remaining-allowance math.
 * Incomplete rows (no From/To) stay blank and do not enter the running sum —
 * otherwise empty LT(C) rows would show Laytime Allowed (e.g. 108.0000).
 */
export function recomputeSofActivityRows(port, rows = []) {
  const timed = rows.map((row) => hasActivityTimeRange(row));
  const rateUnit = port?.rateUnit === 'days' ? 'days' : 'hours';
  const calculation = recomputePortDraft({
    laytimeAllowed: port?.laytimeAllowed || '',
    activities: rows.map((row, index) => ({
      activity: row.activity,
      start: '',
      end: '',
      duration: timed[index] ? row.duration : '',
      ltCounts: Boolean(row.layTimeCount) && timed[index],
      ltNoCounts: Boolean(row.portTimeCount),
      ltPartial: row.ltPartial,
      notes: row.notes,
    })),
    deductions: [],
  }, rateUnit);

  return rows.map((row, rowIndex) => ({
    ...row,
    // Do not coerce intentional blank (unknown allowance) to '0.0000'.
    cumulative: timed[rowIndex]
      ? coalesceActivityCumulative(calculation.activities[rowIndex]?.cumulative)
      : '',
  }));
}

/**
 * Display value for Cumulative Duration (Hrs).
 * Accepts an activity row (preferred) or a raw cumulative string.
 */
export function displayActivityCumulative(rowOrValue = {}) {
  if (rowOrValue != null && typeof rowOrValue === 'object') {
    if (!hasActivityTimeRange(rowOrValue)) return '—';
    if (rowOrValue.cumulative === '' || rowOrValue.cumulative == null) return '—';
    return String(rowOrValue.cumulative);
  }
  if (rowOrValue === '' || rowOrValue == null) return '—';
  return String(rowOrValue);
}

export function isValidLtPartialPercent(value) {
  if (value == null || String(value).trim() === '') return true;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100;
}

export function emptyDeductionRow() {
  return {
    activity: '',
    start: '',
    end: '',
    duration: '',
    ltPartial: '100',
    cumulative: '',
    notes: '',
  };
}

/** Meaningful Activity content — flags/partial alone are not enough to persist. */
export function isMeaningfulActivityRow(row = {}) {
  return Boolean(
    String(row.activity || '').trim()
    || String(row.from || '').trim()
    || String(row.to || '').trim()
    || String(row.notes || '').trim(),
  );
}

function normalizeActivityForSave(row = {}) {
  return [
    String(row.activity || ''),
    String(row.from || ''),
    String(row.to || ''),
    row.layTimeCount === true || Number(row.layTimeCount) === 1,
    row.portTimeCount === true || Number(row.portTimeCount) === 1,
    String(row.ltPartial ?? ''),
    String(row.notes || ''),
  ];
}

function normalizeDeductionForSave(row = {}) {
  return [
    String(row.laytimeDeductionId || ''),
    String(row.activity || ''),
    String(row.start || ''),
    String(row.end || ''),
    String(row.ltPartial ?? ''),
    String(row.notes || ''),
  ];
}

function activityRowsForSave(rows = []) {
  return rows.filter(isMeaningfulActivityRow);
}

function deductionRowsForComparison(rows = []) {
  return rows.filter((row) => (
    row.laytimeDeductionId
    || String(row.activity || '').trim()
    || String(row.start || '').trim()
    || String(row.end || '').trim()
    || String(row.notes || '').trim()
  ));
}

export function insertDeductionRowAfter(rows = [], index = -1) {
  if (!rows.length) return [emptyDeductionRow(), emptyDeductionRow()];
  const next = [...rows];
  next.splice(index + 1, 0, emptyDeductionRow());
  return next;
}

export function removeDeductionRowAt(rows = [], index = -1) {
  const next = rows.filter((_, rowIndex) => rowIndex !== index);
  return next;
}

export function paginateRows(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    totalPages,
    safePage,
  };
}

export function pageForIndex(index, pageSize) {
  return Math.max(1, Math.floor(index / pageSize) + 1);
}

/** Parse dd-mm-yyyy or dd-mm-yyyy HH:MM display strings into a local Date. */
export function parseDisplayDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', min = '0'] = match;
  const year = Number(yyyy);
  const day = Number(dd);
  const month = Number(mm);
  const hour = Number(hh);
  const minute = Number(min);
  if (year < 1971 || month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const dt = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getFullYear() === year
    && dt.getMonth() === month - 1
    && dt.getDate() === day
    ? dt
    : null;
}

/** Hours between two display datetimes, formatted to 1 decimal matching the SOF mockup. */
export function computeActivityDurationHours(from, to) {
  const sd = parseDisplayDateTime(from);
  const fd = parseDisplayDateTime(to);
  if (!sd || !fd) return '';
  const hrs = (fd.getTime() - sd.getTime()) / 3600000;
  return hrs >= 0 ? hrs.toFixed(1) : '';
}

/**
 * Decimal-day duration for Dry SOF Activity/Deductions (hours/24).
 * Uses 4dp to match Dry laytime day semantics / deduction totals.
 * Stored duration remains hours for Laytime sync; this is the Days display/update value.
 */
export function computeActivityDurationDays(from, to) {
  const sd = parseDisplayDateTime(from);
  const fd = parseDisplayDateTime(to);
  if (!sd || !fd) return '';
  const hrs = (fd.getTime() - sd.getTime()) / 3600000;
  if (hrs < 0) return '';
  return (hrs / 24).toFixed(4);
}

/** Convert a stored hour duration string to Days (4dp) for Dry display/totals. */
export function hoursDurationToDays(durationHours) {
  const raw = String(durationHours ?? '').trim();
  if (!raw || raw === '—') return '';
  const hrs = Number(raw);
  if (!Number.isFinite(hrs) || hrs < 0) return '';
  return (hrs / 24).toFixed(4);
}

function isCargoLoadedRow(row) {
  const name = String(row?.activity || '').trim().toLowerCase();
  return name === 'cargo loaded' || name === 'cargo discharged';
}

function isLopIssuedRow(row) {
  return String(row?.activity || '').trim().toLowerCase().startsWith('lop issued');
}

function isLopReceivedRow(row) {
  return String(row?.activity || '').trim().toLowerCase().startsWith('lop received');
}

/**
 * Extract the 4 Cargo card values from canonical sof_slave_7 cargoRows
 * without discarding any other cargo/figures rows (bunkers, tugs, drafts, remarks, custom).
 */
export function getCargoCardValues(cargoRows = []) {
  const rows = Array.isArray(cargoRows) ? cargoRows : [];
  const cargoRow = rows.find(isCargoLoadedRow);
  const lopIssuedRow = rows.find(isLopIssuedRow);
  const lopReceivedRow = rows.find(isLopReceivedRow);
  return {
    shipFigure: cargoRow?.shipFigure ?? '',
    blFigure: cargoRow?.blFigure ?? '',
    lopIssued: lopIssuedRow?.remarks ?? '',
    lopReceived: lopReceivedRow?.remarks ?? '',
  };
}

/**
 * Immutably update one of the 4 Cargo card fields inside canonical cargoRows,
 * preserving every other row and field in sof_slave_7.
 */
export function patchCargoCardField(cargoRows = [], field, value) {
  const rows = Array.isArray(cargoRows) ? cargoRows.map((row) => ({ ...row })) : [];
  const nextVal = String(value ?? '');

  if (field === 'shipFigure' || field === 'blFigure') {
    const idx = rows.findIndex(isCargoLoadedRow);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], [field]: nextVal };
    } else {
      rows.push({
        activity: CANONICAL_CARGO_LOADED,
        shipFigure: field === 'shipFigure' ? nextVal : '',
        blFigure: field === 'blFigure' ? nextVal : '',
        waterDensity: '',
        remarks: '',
        tDefault: 1,
      });
    }
    return rows;
  }

  if (field === 'lopIssued') {
    const idx = rows.findIndex(isLopIssuedRow);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], remarks: nextVal };
    } else {
      rows.push({
        activity: CANONICAL_LOP_ISSUED,
        shipFigure: '',
        blFigure: '',
        waterDensity: '',
        remarks: nextVal,
        tDefault: 1,
      });
    }
    return rows;
  }

  if (field === 'lopReceived') {
    const idx = rows.findIndex(isLopReceivedRow);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], remarks: nextVal };
    } else {
      rows.push({
        activity: CANONICAL_LOP_RECEIVED,
        shipFigure: '',
        blFigure: '',
        waterDensity: '',
        remarks: nextVal,
        tDefault: 1,
      });
    }
    return rows;
  }

  return rows;
}

export function displayStoredFileName(stored) {
  const raw = String(stored || '').trim();
  const match = raw.match(/^\d+_(.+)$/);
  return match ? match[1] : raw;
}

/**
 * Snapshot a port record into per-tab draft state while preserving all backend collections
 * (entityRows, blRows, portActivities, preArrival, dailyQty, cargoRows, keyOperations, agentRemarks).
 */
export function draftFromPort(port = {}) {
  // Duration stays in hours for Laytime sync (recomputePortDraft divider math).
  // Dry UI converts to Days for display via computeActivityDurationDays / hoursDurationToDays.
  // New placeholder rows use emptyPortActivityRow() defaults (C/100).
  // Loaded rows keep stored flags/partial — do not silently rewrite C/0% or neither.
  const portActivities = (port.portActivities?.length ? port.portActivities : [emptyPortActivityRow()])
    .map((row) => ({
      activity: row.activity || '',
      from: row.from || '',
      to: row.to || '',
      duration: row.duration || computeActivityDurationHours(row.from, row.to),
      layTimeCount: row.layTimeCount === true || Number(row.layTimeCount) === 1,
      portTimeCount: row.portTimeCount === true || Number(row.portTimeCount) === 1,
      ltPartial: row.ltPartial == null ? '' : String(row.ltPartial),
      cumulative: row.cumulative || '',
      laytimeActivityId: row.laytimeActivityId || '',
      notes: row.notes || '',
    }));

  return {
    terminal: port.terminal || '',
    agentRemarks: port.agentRemarks || '',
    keyOperations: (port.keyOperations || []).map((row) => ({ ...row })),
    cargoRows: (port.cargoRows || []).map((row) => ({ ...row })),
    portActivities,
    deductions: (port.deductions || []).map((row) => ({ ...row })),
    entityRows: (port.entityRows || []).map((row) => ({ ...row })),
    blRows: (port.blRows || []).map((row) => ({ ...row })),
    preArrival: port.preArrival && typeof port.preArrival === 'object' ? { ...port.preArrival } : null,
    dailyQty: (port.dailyQty || []).map((row) => ({ ...row })),
    keepFiles: [...(port.uploads || [])],
  };
}

/**
 * Visible Activity/Deduction duration for the redesigned SOF.
 * Dry shows decimal Days; Tanker keeps Hours. Storage remains hours either way.
 */
export function displaySofDuration(row = {}, { fromKey = 'from', toKey = 'to', isDry = false } = {}) {
  const from = row[fromKey];
  const to = row[toKey];
  if (!String(from || '').trim() || !String(to || '').trim()) return '—';
  if (isDry) {
    const days = computeActivityDurationDays(from, to)
      || hoursDurationToDays(row.duration);
    return days || '—';
  }
  return row.duration || computeActivityDurationHours(from, to) || '—';
}

/**
 * Include only collections this layout owns. The API preserves omitted collections,
 * which avoids replacing fields this screen does not display or edit.
 */
export function buildSofSavePayload({ comId, activePort, draft, submitId }) {
  const payload = {
    comId,
    portType: activePort.portType,
    portId: activePort.portId,
    randomId: activePort.randomId,
    submitId,
    terminal: draft.terminal,
    agentRemarks: draft.agentRemarks,
    keyOperations: draft.keyOperations,
    cargoRows: draft.cargoRows,
    keepFiles: draft.keepFiles,
  };
  if (!activePort.laytimeLocked) {
    const originalActivities = activePort.portActivities || [];
    const currentActivities = draft.portActivities || [];
    if (JSON.stringify(activityRowsForSave(originalActivities).map(normalizeActivityForSave))
      !== JSON.stringify(activityRowsForSave(currentActivities).map(normalizeActivityForSave))) {
      // Persist only meaningful rows; synthetic C/100 placeholders stay out of the payload.
      payload.portActivities = activityRowsForSave(currentActivities);
      if (activePort.laytimeActivityVersion) {
        payload.expectedLaytimeActivityVersion = activePort.laytimeActivityVersion;
      }
    }

    const originalDeductions = activePort.deductions || [];
    const currentDeductions = draft.deductions || [];
    if (JSON.stringify(deductionRowsForComparison(originalDeductions).map(normalizeDeductionForSave))
      !== JSON.stringify(deductionRowsForComparison(currentDeductions).map(normalizeDeductionForSave))) {
      payload.deductions = currentDeductions;
      if (activePort.laytimeDeductionVersion) {
        payload.expectedLaytimeDeductionVersion = activePort.laytimeDeductionVersion;
      }
    }
  }
  return payload;
}
