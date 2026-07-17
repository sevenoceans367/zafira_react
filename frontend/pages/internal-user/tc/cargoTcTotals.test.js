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
});
