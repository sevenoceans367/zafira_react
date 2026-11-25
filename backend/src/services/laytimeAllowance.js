/**
 * Shared contractual laytime allowance resolution for SOF + Laytime.
 *
 * Legacy (Zafira pin 93c44b4 dryout/laytime_calculation.php):
 * - Voyage TIMEALLOWED via getFun285() seeds $la when no matching laytime_master.
 * - TP ports are excluded from laytime tabs / contractual allowance.
 * - Saved LAYTIME_ALLOWED overrides the estimate seed when present.
 * - Estimate UI labels TIMEALLOWED as "Time Allowed (hrs)".
 *
 * Intentional modern deviations:
 * - Do not coalesce WORKING_DAYS into contractual allowance (voyage days ≠ laytime hours).
 * - Explicit numeric zero is a saved override (Legacy PHP treats bare "0" as falsy).
 * - Incomplete masters with blank LAYTIME_ALLOWED still fall back to TIMEALLOWED
 *   (Legacy $la used ACTUAL_LAYTIME and could blank the estimate seed).
 */

function trimAllowance(value) {
  if (value == null) return '';
  return String(value).trim();
}

/** True when a saved LAYTIME_ALLOWED is present, including explicit numeric zero. */
export function isExplicitLaytimeAllowance(value) {
  const raw = trimAllowance(value);
  if (raw === '') return false;
  return Number.isFinite(Number(raw));
}

/**
 * Contractual estimate seed is TIMEALLOWED only.
 * Never promote WORKING_DAYS (e.g. ANTARES-like 3.500 voyage days).
 */
export function normalizeEstimateTimeAllowed(masterOrValue) {
  if (masterOrValue == null) return '';
  if (typeof masterOrValue !== 'object') return trimAllowance(masterOrValue);
  return trimAllowance(masterOrValue.TIMEALLOWED);
}

/**
 * Resolve the contractual allowance shown/used for a port.
 *
 * @returns {{ value: string, source: 'laytime_master'|'estimate_timeallowed'|'transit'|'unknown' }}
 */
export function resolveContractualLaytimeAllowance({
  portType,
  savedLaytimeAllowed,
  estimateTimeAllowed,
} = {}) {
  const type = String(portType || '').toUpperCase();
  if (type === 'TP') {
    return { value: '', source: 'transit' };
  }

  if (isExplicitLaytimeAllowance(savedLaytimeAllowed)) {
    return { value: trimAllowance(savedLaytimeAllowed), source: 'laytime_master' };
  }

  const estimate = normalizeEstimateTimeAllowed(estimateTimeAllowed);
  if (estimate !== '') {
    return { value: estimate, source: 'estimate_timeallowed' };
  }

  return { value: '', source: 'unknown' };
}
