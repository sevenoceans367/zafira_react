import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcCargoReletTotals } from './cargoReletTotals.js';

describe('calcCargoReletTotals', () => {
  it('calculates freight, totals, and profit', () => {
    const result = calcCargoReletTotals({
      cargoQty: '10000',
      freightUsd: '12.5',
      freightUsdOut: '11',
      bunkerSurchargeAmt: '500',
      bunkerSurchargeAmtOut: '200',
      demmurageAmt: '0',
      despatchAmt: '100',
      addCommAmt: '50',
      brokerageAmt: '50',
      demmurageAmtOut: '0',
      despatchAmtOut: '0',
      addCommAmtOut: '25',
      brokerageAmtOut: '25',
    });

    assert.equal(result.freightAmt, '125000.00');
    assert.equal(result.freightAmtOut, '110000.00');
    assert.equal(result.totalAmt, '125300.00');
    assert.equal(result.totalAmtOut, '110150.00');
    assert.equal(result.profit, '15150.00');
  });

  it('treats invalid numbers as zero', () => {
    const result = calcCargoReletTotals({
      cargoQty: 'abc',
      freightUsd: '',
      freightUsdOut: null,
    });
    assert.equal(result.profit, '0.00');
  });
});
