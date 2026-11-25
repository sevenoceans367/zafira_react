import {
  applyCommittedValue,
  formatDmy,
  formatDmyTime,
  parseFlexibleDate,
  resolveTypedCommit,
  sanitizeValue,
  toDateOnly,
} from './dmyDateInputHelpers.js';

/**
 * Commit/display state machine behind DmyDateInput. Owns the committed string,
 * the pending calendar day and the "ignore Flatpickr-originated onChange" guard.
 * DmyDateInput wires Flatpickr hooks to these methods and keeps only DOM work
 * (picker steps, highlights, footer buttons) itself.
 *
 * @param {object} options
 * @param {boolean} options.enableTime
 * @param {boolean} options.strict24Hour
 * @param {string} options.initialValue
 * @param {() => boolean} options.getAllowClear
 * @param {(value: string) => void} options.emit Called with every committed string ('' on clear).
 * @param {(fp: object) => void} [options.syncApply] Called when pendingDate changes (Apply button state).
 */
export function createDmyController({
  enableTime,
  strict24Hour,
  initialValue,
  getAllowClear,
  emit,
  syncApply = () => {},
}) {
  let value = sanitizeValue(initialValue);
  let pendingDate = null;
  let suppressChange = false;
  let appliedViaFooter = false;

  const quietly = (fn) => {
    suppressChange = true;
    try {
      fn();
    } finally {
      suppressChange = false;
    }
  };

  const restoreDisplay = (fp) => {
    if (fp.input) fp.input.value = value;
  };

  const commitDate = (fp, date) => {
    const str = enableTime ? formatDmyTime(date) : formatDmy(date);
    if (!str) return;
    quietly(() => fp.setDate(toDateOnly(date), false));
    if (fp.input) fp.input.value = str;
    // Blur/Enter re-commit the same text; only notify the parent on a real change.
    if (str === value) return;
    value = str;
    emit(str);
  };

  const clear = (fp) => {
    if (!getAllowClear() && value) {
      applyCommittedValue(fp, value, strict24Hour);
      return;
    }
    quietly(() => fp.clear(false));
    if (fp.input) fp.input.value = '';
    const changed = value !== '';
    value = '';
    pendingDate = null;
    if (changed) emit('');
    syncApply(fp);
  };

  const commitRaw = (fp, raw) => {
    const decision = resolveTypedCommit(raw, {
      committed: value,
      enableTime,
      allowClear: getAllowClear(),
      strict24Hour,
    });
    if (decision.kind === 'restore') {
      applyCommittedValue(fp, decision.value, strict24Hour);
      return;
    }
    if (decision.kind === 'clear') {
      clear(fp);
      return;
    }
    const parsed = parseFlexibleDate(decision.value, strict24Hour);
    if (!parsed) {
      applyCommittedValue(fp, value, strict24Hour);
      return;
    }
    commitDate(fp, parsed);
  };

  return {
    get value() {
      return value;
    },
    get pendingDate() {
      return pendingDate;
    },
    clear,
    commitRaw,

    /** Timed picker's final step (minute or Real-time): commit, caller closes. */
    commitPicked(fp, date) {
      commitDate(fp, date);
      pendingDate = null;
    },

    paste(fp, text) {
      commitRaw(fp, text);
      fp.close();
    },

    /** Native input event: only an emptied field is a commit (clear). */
    input(fp) {
      if (fp.isOpen) return;
      if (!sanitizeValue(fp.input?.value ?? '')) clear(fp);
    },

    /**
     * Native blur. Clicking a calendar day blurs the input first, so never
     * commit/restore while open. Flatpickr's own blur handler runs after this
     * and may rewrite the input to date-only; commitRaw restores HH:mm.
     */
    blur(fp) {
      if (fp.isOpen) return;
      commitRaw(fp, fp.input?.value ?? '');
    },

    enter(fp) {
      commitRaw(fp, fp.input?.value ?? '');
      fp.close();
      fp.input?.blur();
    },

    /** Controlled `value` prop changed. */
    setValue(fp, next) {
      value = sanitizeValue(next);
      applyCommittedValue(fp, value, strict24Hour);
    },

    /** Flatpickr onOpen. Returns the committed Date (with time) or null. */
    open(fp) {
      appliedViaFooter = false;
      const committed = parseFlexibleDate(value, strict24Hour);
      pendingDate = committed ? toDateOnly(committed) : null;
      quietly(() => {
        if (pendingDate) {
          fp.setDate(pendingDate, false);
          fp.jumpToDate(pendingDate, false);
        } else {
          fp.clear(false);
        }
      });
      restoreDisplay(fp);
      syncApply(fp);
      return committed;
    },

    /** Date-only "Real-time": select a day, commit on Apply. */
    selectPending(fp, date) {
      pendingDate = date;
      quietly(() => fp.setDate(date, false));
      restoreDisplay(fp);
      syncApply(fp);
    },

    /** Date-only Apply. Returns false when nothing is pending. */
    applyPending(fp) {
      if (!pendingDate) return false;
      appliedViaFooter = true;
      commitDate(fp, pendingDate);
      return true;
    },

    cancel() {
      appliedViaFooter = false;
    },

    /**
     * Flatpickr onChange. Returns `{ hour }` when a timed picker should move
     * from the date step to the hour step, otherwise null.
     */
    onFlatpickrChange(fp, selectedDates, step) {
      if (suppressChange) return null;
      // Flatpickr blur may call setDate(true) while closed; never start the
      // hour/minute wizard from that path — only restore the timed display.
      if (enableTime && !fp.isOpen) {
        restoreDisplay(fp);
        return null;
      }
      if (!selectedDates?.length) {
        if (!enableTime) {
          pendingDate = null;
          restoreDisplay(fp);
          syncApply(fp);
        }
        return null;
      }

      const dateOnly = toDateOnly(selectedDates[0]);
      pendingDate = dateOnly;

      if (!enableTime) {
        // Select only — commit on Apply (keep input on last committed value).
        restoreDisplay(fp);
        syncApply(fp);
        return null;
      }

      if (step !== 'date') return null;
      const committed = parseFlexibleDate(value, strict24Hour);
      quietly(() => fp.setDate(dateOnly, false));
      return { hour: committed?.getHours?.() ?? 0 };
    },

    /** Flatpickr dateFormat is date-only; re-apply the timed string after its rewrites. */
    onValueUpdate(fp) {
      if (enableTime) restoreDisplay(fp);
    },

    /** Flatpickr onClose. Discards drafts: hour-only, cancel, click-outside. */
    onClose(fp) {
      if (enableTime) {
        pendingDate = null;
        applyCommittedValue(fp, value, strict24Hour);
        return;
      }
      if (appliedViaFooter) {
        appliedViaFooter = false;
        const committed = parseFlexibleDate(value, strict24Hour);
        pendingDate = committed ? toDateOnly(committed) : null;
        return;
      }
      pendingDate = null;
      applyCommittedValue(fp, value, strict24Hour);
      syncApply(fp);
    },
  };
}
