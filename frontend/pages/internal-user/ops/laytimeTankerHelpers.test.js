import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyLaytimeActivityLtToggle,
  ensureCountingLtPartial,
  getTankerEntityValue,
  isLaytimeActivityCounting,
  isTankerNegoUiEnabled,
  normalizeActivityLtPartials,
  resolveLaytimeEstimateType,
  setTankerEntityValue,
  sumNegoAgreedDemm,
  tankerLoadedQtyPatchOptions,
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

  it('fills blank LT Partial to 100 when row is counting (C)', () => {
    assert.equal(ensureCountingLtPartial({ ltCounts: true, ltPartial: '' }).ltPartial, '100');
    assert.equal(ensureCountingLtPartial({ ltCounts: true, ltPartial: '50' }).ltPartial, '50');
    assert.equal(ensureCountingLtPartial({ ltNoCounts: true, ltPartial: '' }).ltPartial, '');
    assert.equal(ensureCountingLtPartial({ sofLoadPortId: '9', ltCounts: false, ltPartial: '' }).ltPartial, '');
    const rows = normalizeActivityLtPartials([
      { ltCounts: true, ltPartial: '100' },
      { ltCounts: true, ltPartial: '' },
      { ltNoCounts: true, ltPartial: '0' },
    ]);
    assert.equal(rows[0].ltPartial, '100');
    assert.equal(rows[1].ltPartial, '100');
    assert.equal(rows[2].ltPartial, '0');
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

  it('keeps empty named row so cleared values do not disappear', () => {
    const cleared = setTankerEntityValue(
      [{ name: 'All Clear', value: '01-09-2026 10:00' }],
      'allClear',
      '',
    );
    assert.equal(cleared.length, 1);
    assert.equal(cleared[0].name, 'All Clear');
    assert.equal(cleared[0].value, '');
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

  it('keeps production nego UI gated off', () => {
    assert.equal(isTankerNegoUiEnabled(), false);
  });
});

describe('laytimeTankerHelpers allowance gate', () => {
  it('does not refreshAllowed on Tanker QTY edit', () => {
    assert.equal(tankerLoadedQtyPatchOptions().refreshAllowed, false);
    assert.equal(tankerLoadedQtyPatchOptions().recompute, true);
  });
});
