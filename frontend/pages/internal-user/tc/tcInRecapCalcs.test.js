import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_TC_IN_PERIOD,
  normalizeTcInTerms,
  syncPeriodOneToLegacy,
  calcTcInGrossHireExpense,
  calcTcInFinalHireage,
  buildTcInRecapDraft,
} from './tcInRecapCalcs.js';

/** Mimic patchTerms: prior normalized terms + explicit primary clear. */
function clearPrimary(priorTerms, key, empty = '') {
  return normalizeTcInTerms({ ...priorTerms, [key]: empty });
}

const LEGACY_ONLY_TERMS = {
  ilohc: '5000',
  adComm: '2.5',
  brokerage: '1.25',
  delPort: 'Singapore',
  reDelPort: 'Mundra',
  brokeragePaidBy: 'Owner',
};

const HIRE_10x22000 = [{ voyageDays: '10', dailyHire: '22000', hireage: '220000' }];

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

    // Prior truthy currency fallback: empty primary still yields hireCurrency.
    const eur = normalizeTcInTerms({ exchangeCurrency: '', hireCurrency: 'EUR' });
    assert.equal(eur.exchangeCurrency, 'EUR');
    assert.equal(eur.hireCurrency, 'EUR');
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

describe('legacy snapshot hydration and partial periods', () => {
  it('preserves alias-only saved period terms on buildTcInRecapDraft reopen', () => {
    const draft = buildTcInRecapDraft({}, {
      recapVersion: 1,
      periods: [{
        terms: { ...LEGACY_ONLY_TERMS },
        hires: HIRE_10x22000,
        offHires: [],
      }],
    });
    assert.equal(draft.terms.ilohcUsd, '5000');
    assert.equal(draft.terms.ilohc, '5000');
    assert.equal(draft.terms.addComm, '2.5');
    assert.equal(draft.terms.adComm, '2.5');
    assert.equal(draft.terms.brokerComm, '1.25');
    assert.equal(draft.terms.delRangePort, 'Singapore');
    assert.equal(draft.terms.reDelRange, 'Mundra');
    assert.equal(draft.terms.broCommPayable, 'Owner');
    assert.equal(draft.ilohc, '5000');
    assert.equal(calcTcInGrossHireExpense(draft).totalHirePayable, '225000.00');
    assert.equal(calcTcInFinalHireage(draft).finalHireage, '225000.00');
  });

  it('preserves alias-only flat saved terms when periods are absent', () => {
    const draft = buildTcInRecapDraft({}, {
      recapVersion: 1,
      terms: { ...LEGACY_ONLY_TERMS },
      hires: HIRE_10x22000,
      offHires: [],
    });
    assert.equal(draft.terms.ilohcUsd, '5000');
    assert.equal(draft.ilohc, '5000');
    assert.equal(draft.terms.addComm, '2.5');
    assert.equal(draft.deliveryPort, 'Singapore');
    assert.equal(draft.redeliveryPort, 'Mundra');
    assert.equal(calcTcInGrossHireExpense(draft).totalHirePayable, '225000.00');
    assert.equal(calcTcInFinalHireage(draft).finalHireage, '225000.00');
  });

  it('falls back to draft-level values when period omits ILOHC/ports/ballast', () => {
    const synced = syncPeriodOneToLegacy({
      ilohc: '5000',
      ballastBonus: '1000',
      deliveryPort: 'Singapore',
      redeliveryPort: 'Mundra',
      periods: [{
        ...EMPTY_TC_IN_PERIOD,
        terms: {},
        hires: HIRE_10x22000,
        offHires: [],
      }],
    });
    assert.equal(synced.ilohc, '5000');
    assert.equal(synced.ballastBonus, '1000');
    assert.equal(synced.deliveryPort, 'Singapore');
    assert.equal(synced.redeliveryPort, 'Mundra');
    assert.equal(calcTcInGrossHireExpense(synced).totalHirePayable, '226000.00');
  });

  it('buildTcInRecapDraft preserves draft-level values for partial period terms {}', () => {
    const draft = buildTcInRecapDraft({}, {
      recapVersion: 1,
      ilohc: '5000',
      ballastBonus: '1000',
      deliveryPort: 'Singapore',
      redeliveryPort: 'Mundra',
      periods: [{
        terms: {},
        hires: HIRE_10x22000,
        offHires: [],
      }],
    });
    assert.equal(draft.ilohc, '5000');
    assert.equal(draft.ballastBonus, '1000');
    assert.equal(draft.deliveryPort, 'Singapore');
    assert.equal(draft.redeliveryPort, 'Mundra');
    assert.equal(draft.terms.ilohcUsd, '5000');
    assert.equal(calcTcInGrossHireExpense(draft).totalHirePayable, '226000.00');
    assert.equal(calcTcInFinalHireage(draft).finalHireage, '225000.00');
  });

  it('buildTcInRecapDraft preserves draft-level values for flat empty terms {}', () => {
    const draft = buildTcInRecapDraft({}, {
      recapVersion: 1,
      ilohc: '5000',
      ballastBonus: '1000',
      deliveryPort: 'Singapore',
      redeliveryPort: 'Mundra',
      terms: {},
      hires: HIRE_10x22000,
      offHires: [],
    });
    assert.equal(draft.ilohc, '5000');
    assert.equal(draft.ballastBonus, '1000');
    assert.equal(draft.deliveryPort, 'Singapore');
    assert.equal(draft.redeliveryPort, 'Mundra');
    assert.equal(calcTcInGrossHireExpense(draft).totalHirePayable, '226000.00');
    assert.equal(calcTcInFinalHireage(draft).finalHireage, '225000.00');
  });

  it('keeps explicit clears empty without resurrecting draft leftovers', () => {
    const synced = syncPeriodOneToLegacy({
      ilohc: '5000',
      ballastBonus: '1000',
      deliveryPort: 'Singapore',
      redeliveryPort: 'Mundra',
      periods: [{
        ...EMPTY_TC_IN_PERIOD,
        terms: {
          ilohcUsd: '',
          ballastBonus: '',
          delRangePort: '',
          reDelRange: '',
        },
        hires: HIRE_10x22000,
        offHires: [],
      }],
    });
    assert.equal(synced.ilohc, '');
    assert.equal(synced.ballastBonus, '');
    assert.equal(synced.deliveryPort, '');
    assert.equal(synced.redeliveryPort, '');
    assert.equal(calcTcInGrossHireExpense(synced).totalHirePayable, '220000.00');
  });

  it('buildTcInRecapDraft keeps explicit clears empty vs absent draft leftovers', () => {
    const draft = buildTcInRecapDraft({}, {
      recapVersion: 1,
      ilohc: '5000',
      ballastBonus: '1000',
      deliveryPort: 'Singapore',
      redeliveryPort: 'Mundra',
      periods: [{
        terms: {
          ilohcUsd: '',
          ballastBonus: '',
          delRangePort: '',
          reDelRange: '',
        },
        hires: HIRE_10x22000,
        offHires: [],
      }],
    });
    assert.equal(draft.ilohc, '');
    assert.equal(draft.ballastBonus, '');
    assert.equal(draft.deliveryPort, '');
    assert.equal(draft.redeliveryPort, '');
    assert.equal(calcTcInGrossHireExpense(draft).totalHirePayable, '220000.00');
    assert.equal(calcTcInFinalHireage(draft).finalHireage, '220000.00');
  });

  it('preserves numeric zero ILOHC through normalize and sync', () => {
    const asNumber = normalizeTcInTerms({ ilohcUsd: 0 });
    assert.equal(asNumber.ilohcUsd, 0);
    assert.equal(asNumber.ilohc, 0);

    const asString = normalizeTcInTerms({ ilohcUsd: '0' });
    assert.equal(asString.ilohcUsd, '0');
    assert.equal(asString.ilohc, '0');

    const synced = syncPeriodOneToLegacy({
      ilohc: '5000',
      periods: [{
        ...EMPTY_TC_IN_PERIOD,
        terms: { ilohcUsd: 0 },
        hires: HIRE_10x22000,
        offHires: [],
      }],
    });
    assert.equal(synced.ilohc, 0);
    assert.equal(calcTcInGrossHireExpense(synced).totalHirePayable, '220000.00');
    assert.equal(calcTcInFinalHireage(synced).finalHireage, '220000.00');
  });

  it('reopening a cleared saved recap keeps ILOHC empty and hireage without ILOHC', () => {
    const saved = {
      recapVersion: 1,
      periods: [{
        terms: {
          ilohcUsd: '',
          ilohc: '',
          addComm: '',
          adComm: '',
        },
        hires: HIRE_10x22000,
        offHires: [],
      }],
      ilohc: '',
    };
    const draft = buildTcInRecapDraft({}, saved);
    assert.equal(draft.terms.ilohcUsd, '');
    assert.equal(draft.ilohc, '');
    assert.equal(calcTcInGrossHireExpense(draft).totalHirePayable, '220000.00');
    assert.equal(calcTcInFinalHireage(draft).finalHireage, '220000.00');
  });
});
