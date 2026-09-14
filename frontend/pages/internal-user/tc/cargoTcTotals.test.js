import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcTcTotals } from '../../../services/tcEstimates.js';

describe('frontend calcTcTotals', () => {
  it('matches PHP hire/commission/profit formulas', () => {
    const totals = calcTcTotals({
      tcDays: 10,
      dailyGrossHire: 10000,
      addCommPct: 2,
      brokerCommPct: 1,
      lessOffHire: 1000,
      cve: 500,
      otherIncome: 250,
      totalExp: 5000,
      delHfoMt: 10,
      delHfoUsd: 100,
      delMgoMt: 0,
      delMgoUsd: 0,
      reDelHfoMt: 5,
      reDelHfoUsd: 100,
      reDelMgoMt: 0,
      reDelMgoUsd: 0,
      utilisationDays: 10,
    });
    assert.equal(totals.hireIncome, '100000.00');
    assert.equal(totals.nettHire, '97000.00');
    assert.equal(totals.nettRev, '97000.00');
    assert.equal(totals.bunkerDiffAmt, '500.00');
    assert.equal(totals.totalRev, '97250.00');
    assert.equal(totals.voyageEarn, '92250.00');
    assert.equal(totals.profitPerDay, '9225.00');
  });

  it('overrides stale hire days when del/redel dates are present', () => {
    const totals = calcTcTotals({
      hirePeriods: [
        { delDate: '01-02-2026 00:00', reDelDate: '11-02-2026 00:00', days: '99', hireRate: '1000' },
      ],
      addCommPct: 0,
      brokerCommPct: 0,
      otherIncome: 0,
      totalExp: 0,
      offHires: [],
    });
    assert.equal(totals.tcDays, '10');
    assert.equal(totals.hireIncome, '10000.00');
  });

  it('includes off-hire bunker amounts in lessOffHire', () => {
    const totals = calcTcTotals({
      tcDays: 10,
      dailyGrossHire: 10000,
      addCommPct: 0,
      brokerCommPct: 0,
      otherIncome: 0,
      totalExp: 0,
      offHires: [{
        days: '1',
        hireRate: '10000',
        bunkers: [{ qty: '5', price: '600' }],
      }],
    });
    assert.equal(totals.lessOffHire, '13000.00');
  });

  it('treats empty cveMonth as zero CVE (PHP txtCVEM == "")', () => {
    const totals = calcTcTotals({
      hirePeriods: [
        { delDate: '01-01-2026 00:00', reDelDate: '11-01-2026 00:00', hireRate: '10000' },
      ],
      addCommPct: 0,
      brokerCommPct: 0,
      cveMonth: '',
      cve: 99999,
      otherIncome: 0,
      totalExp: 0,
      offHires: [],
    });
    assert.equal(totals.cve, '0.00');
    assert.equal(totals.utilisationDays, '10');
  });

  it('does not reduce utilisation when off-hire To is missing', () => {
    const totals = calcTcTotals({
      hirePeriods: [
        { delDate: '01-01-2026 00:00', reDelDate: '11-01-2026 00:00', hireRate: '10000' },
      ],
      addCommPct: 0,
      brokerCommPct: 0,
      cveMonth: '',
      otherIncome: 0,
      totalExp: 0,
      offHires: [{ days: '2', hireRate: '5000', from: '02-01-2026 00:00', to: '' }],
    });
    assert.equal(totals.utilisationDays, '10');
    assert.equal(totals.lessOffHire, '10000.00');
  });

  it('matches full PHP getFinalCalculation walkthrough', () => {
    const totals = calcTcTotals({
      hirePeriods: [
        { delDate: '01-01-2026 00:00', reDelDate: '11-01-2026 00:00', hireRate: '10000' },
      ],
      addCommPct: 2,
      brokerCommPct: 1,
      ballastBonus: 5000,
      cveMonth: 3000,
      ilohcAmt: 100,
      otherIncome: 250,
      totalExp: 5000,
      deliveryBunkers: [{ qty: 10, price: 100 }],
      redeliveryBunkers: [{ qty: 5, price: 100 }],
      offHires: [{
        from: '02-01-2026 00:00',
        to: '04-01-2026 00:00',
        hireRate: '10000',
        bunkers: [
          { qty: '10', price: '500' },
          { qty: '2', price: '750' },
        ],
      }],
    });
    assert.equal(totals.totalRev, '70500.00');
    assert.equal(totals.voyageEarn, '65500.00');
    assert.equal(totals.profitPerDay, '8187.50');
  });
});
