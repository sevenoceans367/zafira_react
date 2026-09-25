const BUSINESS_TYPE_KEY = 'opsVc.selBType';

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

/** Spot Ops Tanker / Gas / Dry. URL wins; otherwise restore the last choice after Back. */
export function readOpsVcBusinessType(searchParams) {
  const fromUrl = searchParams.get('selBType');
  if (fromUrl) {
    writeStored(BUSINESS_TYPE_KEY, fromUrl);
    return fromUrl;
  }
  return readStored(BUSINESS_TYPE_KEY) || '2';
}

export function rememberOpsVcBusinessType(value) {
  writeStored(BUSINESS_TYPE_KEY, value);
}
