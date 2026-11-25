import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isBlankOrFiniteNumber,
  isValidLtPartialPercent,
  parseDmyDateTimeMs,
  parseStrictDecimal,
  tankerLtInsertFailClosed,
  validateDateRangeOrder,
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
