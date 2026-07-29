/**
 * Dev-only Add Estimate prefill (`?testdata=1`).
 * Source snapshot: updateestimate?id=44&estimatetype=2 (GISELE voyage).
 */

import fixture from './addEstimateTestData.fixture.json';
import { toFormState } from './estimateDetail.constants.js';

/** Raw detail snapshot (estimate id 44), with voyage renamed for add. */
export const ADD_ESTIMATE_TEST_DETAIL = fixture;

/**
 * Build a full Add Estimate form from the estimate-44 fixture.
 * Caller should run applyEstimateCalculations() on the result.
 */
export function buildAddEstimateTestForm(baseForm = {}, _lookups = {}) {
  const form = toFormState(ADD_ESTIMATE_TEST_DETAIL);
  return {
    ...form,
    // Keep page estimate type if URL differs; fixture is tanker (2).
    estimateType: Number(baseForm.estimateType) || form.estimateType || 2,
    periodId: baseForm.periodId || form.periodId || '',
    attachments: [],
    attachmentFiles: [],
  };
}
