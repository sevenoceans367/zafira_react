import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  durationForPersist,
  fillMissingNamedEntityDates,
  getNamedEntityValue,
  isBlankOrFiniteNumber,
  isValidLtPartialPercent,
  parseDmyDateTimeMs,
  parseStrictDecimal,
  tankerLtInsertFailClosed,
  validateDateRangeOrder,
  validateNamedEntityDates,
  validateTankerLaytimePayload,
  verifyRowDurations,
} from './laytimeTankerValidation.js';

function basePayload(overrides = {}) {
  return {
    norTendered: '01-01-2026 08:00',
    loadCommenced: '01-01-2026 12:00',
    loadCompleted: '02-01-2026 18:00',
    loadedRate: '',
    stowageQty: '',
    vesselArrived: '',
    vesselSailed: '',
    loadedQty: '5000',
    laytimeAllowed: '12',
    demurrageRate: '20000',
    despatchRate: '',
    activities: [],
    deductions: [],
    approvers: ['9'],
    submitId: 0,
    ...overrides,
  };
}

describe('backend tanker validation', () => {
  it('allows Tanker save without loadedRate / hidden Dry fields', () => {
    const result = validateTankerLaytimePayload(basePayload());
    assert.equal(result.ok, true);
  });

  it('rejects missing tanker-visible operational fields with clear message', () => {
    const result = validateTankerLaytimePayload(basePayload({ loadCompleted: '' }));
    assert.equal(result.ok, false);
    assert.match(result.message, /CARGO COMPLETED/i);
  });

  it('rejects invalid LT partial %', () => {
    assert.equal(isValidLtPartialPercent('150'), false);
    const result = validateTankerLaytimePayload(basePayload({
      deductions: [{ activity: 'Rain', start: '01-01-2026 08:00', end: '01-01-2026 10:00', ltPartial: '150', duration: '2.0000', notes: '' }],
    }));
    assert.equal(result.ok, false);
    assert.match(result.message, /LT Partial %/);
  });

  it('verifies duration matches start/finish when both set', () => {
    const ok = verifyRowDurations([
      { activity: 'A', start: '01-01-2026 08:00', end: '01-01-2026 10:00', duration: '2.0000', notes: '' },
    ], 'Activity');
    assert.equal(ok.ok, true);

    const bad = verifyRowDurations([
      { activity: 'A', start: '01-01-2026 08:00', end: '01-01-2026 10:00', duration: '9', notes: '' },
    ], 'Activity');
    assert.equal(bad.ok, false);
  });

  it('requires approvers for submitId=1', () => {
    const result = validateTankerLaytimePayload(basePayload({ submitId: 1, approvers: [] }));
    assert.equal(result.ok, false);
    assert.equal(result.field, 'approvers');
  });

  it('rejects commas, hex, negatives, bad calendars and hour 25', () => {
    assert.equal(parseStrictDecimal('1,000').ok, false);
    assert.equal(parseStrictDecimal('0x10').ok, false);
    assert.equal(isBlankOrFiniteNumber('-1'), false);
    assert.equal(parseDmyDateTimeMs('31-02-2026'), null);
    assert.equal(parseDmyDateTimeMs('01-11-2026 25:00'), null);
    assert.equal(parseDmyDateTimeMs('01-11-2026 10:00x'), null);
    assert.equal(validateDateRangeOrder('01-11-2026 00:00', '').ok, false);
    const junkRate = validateTankerLaytimePayload(basePayload({ demurrageRate: '1,000' }));
    assert.equal(junkRate.ok, false);
    const badCal = validateTankerLaytimePayload(basePayload({ norTendered: '31-02-2026 08:00' }));
    assert.equal(badCal.ok, false);
  });

  it('allows blank optional NOR Accepted / Laytime Starts; rejects malformed when supplied', () => {
    assert.equal(validateTankerLaytimePayload(basePayload({ norAccepted: '', startCounting: '' })).ok, true);
    const badNor = validateTankerLaytimePayload(basePayload({ norAccepted: '31-02-2026 08:00' }));
    assert.equal(badNor.ok, false);
    assert.equal(badNor.field, 'norAccepted');
    const badStart = validateTankerLaytimePayload(basePayload({ startCounting: '01-11-2026 25:00' }));
    assert.equal(badStart.ok, false);
    assert.equal(badStart.field, 'startCounting');
  });

  it('allows blank duration when dates are present; rejects mismatched supplied duration', () => {
    const blankDur = verifyRowDurations([
      { activity: 'A', start: '01-11-2026 00:00', end: '01-11-2026 12:00', duration: '', notes: '' },
    ], 'Activity');
    assert.equal(blankDur.ok, true);
    const mismatch = verifyRowDurations([
      { activity: 'A', start: '01-11-2026 00:00', end: '01-11-2026 12:00', duration: '10.0000', notes: '' },
    ], 'Activity');
    assert.equal(mismatch.ok, false);
  });

  it('durationForPersist derives 12h for 00:00–12:00 even when client duration blank/stale', () => {
    assert.equal(durationForPersist({
      start: '01-11-2026 00:00', end: '01-11-2026 12:00', duration: '',
    }), '12.0000');
    assert.equal(durationForPersist({
      start: '01-11-2026 00:00', end: '01-11-2026 12:00', duration: '10.0000',
    }), '12.0000');
    assert.equal(durationForPersist({
      start: '', end: '', duration: '3.5',
    }), '3.5');
  });
});

describe('LT insert fail-closed contract', () => {
  it('enables failClosed only for Tanker estimateType 2', () => {
    assert.equal(tankerLtInsertFailClosed(2), true);
    assert.equal(tankerLtInsertFailClosed('2'), true);
    assert.equal(tankerLtInsertFailClosed(1), false);
    assert.equal(tankerLtInsertFailClosed(3), false);
    assert.equal(tankerLtInsertFailClosed(null), false);
  });
});

describe('named entity dates', () => {
  it('rejects malformed All Clear / Laytime Ends / DEMM Starts on payload', () => {
    assert.equal(validateNamedEntityDates([{ name: 'All Clear', value: '' }]).ok, true);
    assert.equal(validateNamedEntityDates([{ name: 'All Clear', value: '31-02-2026 08:00' }]).ok, false);
    const bad = validateTankerLaytimePayload(basePayload({
      entityRows: [{ name: 'DEMM Starts', value: '01-11-2026 25:00' }],
    }));
    assert.equal(bad.ok, false);
    assert.equal(bad.field, 'demmStarts');
  });

  it('fills missing named fields from SOF without dropping Surveyor; blank wins', () => {
    const filled = fillMissingNamedEntityDates(
      [{ name: 'Surveyor', value: 'SGS' }],
      [
        { name: 'All clear', value: '01-09-2026 10:00' },
        { name: 'Laytime Ends', value: '05-09-2026 12:00' },
      ],
    );
    assert.equal(filled.find((r) => r.name === 'Surveyor').value, 'SGS');
    assert.equal(getNamedEntityValue(filled, 'allClear'), '01-09-2026 10:00');
    assert.equal(getNamedEntityValue(filled, 'laytimeEnds'), '05-09-2026 12:00');

    const blankWins = fillMissingNamedEntityDates(
      [{ name: 'All Clear', value: '' }],
      [{ name: 'All Clear', value: '01-09-2026 10:00' }],
    );
    assert.equal(getNamedEntityValue(blankWins, 'allClear'), '');
  });
});
