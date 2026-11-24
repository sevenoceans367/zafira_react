/**
 * Legacy getFun158() unit contract for LAYTIME_ALLOWED / LOADED_RATE:
 *   1 | 2 → hours (divider=1)
 *   3     → days  (divider=24)
 * Unknown estimateType → null (fail closed: do not interpret stored allowance).
 */
export function laytimeRateUnitFromEstimateType(estimateType) {
  const n = Number(estimateType);
  if (n === 1 || n === 2) return 'hours';
  if (n === 3) return 'days';
  return null;
}
