import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcTcTotals,
  computeTcListStats,
  dailyGrossHire,
  mapTcListRow,
} from './tcEstimateMappers.js';

describe('tcEstimateMappers', () => {
  it('converts daily gross hire with exchange rate defaulting to 1', () => {
    assert.equal(dailyGrossHire(15000, 1), '15000.00');
    assert.equal(dailyGrossHire(15000, 1.1), '16500.00');
    assert.equal(dailyGrossHire(15000, 0), '15000.00');
    assert.equal(dailyGrossHire(15000, null), '15000.00');
  });

  it('maps list row compare eligibility from COMID and revenue', () => {
    const eligible = mapTcListRow({
      TCOUTID: 1,
      VESSEL_NAME: 'Atlantic Star',
      VESSEL_TYPE: 'Capesize',
      TC_NO: 'TC-1',
      CP_DATE1: '2026-01-15',
      DWT_SUMMER_CP: '180000',
      DEL_RANGE_PORT: 'Singapore',
      RE_DEL_RANGE: 'Rotterdam',
      TC_DAYS_EST: 30,
      HIRE_FIX_PER: 15000,
      EXCHANGE_RATE: 1,
      TOTAL_REV_EST: 400000,
      COMID: '',
    });
    assert.equal(eligible.canCompare, true);
    assert.equal(eligible.sentToDecisionChart, false);
    assert.equal(eligible.dailyGrossHire, '15000.00');
    assert.equal(eligible.hireOut, '15000.00');
    assert.equal(eligible.hireIn, '');
    assert.equal(eligible.delRedel, 'Singapore - Rotterdam');

    const draft = mapTcListRow({
      TCOUTID: 2,
      TOTAL_REV_EST: 0,
      HIRE_FIX_PER: 10000,
      EXCHANGE_RATE: 1,
      COMID: null,
    });
    assert.equal(draft.canCompare, false);
    assert.equal(draft.compareLabel, 'Create Estimate');

    const sent = mapTcListRow({
      TCOUTID: 3,
      TOTAL_REV_EST: 100,
      HIRE_FIX_PER: 10000,
      EXCHANGE_RATE: 1,
      COMID: '55',
    });
    assert.equal(sent.sentToDecisionChart, true);
    assert.equal(sent.compareLabel, 'Sent to Ops');
  });

  it('computes highlight stats from live revenue without inventing values', () => {
    const stats = computeTcListStats([
      { TOTAL_REV_EST: 1860000, COMID: '' },
      { TOTAL_REV_EST: 2710000, COMID: '12' },
    ]);
    assert.equal(stats.openTrade, 1860);
    assert.equal(stats.vesselsInSubs, 1);
    assert.equal(stats.tradesInOperations, 2710);
    assert.equal(stats.vesselsOnWater, 2);
  });

  it('calculates commissions, bunker diff, and profit/day like PHP getFinalCalculation', () => {
    const totals = calcTcTotals({
      tcDays: 30,
      dailyGrossHire: 15000,
      addCommPct: 1.25,
      brokerCommPct: 1.25,
      lessOffHire: 0,
      cve: 1000,
      otherIncome: 0,
      totalExp: 25000,
      delHfoMt: 500,
      delHfoUsd: 450,
      delMgoMt: 50,
      delMgoUsd: 700,
      reDelHfoMt: 400,
      reDelHfoUsd: 460,
      reDelMgoMt: 40,
      reDelMgoUsd: 710,
      utilisationDays: 30,
    });

    assert.equal(totals.hireIncome, '450000.00');
    assert.equal(totals.nettHire, '438750.00');
    assert.equal(totals.nettRev, '438750.00');
    assert.equal(totals.addCommAmt, '5625.00');
    assert.equal(totals.brokerCommAmt, '5625.00');
    assert.equal(totals.bunkerDiffAmt, '47600.00');
    assert.equal(totals.totalRev, '487350.00');
    assert.equal(totals.voyageEarn, '462350.00');
    assert.equal(totals.profitPerDay, '15411.67');
  });

  it('uses hire periods, prorated CVE, and ballast bonus', () => {
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
      offHires: [],
    });
    assert.equal(totals.tcDays, '10');
    assert.equal(totals.hireIncome, '100000.00');
    assert.equal(totals.addCommAmt, '2100.00');
    assert.equal(totals.brokerCommAmt, '1050.00');
    assert.equal(totals.nettRev, '101850.00');
    assert.equal(totals.bunkerDiffAmt, '500.00');
    assert.equal(totals.cve, '1000.00');
    assert.equal(totals.totalRev, '103700.00');
  });

  it('prefers date-derived hire days over stale stored days (PHP getFinalCalculation)', () => {
    const totals = calcTcTotals({
      hirePeriods: [
        {
          delDate: '01-01-2026 00:00',
          reDelDate: '11-01-2026 00:00',
          days: '30',
          hireRate: '10000',
        },
      ],
      addCommPct: 0,
      brokerCommPct: 0,
      cveMonth: '',
      otherIncome: 0,
      totalExp: 0,
      offHires: [],
    });
    assert.equal(totals.tcDays, '10');
    assert.equal(totals.hireIncome, '100000.00');
  });

  it('only reduces utilisation when off-hire has both From and To', () => {
    const totals = calcTcTotals({
      hirePeriods: [
        { delDate: '01-01-2026 00:00', reDelDate: '11-01-2026 00:00', hireRate: '10000' },
      ],
      addCommPct: 0,
      brokerCommPct: 0,
      cveMonth: 3000,
      otherIncome: 0,
      totalExp: 0,
      offHires: [{ days: '2', hireRate: '5000', from: '', to: '' }],
    });
    assert.equal(totals.utilisationDays, '10');
    assert.equal(totals.lessOffHire, '10000.00');
    assert.equal(totals.cve, '1000.00');
  });

  it('ignores off-hire utilisation when To is missing (PHP getTimeDiff)', () => {
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

  it('treats empty cveMonth as zero CVE (not stale cve amount)', () => {
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
  });

  it('falls back to HFO/MGO when bunker grid only has a grade selected', () => {
    const totals = calcTcTotals({
      tcDays: 10,
      dailyGrossHire: 1000,
      deliveryBunkers: [{ bunkerId: '12', qty: '', price: '', amount: '' }],
      redeliveryBunkers: [{ bunkerId: '12', qty: '', price: '', amount: '' }],
      delHfoMt: 10,
      delHfoUsd: 100,
      reDelHfoMt: 5,
      reDelHfoUsd: 100,
      otherIncome: 0,
      totalExp: 0,
      offHires: [],
    });
    assert.equal(totals.bunkerDiffAmt, '500.00');
  });

  it('adds nested off-hire bunkers into lessOffHire', () => {
    const totals = calcTcTotals({
      hirePeriods: [
        { delDate: '01-01-2026 00:00', reDelDate: '11-01-2026 00:00', hireRate: '10000' },
      ],
      addCommPct: 0,
      brokerCommPct: 0,
      otherIncome: 0,
      totalExp: 0,
      offHires: [{
        from: '02-01-2026 00:00',
        to: '04-01-2026 00:00',
        hireRate: '10000',
        bunkers: [
          { bunkerId: '1', qty: '10', price: '500' },
          { bunkerId: '2', qty: '2', price: '750' },
        ],
      }],
    });
    // PHP double-counts bunkers when From is set:
    // 2 days × 10000 + 2×((10×500)+(2×750)) = 33000
    assert.equal(totals.lessOffHire, '33000.00');
    assert.equal(totals.utilisationDays, '8');
  });

  it('counts off-hire bunkers once when From is empty', () => {
    const totals = calcTcTotals({
      hirePeriods: [
        { delDate: '01-01-2026 00:00', reDelDate: '11-01-2026 00:00', hireRate: '10000' },
      ],
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
    assert.equal(totals.tcDays, '10');
    assert.equal(totals.utilisationDays, '8');
    assert.equal(totals.hireIncome, '100000.00');
    assert.equal(totals.nettRev, '101850.00');
    assert.equal(totals.lessOffHire, '33000.00');
    assert.equal(totals.cve, '800.00');
    assert.equal(totals.bunkerDiffAmt, '500.00');
    assert.equal(totals.totalRev, '70500.00');
    assert.equal(totals.voyageEarn, '65500.00');
    assert.equal(totals.profitPerDay, '8187.50');
  });

  it('falls back to HFO/MGO summary when bunker grid is empty placeholders', () => {
    const totals = calcTcTotals({
      tcDays: 10,
      dailyGrossHire: 1000,
      deliveryBunkers: [{ bunkerId: '', qty: '', price: '', amount: '' }],
      redeliveryBunkers: [{ bunkerId: '', qty: '', price: '', amount: '' }],
      delHfoMt: 10,
      delHfoUsd: 100,
      reDelHfoMt: 5,
      reDelHfoUsd: 100,
      otherIncome: 0,
      totalExp: 0,
      offHires: [],
    });
    assert.equal(totals.bunkerDiffAmt, '500.00');
  });
});
