import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isBlankOrFiniteNumber,
  isValidLtPartialPercent,
  parseStrictDecimal,
  parseStrictDisplayDateTime,
  recomputeTankerPortDraft,
  sanitizeTankerDraftForRecompute,
  validateDateRangeOrder,
  validateTankerLaytimeDraft,
} from './laytimeTankerValidation.js';
import {
  formatMoneyDisplay,
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
    laytimeAllowed: '72',
    demurrageRate: '24000',
    despatchRate: '12000',
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

describe('strict decimal parsing', () => {
  it('rejects commas, hex, trailing junk, negatives for rates', () => {
    assert.equal(parseStrictDecimal('1,000').ok, false);
    assert.equal(parseStrictDecimal('0x10').ok, false);
    assert.equal(parseStrictDecimal('10abc').ok, false);
    assert.equal(parseStrictDecimal('12.5').ok, true);
    assert.equal(parseStrictDecimal('12.5').value, 12.5);
    assert.equal(isBlankOrFiniteNumber('-5'), false);
    assert.equal(isBlankOrFiniteNumber('0'), true);
    assert.equal(isBlankOrFiniteNumber(''), true);
    assert.equal(isValidLtPartialPercent('150'), false);
    assert.equal(isValidLtPartialPercent('1,0'), false);
    assert.equal(isValidLtPartialPercent('50'), true);
  });
});

describe('strict date parsing', () => {
  it('rejects calendar rollover, hour 25, trailing junk, incomplete ranges', () => {
    assert.equal(parseStrictDisplayDateTime('31-02-2026'), null);
    assert.equal(parseStrictDisplayDateTime('01-11-2026 25:00'), null);
    assert.equal(parseStrictDisplayDateTime('01-11-2026 10:00junk'), null);
    assert.equal(parseStrictDisplayDateTime('01-11-2026 10:00')?.getHours(), 10);
    assert.equal(validateDateRangeOrder('01-11-2026 00:00', '').ok, false);
    assert.equal(validateDateRangeOrder('', '01-11-2026 00:00').ok, false);
    assert.equal(validateDateRangeOrder('02-11-2026 00:00', '01-11-2026 00:00').ok, false);
    assert.equal(validateDateRangeOrder('01-11-2026 00:00', '01-11-2026 10:00').ok, true);
  });
});

describe('centralized tanker recompute sanitize', () => {
  it('does not let stored invalid LT % inflate totals when another field changes', () => {
    const draft = baseDraft({
      activities: [{
        activity: 'A',
        start: '01-11-2026 00:00',
        end: '01-11-2026 10:00',
        duration: '10.0000',
        ltCounts: true,
        ltNoCounts: false,
        ltPartial: '150',
        notes: '',
      }],
    });
    const safe = sanitizeTankerDraftForRecompute(draft);
    assert.equal(safe.activities[0].ltPartial, '0');
    assert.equal(draft.activities[0].ltPartial, '150');

    const next = recomputeTankerPortDraft(draft, 'hours');
    // Raw invalid value preserved for Save rejection
    assert.equal(next.activities[0].ltPartial, '150');
    // Weighted actual must not use 150% (10h * 1.5 = 15)
    assert.ok(Number(next.actualLaytime) < 10.1);
  });

  it('ignores invalid rates for money while restoring raw rate text', () => {
    const draft = baseDraft({
      demurrageRate: 'nope',
      activities: [{
        activity: 'A',
        start: '01-11-2026 00:00',
        end: '01-11-2026 100:00'.replace('100', '10'),
        duration: '10.0000',
        ltCounts: true,
        ltNoCounts: false,
        ltPartial: '100',
        notes: '',
      }],
    });
    // Fix end time properly
    draft.activities[0].end = '01-11-2026 10:00';
    const next = recomputeTankerPortDraft(draft, 'hours');
    assert.equal(next.demurrageRate, 'nope');
    assert.equal(Number(next.ttlDemurrage), 0);
  });
});

describe('lt partial % and rates', () => {
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
});

describe('money display + nego gate', () => {
  it('formats calculated demurrage to two decimals', () => {
    assert.equal(formatMoneyDisplay(2666.7), '2,666.70');
    assert.equal(formatMoneyDisplay(0.75), '0.75');
    assert.equal(formatMoneyDisplay(0), '0.00');
  });

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
