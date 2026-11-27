import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePdfActivityTimeUsed, draftLaytimePdfPort } from './laytimePdfService.js';

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

it('uses synced rows for a draft PDF and keeps closed and classic reports on stored totals', () => {
  const port = {
    norTendered: '01-01-2026 00:00', loadCommenced: '01-01-2026 01:00', loadCompleted: '01-01-2026 04:00',
    laytimeAllowed: '1', demurrageRate: '24000', actualLaytime: '2.0000', ttlDemurrage: '1000.00',
    activities: [{ activity: 'Loading', duration: '3', ltCounts: true, ltPartial: '100' }], deductions: [],
  };
  const draft = draftLaytimePdfPort(port, 2);
  assert.equal(draft.draftSummary, true);
  assert.equal(draft.actualLaytime, '3.0000');
  assert.equal(draft.ttlDemurrage, '2000.00');
  assert.equal(port.ttlDemurrage, '1000.00');
  assert.equal(draftLaytimePdfPort(port, 1), port);
  const closed = { ...port, locked: true };
  assert.equal(draftLaytimePdfPort(closed, 2), closed);
  const deductions = [{ activity: 'Weather', duration: '3', ltPartial: '100' }];
  const unresolved = draftLaytimePdfPort({ ...port, deductions }, 2);
  assert.match(unresolved.calculationNote, /contractual treatment/);
  assert.equal(unresolved.ttlDemurrage, '');
});
