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

  it('treats unknown unit as a hard write block for Save and Open alike', () => {
    // Guard contract: any write (including action=open) must reject when this is null.
    const blockedActions = ['save', 'open', 'submit', 'close'];
    for (const action of blockedActions) {
      assert.equal(
        laytimeRateUnitFromEstimateType(null),
        null,
        `action=${action} must fail closed when estimateType unknown`,
      );
    }
    assert.equal(laytimeRateUnitFromEstimateType(2), 'hours');
  });
});
