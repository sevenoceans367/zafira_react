import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { laytimeRateUnitFromEstimateType } from './laytimeRateUnit.js';

describe('laytimeRateUnitFromEstimateType', () => {
  it('maps Fun158 1|2 to hours, 3 to days, and fails closed when unknown', () => {
    assert.equal(laytimeRateUnitFromEstimateType(1), 'hours');
    assert.equal(laytimeRateUnitFromEstimateType(2), 'hours');
    assert.equal(laytimeRateUnitFromEstimateType('2'), 'hours');
    assert.equal(laytimeRateUnitFromEstimateType(3), 'days');
    assert.equal(laytimeRateUnitFromEstimateType(null), null);
    assert.equal(laytimeRateUnitFromEstimateType(undefined), null);
    assert.equal(laytimeRateUnitFromEstimateType(NaN), null);
  });
});
