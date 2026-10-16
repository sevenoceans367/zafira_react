/**
 * Persist Tanker / Gas / Dry (selBType) globally across the app.
 * URL wins when present (and canonical values update the global store);
 * otherwise restore the shared last choice.
 *
 * Gas=1, Tanker=2, Dry Cargo=3
 */

const GLOBAL_KEY = 'zafira.selBType';

/** Older per-module keys — read once for migration, then prefer GLOBAL_KEY. */
const LEGACY_KEYS = [
  'sopf.selBType',
  'opsVc.selBType',
  'opsTc.selBType',
  'tc.selBType',
  'coa.selBType',
  'fleet.selBType',
  'cargoRelet.selBType',
  'periodContract.selBType',
  'genericFinances.selBType',
  'vcDashboard.selBType',
  'liveVesselMap.selBType',
];

/** Canonical Dry / Tanker / Gas ids only (not "all" or empty). */
function isCanonicalBusinessType(value) {
  return value === '1' || value === '2' || value === '3';
}

function readStored(key) {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStored(key, value) {
  try {
    if (value == null || value === '') sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {
    // Ignore private-mode storage failures.
  }
}

function readGlobalBusinessType() {
  const global = readStored(GLOBAL_KEY);
  if (isCanonicalBusinessType(global)) return global;

  for (const key of LEGACY_KEYS) {
    const legacy = readStored(key);
    if (isCanonicalBusinessType(legacy)) {
      writeStored(GLOBAL_KEY, legacy);
      return legacy;
    }
  }
  return '';
}

/**
 * @param {URLSearchParams} searchParams
 * @param {string} [_storageKey] unused — kept for call-site compatibility
 * @param {string} [defaultValue='2']
 */
export function readBusinessType(searchParams, _storageKey, defaultValue = '2') {
  const fromUrl = searchParams?.get?.('selBType');
  if (fromUrl) {
    if (isCanonicalBusinessType(fromUrl)) writeStored(GLOBAL_KEY, fromUrl);
    return fromUrl;
  }
  return readGlobalBusinessType() || defaultValue;
}

/**
 * @param {string} [_storageKey] unused — kept for call-site compatibility
 * @param {string|null|undefined} value
 */
export function rememberBusinessType(_storageKey, value) {
  const next = value == null ? '' : String(value);
  // Only Dry / Tanker / Gas update the shared app selection.
  // Page-local values like "all" must not overwrite it.
  if (isCanonicalBusinessType(next)) writeStored(GLOBAL_KEY, next);
}

/** @deprecated Keys are ignored; storage is global. Kept so existing imports keep working. */
export const BUSINESS_TYPE_KEYS = {
  sopf: GLOBAL_KEY,
  opsVc: GLOBAL_KEY,
  opsTc: GLOBAL_KEY,
  tc: GLOBAL_KEY,
  coa: GLOBAL_KEY,
  fleet: GLOBAL_KEY,
  cargoRelet: GLOBAL_KEY,
  periodContract: GLOBAL_KEY,
  genericFinances: GLOBAL_KEY,
  vcDashboard: GLOBAL_KEY,
  liveVesselMap: GLOBAL_KEY,
};
