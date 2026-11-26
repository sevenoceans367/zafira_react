import test from 'node:test';
import assert from 'node:assert/strict';
import { calcDryLaytimeAllowed } from './laytimeCalculations.js';
import { recomputeTankerPortDraft } from './laytimeTankerValidation.js';
import { hoursDurationToDays } from './sofTankerHelpers.js';

const activity = {
  activity: 'Loading',
  start: '01-01-2026 00:00',
  end: '03-01-2026 00:00',
  ltCounts: true,
  ltPartial: '75',
};
const deduction = {
  activity: 'Weather',
  start: '01-01-2026 00:00',
  end: '01-01-2026 12:00',
  ltPartial: '50',
};

test('Dry rounds quantity divided by rate before adding turn hours and reversible days', () => {
  assert.equal(calcDryLaytimeAllowed({ loadedQty: '2', loadedRate: '3', turnTimeToAdd: '1' }), '0.7084');
  assert.equal(calcDryLaytimeAllowed({
    loadedQty: '12000', loadedRate: '12000', turnTimeToAdd: '6', laytimeAllowedExtra: '0.5',
  }), '1.7500');
  assert.equal(calcDryLaytimeAllowed({ loadedQty: '1000', loadedRate: '' }), '');
});

test('Dry applies the weighted deduction once to demurrage and keeps SOF row storage in hours', () => {
  const result = recomputeTankerPortDraft({
    laytimeAllowed: '1',
    actualLaytimeExtra: '0.125',
    demurrageRate: '20000',
    vesselArrived: '01-01-2026 00:00',
    vesselSailed: '03-01-2026 12:00',
    activities: [activity, { ...activity, ltCounts: false }],
    deductions: [deduction],
  }, 'days', { dryLaytime: true });

  assert.equal(result.totalDaysAtPort, '2.5000');
  assert.equal(result.activities[0].duration, '48.0000');
  assert.equal(hoursDurationToDays(result.activities[0].duration), '2.0000');
  assert.equal(result.activities[0].cumulative, '-0.5000');
  assert.equal(result.activities[1].cumulative, '0.00');
  assert.equal(result.deductions[0].cumulative, '6.0000');
  assert.equal(hoursDurationToDays(result.deductions[0].cumulative), '0.2500');
  assert.equal(result.actualLaytime, '1.6250');
  assert.equal(result.timeToDemurrage, '0.3750');
  assert.equal(result.ttlDemurrage, '7500.00');
});

test('Dry despatch uses days and ignores deductions', () => {
  const result = recomputeTankerPortDraft({
    laytimeAllowed: '2',
    despatchRate: '10000',
    activities: [activity],
    deductions: [deduction],
  }, 'days', { dryLaytime: true });

  assert.equal(result.actualLaytime, '1.5000');
  assert.equal(result.timeToDespatch, '0.5000');
  assert.equal(result.ttlDespatch, '5000.00');
  assert.equal(result.timeToDemurrage, '00.00');
});
