import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyLaytimeActivityLtToggle,
  isLaytimeActivityCounting,
  resolveLaytimeEstimateType,
  sumNegoAgreedDemm,
  usesTankerLaytimeLayout,
} from './laytimeTankerHelpers.js';

describe('laytimeTankerHelpers gate', () => {
  it('unlocks Tanker layout only for estimate type 2', () => {
    assert.equal(usesTankerLaytimeLayout(2), true);
    assert.equal(usesTankerLaytimeLayout('2'), true);
    assert.equal(usesTankerLaytimeLayout(1), false);
    assert.equal(usesTankerLaytimeLayout(3), false);
    assert.equal(usesTankerLaytimeLayout(null), false);
    assert.equal(usesTankerLaytimeLayout(undefined), false);
    assert.equal(usesTankerLaytimeLayout(''), false);
    assert.equal(usesTankerLaytimeLayout(NaN), false);
  });

  it('resolves estimateType from form top-level or vesselParticulars without defaulting', () => {
    assert.equal(resolveLaytimeEstimateType({ estimateType: 2 }), 2);
    assert.equal(resolveLaytimeEstimateType({ vesselParticulars: { estimateType: 2 } }), 2);
    assert.equal(resolveLaytimeEstimateType({ estimateType: 1, vesselParticulars: { estimateType: 2 } }), 1);
    assert.equal(resolveLaytimeEstimateType({}), null);
    assert.equal(resolveLaytimeEstimateType(null), null);
    assert.equal(resolveLaytimeEstimateType({ rateUnit: 'hours' }), null);
  });
});

describe('laytimeTankerHelpers activity LT flags', () => {
  it('defaults new C rows to counting + 100 partial', () => {
    const next = applyLaytimeActivityLtToggle({}, true);
    assert.equal(next.ltCounts, true);
    assert.equal(next.ltNoCounts, false);
    assert.equal(next.ltPartial, '100');
  });

  it('forces NC to partial 0', () => {
    const next = applyLaytimeActivityLtToggle({ ltPartial: '50' }, false);
    assert.equal(next.ltCounts, false);
    assert.equal(next.ltNoCounts, true);
    assert.equal(next.ltPartial, '0');
  });

  it('preserves SOF-synced unset as non-counting', () => {
    assert.equal(isLaytimeActivityCounting({ sofLoadPortId: '99', ltCounts: false, ltNoCounts: false }), false);
    assert.equal(isLaytimeActivityCounting({ ltCounts: true }), true);
    assert.equal(isLaytimeActivityCounting({ ltNoCounts: true }), false);
  });
});

describe('laytimeTankerHelpers nego visual total', () => {
  it('sums agreed demm across statuses for display only', () => {
    assert.equal(sumNegoAgreedDemm([
      { agreedDemm: '38,500', status: 'Completed' },
      { agreedDemm: '25,000', status: 'Under Nego' },
      { agreedDemm: '', status: 'On Hold' },
    ]), 63500);
  });
});
