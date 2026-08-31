import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcDirectFixtureTotals } from './directFixtureTotals.js';

describe('calcDirectFixtureTotals', () => {
  it('computes single-leg Bnkr Surcharge as FO × BAF', () => {
    const result = calcDirectFixtureTotals({
      cargoQty: '10000',
      freightUsd: '10',
      bafUsd: '0.05',
      foPrice: '400',
      addCom: '1',
      brokerage: '1',
    });
    assert.equal(result.bunkerSurchargePerMt, '20.00');
    assert.equal(result.effectiveFrt, '30.00');
    assert.equal(result.grossRevenue, '300000.00');
    assert.equal(result.ttlComm, '6000.00');
    assert.equal(result.nettRevenue, '294000.00');
  });
});
