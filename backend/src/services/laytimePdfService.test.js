import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePdfActivityTimeUsed } from './laytimePdfService.js';

describe('PDF activity time used', () => {
  it('counts NC and explicit zero percent as zero', () => {
    assert.equal(computePdfActivityTimeUsed({ duration: '4', ltCounts: false, ltNoCounts: true }, { isDays: false }), 0);
    assert.equal(computePdfActivityTimeUsed({ duration: '4', ltCounts: true, ltPartial: '0' }, { isDays: false }), 0);
    assert.equal(computePdfActivityTimeUsed({ duration: '4', ltCounts: true, ltPartial: '50' }, { isDays: false }), 2);
  });

  it('treats a blank partial as zero for a Dry form when the port has no rate unit', () => {
    const form = { rateUnit: 'days' };
    const port = {};
    assert.equal(computePdfActivityTimeUsed(
      { duration: '24', ltCounts: true, ltPartial: '' },
      { isDays: (port.rateUnit || form.rateUnit) === 'days' },
    ), 0);
  });
});
