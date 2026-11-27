import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyLaytimeActivityLtToggle,
  getTankerEntityValue,
  isLaytimeActivityCounting,
  resolveLaytimeEstimateType,
  setTankerEntityValue,
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

describe('laytimeTankerHelpers entity field mapping', () => {
  it('reads All clear alias and upserts without dropping unrelated rows', () => {
    const rows = [
      { name: 'Surveyor', value: 'SGS' },
      { name: 'All clear', value: '01-09-2026 10:00' },
    ];
    assert.equal(getTankerEntityValue(rows, 'allClear'), '01-09-2026 10:00');
    const next = setTankerEntityValue(rows, 'laytimeEnds', '05-09-2026 12:00');
    assert.equal(next.length, 3);
    assert.equal(getTankerEntityValue(next, 'laytimeEnds'), '05-09-2026 12:00');
    assert.equal(getTankerEntityValue(next, 'allClear'), '01-09-2026 10:00');
    assert.equal(next.find((r) => r.name === 'Surveyor').value, 'SGS');
  });

  it('edits and clears every alias while preserving rows and unrelated values', () => {
    const rows = [
      { name: 'All Clear', value: '01-09-2026 10:00' },
      { name: 'allclear', value: '01-09-2026 11:00' },
      { name: 'Surveyor', value: 'SGS' },
    ];
    for (const value of ['02-09-2026 12:00', '']) {
      assert.deepEqual(setTankerEntityValue(rows, 'allClear', value), [
        { name: 'All Clear', value },
        { name: 'allclear', value },
        rows[2],
      ]);
    }
    assert.deepEqual(setTankerEntityValue([], 'allClear', ''), [
      { name: 'All Clear', value: '' },
    ]);
  });
});
