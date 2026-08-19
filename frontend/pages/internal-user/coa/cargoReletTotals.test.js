import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcCargoIntake, calcCargoReletTotals } from './cargoReletTotals.js';

describe('calcCargoReletTotals', () => {
  it('calculates freight, bunker surcharge, totals, and profit', () => {
    const result = calcCargoReletTotals({
      cargoQty: '10000',
      freightUsd: '12.5',
      freightUsdOut: '11',
      addCom: '1.25',
      brokerage: '1.25',
      addComOut: '1',
      brokerageOut: '1',
      currentFoPrice: '520',
      contractFoPrice: '500',
      bafUsd: '0.01',
      demmurageAmt: '0',
      despatchAmt: '100',
      demmurageAmtOut: '0',
      despatchAmtOut: '0',
    });

    assert.equal(result.freightAmt, '125000.00');
    assert.equal(result.addCommAmt, '1562.50');
    assert.equal(result.brokerageAmt, '1562.50');
    assert.equal(result.bunkerSurchargeAmt, '2000.00');
    assert.equal(result.freightAmtOut, '110000.00');
    assert.equal(result.addCommAmtOut, '1100.00');
    assert.equal(result.brokerageAmtOut, '1100.00');
    assert.equal(result.totalAmt, '123775.00');
    assert.equal(result.totalAmtOut, '107800.00');
    assert.equal(result.profit, '15975.00');
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

describe('calcCargoIntake', () => {
  it('uses planned qty when allowed draft is empty', () => {
    const result = calcCargoIntake({
      allowedDraftM: '',
      plannedCargoQty: '55000',
      cargoQty: '1000',
    });
    assert.equal(result.cargoIntakeMt, '0');
    assert.equal(result.cargoQty, '55000');
  });

  it('reduces summer DWT by draft, bunker ROB, and constants', () => {
    const result = calcCargoIntake({
      allowedDraftM: '12',
      summerDraftM: '14',
      tpcMt: '80',
      summerDwtMt: '100000',
      bunkerRobMt: '500',
      constantsMt: '300',
    });
    assert.equal(result.cargoIntakeMt, '83200.0000');
    assert.equal(result.cargoQty, '83200.0000');
  });
});
