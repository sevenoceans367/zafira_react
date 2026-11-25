import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isBlankOrFiniteNumber,
  isValidLtPartialPercent,
  mayRecomputeTankerField,
  validateDateRangeOrder,
  validateTankerLaytimeDraft,
} from './laytimeTankerValidation.js';
import {
  isTankerNegoUiEnabled,
  tankerLoadedQtyPatchOptions,
} from './laytimeTankerHelpers.js';

function baseDraft(overrides = {}) {
  return {
    norTendered: '01-01-2026 08:00',
    loadCommenced: '01-01-2026 12:00',
    loadCompleted: '02-01-2026 18:00',
    stowageQty: '',
    vesselArrived: '',
    vesselSailed: '',
    loadedRate: '',
    loadedQty: '1000',
    laytimeAllowed: '10',
    demurrageRate: '25000',
    despatchRate: '',
    activities: [],
    deductions: [],
    approvers: ['1'],
    ...overrides,
  };
}

describe('tanker mandatory gate', () => {
  it('does not require hidden Dry fields or loadedRate', () => {
    const result = validateTankerLaytimeDraft(baseDraft({
      stowageQty: '',
      vesselArrived: '',
      vesselSailed: '',
      loadedRate: '',
    }));
    assert.equal(result.ok, true);
  });

  it('requires norTendered / cargo commenced / completed', () => {
    const missing = validateTankerLaytimeDraft(baseDraft({ norTendered: '' }));
    assert.equal(missing.ok, false);
    assert.equal(missing.field, 'norTendered');
  });

  it('requires approvers only for submitId=1', () => {
    const saveOk = validateTankerLaytimeDraft(baseDraft({ approvers: [] }), { submitId: 0 });
    assert.equal(saveOk.ok, true);
    const submitBad = validateTankerLaytimeDraft(baseDraft({ approvers: [] }), { submitId: 1 });
    assert.equal(submitBad.ok, false);
    assert.equal(submitBad.field, 'approvers');
  });
});

describe('lt partial % and rates', () => {
  it('bounds partial 0–100', () => {
    assert.equal(isValidLtPartialPercent(''), true);
    assert.equal(isValidLtPartialPercent('50'), true);
    assert.equal(isValidLtPartialPercent('100'), true);
    assert.equal(isValidLtPartialPercent('101'), false);
    assert.equal(isValidLtPartialPercent('-1'), false);
    assert.equal(isValidLtPartialPercent('abc'), false);
  });

  it('rejects junk rates but allows blank', () => {
    assert.equal(isBlankOrFiniteNumber(''), true);
    assert.equal(isBlankOrFiniteNumber('12.5'), true);
    assert.equal(isBlankOrFiniteNumber('nope'), false);
  });

  it('flags bad activity partial on draft validate', () => {
    const result = validateTankerLaytimeDraft(baseDraft({
      activities: [{ activity: 'A', start: '', end: '', notes: '', ltPartial: '120' }],
    }));
    assert.equal(result.ok, false);
    assert.match(result.message, /LT Partial %/);
  });

  it('ignores LT partial on fully empty placeholder rows', () => {
    const result = validateTankerLaytimeDraft(baseDraft({
      activities: [{ activity: '', start: '', end: '', notes: '', ltPartial: '999' }],
    }));
    assert.equal(result.ok, true);
  });

  it('blocks recompute for invalid LT % / junk rates / reversed dates', () => {
    assert.equal(mayRecomputeTankerField('ltPartial', '100'), true);
    assert.equal(mayRecomputeTankerField('ltPartial', '150'), false);
    assert.equal(mayRecomputeTankerField('ltPartial', '-5'), false);
    assert.equal(mayRecomputeTankerField('ltPartial', '10abc'), false);
    assert.equal(mayRecomputeTankerField('number', '24000'), true);
    assert.equal(mayRecomputeTankerField('number', 'nope'), false);
    assert.equal(mayRecomputeTankerField('dateRange', '01-11-2026 00:00', '01-11-2026 10:00'), true);
    assert.equal(mayRecomputeTankerField('dateRange', '02-11-2026 00:00', '01-11-2026 00:00'), false);
  });
});

describe('date order', () => {
  it('accepts complete DMY ranges and rejects end before start', () => {
    assert.equal(validateDateRangeOrder('01-01-2026 08:00', '01-01-2026 10:00').ok, true);
    const bad = validateDateRangeOrder('02-01-2026 10:00', '01-01-2026 08:00');
    assert.equal(bad.ok, false);
    assert.match(bad.message, /on or after/i);
  });

  it('rejects incomplete / unparseable dates when provided', () => {
    const bad = validateDateRangeOrder('not-a-date', '');
    assert.equal(bad.ok, false);
    const slash = validateDateRangeOrder('01/01/2026', '');
    assert.equal(slash.ok, false);
  });
});

describe('nego gated + allowance not overwritten by qty', () => {
  it('keeps nego UI disabled in production Tanker', () => {
    assert.equal(isTankerNegoUiEnabled(), false);
  });

  it('Tanker QTY patch does not refreshAllowed from qty/rate', () => {
    assert.deepEqual(tankerLoadedQtyPatchOptions(), {
      recompute: true,
      refreshAllowed: false,
    });
  });
});
