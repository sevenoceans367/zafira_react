/**
 * Legacy getFun158() unit contract for LAYTIME_ALLOWED / LOADED_RATE:
 *   1 | 2 → hours (divider=1)
 *   3     → days  (divider=24)
 * Unknown estimateType → null (fail closed: do not interpret stored allowance).
 *
 * Release gate (owner-accepted, separate from this helper): historical records
 * written under a prior Zafira day-mode Tanker UI are not auto-detected or ×24
 * converted here. Prove Legacy-hour origin in deployment, or migrate/withhold
 * confirmed day-origin rows before production rollout.
 */
export function laytimeRateUnitFromEstimateType(estimateType) {
  const n = Number(estimateType);
  if (n === 1 || n === 2) return 'hours';
  if (n === 3) return 'days';
  return null;
}
