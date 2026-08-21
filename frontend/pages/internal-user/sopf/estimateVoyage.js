/**
 * Voyage + estimate-number helpers.
 * Display format: 26001-Est1, 26001-Est2, …
 */

export function normalizeEstimateNo(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function formatVoyageEstimateLabel(voyageNo, estimateNo) {
  const voyage = String(voyageNo || '').trim();
  if (!voyage) return '';
  const est = normalizeEstimateNo(estimateNo);
  return `${voyage}-Est${est}`;
}

/** Parse "26001-Est2" → { voyageNo: "26001", estimateNo: 2 }. Plain voyage → Est1. */
export function parseVoyageEstimateLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return { voyageNo: '', estimateNo: 1 };
  const match = raw.match(/^(.*?)-Est(\d+)$/i);
  if (match) {
    return {
      voyageNo: match[1].trim(),
      estimateNo: normalizeEstimateNo(match[2]),
    };
  }
  return { voyageNo: raw, estimateNo: 1 };
}
