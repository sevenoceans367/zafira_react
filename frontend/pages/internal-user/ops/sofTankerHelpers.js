export const SOF_ROW_SIZE_OPTIONS = [5, 10, 25];
export const DEFAULT_SOF_ROW_SIZE = 5;

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
    notes: '',
  };
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
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', min = '0'] = match;
  const year = Number(yyyy);
  if (year < 1971) return null;
  const dt = new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(min));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Hours between two display datetimes, formatted to 1 decimal matching the SOF mockup. */
export function computeActivityDurationHours(from, to) {
  const sd = parseDisplayDateTime(from);
  const fd = parseDisplayDateTime(to);
  if (!sd || !fd) return '';
  const hrs = (fd.getTime() - sd.getTime()) / 3600000;
  return (hrs >= 0 ? hrs : 0).toFixed(1);
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
  const portActivities = (port.portActivities?.length ? port.portActivities : [emptyPortActivityRow()])
    .map((row) => ({
      activity: row.activity || '',
      from: row.from || '',
      to: row.to || '',
      duration: row.duration || computeActivityDurationHours(row.from, row.to),
      notes: row.notes || '',
    }));

  return {
    terminal: port.terminal || '',
    agentRemarks: port.agentRemarks || '',
    keyOperations: (port.keyOperations || []).map((row) => ({ ...row })),
    cargoRows: (port.cargoRows || []).map((row) => ({ ...row })),
    portActivities,
    entityRows: (port.entityRows || []).map((row) => ({ ...row })),
    blRows: (port.blRows || []).map((row) => ({ ...row })),
    preArrival: port.preArrival && typeof port.preArrival === 'object' ? { ...port.preArrival } : null,
    dailyQty: (port.dailyQty || []).map((row) => ({ ...row })),
    keepFiles: [...(port.uploads || [])],
  };
}

/**
 * Build the complete saveSof payload so no existing SOF collections or remarks are lost on save.
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
    portActivities: draft.portActivities,
    entityRows: draft.entityRows,
    blRows: draft.blRows,
    dailyQty: draft.dailyQty,
    keepFiles: draft.keepFiles,
  };
  if (draft.preArrival && typeof draft.preArrival === 'object') {
    payload.preArrival = draft.preArrival;
  }
  return payload;
}
