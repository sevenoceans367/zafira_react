import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_TC_IN_PERIOD,
  normalizeTcInTerms,
  syncPeriodOneToLegacy,
  calcTcInGrossHireExpense,
} from './tcInRecapCalcs.js';

/** Mimic patchTerms: prior normalized terms + explicit primary clear. */
function clearPrimary(priorTerms, key, empty = '') {
  return normalizeTcInTerms({ ...priorTerms, [key]: empty });
}

describe('normalizeTcInTerms clear aliases', () => {
  it('keeps ILOHC empty when clearing primary while alias still has a value', () => {
    const prior = normalizeTcInTerms({ ilohcUsd: '5000' });
    assert.equal(prior.ilohcUsd, '5000');
    assert.equal(prior.ilohc, '5000');

    const cleared = clearPrimary(prior, 'ilohcUsd');
    assert.equal(cleared.ilohcUsd, '');
    assert.equal(cleared.ilohc, '');
  });

  it('keeps AD Comm empty when clearing primary while alias still has a value', () => {
    const prior = normalizeTcInTerms({ addComm: '2.5' });
    assert.equal(prior.addComm, '2.5');
    assert.equal(prior.adComm, '2.5');

    const cleared = clearPrimary(prior, 'addComm');
    assert.equal(cleared.addComm, '');
    assert.equal(cleared.adComm, '');
  });

  it('keeps Brokerage empty when clearing primary while alias still has a value', () => {
    const prior = normalizeTcInTerms({ brokerComm: '1.25' });
    const cleared = clearPrimary(prior, 'brokerComm');
    assert.equal(cleared.brokerComm, '');
    assert.equal(cleared.brokerage, '');
  });

  it('keeps Brokerage Paid By empty when clearing primary while alias still has a value', () => {
    const prior = normalizeTcInTerms({ broCommPayable: 'Owner' });
    const cleared = clearPrimary(prior, 'broCommPayable');
    assert.equal(cleared.broCommPayable, '');
    assert.equal(cleared.brokeragePaidBy, '');
  });

  it('keeps delivery / redelivery ports empty when clearing primary while alias still has a value', () => {
    const prior = normalizeTcInTerms({
      delRangePort: 'Singapore',
      reDelRange: 'Mundra',
    });
    const clearedDel = clearPrimary(prior, 'delRangePort');
    assert.equal(clearedDel.delRangePort, '');
    assert.equal(clearedDel.delPort, '');

    const clearedRe = clearPrimary(prior, 'reDelRange');
    assert.equal(clearedRe.reDelRange, '');
    assert.equal(clearedRe.reDelPort, '');
  });

  it('still reads legacy-only aliases when primary is absent', () => {
    assert.equal(normalizeTcInTerms({ ilohc: '900' }).ilohcUsd, '900');
    assert.equal(normalizeTcInTerms({ adComm: '3' }).addComm, '3');
    assert.equal(normalizeTcInTerms({ brokerage: '1' }).brokerComm, '1');
    assert.equal(normalizeTcInTerms({ delPort: 'Rotterdam' }).delRangePort, 'Rotterdam');
  });

  it('keeps currency default USD and exchangeRate default 1', () => {
    const blank = normalizeTcInTerms({});
    assert.equal(blank.exchangeCurrency, 'USD');
    assert.equal(blank.hireCurrency, 'USD');
    assert.equal(blank.exchangeRate, '1');
    assert.equal(blank.xrate, '1');
  });
});

describe('syncPeriodOneToLegacy clear aliases', () => {
  it('does not restore cleared ILOHC or ballastBonus from draft-level leftovers', () => {
    const terms = normalizeTcInTerms({
      ...EMPTY_TC_IN_PERIOD.terms,
      ilohcUsd: '5000',
      ballastBonus: '1000',
    });
    const withValues = syncPeriodOneToLegacy({
      ilohc: '5000',
      ballastBonus: '1000',
      periods: [{ ...EMPTY_TC_IN_PERIOD, terms }],
    });
    assert.equal(withValues.ilohc, '5000');
    assert.equal(withValues.ballastBonus, '1000');

    const clearedTerms = normalizeTcInTerms({
      ...terms,
      ilohcUsd: '',
      ballastBonus: '',
    });
    const cleared = syncPeriodOneToLegacy({
      ...withValues,
      periods: [{ ...EMPTY_TC_IN_PERIOD, terms: clearedTerms }],
      // stale draft leftovers that used to win via ||
      ilohc: '5000',
      ballastBonus: '1000',
    });
    assert.equal(cleared.ilohc, '');
    assert.equal(cleared.ballastBonus, '');
    assert.equal(cleared.terms.ilohcUsd, '');
    assert.equal(cleared.deliveryPort, cleared.terms.delRangePort);
  });

  it('drops ILOHC from hire payable when the field is cleared', () => {
    const hires = [{ voyageDays: '10', dailyHire: '22000', hireage: '220000' }];
    const withIlohc = syncPeriodOneToLegacy({
      periods: [{
        ...EMPTY_TC_IN_PERIOD,
        terms: normalizeTcInTerms({ ilohcUsd: '5000' }),
        hires,
        offHires: [],
      }],
    });
    assert.equal(calcTcInGrossHireExpense(withIlohc).totalHirePayable, '225000.00');

    const cleared = syncPeriodOneToLegacy({
      ...withIlohc,
      ilohc: '5000',
      periods: [{
        ...withIlohc.periods[0],
        terms: normalizeTcInTerms({ ...withIlohc.terms, ilohcUsd: '' }),
        hires,
        offHires: [],
      }],
    });
    assert.equal(cleared.ilohc, '');
    assert.equal(calcTcInGrossHireExpense(cleared).totalHirePayable, '220000.00');
  });
});
