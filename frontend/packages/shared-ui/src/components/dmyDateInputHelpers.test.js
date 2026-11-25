import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCommittedValue,
  formatDmy,
  formatDmyTime,
  parseFlexibleDate,
  resolveTypedCommit,
  sanitizeValue,
} from './dmyDateInputHelpers.js';

function mockFp(initial = '') {
  const input = { value: initial };
  return {
    input,
    selected: null,
    clear(triggerChange) {
      assert.equal(triggerChange, false);
      this.selected = null;
      input.value = '';
    },
    setDate(date, triggerChange) {
      assert.equal(triggerChange, false);
      this.selected = date;
      // Flatpickr dateFormat 'd-m-Y' would rewrite the input to date-only.
      input.value = formatDmy(date);
    },
  };
}

describe('sanitizeValue', () => {
  it('strips epoch placeholders', () => {
    assert.equal(sanitizeValue('01-01-1970'), '');
    assert.equal(sanitizeValue('1970-01-01 00:00:00'), '');
    assert.equal(sanitizeValue('15-03-2026 14:30'), '15-03-2026 14:30');
  });
});

describe('formatDmyTime / parseFlexibleDate', () => {
  it('preserves midnight 00:00', () => {
    const dt = parseFlexibleDate('15-03-2026 00:00');
    assert.ok(dt);
    assert.equal(dt.getHours(), 0);
    assert.equal(dt.getMinutes(), 0);
    assert.equal(formatDmyTime(dt), '15-03-2026 00:00');
  });

  it('round-trips timed and date-only strings', () => {
    assert.equal(formatDmyTime(parseFlexibleDate('01-02-2026 09:05')), '01-02-2026 09:05');
    assert.equal(formatDmy(parseFlexibleDate('01-02-2026')), '01-02-2026');
  });
});

describe('resolveTypedCommit enableTime blur', () => {
  it('keeps HH:mm when Flatpickr leaves date-only matching committed day', () => {
    const result = resolveTypedCommit('15-03-2026', {
      committed: '15-03-2026 14:30',
      enableTime: true,
    });
    assert.deepEqual(result, { kind: 'restore', value: '15-03-2026 14:30' });
  });

  it('commits explicit typed time including midnight', () => {
    assert.deepEqual(
      resolveTypedCommit('15-03-2026 00:00', {
        committed: '15-03-2026 14:30',
        enableTime: true,
      }),
      { kind: 'commit', value: '15-03-2026 00:00' },
    );
    assert.deepEqual(
      resolveTypedCommit('16-03-2026 18:45', {
        committed: '15-03-2026 14:30',
        enableTime: true,
      }),
      { kind: 'commit', value: '16-03-2026 18:45' },
    );
  });

  it('commits date-only on a different day as midnight', () => {
    assert.deepEqual(
      resolveTypedCommit('16-03-2026', {
        committed: '15-03-2026 14:30',
        enableTime: true,
      }),
      { kind: 'commit', value: '16-03-2026 00:00' },
    );
  });

  it('leaves date-only fields without HH:mm', () => {
    assert.deepEqual(
      resolveTypedCommit('15-03-2026', {
        committed: '01-01-2026',
        enableTime: false,
      }),
      { kind: 'commit', value: '15-03-2026' },
    );
  });

  it('restores committed on invalid input', () => {
    assert.deepEqual(
      resolveTypedCommit('not-a-date', {
        committed: '15-03-2026 14:30',
        enableTime: true,
      }),
      { kind: 'restore', value: '15-03-2026 14:30' },
    );
  });

  it('clears empty when allowed; restores when clear disallowed', () => {
    assert.deepEqual(
      resolveTypedCommit('', { committed: '15-03-2026 14:30', enableTime: true, allowClear: true }),
      { kind: 'clear', value: '' },
    );
    assert.deepEqual(
      resolveTypedCommit('', { committed: '15-03-2026 14:30', enableTime: true, allowClear: false }),
      { kind: 'restore', value: '15-03-2026 14:30' },
    );
  });
});

describe('applyCommittedValue', () => {
  it('keeps timed input text after Flatpickr date-only setDate', () => {
    const fp = mockFp();
    applyCommittedValue(fp, '15-03-2026 14:30');
    assert.equal(fp.input.value, '15-03-2026 14:30');
    assert.equal(formatDmy(fp.selected), '15-03-2026');
  });

  it('preserves midnight in the input string', () => {
    const fp = mockFp();
    applyCommittedValue(fp, '15-03-2026 00:00');
    assert.equal(fp.input.value, '15-03-2026 00:00');
  });
});
