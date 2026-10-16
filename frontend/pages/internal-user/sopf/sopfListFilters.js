/** Spot Business Tanker / Gas / Dry. Shared app-wide via businessTypeSession. */

import {
  BUSINESS_TYPE_KEYS,
  readBusinessType,
  rememberBusinessType,
} from '../../../utils/businessTypeSession.js';

/** Gas=1, Tanker=2, Dry Cargo=3 — legacy PHP default is Tanker */
export const DEFAULT_SOPF_BUSINESS_TYPE = '2';

export function readSopfBusinessType(searchParams) {
  return readBusinessType(searchParams, BUSINESS_TYPE_KEYS.sopf, DEFAULT_SOPF_BUSINESS_TYPE);
}

export function rememberSopfBusinessType(value) {
  rememberBusinessType(BUSINESS_TYPE_KEYS.sopf, value);
}
