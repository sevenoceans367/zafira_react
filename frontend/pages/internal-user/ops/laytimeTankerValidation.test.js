import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  durationFromStrictDates,
  hoursBetweenStrict,
  isBlankOrFiniteNumber,
  isValidLtPartialPercent,
  parseStrictDecimal,
  parseStrictDisplayDateTime,
  recomputeTankerPortDraft,
  tankerCalcInputsValid,
  validateDateRangeOrder,
  validateNamedEntityDates,
  validateTankerLaytimeDraft,
} from './laytimeTankerValidation.js';
import { formatMoneyDisplay } from './laytimeTankerHelpers.js';

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

  it('allows blank named entity dates; rejects malformed on save', () => {
    assert.equal(validateNamedEntityDates([{ name: 'All Clear', value: '' }]).ok, true);
    assert.equal(validateNamedEntityDates([{ name: 'All Clear', value: '31-02-2026 08:00' }]).ok, false);
    const bad = validateTankerLaytimeDraft(baseDraft({
      entityRows: [{ name: 'Laytime Ends', value: '01-11-2026 25:00' }],
    }));
    assert.equal(bad.ok, false);
    assert.equal(bad.field, 'laytimeEnds');
  });

  it('rejects duplicate alias junk and conflicting valid values', () => {
    assert.equal(validateNamedEntityDates([
      { name: 'All Clear', value: '01-11-2026 08:00' },
      { name: 'allclear', value: '01-11-2026 08:00 junk' },
    ]).ok, false);
    assert.equal(validateNamedEntityDates([
      { name: 'All Clear', value: '01-11-2026 08:00' },
      { name: 'allclear', value: '02-11-2026 08:00' },
    ]).ok, false);
    assert.equal(validateNamedEntityDates([
      { name: 'All Clear', value: '01-11-2026 08:00' },
      { name: 'allclear', value: '1-11-2026 8:0' },
    ]).ok, true);
    assert.equal(validateNamedEntityDates([
      { name: 'All Clear', value: '01-11-2026 08:00' },
      { name: 'allclear', value: '' },
    ]).ok, false);
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

describe('centralized tanker recompute — unavailable when invalid', () => {
  it('marks calculations unavailable for invalid LT % (no fake $0 financials)', () => {
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
      deductions: [{
        activity: 'D',
        start: '01-11-2026 00:00',
        end: '01-11-2026 01:00',
        duration: '1.0000',
        ltPartial: '100',
        notes: '',
      }],
    });
    assert.equal(tankerCalcInputsValid(draft).ok, false);
    const next = recomputeTankerPortDraft(draft, 'hours');
    assert.equal(next.calcUnavailable, true);
    assert.equal(next.activities[0].ltPartial, '150');
    assert.equal(next.actualLaytime, '');
    assert.equal(next.ttlDemurrage, '');
    assert.equal(next.timeToDemurrage, '');
    // Duration still refreshes from strict dates
    assert.equal(next.activities[0].duration, '10.0000');
    assert.equal(next.activities[0].cumulative, '');
  });

  it('restores authoritative totals after correcting invalid A then editing valid B', () => {
    const invalid = baseDraft({
      activities: [{
        activity: 'A',
        start: '01-11-2026 00:00',
        end: '01-11-2026 12:00',
        duration: '12.0000',
        ltCounts: true,
        ltNoCounts: false,
        ltPartial: '150',
        notes: '',
      }],
    });
    const blocked = recomputeTankerPortDraft(invalid, 'hours');
    assert.equal(blocked.calcUnavailable, true);
    assert.equal(blocked.actualLaytime, '');

    const fixed = recomputeTankerPortDraft({
      ...invalid,
      activities: [{ ...invalid.activities[0], ltPartial: '100' }],
    }, 'hours');
    assert.equal(fixed.calcUnavailable, false);
    assert.equal(fixed.activities[0].duration, '12.0000');
    assert.equal(Number(fixed.actualLaytime), 12);

    const afterOtherEdit = recomputeTankerPortDraft({
      ...fixed,
      demurrageRate: '24000',
    }, 'hours');
    assert.equal(afterOtherEdit.calcUnavailable, false);
    assert.equal(Number(afterOtherEdit.actualLaytime), 12);
  });

  it('marks unavailable for invalid rates (no silent zero money)', () => {
    const draft = baseDraft({
      demurrageRate: 'nope',
      activities: [{
        activity: 'A',
        start: '01-11-2026 00:00',
        end: '01-11-2026 10:00',
        duration: '10.0000',
        ltCounts: true,
        ltNoCounts: false,
        ltPartial: '100',
        notes: '',
      }],
    });
    const next = recomputeTankerPortDraft(draft, 'hours');
    assert.equal(next.demurrageRate, 'nope');
    assert.equal(next.calcUnavailable, true);
    assert.equal(next.ttlDemurrage, '');
  });

  it('hoursBetweenStrict matches 00:00–12:00 → 12h', () => {
    assert.equal(hoursBetweenStrict('01-11-2026 00:00', '01-11-2026 12:00'), 12);
  });

  it('clears stale/negative duration when dates missing, unparseable, or reversed', () => {
    assert.equal(durationFromStrictDates({
      start: '', end: '', duration: '10.0000',
    }), '');
    assert.equal(durationFromStrictDates({
      start: '01-11-2026 00:00', end: '31-02-2026 12:00', duration: '10.0000',
    }), '');
    assert.equal(durationFromStrictDates({
      start: '01-11-2026 12:00', end: '01-11-2026 00:00', duration: '12.0000',
    }), '');
    assert.equal(durationFromStrictDates({
      start: '01-11-2026 00:00', end: '01-11-2026 12:00', duration: '10.0000',
    }), '12.0000');
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

it('formats calculated demurrage to two decimals', () => {
  assert.equal(formatMoneyDisplay(2666.7), '2,666.70');
  assert.equal(formatMoneyDisplay(0.75), '0.75');
  assert.equal(formatMoneyDisplay(0), '0.00');
});
