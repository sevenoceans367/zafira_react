/**
 * Tanker Laytime layout gate (NAK-166).
 *
 * Prefer vessel estimate type (Fun158 / ESTIMATE_TYPE). Contract fixtureTypeId is
 * NOT a substitute — Gas (1) also uses hours rateUnit, so hours alone must never
 * unlock the Tanker redesign. Unknown / missing type keeps the existing layout.
 */

export const LAYTIME_TANKER_PAGE_SIZE = 5;

/** True only for Tanker estimate type 2. Never defaults unknown → Tanker. */
export function usesTankerLaytimeLayout(estimateType) {
  return Number(estimateType) === 2;
}

/** Resolve estimate type from laytime form payload without inventing defaults. */
export function resolveLaytimeEstimateType(form) {
  if (!form) return null;
  if (form.estimateType != null && form.estimateType !== '') {
    const n = Number(form.estimateType);
    return Number.isFinite(n) ? n : null;
  }
  const nested = form.vesselParticulars?.estimateType;
  if (nested != null && nested !== '') {
    const n = Number(nested);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function emptyNegoRow() {
  return {
    entity: 'Charterer',
    date: '',
    reason: '',
    agreedDemm: '',
    status: 'On Hold',
    notes: '',
  };
}

export function parseMoneyInput(value) {
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Visual-only nego total (all statuses) — do not wire into financial save fields. */
export function sumNegoAgreedDemm(rows = []) {
  return (rows || []).reduce((sum, row) => sum + parseMoneyInput(row.agreedDemm), 0);
}

/** Always show two decimal places for calculated demurrage USD (pill + expanded). */
export function formatMoneyDisplay(n) {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function filterRowsByQuery(rows, query, fields) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return (rows || []).map((row, index) => ({ row, index }));
  return (rows || [])
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => fields.some((field) => String(row?.[field] ?? '').toLowerCase().includes(q)));
}

/**
 * Activity LT toggle for Laytime drafts (ltCounts / ltNoCounts).
 * C → counts + partial 100 (when empty/0); NC → no-count + partial 0.
 */
export function applyLaytimeActivityLtToggle(row = {}, counting = true) {
  if (counting) {
    const partial = String(row.ltPartial ?? '').trim();
    const nextPartial = partial === '' || partial === '0' ? '100' : partial;
    return {
      ...row,
      ltCounts: true,
      ltNoCounts: false,
      ltPartial: nextPartial,
    };
  }
  return {
    ...row,
    ltCounts: false,
    ltNoCounts: true,
    ltPartial: '0',
  };
}

export function isLaytimeActivityCounting(row = {}) {
  if (row.ltCounts === true || row.ltCounts === 1 || row.ltCounts === '1') return true;
  if (row.ltNoCounts === true || row.ltNoCounts === 1 || row.ltNoCounts === '1') return false;
  // SOF-synced unset: treat as non-counting until user sets C (preserve blank partial).
  if (row.sofLoadPortId) return false;
  return true;
}

/**
 * Tanker QTY edit patch flags (Legacy Fun158==2).
 * Recompute financials from existing allowance; do NOT refreshAllowed from qty/rate.
 */
export function tankerLoadedQtyPatchOptions() {
  return { recompute: true, refreshAllowed: false };
}

/** Nego Dialogues are gated out of production Tanker UI (no editable table). */
export function isTankerNegoUiEnabled() {
  return false;
}
