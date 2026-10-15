/**
 * Persist Tanker / Gas / Dry (selBType) across navigation.
 * URL wins when present; otherwise restore the last choice for the given key.
 */

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

/** @param {URLSearchParams} searchParams @param {string} storageKey @param {string} [defaultValue='2'] */
export function readBusinessType(searchParams, storageKey, defaultValue = '2') {
  const fromUrl = searchParams?.get?.('selBType');
  if (fromUrl) {
    writeStored(storageKey, fromUrl);
    return fromUrl;
  }
  return readStored(storageKey) || defaultValue;
}

/** @param {string} storageKey @param {string|null|undefined} value */
export function rememberBusinessType(storageKey, value) {
  writeStored(storageKey, value);
}

export const BUSINESS_TYPE_KEYS = {
  sopf: 'sopf.selBType',
  opsVc: 'opsVc.selBType',
  opsTc: 'opsTc.selBType',
  tc: 'tc.selBType',
  coa: 'coa.selBType',
  fleet: 'fleet.selBType',
  cargoRelet: 'cargoRelet.selBType',
  periodContract: 'periodContract.selBType',
  genericFinances: 'genericFinances.selBType',
  vcDashboard: 'vcDashboard.selBType',
  liveVesselMap: 'liveVesselMap.selBType',
};
