import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDmyController } from './dmyDateInputController.js';
import {
  applyCommittedValue,
  formatDmy,
  parseFlexibleDate,
  toDateOnly,
} from './dmyDateInputHelpers.js';

/**
 * Drives the real controller through a Flatpickr stand-in that follows
 * flatpickr@4 semantics (verified against dist/esm/index.js):
 *  - setDate/selectDate rewrite the input to dateFormat 'd-m-Y' (date-only)
 *  - updateValue fires onValueUpdate only when triggerChange !== false
 *  - clear(false) neither rewrites via updateValue nor fires onChange
 *  - close() fires onClose and leaves the input text alone
 *  - the built-in blur handler re-parses the input via setDate(text, true)
 *    when the text differs from the date-only string, unless focus moved
 *    into the calendar
 * DmyDateInput only forwards Flatpickr hooks to the controller (plus picker
 * step bookkeeping, mirrored here), so these are the real commit/display paths.
 */
function mount({ enableTime = false, value = '', allowClear = true, controlled = true } = {}) {
  const emitted = [];
  const applyStates = [];
  let step = 'date';
  let hour = 0;
  let parentValue = value;
  let settledCount = 0;

  const fp = {
    input: { value: '', blur: () => api.blur() },
    isOpen: false,
    selectedDates: [],
    config: {},
    dateStr() {
      return this.selectedDates.map(formatDmy).join(', ');
    },
    updateValue(triggerChange) {
      this.input.value = this.dateStr();
      if (triggerChange !== false) this.config.onValueUpdate([...this.selectedDates], this.input.value, this);
    },
    clear(triggerChange = true) {
      this.input.value = '';
      this.selectedDates = [];
      if (triggerChange) this.config.onChange([], '', this);
    },
    setDate(date, triggerChange = false) {
      if (!date) {
        this.clear(triggerChange);
        return;
      }
      const parsed = typeof date === 'string'
        ? (parseFlexibleDate(date) && toDateOnly(parseFlexibleDate(date)))
        : date;
      this.selectedDates = parsed ? [parsed] : [];
      if (!parsed) this.clear(false);
      this.updateValue(triggerChange);
      if (triggerChange) this.config.onChange([...this.selectedDates], this.input.value, this);
    },
    jumpToDate() {},
    open() {
      this.isOpen = true;
      this.config.onOpen([], '', this);
    },
    close() {
      this.isOpen = false;
      this.config.onClose([...this.selectedDates], this.input.value, this);
    },
  };

  const ctrl = createDmyController({
    enableTime,
    strict24Hour: false,
    initialValue: value,
    getAllowClear: () => allowClear,
    emit: (next) => emitted.push(next),
    syncApply: () => applyStates.push(Boolean(ctrl.pendingDate)),
  });

  fp.config = {
    onOpen: (_d, _s, f) => ctrl.open(f),
    onChange: (dates, _s, f) => {
      const next = ctrl.onFlatpickrChange(f, dates, step);
      if (next) {
        hour = next.hour;
        step = 'hour';
      }
    },
    onValueUpdate: (_d, _s, f) => ctrl.onValueUpdate(f),
    onClose: (_d, _s, f) => {
      if (enableTime) step = 'date';
      ctrl.onClose(f);
    },
  };

  applyCommittedValue(fp, ctrl.value);

  /** Parent re-renders with the value it last received, like a controlled form field. */
  const settle = () => {
    if (emitted.length === settledCount) return;
    settledCount = emitted.length;
    if (!controlled) return;
    parentValue = emitted.at(-1);
    ctrl.setValue(fp, parentValue);
  };

  const api = {
    fp,
    ctrl,
    emitted,
    applyStates,
    get text() { return fp.input.value; },
    get step() { return step; },
    get committed() { return ctrl.value; },
    type(text) {
      fp.input.value = text;
      ctrl.input(fp);
      settle();
    },
    paste(text) {
      ctrl.paste(fp, text);
      settle();
    },
    blur() {
      ctrl.blur(fp);
      // Flatpickr's own handler runs after ours (our listener is registered first).
      if (!fp.isOpen && fp.input.value.trimEnd() !== fp.dateStr()) fp.setDate(fp.input.value, true);
      settle();
    },
    enter() {
      ctrl.enter(fp);
      settle();
    },
    open() {
      fp.open();
    },
    pickDay(date) {
      // selectDate: updateValue() then onChange
      fp.selectedDates = [date];
      fp.updateValue();
      fp.config.onChange([date], fp.input.value, fp);
    },
    pickHour(h) {
      hour = h;
      step = 'minute';
    },
    pickMinute(minute, fallback = new Date(2026, 2, 15)) {
      const base = new Date(ctrl.pendingDate ?? fp.selectedDates[0] ?? fallback);
      base.setHours(hour, minute, 0, 0);
      ctrl.commitPicked(fp, base);
      fp.close();
      settle();
    },
    realTimeTimed(now) {
      ctrl.commitPicked(fp, now);
      fp.close();
      settle();
    },
    realTimeDateOnly(now) {
      ctrl.selectPending(fp, toDateOnly(now));
    },
    apply() {
      if (ctrl.applyPending(fp)) fp.close();
      settle();
    },
    cancel() {
      ctrl.cancel();
      fp.close();
      settle();
    },
    clickOutside() {
      fp.close();
      settle();
    },
    setValue(next) {
      parentValue = next;
      ctrl.setValue(fp, next);
    },
  };
  return api;
}

const day = (d, m, y) => new Date(y, m - 1, d);

describe('timed input: typed and pasted timestamps', () => {
  it('keeps a typed non-midnight time through blur and Flatpickr date-only rewrite', () => {
    const c = mount({ enableTime: true });
    c.type('15-03-2026 14:30');
    assert.deepEqual(c.emitted, []);
    c.blur();
    assert.deepEqual(c.emitted, ['15-03-2026 14:30']);
    assert.equal(c.text, '15-03-2026 14:30');
    assert.equal(c.step, 'date');
  });

  it('keeps typed midnight (00:00), not date-only', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.fp.input.value = '16-03-2026 00:00';
    c.blur();
    assert.deepEqual(c.emitted, ['16-03-2026 00:00']);
    assert.equal(c.text, '16-03-2026 00:00');
  });

  it('commits Enter like blur and keeps the time', () => {
    const c = mount({ enableTime: true });
    c.fp.input.value = '15-03-2026 09:05';
    c.enter();
    assert.deepEqual(c.emitted, ['15-03-2026 09:05']);
    assert.equal(c.text, '15-03-2026 09:05');
    assert.equal(c.fp.isOpen, false);
  });

  it('paste normalizes separators, ISO order and seconds, then closes', () => {
    const c = mount({ enableTime: true });
    c.open();
    c.paste('2026-03-15 14:30:59');
    assert.deepEqual(c.emitted, ['15-03-2026 14:30']);
    assert.equal(c.text, '15-03-2026 14:30');
    assert.equal(c.fp.isOpen, false);
    c.paste('16/03/2026 00:00');
    assert.deepEqual(c.emitted, ['15-03-2026 14:30', '16-03-2026 00:00']);
    assert.equal(c.text, '16-03-2026 00:00');
  });

  it('paste of garbage restores the committed timestamp without emitting', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.paste('hello');
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026 14:30');
  });

  it('blur without edits restores HH:mm after Flatpickr rewrites to date-only and emits nothing', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.blur();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026 14:30');
  });

  it('blur on committed midnight keeps 00:00', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 00:00' });
    c.blur();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026 00:00');
  });

  it('typing only the committed day keeps the committed time; a different day commits midnight', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.fp.input.value = '15-03-2026';
    c.blur();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026 14:30');

    c.fp.input.value = '16-03-2026';
    c.blur();
    assert.deepEqual(c.emitted, ['16-03-2026 00:00']);
    assert.equal(c.text, '16-03-2026 00:00');
  });

  it('invalid typed text restores the committed timestamp', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.fp.input.value = 'next tuesday 14:30';
    c.blur();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026 14:30');
  });

  it('Flatpickr onChange while closed (blur setDate(true)) never starts the hour wizard', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.fp.setDate(day(20, 3, 2026), true);
    assert.equal(c.step, 'date');
    assert.equal(c.text, '15-03-2026 14:30');
    assert.deepEqual(c.emitted, []);
  });
});

describe('timed input: picker flow', () => {
  it('date, hour, minute commits once, closes, and shows the full timestamp', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.open();
    c.pickDay(day(16, 3, 2026));
    assert.equal(c.step, 'hour');
    // Draft day is shown while picking time; it is not committed.
    assert.equal(c.text, '16-03-2026');
    assert.equal(c.committed, '15-03-2026 14:30');
    assert.deepEqual(c.emitted, []);
    c.pickHour(9);
    c.pickMinute(5);
    assert.deepEqual(c.emitted, ['16-03-2026 09:05']);
    assert.equal(c.fp.isOpen, false);
    assert.equal(c.step, 'date');
    assert.equal(c.text, '16-03-2026 09:05');
    c.blur();
    assert.equal(c.text, '16-03-2026 09:05');
    assert.deepEqual(c.emitted, ['16-03-2026 09:05']);
  });

  it('clicking into the open calendar blurs the input without committing or restoring', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.open();
    c.fp.input.value = '16-03-2026 10:00';
    // Flatpickr's own handler skips focus moving into the calendar, so only ours could act.
    c.ctrl.blur(c.fp);
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '16-03-2026 10:00');
    assert.equal(c.committed, '15-03-2026 14:30');
  });

  it('picker-selected midnight is committed as 00:00', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.open();
    c.pickDay(day(16, 3, 2026));
    c.pickHour(0);
    c.pickMinute(0);
    assert.deepEqual(c.emitted, ['16-03-2026 00:00']);
    assert.equal(c.text, '16-03-2026 00:00');
  });

  it('opening seeds the hour from the committed value', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.open();
    c.pickDay(day(16, 3, 2026));
    assert.equal(c.step, 'hour');
    // hour draft is the committed hour until the user picks another
    c.pickMinute(45);
    assert.deepEqual(c.emitted, ['16-03-2026 14:45']);
  });

  it('abandoning the picker after date or hour keeps the committed value and emits nothing', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.open();
    c.pickDay(day(16, 3, 2026));
    c.clickOutside();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026 14:30');
    assert.equal(c.step, 'date');

    c.open();
    c.pickDay(day(17, 3, 2026));
    c.pickHour(8);
    c.cancel();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026 14:30');
    assert.equal(c.ctrl.pendingDate, null);
  });

  it('Real-time commits the current minute and closes', () => {
    const c = mount({ enableTime: true });
    c.open();
    c.realTimeTimed(new Date(2026, 5, 1, 7, 3, 0, 0));
    assert.deepEqual(c.emitted, ['01-06-2026 07:03']);
    assert.equal(c.text, '01-06-2026 07:03');
  });

  it('empty field opens without committing a value', () => {
    const c = mount({ enableTime: true });
    c.open();
    assert.equal(c.text, '');
    c.clickOutside();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '');
  });
});

describe('timed input: clearing', () => {
  it('emptying the field emits "" and stays empty after blur', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.type('');
    assert.deepEqual(c.emitted, ['']);
    assert.equal(c.text, '');
    c.blur();
    assert.deepEqual(c.emitted, ['']);
    assert.equal(c.text, '');
  });

  it('allowClear=false restores the timestamp for empty input, empty blur and empty paste', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30', allowClear: false });
    c.type('');
    assert.equal(c.text, '15-03-2026 14:30');
    c.fp.input.value = '';
    c.blur();
    assert.equal(c.text, '15-03-2026 14:30');
    c.paste('');
    assert.equal(c.text, '15-03-2026 14:30');
    assert.deepEqual(c.emitted, []);
  });

  it('1970 placeholder pasted counts as empty', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.paste('01-01-1970 00:00');
    assert.deepEqual(c.emitted, ['']);
    assert.equal(c.text, '');
  });
});

describe('timed input: controlled updates', () => {
  it('external value changes show the full timestamp, including midnight', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.setValue('20-04-2026 00:00');
    assert.equal(c.text, '20-04-2026 00:00');
    assert.equal(c.committed, '20-04-2026 00:00');
    c.blur();
    assert.equal(c.text, '20-04-2026 00:00');
    assert.deepEqual(c.emitted, []);
  });

  it('external reset to empty or the 1970 placeholder clears the field', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.setValue('');
    assert.equal(c.text, '');
    c.setValue('20-04-2026 08:15');
    c.setValue('1970-01-01 00:00:00');
    assert.equal(c.text, '');
    assert.equal(c.committed, '');
  });

  it('the parent echo of an emitted value is a no-op for display', () => {
    const c = mount({ enableTime: true });
    c.fp.input.value = '15-03-2026 14:30';
    c.blur();
    assert.deepEqual(c.emitted, ['15-03-2026 14:30']);
    assert.equal(c.text, '15-03-2026 14:30');
  });

  it('an external value applied after a typed commit wins on the next blur', () => {
    const c = mount({ enableTime: true, value: '15-03-2026 14:30' });
    c.fp.input.value = '16-03-2026 10:00';
    c.blur();
    c.setValue('17-03-2026 23:59');
    c.blur();
    assert.equal(c.text, '17-03-2026 23:59');
    assert.deepEqual(c.emitted, ['16-03-2026 10:00']);
  });
});

describe('date-only input', () => {
  it('typed and pasted dates commit as dd-mm-yyyy; any time part is dropped', () => {
    const c = mount({ value: '01-01-2026' });
    c.fp.input.value = '15-03-2026';
    c.blur();
    assert.deepEqual(c.emitted, ['15-03-2026']);
    assert.equal(c.text, '15-03-2026');

    c.paste('2026-04-02 18:45');
    assert.deepEqual(c.emitted, ['15-03-2026', '02-04-2026']);
    assert.equal(c.text, '02-04-2026');
  });

  it('selecting a day keeps the committed text until Apply', () => {
    const c = mount({ value: '15-03-2026' });
    c.open();
    assert.equal(c.applyStates.at(-1), true, 'committed day is pending on open');
    c.pickDay(day(20, 3, 2026));
    assert.equal(c.text, '15-03-2026');
    assert.deepEqual(c.emitted, []);
    c.apply();
    assert.deepEqual(c.emitted, ['20-03-2026']);
    assert.equal(c.text, '20-03-2026');
    assert.equal(c.fp.isOpen, false);
    assert.equal(c.ctrl.pendingDate.getDate(), 20, 'Apply keeps the applied day pending, not discarded');
  });

  it('Apply is disabled until a day is pending and Apply does nothing without one', () => {
    const c = mount();
    c.open();
    assert.equal(c.applyStates.at(-1), false);
    c.apply();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.fp.isOpen, true);
    c.pickDay(day(20, 3, 2026));
    assert.equal(c.applyStates.at(-1), true);
  });

  it('Cancel and click-outside discard the pending day and restore the text', () => {
    const c = mount({ value: '15-03-2026' });
    c.open();
    c.pickDay(day(20, 3, 2026));
    c.cancel();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026');
    assert.equal(c.ctrl.pendingDate, null);
    assert.equal(c.applyStates.at(-1), false);

    c.open();
    c.pickDay(day(21, 3, 2026));
    c.clickOutside();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026');
  });

  it('Cancel after an earlier Apply does not reuse the stale Apply flag', () => {
    const c = mount({ value: '15-03-2026' });
    c.open();
    c.pickDay(day(20, 3, 2026));
    c.apply();
    c.open();
    c.pickDay(day(25, 3, 2026));
    c.cancel();
    assert.deepEqual(c.emitted, ['20-03-2026']);
    assert.equal(c.text, '20-03-2026');
  });

  it('Real-time selects today for Apply without committing', () => {
    const c = mount({ value: '15-03-2026' });
    c.open();
    c.realTimeDateOnly(new Date(2026, 5, 1, 13, 20));
    assert.equal(c.text, '15-03-2026');
    assert.deepEqual(c.emitted, []);
    c.apply();
    assert.deepEqual(c.emitted, ['01-06-2026']);
    assert.equal(c.text, '01-06-2026');
  });

  it('clearing emits "" and blur keeps it empty; allowClear=false restores', () => {
    const c = mount({ value: '15-03-2026' });
    c.type('');
    assert.deepEqual(c.emitted, ['']);
    assert.equal(c.text, '');
    c.blur();
    assert.equal(c.text, '');

    const locked = mount({ value: '15-03-2026', allowClear: false });
    locked.type('');
    assert.equal(locked.text, '15-03-2026');
    locked.fp.input.value = '';
    locked.blur();
    assert.equal(locked.text, '15-03-2026');
    assert.deepEqual(locked.emitted, []);
  });

  it('invalid typed text restores the committed date', () => {
    const c = mount({ value: '15-03-2026' });
    c.fp.input.value = 'tomorrow';
    c.blur();
    assert.deepEqual(c.emitted, []);
    assert.equal(c.text, '15-03-2026');
  });

  it('controlled updates replace the text, ignore the 1970 placeholder, and survive blur', () => {
    const c = mount({ value: '15-03-2026' });
    c.setValue('20-04-2026');
    assert.equal(c.text, '20-04-2026');
    c.blur();
    assert.equal(c.text, '20-04-2026');
    c.setValue('01-01-1970');
    assert.equal(c.text, '');
    assert.deepEqual(c.emitted, []);
  });

  it('reopening after Apply seeds the picker from the applied value', () => {
    const c = mount();
    c.open();
    c.pickDay(day(20, 3, 2026));
    c.apply();
    c.open();
    assert.equal(formatDmy(c.fp.selectedDates[0]), '20-03-2026');
    assert.equal(c.text, '20-03-2026');
  });
});
